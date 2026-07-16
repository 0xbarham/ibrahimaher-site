import { sha256Hex, constantTimeEqual, createSessionCookie, json } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) {
    return json({ ok: false, error: 'Admin auth is not configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, 400);
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const hash = await sha256Hex(password);

  if (!constantTimeEqual(hash, env.ADMIN_PASSWORD_HASH)) {
    // Small fixed delay to blunt naive brute-force attempts.
    await new Promise((resolve) => setTimeout(resolve, 300));
    return json({ ok: false, error: 'Invalid password' }, 401);
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', await createSessionCookie(env));
  return new Response(JSON.stringify({ ok: true }), { headers });
}
