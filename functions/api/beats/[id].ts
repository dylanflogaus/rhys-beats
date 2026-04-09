import type { PagesFunction } from "@cloudflare/workers-types";
import { getSessionUserId } from "../../lib/auth";
import {
  type BeatRow,
  type Env,
  getErrorMessage,
  hasBeatsTagsColumn,
  jsonError,
  parseTagsInput,
  rowToBeat,
  stringifyTags,
} from "../../lib/shared";

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.DB) return jsonError("Server misconfigured: missing D1 binding `DB`.", 500);
  if (!env.BEATS_KV) return jsonError("Server misconfigured: missing KV binding `BEATS_KV`.", 500);

  const userId = await getSessionUserId(env, request);
  if (!userId) {
    return jsonError("Unauthorized.", 401);
  }

  const beatId = Number(params.id);
  if (Number.isNaN(beatId)) {
    return jsonError("Invalid beat id.", 400);
  }

  if (request.method === "DELETE") {
    try {
      const row = await env.DB.prepare("SELECT r2_key, user_id FROM beats WHERE id = ?")
        .bind(beatId)
        .first<{ r2_key: string; user_id: number | null }>();

      if (!row || row.user_id !== userId) {
        return jsonError("Beat not found.", 404);
      }

      await env.DB.prepare("DELETE FROM beat_reactions WHERE beat_id = ?").bind(beatId).run();
      await env.DB.prepare("DELETE FROM beats WHERE id = ?").bind(beatId).run();
      await env.BEATS_KV.delete(row.r2_key);

      return new Response(null, { status: 204 });
    } catch (error) {
      return jsonError(`Failed to delete beat: ${getErrorMessage(error)}`, 500);
    }
  }

  if (request.method === "PATCH") {
    try {
      const ownerRow = await env.DB.prepare("SELECT user_id FROM beats WHERE id = ?")
        .bind(beatId)
        .first<{ user_id: number | null }>();
      if (!ownerRow || ownerRow.user_id !== userId) {
        return jsonError("Beat not found.", 404);
      }

      const payload = (await request.json().catch(() => null)) as
        | {
            title?: unknown;
            producer?: unknown;
            bpm?: unknown;
            beatKey?: unknown;
            notes?: unknown;
            tags?: unknown;
            isPublic?: unknown;
          }
        | null;
      if (!payload || typeof payload !== "object") {
        return jsonError("Invalid request body.", 400);
      }

      const title = String(payload.title ?? "").trim();
      const producer = String(payload.producer ?? "").trim();
      const bpmRaw = String(payload.bpm ?? "").trim();
      const beatKey = String(payload.beatKey ?? "").trim();
      const notes = String(payload.notes ?? "").trim();
      const tagsRaw = String(payload.tags ?? "").trim();
      const isPublic = payload.isPublic ? 1 : 0;
      const bpmVal = bpmRaw ? Number(bpmRaw) : null;
      if (!title) {
        return jsonError("Title is required.", 400);
      }
      if (bpmVal !== null && !Number.isFinite(bpmVal)) {
        return jsonError("BPM must be a number.", 400);
      }

      const tags = parseTagsInput(tagsRaw);
      const hasTagsColumn = await hasBeatsTagsColumn(env.DB);
      const row = hasTagsColumn
        ? await env.DB
            .prepare(
              `
              UPDATE beats
              SET title = ?, producer = ?, bpm = ?, beat_key = ?, notes = ?, tags = ?, is_public = ?
              WHERE id = ? AND user_id = ?
              RETURNING id, title, producer, bpm, beat_key, notes, tags, file_name, mime_type, is_public, created_at
              `
            )
            .bind(
              title,
              producer || null,
              bpmVal !== null ? bpmVal : null,
              beatKey || null,
              notes || null,
              stringifyTags(tags),
              isPublic,
              beatId,
              userId
            )
            .first<BeatRow>()
        : await env.DB
            .prepare(
              `
              UPDATE beats
              SET title = ?, producer = ?, bpm = ?, beat_key = ?, notes = ?, is_public = ?
              WHERE id = ? AND user_id = ?
              RETURNING id, title, producer, bpm, beat_key, notes, NULL AS tags, file_name, mime_type, is_public, created_at
              `
            )
            .bind(
              title,
              producer || null,
              bpmVal !== null ? bpmVal : null,
              beatKey || null,
              notes || null,
              isPublic,
              beatId,
              userId
            )
            .first<BeatRow>();

      if (!row) {
        return jsonError("Beat not found.", 404);
      }

      return Response.json(rowToBeat(row));
    } catch (error) {
      return jsonError(`Failed to update beat: ${getErrorMessage(error)}`, 500);
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};
