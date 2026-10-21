import { and, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "./index.js";
import { appState, presences, records } from "./schema.js";
import seedDatabase from "../data/database.json" with { type: "json" };

// Koleksi data aplikasi yang disimpan sebagai baris di tabel `records`.
export const COLLECTIONS = [
  "users",
  "buildings",
  "meetingRooms",
  "rooms",
  "transactions",
  "maintenances",
  "qcInspections",
  "workSessions",
  "auditLogs",
  "chatChannels",
  "chatMessages",
  "breakfastMenuItems",
  "breakfastOrders",
  "roomCapacityRates",
  "passwordResetRequests",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

// Koleksi yang juga ditulis langsung oleh event realtime dari banyak perangkat.
// Penyimpanan penuh hanya menambah/memperbarui baris agar data perangkat lain tidak terhapus.
const APPEND_ONLY: ReadonlySet<string> = new Set(["workSessions", "auditLogs", "chatChannels", "chatMessages"]);

// Data master yang tidak boleh dikosongkan oleh satu penyimpanan (mencegah data hilang akibat cache klien kosong).
const PROTECTED_FROM_EMPTY: ReadonlySet<string> = new Set([
  "users",
  "buildings",
  "rooms",
  "meetingRooms",
  "roomCapacityRates",
  "breakfastMenuItems",
]);

const PRESENCE_TTL_MS = 60_000;
const CHUNK_SIZE = 200;

type Row = { id: string; [key: string]: unknown };

function toRows(list: unknown): Row[] {
  if (!Array.isArray(list)) return [];
  const byId = new Map<string, Row>();
  for (const item of list) {
    if (item && typeof item === "object" && (item as any).id != null && (item as any).id !== "") {
      const id = String((item as any).id);
      byId.set(id, { ...(item as any), id });
    }
  }
  return Array.from(byId.values());
}

async function upsertRows(tx: any, collection: string, rows: Row[]) {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await tx
      .insert(records)
      .values(chunk.map((r) => ({ collection, id: r.id, data: r, updatedAt: new Date() })))
      .onConflictDoUpdate({
        target: [records.collection, records.id],
        set: { data: sql`excluded.data`, updatedAt: sql`now()` },
      });
  }
}

export async function upsertRecord(collection: CollectionName, row: Row) {
  await upsertRows(db, collection, toRows([row]));
}

export async function listCollection(collection: CollectionName): Promise<any[]> {
  const rows = await db.select({ data: records.data }).from(records).where(eq(records.collection, collection));
  return rows.map((r) => r.data);
}

async function isEmpty(): Promise<boolean> {
  const rows = await db.select({ id: records.id }).from(records).limit(1);
  return rows.length === 0;
}

// Mengisi database baru dengan data awal aplikasi (gedung, kamar, pengguna, katalog).
async function seedIfEmpty() {
  if (!(await isEmpty())) return;
  await saveDatabase(seedDatabase as Record<string, unknown>, { allowEmpty: true });
}

export async function loadDatabase(): Promise<Record<string, unknown>> {
  await seedIfEmpty();

  const [rows, settings] = await Promise.all([
    db.select({ collection: records.collection, data: records.data }).from(records),
    db.select().from(appState).where(eq(appState.key, "appSettings")),
  ]);

  const result: Record<string, unknown> = {
    schemaVersion: (seedDatabase as any).schemaVersion ?? 4,
    appName: (seedDatabase as any).appName ?? "SIM-Akomodasi UPT Asrama Haji Jakarta",
    exportedAt: new Date().toISOString(),
    appSettings: settings[0]?.value ?? null,
  };
  for (const c of COLLECTIONS) result[c] = [];
  for (const r of rows) {
    const list = result[r.collection];
    if (Array.isArray(list)) list.push(r.data);
  }
  return result;
}

export async function saveDatabase(payload: Record<string, unknown>, opts: { allowEmpty?: boolean } = {}) {
  await db.transaction(async (tx: any) => {
    for (const collection of COLLECTIONS) {
      if (!(collection in payload) || !Array.isArray(payload[collection])) continue;
      const rows = toRows(payload[collection]);

      if (!APPEND_ONLY.has(collection)) {
        if (rows.length === 0 && PROTECTED_FROM_EMPTY.has(collection) && !opts.allowEmpty) continue;
        const ids = rows.map((r) => r.id);
        await tx
          .delete(records)
          .where(
            ids.length > 0
              ? and(eq(records.collection, collection), notInArray(records.id, ids))
              : eq(records.collection, collection),
          );
      }
      await upsertRows(tx, collection, rows);
    }

    if (payload.appSettings && typeof payload.appSettings === "object") {
      await tx
        .insert(appState)
        .values({ key: "appSettings", value: payload.appSettings, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appState.key, set: { value: payload.appSettings, updatedAt: sql`now()` } });
    }
  });
}

export async function deleteRecords(collection: CollectionName, ids?: string[]) {
  await db
    .delete(records)
    .where(
      ids ? and(eq(records.collection, collection), inArray(records.id, ids)) : eq(records.collection, collection),
    );
}

export async function deleteChatMessages(channelId?: string) {
  await db
    .delete(records)
    .where(
      channelId
        ? and(eq(records.collection, "chatMessages"), sql`${records.data}->>'channelId' = ${channelId}`)
        : eq(records.collection, "chatMessages"),
    );
}

export async function markChannelRead(channelId: string, userId: string) {
  await db.execute(sql`
    UPDATE records
    SET data = jsonb_set(data, '{readBy}', COALESCE(data->'readBy', '[]'::jsonb) || to_jsonb(${userId}::text)),
        updated_at = now()
    WHERE collection = 'chatMessages'
      AND data->>'channelId' = ${channelId}
      AND NOT jsonb_exists(COALESCE(data->'readBy', '[]'::jsonb), ${userId}::text)
  `);
}

export async function listChatMessages(limit = 1000): Promise<any[]> {
  const rows = await db.execute(sql`
    SELECT data FROM (
      SELECT data, updated_at FROM records
      WHERE collection = 'chatMessages'
      ORDER BY COALESCE(data->>'timestamp', data->>'createdAt', updated_at::text) DESC
      LIMIT ${limit}
    ) recent
    ORDER BY COALESCE(data->>'timestamp', data->>'createdAt', updated_at::text) ASC
  `);
  const list: any[] = Array.isArray(rows) ? rows : ((rows as any).rows ?? []);
  return list.map((r) => r.data);
}

export async function touchPresence(userId: string, data: Record<string, unknown>) {
  const value = { ...data, userId };
  await db
    .insert(presences)
    .values({ userId, data: value, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: presences.userId,
      set: { data: sql`${presences.data} || excluded.data`, lastSeenAt: sql`now()` },
    });
}

export async function removePresence(userId: string) {
  await db.delete(presences).where(eq(presences.userId, userId));
}

export async function listActivePresences(): Promise<any[]> {
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);
  const rows = await db.select().from(presences).where(gt(presences.lastSeenAt, cutoff));
  return rows.map((r) => ({ ...(r.data as object), lastSeenMs: r.lastSeenAt.getTime() }));
}
