import { isAuthed, json } from '../../_lib/auth.js';

export async function onRequest({ request, next, env }) {
  if (!(await isAuthed(request, env))) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }
  return next();
}
