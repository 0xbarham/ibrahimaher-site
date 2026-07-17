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
 * Legacy `.html` URLs -> the extensionless form.
 *
 * v1 was a static Pages site of real files: /about.html, /blog/foo.html. Pages
 * normalised those to the clean form itself, so the sitemap and every indexed
 * URL is already extensionless and the move to Workers keeps its URLs. Old
 * inbound links, bookmarks and backlinks still carry the extension though, and
 * nothing on Workers normalises them — measured on the deployed v2, each shape
 * degraded differently: /about.html and /index.html 404'd, and /blog/foo.html
 * answered 200, serving the SAME post on two URLs (the canonical tag deduped
 * it, but a canonical is only a hint). All of those now 301.
 *
 * KNOWN EXCEPTION — `/blog/index.html` still 500s and this cannot fix it.
 * Astro matches a route BEFORE running middleware, and /blog/ is the one
 * directory holding both index.astro and [slug].astro; that match throws on the
 * literal lowercase "index.html" and never reaches this function. Verified by
 * elimination on the deployed Worker: /blog/Index.html, /blog/indexx.html,
 * /admin/index.html and /nope/index.html all 301 correctly — only that exact
 * string fails. Assets `html_handling` is already "none", so the asset router
 * is not the cause. Fixing it needs a zone Redirect Rule (no rulesets scope on
 * this token) or an upstream Astro fix. Left as-is deliberately: the URL is not
 * in the sitemap, is linked from nowhere on the site, and v1 only ever answered
 * it with a redirect, so nothing should hold it but a stale external link.
 */
function legacyHtmlRedirect(url: URL): Response | null {
  const { pathname } = url;
  if (!pathname.endsWith('.html')) return null;

  // `/x/index.html` names a directory index, not a page called "index" — it has
  // to land on `/x/`, not `/x/index`, which is itself a 404 here.
  const clean = pathname.endsWith('/index.html')
    ? pathname.slice(0, -'index.html'.length)
    : pathname.slice(0, -'.html'.length);

  const to = new URL(url);
  to.pathname = clean;
  return new Response(null, { status: 301, headers: { Location: to.pathname + to.search } });
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

  // After the host hop, so a link to the apex resolves in ONE redirect rather
  // than two. No DB either, so it stays on the cheap path.
  const htmlRedirect = legacyHtmlRedirect(context.url);
  if (htmlRedirect) return htmlRedirect;

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
