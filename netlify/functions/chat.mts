import type { Config } from "@netlify/functions";
import { listChatMessages, listCollection, markChannelRead, upsertRecord } from "../../db/store.js";

function normalizeMessage(m: any) {
  const now = new Date();
  return {
    ...m,
    id: m.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: m.timestamp || now.toISOString(),
    timeFormatted:
      m.timeFormatted ||
      now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB",
    priority: m.priority || "NORMAL",
    readBy: Array.isArray(m.readBy) ? m.readBy : [m.senderId].filter(Boolean),
    createdAt: m.createdAt || now.toISOString(),
  };
}

export default async (req: Request) => {
  try {
    const { pathname } = new URL(req.url);

    if (pathname === "/api/chat/database" && req.method === "GET") {
      const [channels, messages] = await Promise.all([listCollection("chatChannels"), listChatMessages()]);
      return Response.json({
        ok: true,
        channels,
        messages,
        count: { channels: channels.length, messages: messages.length },
        timestamp: Date.now(),
      });
    }

    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const body = await req.json().catch(() => ({}));

    if (pathname === "/api/chat/messages") {
      const m = body?.message;
      if (!m?.channelId || !m?.message) {
        return Response.json({ ok: false, error: "Pesan tidak lengkap" }, { status: 400 });
      }
      const msg = normalizeMessage(m);
      await upsertRecord("chatMessages", msg);
      if (body.channel?.id) await upsertRecord("chatChannels", body.channel);
      return Response.json({ ok: true, message: msg });
    }

    if (pathname === "/api/chat/channels") {
      if (!body?.channel?.id) return Response.json({ ok: false, error: "Channel tidak valid" }, { status: 400 });
      await upsertRecord("chatChannels", body.channel);
      return Response.json({ ok: true, channel: body.channel });
    }

    if (pathname === "/api/chat/mark-read") {
      if (!body?.channelId || !body?.userId) {
        return Response.json({ ok: false, error: "channelId dan userId wajib diisi" }, { status: 400 });
      }
      await markChannelRead(String(body.channelId), String(body.userId));
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  } catch (err: any) {
    console.error("Chat error:", err);
    return Response.json({ ok: false, error: err?.message || "Chat error" }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/chat/database", "/api/chat/messages", "/api/chat/channels", "/api/chat/mark-read"],
};
