import type { PagesFunction } from "@cloudflare/workers-types";
import { type Env, jsonError } from "../../lib/shared";
import { getSessionUserId } from "../../lib/auth";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return jsonError("Server misconfigured: missing D1 binding `DB`.", 500);

  const userId = await getSessionUserId(env, request);
  if (!userId) {
    return jsonError("Unauthorized.", 401);
  }

  const row = await env.DB.prepare("SELECT id, username FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: number; username: string }>();

  if (!row) {
    return jsonError("Unauthorized.", 401);
  }

  return Response.json({ id: row.id, username: row.username });
};
