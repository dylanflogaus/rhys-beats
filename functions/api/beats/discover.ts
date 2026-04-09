import type { PagesFunction } from "@cloudflare/workers-types";
import { getSessionUserId } from "../../lib/auth";
import { type Env, getErrorMessage, jsonError } from "../../lib/shared";

type DiscoverRow = {
  id: number;
  title: string;
  producer: string | null;
  bpm: number | null;
  beat_key: string | null;
  notes: string | null;
  mime_type: string;
  created_at: string;
  username: string;
  star_count: number | string | null;
  my_star: number | string | null;
};

function toCount(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function parseSort(value: string | null): "newest" | "most_starred" {
  return value === "newest" ? "newest" : "most_starred";
}

function parseRange(value: string | null): "week" | "month" | "all" {
  if (value === "all" || value === "month") return value;
  return "week";
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
    const url = new URL(request.url);
    const sort = parseSort(url.searchParams.get("sort"));
    const range = parseRange(url.searchParams.get("range"));
    const rangeFilter =
      range === "all"
        ? ""
        : range === "month"
          ? " AND datetime(b.created_at) >= datetime('now', '-30 days')"
          : " AND datetime(b.created_at) >= datetime('now', '-7 days')";
    const orderBy =
      sort === "newest"
        ? "datetime(b.created_at) DESC"
        : "star_count DESC, datetime(b.created_at) DESC";

    const { results } = await env.DB.prepare(
      `
      SELECT
        b.id,
        b.title,
        b.producer,
        b.bpm,
        b.beat_key,
        b.notes,
        b.mime_type,
        b.created_at,
        u.username,
        COALESCE(SUM(CASE WHEN br.reaction_type = 'star' THEN 1 ELSE 0 END), 0) AS star_count,
        COALESCE(MAX(CASE WHEN my.reaction_type = 'star' THEN 1 ELSE 0 END), 0) AS my_star
      FROM beats b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN beat_reactions br ON br.beat_id = b.id
      LEFT JOIN beat_reactions my ON my.beat_id = b.id AND my.user_id = ?
      WHERE COALESCE(b.is_public, 1) = 1 AND b.user_id IS NOT NULL AND b.user_id != ?
      ${rangeFilter}
      GROUP BY b.id
      ORDER BY ${orderBy}
      LIMIT 30
      `
    )
      .bind(userId, userId)
      .all<DiscoverRow>();

    const rows = results ?? [];
    return Response.json(
      rows.map((row) => {
        const starCount = toCount(row.star_count);
        const myStar = toCount(row.my_star) === 1;
        return {
          id: row.id,
          title: row.title,
          producer: row.producer,
          bpm: row.bpm,
          beatKey: row.beat_key,
          notes: row.notes,
          mimeType: row.mime_type,
          createdAt: row.created_at,
          username: row.username,
          reactionCounts: {
            star: starCount,
            total: starCount,
          },
          isStarred: myStar,
        };
      })
    );
  } catch (error) {
    return jsonError(`Failed to load discover beats: ${getErrorMessage(error)}`, 500);
  }
};
