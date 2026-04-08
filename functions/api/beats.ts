import type { PagesFunction } from "@cloudflare/workers-types";
import {
  type BeatRow,
  type Env,
  MAX_FILE_SIZE_BYTES,
  getErrorMessage,
  jsonError,
  rowToBeat,
} from "../lib/shared";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return jsonError("Server misconfigured: missing D1 binding `DB`.", 500);
  if (!env.BEATS_KV) return jsonError("Server misconfigured: missing KV binding `BEATS_KV`.", 500);

  if (request.method === "GET") {
    try {
      const { results } = await env.DB.prepare(
        `
        SELECT id, title, producer, bpm, beat_key, notes, file_name, mime_type, created_at
        FROM beats
        ORDER BY datetime(created_at) DESC
        `
      ).all();

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

      const row = await env.DB.prepare(
        `
        INSERT INTO beats (title, producer, bpm, beat_key, notes, file_name, r2_key, mime_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id, title, producer, bpm, beat_key, notes, file_name, mime_type, created_at
        `
      )
        .bind(
          title,
          producer || null,
          bpmRaw ? Number(bpmRaw) : null,
          beatKey || null,
          notes || null,
          safeName,
          fileKey,
          fileInput.type
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
