import type { PagesFunction } from "@cloudflare/workers-types";
import { getSessionUserId } from "../lib/auth";
import {
  type BeatRow,
  type Env,
  MAX_FILE_SIZE_BYTES,
  getErrorMessage,
  hasBeatsTagsColumn,
  jsonError,
  parseTagsInput,
  rowToBeat,
  stringifyTags,
} from "../lib/shared";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return jsonError("Server misconfigured: missing D1 binding `DB`.", 500);
  if (!env.BEATS_KV) return jsonError("Server misconfigured: missing KV binding `BEATS_KV`.", 500);

  const userId = await getSessionUserId(env, request);
  if (!userId) {
    return jsonError("Unauthorized.", 401);
  }

  if (request.method === "GET") {
    try {
      const hasTagsColumn = await hasBeatsTagsColumn(env.DB);
      const tagsSelect = hasTagsColumn ? "tags" : "NULL AS tags";
      const { results } = await env.DB.prepare(
        `
        SELECT id, title, producer, bpm, beat_key, notes, ${tagsSelect}, file_name, mime_type, is_public, created_at
        FROM beats
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
        `
      )
        .bind(userId)
        .all();

      const rows = (results ?? []) as BeatRow[];
      return Response.json(rows.map(rowToBeat));
    } catch (error) {
      return jsonError(`Failed to load beats: ${getErrorMessage(error)}`, 500);
    }
  }

  if (request.method === "POST") {
    try {
      const form = await request.formData();
      const title = String(form.get("title") ?? "").trim();
      const producer = String(form.get("producer") ?? "").trim();
      const bpmRaw = String(form.get("bpm") ?? "").trim();
      const beatKey = String(form.get("beatKey") ?? "").trim();
      const notes = String(form.get("notes") ?? "").trim();
      const tagsRaw = String(form.get("tags") ?? "").trim();
      const autoTagsRaw = String(form.get("autoTags") ?? "").trim();
      const isPublicInput = String(form.get("isPublic") ?? "1").trim();
      const bpmVal = bpmRaw ? Number(bpmRaw) : null;
      const isPublic = isPublicInput === "1" ? 1 : 0;
      const tags = parseTagsInput(tagsRaw || autoTagsRaw);

      const fileInput = form.get("beatFile");
      if (!title) {
        return jsonError("Title is required.", 400);
      }
      if (!(fileInput instanceof File)) {
        return jsonError("Beat file is required.", 400);
      }
      if (!fileInput.type.startsWith("audio/")) {
        return jsonError("Only audio files are allowed.", 400);
      }
      if (fileInput.size > MAX_FILE_SIZE_BYTES) {
        return jsonError("File too large. Max size is 25 MB.", 400);
      }

      const safeName = fileInput.name.replace(/\s+/g, "-").toLowerCase() || "beat";
      const fileKey = `${Date.now()}-${safeName}`;
      await env.BEATS_KV.put(fileKey, await fileInput.arrayBuffer(), {
        metadata: { mimeType: fileInput.type },
      });

      const hasTagsColumn = await hasBeatsTagsColumn(env.DB);
      const row = hasTagsColumn
        ? await env.DB
            .prepare(
              `
              INSERT INTO beats (user_id, title, producer, bpm, beat_key, notes, tags, file_name, r2_key, mime_type, is_public)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              RETURNING id, title, producer, bpm, beat_key, notes, tags, file_name, mime_type, is_public, created_at
              `
            )
            .bind(
              userId,
              title,
              producer || null,
              bpmVal !== null && Number.isFinite(bpmVal) ? bpmVal : null,
              beatKey || null,
              notes || null,
              stringifyTags(tags),
              safeName,
              fileKey,
              fileInput.type,
              isPublic
            )
            .first<BeatRow>()
        : await env.DB
            .prepare(
              `
              INSERT INTO beats (user_id, title, producer, bpm, beat_key, notes, file_name, r2_key, mime_type, is_public)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              RETURNING id, title, producer, bpm, beat_key, notes, NULL AS tags, file_name, mime_type, is_public, created_at
              `
            )
            .bind(
              userId,
              title,
              producer || null,
              bpmVal !== null && Number.isFinite(bpmVal) ? bpmVal : null,
              beatKey || null,
              notes || null,
              safeName,
              fileKey,
              fileInput.type,
              isPublic
            )
            .first<BeatRow>();

      if (!row) {
        return jsonError("Failed to save beat.", 500);
      }

      return Response.json(rowToBeat(row), { status: 201 });
    } catch (error) {
      return jsonError(`Failed to save beat: ${getErrorMessage(error)}`, 500);
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};
