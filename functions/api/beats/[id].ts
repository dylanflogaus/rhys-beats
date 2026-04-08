import type { PagesFunction } from "@cloudflare/workers-types";
import { Env, jsonError } from "../../lib/beat-api";

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "DELETE") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const idParam = context.params.id;
  const beatId = Number(idParam);
  if (!idParam || Number.isNaN(beatId)) {
    return jsonError("Invalid beat id.", 400);
  }

  try {
    const row = await context.env.DB.prepare(
      "SELECT id, r2_key FROM beats WHERE id = ?"
    )
      .bind(beatId)
      .first<{ id: number; r2_key: string }>();

    if (!row) {
      return jsonError("Beat not found.", 404);
    }

    await context.env.DB.prepare("DELETE FROM beats WHERE id = ?")
      .bind(beatId)
      .run();

    await context.env.BEATS_KV.delete(row.r2_key).catch(() => {});

    return new Response(null, { status: 204 });
  } catch {
    return jsonError("Failed to delete beat.", 500);
  }
};
