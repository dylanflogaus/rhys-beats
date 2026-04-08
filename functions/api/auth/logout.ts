import type { PagesFunction } from "@cloudflare/workers-types";
import { SESSION_COOKIE, clearSessionCookie, deleteSession, getCookie } from "../../lib/auth";
import { type Env } from "../../lib/shared";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.BEATS_KV) {
    return new Response("Server misconfigured: missing KV binding `BEATS_KV`.", { status: 500 });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    await deleteSession(env, token);
  }

  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie(request) },
  });
};
