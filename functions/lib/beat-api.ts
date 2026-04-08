export interface Env {
  DB: D1Database;
  BEATS_KV: KVNamespace;
}

export type BeatRow = {
  id: number;
  title: string;
  producer: string | null;
  bpm: number | null;
  beat_key: string | null;
  notes: string | null;
  file_name: string;
  mime_type: string;
  created_at: string;
};

export function rowToJson(row: BeatRow) {
  return {
    id: row.id,
    title: row.title,
    producer: row.producer,
    bpm: row.bpm,
    beatKey: row.beat_key,
    notes: row.notes,
    fileName: row.file_name,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  };
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

const MAX_BYTES = 25 * 1024 * 1024;

export function sanitizeOriginalName(name: string): string {
  return name.replace(/\s+/g, "-").toLowerCase() || "beat";
}

export async function validateAudioFile(value: FormDataEntryValue | null): Promise<File | Response> {
  if (!value || typeof value === "string") {
    return jsonError("Beat file is required.", 400);
  }
  if (!(value instanceof File)) {
    return jsonError("Beat file is required.", 400);
  }
  if (!value.type.startsWith("audio/")) {
    return jsonError("Only audio files are allowed.", 400);
  }
  if (value.size > MAX_BYTES) {
    return jsonError("File too large (max 25 MB).", 400);
  }
  return value;
}
