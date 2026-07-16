/**
 * Session auth for /admin.
 *
 * Ported from functions/_lib/auth.js — the Pages Functions directory is not
 * executed under the Workers target, so this logic has to live in the Astro app.
 * The cookie format and secret names are unchanged, so existing secrets keep
 * working: base64url(JSON payload) + "." + HMAC-SHA256(payload, SESSION_SECRET)
 *
 * Threat model note: ADMIN_PASSWORD_HASH is an unsalted SHA-256 of the password,
 * inherited from the previous implementation. SHA-256 is a *fast* hash, so if the
 * hash ever leaked it would be cheap to brute-force. It is not public, and only
 * one operator exists, so this is a known, accepted weakness rather than an
 * unnoticed one — see verifyPassword() for the upgrade path.
 */
import { env } from 'cloudflare:workers';

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

interface AdminEnv {
  SESSION_SECRET?: string;
  ADMIN_PASSWORD_HASH?: string;
}

function adminEnv(): AdminEnv {
  return env as unknown as AdminEnv;
}

function toBase64Url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64);
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(sig));
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparison whose timing does not leak how much of the value matched. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAuthConfigured(): boolean {
  const e = adminEnv();
  return Boolean(e.SESSION_SECRET && e.ADMIN_PASSWORD_HASH);
}

/**
 * @returns true only when the password matches the configured hash.
 * Upgrade path: to move off unsalted SHA-256, store a PBKDF2/scrypt string here
 * and branch on a prefix — the cookie format would not need to change.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const e = adminEnv();
  if (!e.ADMIN_PASSWORD_HASH) return false;
  return constantTimeEqual(await sha256Hex(password), e.ADMIN_PASSWORD_HASH);
}

export async function createSessionCookie(): Promise<string> {
  const e = adminEnv();
  if (!e.SESSION_SECRET) throw new Error('SESSION_SECRET is not configured');
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload));
  const sig = await hmacSign(payloadB64, e.SESSION_SECRET);
  return `${COOKIE_NAME}=${payloadB64}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${
    SESSION_TTL_MS / 1000
  }`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function isAuthed(request: Request): Promise<boolean> {
  const e = adminEnv();
  if (!e.SESSION_SECRET) return false;

  const token = getCookie(request, COOKIE_NAME);
  if (!token) return false;

  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;

  const expected = await hmacSign(payloadB64, e.SESSION_SECRET);
  // Verify the signature BEFORE parsing the payload: never trust unauthenticated
  // bytes enough to hand them to JSON.parse.
  if (!constantTimeEqual(sig, expected)) return false;

  try {
    const payload = JSON.parse(fromBase64Url(payloadB64)) as { exp?: unknown };
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
