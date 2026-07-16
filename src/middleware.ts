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
import { isAuthed } from './lib/auth';
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

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!isProtected(pathname) || PUBLIC_ADMIN_PATHS.has(pathname)) {
    const response = await next();
    if (response.status === 404 && !pathname.startsWith('/api/')) {
      const redirect = await tryRedirect(pathname);
      if (redirect) return redirect;
    }
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
