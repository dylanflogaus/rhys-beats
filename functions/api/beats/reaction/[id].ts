import type { PagesFunction } from "@cloudflare/workers-types";
import { getSessionUserId } from "../../../lib/auth";
import { type Env, getErrorMessage, jsonError } from "../../../lib/shared";

type BeatAccessRow = {
  user_id: number | null;
  is_public: number | null;
};

type CountRow = {
  star_count: number | string | null;
};

function toCount(value: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

async function getCounts(env: Env, beatId: number) {
  const row = await env.DB.prepare(
    `
    SELECT
      COALESCE(SUM(CASE WHEN reaction_type = 'star' THEN 1 ELSE 0 END), 0) AS star_count
    FROM beat_reactions
    WHERE beat_id = ?
    `
  )
    .bind(beatId)
    .first<CountRow>();
  const star = toCount(row?.star_count ?? 0);
  return { star, total: star };
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.DB) return jsonError("Server misconfigured: missing D1 binding `DB`.", 500);

  const userId = await getSessionUserId(env, request);
  if (!userId) return jsonError("Unauthorized.", 401);

  const beatId = Number(params.id);
  if (!Number.isFinite(beatId)) return jsonError("Invalid beat id.", 400);

  if (request.method !== "POST" && request.method !== "DELETE") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const beat = await env.DB.prepare("SELECT user_id, is_public FROM beats WHERE id = ?")
      .bind(beatId)
      .first<BeatAccessRow>();
    const isPublic = Number(beat?.is_public ?? 1) === 1;
    if (!beat || !isPublic) {
      return jsonError("Beat not found.", 404);
    }
    if (beat.user_id === userId) {
      return jsonError("You cannot react to your own beat.", 400);
    }

    if (request.method === "DELETE") {
      await env.DB.prepare(
        "DELETE FROM beat_reactions WHERE beat_id = ? AND user_id = ? AND reaction_type = 'star'"
      )
        .bind(beatId, userId)
        .run();
      const reactionCounts = await getCounts(env, beatId);
      return Response.json({ isStarred: false, reactionCounts });
    }

    await env.DB.prepare(
      `
      INSERT INTO beat_reactions (beat_id, user_id, reaction_type)
      VALUES (?, ?, 'star')
      ON CONFLICT(beat_id, user_id) DO UPDATE SET
        reaction_type = 'star',
        created_at = CURRENT_TIMESTAMP
      `
    )
      .bind(beatId, userId)
      .run();

    const reactionCounts = await getCounts(env, beatId);
    return Response.json({ isStarred: true, reactionCounts });
  } catch (error) {
    return jsonError(`Failed to save reaction: ${getErrorMessage(error)}`, 500);
  }
};
