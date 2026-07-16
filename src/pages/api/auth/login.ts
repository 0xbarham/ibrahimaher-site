/**
 * Admin login. Ported from functions/api/auth/login.js.
 *
 * This endpoint is reachable while logged out (see PUBLIC_ADMIN_PATHS in
 * src/middleware.ts), so it is the site's only brute-force surface.
 */
import type { APIRoute } from 'astro';
import { verifyPassword, createSessionCookie, isAuthConfigured, json } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthConfigured()) {
    // Do not hint at which of the two secrets is missing.
    return json({ ok: false, error: 'Admin auth is not configured' }, 500);
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, 400);
  }

  const password = typeof body.password === 'string' ? body.password : '';

  if (!(await verifyPassword(password))) {
    // Fixed delay to blunt naive brute-forcing. Not rate limiting — it only
    // slows sequential guessing, and a determined attacker can parallelise.
    // Cloudflare WAF rate limiting on /api/auth/login is the real control.
    await new Promise((resolve) => setTimeout(resolve, 300));
    return json({ ok: false, error: 'Invalid password' }, 401);
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', await createSessionCookie());
  return new Response(JSON.stringify({ ok: true }), { headers });
};
