import type { PagesFunction } from "@cloudflare/workers-types";
import { Env, jsonError } from "../../../lib/beat-api";

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const idParam = context.params.id;
  const beatId = Number(idParam);
  if (!idParam || Number.isNaN(beatId)) {
    return jsonError("Invalid beat id.", 400);
  }

  try {
    const row = await context.env.DB.prepare(
      "SELECT r2_key, mime_type FROM beats WHERE id = ?"
    )
      .bind(beatId)
      .first<{ r2_key: string; mime_type: string }>();

    if (!row) {
      return jsonError("Beat not found.", 404);
    }

    const stream = await context.env.BEATS_KV.get(row.r2_key, { type: "stream" });
    if (!stream) {
      return jsonError("File missing.", 404);
    }

    return new Response(stream, {
      headers: {
        "Content-Type": row.mime_type || "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return jsonError("Failed to stream beat.", 500);
  }
};
