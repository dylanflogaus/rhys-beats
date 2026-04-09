import type { PagesFunction } from "@cloudflare/workers-types";
import { getSessionUserId } from "../../lib/auth";
import { type Env, getErrorMessage, jsonError } from "../../lib/shared";

type ProfileUserRow = {
  id: number;
  username: string;
  created_at: string;
};

type ProfileBeatRow = {
  id: number;
  title: string;
  producer: string | null;
  bpm: number | null;
  beat_key: string | null;
  notes: string | null;
  mime_type: string;
  is_public: number | null;
  created_at: string;
  star_count: number | string | null;
  my_star: number | string | null;
};

function toCount(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.DB) return jsonError("Server misconfigured: missing D1 binding `DB`.", 500);

  const viewerId = await getSessionUserId(env, request);
  if (!viewerId) {
    return jsonError("Unauthorized.", 401);
  }

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const usernameParam = String(params.username ?? "").trim();
  if (!usernameParam) {
    return jsonError("Username is required.", 400);
  }

  try {
    const profileUser = await env.DB.prepare(
      `
      SELECT id, username, created_at
      FROM users
      WHERE lower(username) = lower(?)
      `
    )
      .bind(usernameParam)
      .first<ProfileUserRow>();

    if (!profileUser) {
      return jsonError("Profile not found.", 404);
    }

    const isOwnProfile = profileUser.id === viewerId;
    const visibilityFilter = isOwnProfile ? "" : "AND COALESCE(b.is_public, 1) = 1";

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
        b.is_public,
        b.created_at,
        COALESCE(SUM(CASE WHEN br.reaction_type = 'star' THEN 1 ELSE 0 END), 0) AS star_count,
        COALESCE(MAX(CASE WHEN my.reaction_type = 'star' THEN 1 ELSE 0 END), 0) AS my_star
      FROM beats b
      LEFT JOIN beat_reactions br ON br.beat_id = b.id
      LEFT JOIN beat_reactions my ON my.beat_id = b.id AND my.user_id = ?
      WHERE b.user_id = ?
      ${visibilityFilter}
      GROUP BY b.id
      ORDER BY datetime(b.created_at) DESC
      `
    )
      .bind(viewerId, profileUser.id)
      .all<ProfileBeatRow>();

    const beats = (results ?? []).map((row) => {
      const starCount = toCount(row.star_count);
      return {
        id: row.id,
        title: row.title,
        producer: row.producer,
        bpm: row.bpm,
        beatKey: row.beat_key,
        notes: row.notes,
        mimeType: row.mime_type,
        isPublic: Number(row.is_public ?? 1) === 1,
        createdAt: row.created_at,
        username: profileUser.username,
        reactionCounts: {
          star: starCount,
          total: starCount,
        },
        isStarred: toCount(row.my_star) === 1,
      };
    });

    const publicBeatCount = beats.reduce((total, beat) => total + (beat.isPublic ? 1 : 0), 0);
    const totalStarsReceived = beats.reduce((total, beat) => total + beat.reactionCounts.star, 0);

    return Response.json({
      profile: {
        id: profileUser.id,
        username: profileUser.username,
        joinedAt: profileUser.created_at,
        isOwnProfile,
        beatCount: beats.length,
        publicBeatCount,
        totalStarsReceived,
      },
      beats,
    });
  } catch (error) {
    return jsonError(`Failed to load profile: ${getErrorMessage(error)}`, 500);
  }
};
