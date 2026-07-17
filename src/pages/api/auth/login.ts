/**
 * Admin login. Ported from functions/api/auth/login.js.
 *
 * This endpoint is reachable while logged out (see PUBLIC_ADMIN_PATHS in
 * src/middleware.ts), so it is the site's only brute-force surface.
 */
import type { APIRoute } from 'astro';
import { verifyCredentials, createSessionCookie, isAuthConfigured, json } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!(await isAuthConfigured())) {
    // Do not hint at whether it is the secret or the account that is missing.
    return json({ ok: false, error: 'Admin auth is not configured' }, 500);
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, 400);
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!(await verifyCredentials(username, password))) {
    // Fixed delay to blunt naive brute-forcing. Not rate limiting — it only
    // slows sequential guessing, and a determined attacker can parallelise.
    // Cloudflare WAF rate limiting on /api/auth/login is the real control.
    await new Promise((resolve) => setTimeout(resolve, 300));
    // One message for both failure modes: naming which half was wrong would
    // confirm valid usernames to anyone guessing.
    return json({ ok: false, error: 'Invalid username or password' }, 401);
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', await createSessionCookie());
  return new Response(JSON.stringify({ ok: true }), { headers });
};
