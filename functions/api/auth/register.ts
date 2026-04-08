import type { PagesFunction } from "@cloudflare/workers-types";
import {
  USERNAME_RE,
  createSession,
  hashPassword,
  randomSaltHex,
  setSessionCookie,
} from "../../lib/auth";
import { type Env, getErrorMessage, jsonError } from "../../lib/shared";

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

  if (!USERNAME_RE.test(username)) {
    return jsonError(
      "Username must be 3–32 characters: letters, numbers, and underscores only.",
      400
    );
  }
  if (password.length < 8) {
    return jsonError("Password must be at least 8 characters.", 400);
  }

  const salt = randomSaltHex();
  const passwordHash = await hashPassword(password, salt);

  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE username = ? COLLATE NOCASE"
  )
    .bind(username)
    .first<{ id: number }>();

  if (existing) {
    return jsonError("Username already taken.", 409);
  }

  try {
    const result = await env.DB.prepare(
      "INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?) RETURNING id, username"
    )
      .bind(username, passwordHash, salt)
      .first<{ id: number; username: string }>();

    if (!result) {
      return jsonError("Registration failed.", 500);
    }

    const token = await createSession(env, result.id);
    return Response.json(
      { id: result.id, username: result.username },
      {
        status: 201,
        headers: { "Set-Cookie": setSessionCookie(request, token) },
      }
    );
  } catch (error) {
    const msg = getErrorMessage(error);
    if (/UNIQUE|unique constraint|SQLITE_CONSTRAINT_UNIQUE/i.test(msg)) {
      return jsonError("Username already taken.", 409);
    }
    return jsonError(
      "Could not create account. If you run this site, apply D1 migrations (including 0002) on production.",
      500
    );
  }
};
