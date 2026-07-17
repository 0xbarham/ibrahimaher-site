/**
 * First-run admin setup. Creates the ONE admin account, then closes forever.
 *
 * This endpoint is unauthenticated by necessity — it exists precisely because
 * there is no account to authenticate against yet — which makes it the most
 * dangerous route on the site. On a live public domain an ungated setup page is
 * a CMS-takeover race: whoever POSTs first owns the site. Three things close it:
 *
 *   1. It refuses once ANY admin row exists (isSetupOpen), so the window is the
 *      gap between deploy and the owner's signup, not "forever".
 *   2. Inside that window it still requires SETUP_TOKEN, a secret set with
 *      `wrangler secret put` and never committed — so the window is not open to
 *      the internet at all, only to whoever holds the token.
 *   3. The INSERT is guarded by `WHERE NOT EXISTS`, atomically in SQLite, so even
 *      two simultaneous valid requests cannot both create an account.
 *
 * Every rejection is the same flat message. Distinguishing "already set up" from
 * "bad token" would tell an anonymous caller whether the site is still takeable.
 */
import type { APIRoute } from 'astro';
import {
  isSetupOpen,
  verifySetupToken,
  createAdminIfNone,
  createSessionCookie,
  json,
} from '../../../lib/auth';

export const prerender = false;

/** Deliberately permissive but bounded — this is an identifier, not prose. */
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 12;

export const POST: APIRoute = async ({ request }) => {
  if (!(await isSetupOpen())) {
    return json({ ok: false, error: 'Setup is not available' }, 403);
  }

  let body: { token?: unknown; username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, 400);
  }

  const token = typeof body.token === 'string' ? body.token : '';
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  // Check the token BEFORE validating anything else: a helpful validation message
  // is a free oracle telling an anonymous caller that setup is still open.
  if (!verifySetupToken(token)) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return json({ ok: false, error: 'Setup is not available' }, 403);
  }

  if (!USERNAME_RE.test(username)) {
    return json(
      {
        ok: false,
        error: 'Username must be 3-32 characters: letters, numbers, dot, dash or underscore.',
      },
      400
    );
  }

  /*
   * Length only. A composition rule ("one capital, one symbol") measurably pushes
   * people toward Password1! and is what NIST 800-63B now advises against; length
   * is the property that actually buys entropy. The upper bound is a DoS guard —
   * PBKDF2 hashes whatever it is handed, on the request path.
   */
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    return json(
      { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      400
    );
  }

  const created = await createAdminIfNone(username, password);
  if (!created) {
    // Lost the race, or an account appeared between the check above and here.
    return json({ ok: false, error: 'Setup is not available' }, 403);
  }

  // Log the owner straight in: making someone re-type a password they set two
  // seconds ago adds no security, only a chance to fat-finger it.
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', await createSessionCookie());
  return new Response(JSON.stringify({ ok: true }), { headers });
};
