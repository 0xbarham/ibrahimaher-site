/**
 * Session auth for /admin.
 *
 * Ported from functions/_lib/auth.js — the Pages Functions directory is not
 * executed under the Workers target, so this logic has to live in the Astro app.
 * The cookie format and secret names are unchanged, so existing secrets keep
 * working: base64url(JSON payload) + "." + HMAC-SHA256(payload, SESSION_SECRET)
 *
 * Credentials live in D1 (`admin_users`, migration 0009), NOT in a secret. The
 * previous scheme required an ADMIN_PASSWORD_HASH secret that was never set, so
 * isAuthConfigured() was permanently false and login answered 500 for everyone —
 * the admin was locked, owner included. Moving to D1 lets the owner create his
 * own account on first run and rotate it later without a redeploy.
 *
 * That also retires the weakness the old comment here admitted to:
 * ADMIN_PASSWORD_HASH was an UNSALTED SHA-256 — a fast hash, cheap to
 * brute-force from a leak. Passwords are now PBKDF2-SHA256 with a per-row salt.
 *
 * SESSION_SECRET keeps its meaning and the cookie format is unchanged —
 * base64url(JSON payload) + "." + HMAC-SHA256(payload, SESSION_SECRET) — so this
 * is not a breaking change for anything already holding a session.
 */
import { env } from 'cloudflare:workers';
import { db } from './db';

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

/*
 * PBKDF2 cost. OWASP's floor for PBKDF2-SHA256 is well above this; the ceiling
 * here is not security but the Workers CPU budget — this runs inside the request,
 * and blowing the limit turns "log in" into an opaque 1102 rather than a slow
 * login. 100k is the compromise, and `iterations` is stored per-row so it can be
 * raised later without invalidating the existing hash.
 */
const PBKDF2_ITERATIONS = 100_000;

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

interface AdminEnv {
  SESSION_SECRET?: string;
  /**
   * One-time gate for /api/auth/setup. Without it a public setup page is a
   * CMS-takeover race: whoever POSTs first owns the site. It matters only until
   * an admin row exists — after that setup is closed regardless of its value.
   */
  SETUP_TOKEN?: string;
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

function fromBase64UrlBytes(b64url: string): Uint8Array {
  const bin = fromBase64Url(b64url);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

/** `pbkdf2$sha256$<iterations>$<salt>$<hash>`, salt and hash base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

/**
 * Verify against a stored hash string.
 *
 * Every malformed-field path returns false rather than throwing: this parses a
 * value from the database on the login path, and an exception here would be a
 * 500 that leaks "your stored hash is broken" to an anonymous caller.
 */
async function verifyStoredPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5) return false;
  const [scheme, hashName, itersRaw, saltB64, expected] = parts;
  if (scheme !== 'pbkdf2' || hashName !== 'sha256') return false;

  const iterations = Number(itersRaw);
  // Guard the cost read out of the DB: a row saying `1` would make the KDF free.
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) return false;

  let salt: Uint8Array;
  try {
    salt = fromBase64UrlBytes(saltB64);
  } catch {
    return false;
  }
  if (salt.length === 0) return false;

  const actual = toBase64Url(await pbkdf2(password, salt, iterations));
  return constantTimeEqual(actual, expected);
}

export async function findAdmin(username: string): Promise<AdminUser | null> {
  return (
    (await db()
      .prepare('SELECT * FROM admin_users WHERE username = ?')
      .bind(username)
      .first<AdminUser>()) ?? null
  );
}

export async function adminExists(): Promise<boolean> {
  const row = await db().prepare('SELECT 1 AS n FROM admin_users LIMIT 1').first<{ n: number }>();
  return Boolean(row);
}

/** Auth is usable once a secret exists to sign cookies AND an account exists. */
export async function isAuthConfigured(): Promise<boolean> {
  if (!adminEnv().SESSION_SECRET) return false;
  return adminExists();
}

/** Setup is open only while there is no account to take over. */
export async function isSetupOpen(): Promise<boolean> {
  if (!adminEnv().SESSION_SECRET || !adminEnv().SETUP_TOKEN) return false;
  return !(await adminExists());
}

export function verifySetupToken(token: string): boolean {
  const expected = adminEnv().SETUP_TOKEN;
  if (!expected) return false;
  return constantTimeEqual(token, expected);
}

/**
 * Create the first admin. Returns false if one already existed.
 *
 * The guard is `WHERE NOT EXISTS` inside the INSERT rather than a read-then-write:
 * SQLite evaluates it atomically, so two setup requests racing cannot both
 * create an account — the loser changes 0 rows and is reported as "already
 * configured". A check-then-insert would have a window between the two.
 */
export async function createAdminIfNone(username: string, password: string): Promise<boolean> {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const hash = await hashPassword(password);
  const res = await db()
    .prepare(
      `INSERT INTO admin_users (username, password_hash, created_at, updated_at)
       SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM admin_users)`
    )
    .bind(username, hash, now, now)
    .run();
  return (res.meta?.changes ?? 0) === 1;
}

/**
 * @returns true only when the username exists AND the password matches.
 *
 * When the user is unknown this still runs a full PBKDF2 against a dummy hash
 * before returning. Skipping it would make "no such user" measurably faster than
 * "wrong password" and turn the login form into a username oracle.
 */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const admin = await findAdmin(username);
  if (!admin) {
    await pbkdf2(password, new Uint8Array(16), PBKDF2_ITERATIONS);
    return false;
  }
  return verifyStoredPassword(password, admin.password_hash);
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
