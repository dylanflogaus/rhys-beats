import type { Env } from "./shared";

export const SESSION_COOKIE = "rhys_session";
const SESSION_PREFIX = "sess:";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSaltHex(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(salt.buffer);
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToHex(bits);
}

export function getCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("Cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

function sessionCookieAttrs(request: Request, maxAgeSeconds: number): string {
  const secure = new URL(request.url).protocol === "https:";
  const base = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
  return secure ? `${base}; Secure` : base;
}

export function setSessionCookie(request: Request, token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${sessionCookieAttrs(
    request,
    SESSION_TTL_SECONDS
  )}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:";
  const base = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return secure ? `${base}; Secure` : base;
}

export async function createSession(env: Env, userId: number): Promise<string> {
  const token = crypto.randomUUID();
  await env.BEATS_KV.put(`${SESSION_PREFIX}${token}`, String(userId), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.BEATS_KV.delete(`${SESSION_PREFIX}${token}`);
}

export async function getSessionUserId(env: Env, request: Request): Promise<number | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const raw = await env.BEATS_KV.get(`${SESSION_PREFIX}${token}`);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
