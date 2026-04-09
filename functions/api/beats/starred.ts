import type { PagesFunction } from "@cloudflare/workers-types";
import { getSessionUserId } from "../../lib/auth";
import { type Env, getErrorMessage, hasBeatsTagsColumn, jsonError, parseStoredTags } from "../../lib/shared";

type StarredRow = {
  id: number;
  title: string;
  producer: string | null;
  bpm: number | null;
  beat_key: string | null;
  notes: string | null;
  tags: string | null;
  mime_type: string;
  created_at: string;
  username: string;
  star_count: number | string | null;
};

function toCount(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return jsonError("Server misconfigured: missing D1 binding `DB`.", 500);

  const userId = await getSessionUserId(env, request);
  if (!userId) {
    return jsonError("Unauthorized.", 401);
  }

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const hasTagsColumn = await hasBeatsTagsColumn(env.DB);
    const tagsSelect = hasTagsColumn ? "b.tags AS tags" : "NULL AS tags";
    const { results } = await env.DB.prepare(
      `
      SELECT
        b.id,
        b.title,
        b.producer,
        b.bpm,
        b.beat_key,
        b.notes,
        ${tagsSelect},
        b.mime_type,
        b.created_at,
        u.username,
        (
          SELECT COUNT(*)
          FROM beat_reactions r
          WHERE r.beat_id = b.id AND r.reaction_type = 'star'
        ) AS star_count
      FROM beat_reactions my
      INNER JOIN beats b ON b.id = my.beat_id
      INNER JOIN users u ON u.id = b.user_id
      WHERE my.user_id = ?
        AND my.reaction_type = 'star'
        AND COALESCE(b.is_public, 1) = 1
        AND b.user_id IS NOT NULL
        AND b.user_id != ?
      ORDER BY datetime(my.created_at) DESC
      `
    )
      .bind(userId, userId)
      .all<StarredRow>();

    return Response.json(
      (results ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        producer: row.producer,
        bpm: row.bpm,
        beatKey: row.beat_key,
        notes: row.notes,
        tags: parseStoredTags(row.tags),
        mimeType: row.mime_type,
        createdAt: row.created_at,
        username: row.username,
        isStarred: true,
        reactionCounts: {
          star: toCount(row.star_count),
        },
      }))
    );
  } catch (error) {
    return jsonError(`Failed to load starred beats: ${getErrorMessage(error)}`, 500);
  }
};
