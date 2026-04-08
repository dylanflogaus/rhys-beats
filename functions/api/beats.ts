import type { PagesFunction } from "@cloudflare/workers-types";
import {
  type BeatRow,
  Env,
  jsonError,
  rowToJson,
  sanitizeOriginalName,
  validateAudioFile,
} from "../lib/beat-api";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === "GET") {
    try {
      const { results } = await env.DB.prepare(
        `
        SELECT id, title, producer, bpm, beat_key, notes, file_name, mime_type, created_at
        FROM beats
        ORDER BY datetime(created_at) DESC;
        `
      ).all();

      const rows = (results ?? []) as BeatRow[];
      return Response.json(rows.map((r) => rowToJson(r)));
    } catch {
      return jsonError("Failed to load beats.", 500);
    }
  }

  if (request.method === "POST") {
    let uploadedKey: string | null = null;
    try {
      const form = await request.formData();
      const titleRaw = form.get("title");
      const title = typeof titleRaw === "string" ? titleRaw.trim() : "";

      const fileResult = await validateAudioFile(form.get("beatFile"));
      if (fileResult instanceof Response) {
        return fileResult;
      }
      const file = fileResult;

      if (!title) {
        return jsonError("Title is required.", 400);
      }

      const producer = form.get("producer");
      const bpmRaw = form.get("bpm");
      const beatKey = form.get("beatKey");
      const notes = form.get("notes");

      const producerVal =
        typeof producer === "string" && producer.trim() ? producer.trim() : null;
      const bpmVal =
        typeof bpmRaw === "string" && bpmRaw.trim() ? Number(bpmRaw) : null;
      const beatKeyVal =
        typeof beatKey === "string" && beatKey.trim() ? beatKey.trim() : null;
      const notesVal =
        typeof notes === "string" && notes.trim() ? notes.trim() : null;

      const safeName = sanitizeOriginalName(file.name);
      const r2Key = `${Date.now()}-${safeName}`;

      await env.BEATS_BUCKET.put(r2Key, file.stream(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
      });
      uploadedKey = r2Key;

      const stmt = env.DB.prepare(
        `
        INSERT INTO beats (title, producer, bpm, beat_key, notes, file_name, r2_key, mime_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id, title, producer, bpm, beat_key, notes, file_name, mime_type, created_at;
        `
      );

      const row = await stmt
        .bind(
          title,
          producerVal,
          Number.isFinite(bpmVal as number) ? bpmVal : null,
          beatKeyVal,
          notesVal,
          safeName,
          r2Key,
          file.type || "application/octet-stream"
        )
        .first<{
          id: number;
          title: string;
          producer: string | null;
          bpm: number | null;
          beat_key: string | null;
          notes: string | null;
          file_name: string;
          mime_type: string;
          created_at: string;
        }>();

      if (!row) {
        throw new Error("Insert returned no row");
      }

      return Response.json(rowToJson(row), { status: 201 });
    } catch {
      if (uploadedKey) {
        await env.BEATS_BUCKET.delete(uploadedKey).catch(() => {});
      }
      return jsonError("Failed to save beat.", 500);
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};
