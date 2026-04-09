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
  tags: string | null;
  file_name: string;
  mime_type: string;
  is_public: number | null;
  created_at: string;
};

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * iOS Safari often reports an empty type or application/octet-stream for Files-app picks.
 * Normalize using the original filename extension when the reported type is not audio/*.
 */
export function resolveBeatUploadMimeType(fileName: string, reportedType: string): string | null {
  const t = (reportedType || "").trim().toLowerCase();
  if (t.startsWith("audio/")) return reportedType.trim();

  const canInfer = !t || t === "application/octet-stream";
  if (!canInfer) return null;

  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";

  const byExt: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".mpeg": "audio/mpeg",
    ".mpga": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".opus": "audio/opus",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
    ".aif": "audio/aiff",
    ".aiff": "audio/aiff",
    ".caf": "audio/x-caf",
  };

  return byExt[ext] ?? null;
}

const beatsTagsColumnCache = new WeakMap<D1Database, boolean>();

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
    tags: parseStoredTags(row.tags),
    fileName: row.file_name,
    mimeType: row.mime_type,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
  };
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => normalizeTag(tag))
    .filter(Boolean)
    .filter((tag, idx, list) => list.indexOf(tag) === idx)
    .slice(0, 12);
}

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function stringifyTags(tags: string[]): string | null {
  if (!tags.length) return null;
  return tags.join(",");
}

export function parseStoredTags(raw: string | null): string[] {
  if (!raw) return [];
  return parseTagsInput(raw);
}

type TableInfoRow = {
  name: string;
};

export async function hasBeatsTagsColumn(db: D1Database): Promise<boolean> {
  const cached = beatsTagsColumnCache.get(db);
  if (typeof cached === "boolean") return cached;

  try {
    const { results } = await db.prepare("PRAGMA table_info(beats)").all<TableInfoRow>();
    const hasColumn = (results ?? []).some((row) => row.name === "tags");
    beatsTagsColumnCache.set(db, hasColumn);
    return hasColumn;
  } catch {
    return false;
  }
}
