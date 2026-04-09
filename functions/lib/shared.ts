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
  is_public: number | null;
  created_at: string;
};

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "unknown error";
}

export function rowToBeat(row: BeatRow) {
  return {
    id: row.id,
    title: row.title,
    producer: row.producer,
    bpm: row.bpm,
    beatKey: row.beat_key,
    notes: row.notes,
    fileName: row.file_name,
    mimeType: row.mime_type,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
  };
}
