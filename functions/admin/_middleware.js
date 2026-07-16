import { isAuthed } from '../_lib/auth.js';

const PUBLIC_PATHS = new Set(['/admin/login', '/admin/login.html']);

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);

  if (PUBLIC_PATHS.has(url.pathname) || url.pathname.startsWith('/admin/assets/')) {
    return next();
  }

  if (!(await isAuthed(request, env))) {
    return Response.redirect(new URL('/admin/login.html', request.url), 302);
  }

  return next();
}
