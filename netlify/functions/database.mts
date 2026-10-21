import type { Config } from "@netlify/functions";
import { COLLECTIONS, listCollection, loadDatabase, saveDatabase, type CollectionName } from "../../db/store.js";

// Pengganti endpoint /api/sheets/database dari server Express: baca & simpan seluruh database aplikasi.
export default async (req: Request) => {
  try {
    if (req.method === "GET") {
      const sheet = new URL(req.url).searchParams.get("sheet");
      if (sheet) {
        const normalize = (s: string) => s.replace(/_/g, "").toLowerCase();
        const match = COLLECTIONS.find((c) => normalize(c) === normalize(sheet));
        if (!match) return Response.json({ status: "error", message: `Koleksi "${sheet}" tidak dikenal`, data: [] }, { status: 404 });
        const data = await listCollection(match as CollectionName);
        return Response.json({ status: "success", source: "netlify_database", data });
      }

      const data = await loadDatabase();
      return Response.json({
        status: "success",
        source: "netlify_database",
        data,
        updatedAt: new Date().toISOString(),
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const payload = body?.data && typeof body.data === "object" ? body.data : body;
      if (!payload || typeof payload !== "object") {
        return Response.json({ status: "error", message: "Payload database tidak valid" }, { status: 400 });
      }

      await saveDatabase(payload);
      return Response.json({
        status: "success",
        message: "Database berhasil disimpan",
        syncResult: { synced: true, message: "Disimpan di Netlify Database" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err: any) {
    console.error("Database error:", err);
    return Response.json({ status: "error", message: err?.message || "Gagal mengakses database" }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/sheets/database", "/api/database"],
};
