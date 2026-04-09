import type { PagesFunction } from "@cloudflare/workers-types";
import { getSessionUserId } from "../../../lib/auth";
import { type Env, getErrorMessage, jsonError } from "../../../lib/shared";

function parseByteRangeHeader(rangeHeader: string | null, totalLength: number) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return { valid: false as const };

  const startToken = match[1];
  const endToken = match[2];
  if (!startToken && !endToken) return { valid: false as const };

  let start: number;
  let end: number;

  if (!startToken) {
    const suffixLength = Number(endToken);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return { valid: false as const };
    const length = Math.min(suffixLength, totalLength);
    start = Math.max(0, totalLength - length);
    end = totalLength - 1;
  } else {
    start = Number(startToken);
    if (!Number.isFinite(start) || start < 0) return { valid: false as const };

    if (!endToken) {
      end = totalLength - 1;
    } else {
      end = Number(endToken);
      if (!Number.isFinite(end) || end < 0) return { valid: false as const };
    }
  }

  if (start >= totalLength) return { valid: false as const };
  end = Math.min(end, totalLength - 1);
  if (end < start) return { valid: false as const };

  return { valid: true as const, start, end };
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.DB) return jsonError("Server misconfigured: missing D1 binding `DB`.", 500);
  if (!env.BEATS_KV) return jsonError("Server misconfigured: missing KV binding `BEATS_KV`.", 500);

  const userId = await getSessionUserId(env, request);
  if (!userId) {
    return jsonError("Unauthorized.", 401);
  }

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const beatId = Number(params.id);
  if (Number.isNaN(beatId)) {
    return jsonError("Invalid beat id.", 400);
  }
  const requestUrl = new URL(request.url);
  const shouldDownload = requestUrl.searchParams.get("download") === "1";

  try {
    const row = await env.DB.prepare(
      "SELECT r2_key, file_name, mime_type, user_id, is_public FROM beats WHERE id = ?"
    )
      .bind(beatId)
      .first<{
        r2_key: string;
        file_name: string | null;
        mime_type: string;
        user_id: number | null;
        is_public: number | null;
      }>();

    if (!row) {
      return jsonError("Beat not found.", 404);
    }
    const isPublic = Number(row.is_public ?? 1) === 1;
    const canAccess = row.user_id === userId || isPublic;
    if (!canAccess) return jsonError("Beat not found.", 404);

    const data = await env.BEATS_KV.get(row.r2_key, { type: "arrayBuffer" });
    if (!data) {
      return jsonError("File missing.", 404);
    }

    const fileName = String(row.file_name || `beat-${beatId}.mp3`).replace(/[\r\n"]/g, "_");
    const contentLength = data.byteLength;
    const headers: Record<string, string> = {
      "Content-Type": row.mime_type || "audio/mpeg",
      "Cache-Control": "public, max-age=604800",
      "Accept-Ranges": "bytes",
    };
    if (shouldDownload) {
      headers["Content-Disposition"] =
        `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    }
    const range = parseByteRangeHeader(request.headers.get("Range"), contentLength);
    if (range && !range.valid) {
      headers["Content-Range"] = `bytes */${contentLength}`;
      return new Response(null, { status: 416, headers });
    }
    if (range?.valid) {
      const chunk = data.slice(range.start, range.end + 1);
      headers["Content-Range"] = `bytes ${range.start}-${range.end}/${contentLength}`;
      headers["Content-Length"] = String(chunk.byteLength);
      return new Response(chunk, { status: 206, headers });
    }

    headers["Content-Length"] = String(contentLength);
    return new Response(data, { headers });
  } catch (error) {
    return jsonError(`Failed to stream beat: ${getErrorMessage(error)}`, 500);
  }
};
