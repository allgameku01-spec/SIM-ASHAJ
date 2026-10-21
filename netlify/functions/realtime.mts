import type { Config } from "@netlify/functions";
import {
  deleteChatMessages,
  deleteRecords,
  listActivePresences,
  listChatMessages,
  listCollection,
  markChannelRead,
  removePresence,
  touchPresence,
  upsertRecord,
} from "../../db/store.js";

// Pengganti hub realtime Express: status online, sesi kerja, dan chat disimpan di database
// dan dibaca klien melalui polling /api/realtime/state.
async function handleEvent(req: Request) {
  const body = await req.json().catch(() => null);
  const { type, payload, clientId } = body || {};
  if (!type) return Response.json({ error: "Missing event type" }, { status: 400 });

  switch (type) {
    case "presence:heartbeat":
      if (payload?.userId) {
        await touchPresence(String(payload.userId), { ...payload, clientId: clientId || payload.clientId || "default" });
      }
      break;
    case "presence:leave":
    case "presence:logout":
      if (payload?.userId) await removePresence(String(payload.userId));
      break;
    case "session:upsert":
      if (payload?.id) {
        const { closeOtherUserSessions: _ignored, ...session } = payload;
        await upsertRecord("workSessions", session);
      }
      break;
    case "session:clear":
      await deleteRecords("workSessions");
      break;
    case "chat:message":
      if (payload?.message?.id) {
        await upsertRecord("chatMessages", payload.message);
        if (payload.channel?.id) await upsertRecord("chatChannels", payload.channel);
      }
      break;
    case "chat:channel":
      if (payload?.id) await upsertRecord("chatChannels", payload);
      break;
    case "chat:read":
      if (payload?.channelId && payload?.userId) {
        await markChannelRead(String(payload.channelId), String(payload.userId));
      }
      break;
    case "chat:clear":
      await deleteChatMessages(payload?.channelId ? String(payload.channelId) : undefined);
      break;
  }

  return Response.json({ ok: true });
}

async function getState() {
  const [presences, workSessions, chatChannels, chatMessages] = await Promise.all([
    listActivePresences(),
    listCollection("workSessions"),
    listCollection("chatChannels"),
    listChatMessages(),
  ]);
  workSessions.sort((a, b) => String(b?.loginTime || "").localeCompare(String(a?.loginTime || "")));
  return Response.json(
    { ok: true, presences, workSessions, chatChannels, chatMessages, timestamp: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export default async (req: Request) => {
  try {
    const { pathname } = new URL(req.url);
    if (pathname.endsWith("/event") && req.method === "POST") return await handleEvent(req);
    if (pathname.endsWith("/state") && req.method === "GET") return await getState();
    return new Response("Not found", { status: 404 });
  } catch (err: any) {
    console.error("Realtime error:", err);
    return Response.json({ ok: false, error: err?.message || "Realtime error" }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/realtime/event", "/api/realtime/state"],
};
