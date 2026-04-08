import type { PagesFunction } from "@cloudflare/workers-types";
import { type Env, jsonError } from "../../lib/shared";

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (request.method !== "DELETE") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const beatId = Number(params.id);
  if (Number.isNaN(beatId)) {
    return jsonError("Invalid beat id.", 400);
  }

  try {
    const row = await env.DB.prepare("SELECT r2_key FROM beats WHERE id = ?")
      .bind(beatId)
      .first<{ r2_key: string }>();

    if (!row) {
      return jsonError("Beat not found.", 404);
    }

    await env.DB.prepare("DELETE FROM beats WHERE id = ?").bind(beatId).run();
    await env.BEATS_KV.delete(row.r2_key);

    return new Response(null, { status: 204 });
  } catch {
    return jsonError("Failed to delete beat.", 500);
  }
};
