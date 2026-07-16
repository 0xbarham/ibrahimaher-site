/**
 * Auth gate for the admin panel and its API.
 *
 * Replaces functions/admin/_middleware.js, which the Workers target never runs.
 *
 * Design note: this is an ALLOWLIST of public paths inside a protected prefix,
 * not a denylist of private ones. A new /admin/* page is therefore protected the
 * moment it is created — forgetting to register it fails closed, not open.
 */
import { defineMiddleware } from 'astro:middleware';
import { isAuthed, getCookie } from './lib/auth';
import { findRedirect } from './lib/db';

/** Paths under a protected prefix that must stay reachable while logged out. */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/auth/login', '/api/auth/logout']);

const PROTECTED_PREFIXES = ['/admin', '/api/content', '/api/settings', '/api/media'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Admin-managed redirects, checked ONLY when a route would 404.
 *
 * Doing this before next() would cost a D1 lookup on every request to keep a
 * handful of rows honest. Checking after a 404 costs nothing on the happy path,
 * and a 404 is by definition already the slow path.
 */
async function tryRedirect(pathname: string): Promise<Response | null> {
  // Match with and without a trailing slash so one row covers both.
  const bare = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const row = await findRedirect(bare);
  if (!row) return null;
  return new Response(null, {
    status: row.code === 302 ? 302 : 301,
    headers: { Location: row.destination },
  });
}

/**
 * Canonical host: www -> apex, http -> https.
 *
 * This replaces public/_redirects, which was Pages-only syntax. Workers static
 * assets reject it outright: `301!` (the Pages "force" suffix) parses as status
 * 0, and absolute destination URLs are not allowed. Since Seobility scored the
 * old site 0% on server config for exactly these redirects, the behaviour has to
 * survive the move — so it lives here instead.
 *
 * Only runs for hosts that end in the canonical domain, so *.workers.dev preview
 * URLs keep working normally rather than bouncing to production.
 */
function canonicalHostRedirect(url: URL, canonicalHost: string): Response | null {
  const host = url.host;
  if (host === canonicalHost) return null;
  if (host !== `www.${canonicalHost}`) return null; // previews, localhost: leave alone

  const to = new URL(url);
  to.host = canonicalHost;
  to.protocol = 'https:';
  return new Response(null, { status: 301, headers: { Location: to.toString() } });
}

/**
 * Edge-cache public pages.
 *
 * Every page is rendered on demand from D1, so without this each visit costs a
 * worker invocation plus several database round trips — measured at 320-950ms
 * TTFB. `s-maxage` lets Cloudflare's edge serve the HTML directly (single-digit
 * ms) while `max-age=0, must-revalidate` keeps the *browser* from holding a
 * stale copy, so a reader never sees old content pinned locally.
 *
 * `stale-while-revalidate` means the first request after expiry still gets an
 * instant response and the refresh happens behind it.
 *
 * The 60s ceiling is the deliberate trade: an admin edit goes live within a
 * minute rather than instantly. Anything authenticated, any non-GET, and
 * anything that already set its own Cache-Control is left alone.
 */
function addPublicCacheHeaders(request: Request, pathname: string, response: Response): void {
  if (request.method !== 'GET') return;
  if (response.status !== 200) return;
  if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) return;
  // Never cache a response rendered for a logged-in session: the admin cookie
  // does not change public pages today, but caching per-session HTML at a
  // shared edge is exactly how private content leaks to strangers.
  if (getCookie(request, 'admin_session')) {
    response.headers.set('Cache-Control', 'private, no-store');
    return;
  }
  if (response.headers.has('Cache-Control')) return; // endpoint set its own

  response.headers.set(
    'Cache-Control',
    'public, max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=86400'
  );
  // The cached variant depends on encoding negotiation.
  response.headers.set('Vary', 'Accept-Encoding');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Cheap string compare, no DB — safe to run before anything else.
  const hostRedirect = canonicalHostRedirect(context.url, 'ibrahimaher.com');
  if (hostRedirect) return hostRedirect;

  if (!isProtected(pathname) || PUBLIC_ADMIN_PATHS.has(pathname)) {
    const response = await next();

    if (response.status === 404 && !pathname.startsWith('/api/')) {
      const redirect = await tryRedirect(pathname);
      if (redirect) return redirect;
    }

    addPublicCacheHeaders(context.request, pathname, response);
    return response;
  }

  if (await isAuthed(context.request)) {
    return next();
  }

  // API callers get a machine-readable 401; humans get sent to the login form.
  // Redirecting a fetch() would surface as an opaque HTML blob in the console.
  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const to = new URL('/admin/login', context.url);
  // Preserve where they were headed so login can return them there.
  if (pathname !== '/admin') to.searchParams.set('next', pathname);
  return context.redirect(to.pathname + to.search, 302);
});
