import { pgTable, text, jsonb, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

// Satu baris per entitas aplikasi (gedung, kamar, transaksi, pengguna, chat, dll).
// `collection` berisi nama koleksi seperti di aplikasi (mis. "rooms", "transactions").
export const records = pgTable(
  "records",
  {
    collection: text().notNull(),
    id: text().notNull(),
    data: jsonb().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.collection, t.id] }), index("records_collection_idx").on(t.collection)],
);

// Pengaturan global aplikasi (key-value), mis. "appSettings".
export const appState = pgTable("app_state", {
  key: text().primaryKey(),
  value: jsonb(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Status online pengguna (heartbeat).
export const presences = pgTable("presences", {
  userId: text("user_id").primaryKey(),
  data: jsonb().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});
