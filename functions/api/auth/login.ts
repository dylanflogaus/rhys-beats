import type { PagesFunction } from "@cloudflare/workers-types";
import { createSession, hashPassword, setSessionCookie } from "../../lib/auth";
import { type Env, jsonError } from "../../lib/shared";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return jsonError("Server misconfigured: missing D1 binding `DB`.", 500);
  if (!env.BEATS_KV) return jsonError("Server misconfigured: missing KV binding `BEATS_KV`.", 500);

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  const row = await env.DB.prepare(
    "SELECT id, username, password_hash, salt FROM users WHERE username = ? COLLATE NOCASE"
  )
    .bind(username)
    .first<{ id: number; username: string; password_hash: string; salt: string }>();

  if (!row) {
    return jsonError("Invalid username or password.", 401);
  }

  const candidate = await hashPassword(password, row.salt);
  if (!timingSafeEqual(candidate, row.password_hash)) {
    return jsonError("Invalid username or password.", 401);
  }

  const token = await createSession(env, row.id);
  return Response.json(
    { id: row.id, username: row.username },
    { headers: { "Set-Cookie": setSessionCookie(request, token) } }
  );
};
