import type { PagesFunction } from "@cloudflare/workers-types";
import { type Env, jsonError } from "../../../lib/shared";

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const beatId = Number(params.id);
  if (Number.isNaN(beatId)) {
    return jsonError("Invalid beat id.", 400);
  }

  try {
    const row = await env.DB.prepare("SELECT r2_key, mime_type FROM beats WHERE id = ?")
      .bind(beatId)
      .first<{ r2_key: string; mime_type: string }>();

    if (!row) {
      return jsonError("Beat not found.", 404);
    }

    const data = await env.BEATS_KV.get(row.r2_key, { type: "arrayBuffer" });
    if (!data) {
      return jsonError("File missing.", 404);
    }

    return new Response(data, {
      headers: {
        "Content-Type": row.mime_type || "audio/mpeg",
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch {
    return jsonError("Failed to stream beat.", 500);
  }
};
