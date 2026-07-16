/**
 * Site settings.
 *
 * Separate from /api/content/[table] because `settings` is keyed by TEXT rather
 * than an autoincrement id, so the generic row CRUD does not apply.
 *
 * Deliberate constraint: PUT only ever updates `value` on an EXISTING key. New
 * keys come from migrations. That means a typo in the admin cannot silently
 * create dead config that nothing reads, and the key set stays a contract
 * between the schema and the templates.
 *
 * Auth is enforced for /api/settings by src/middleware.ts.
 */
import type { APIRoute } from 'astro';
import { db, invalidateSettingsCache } from '../../lib/db';
import { json } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async () => {
  const { results } = await db()
    .prepare(
      'SELECT key, value, type, grp, label, hint, sort_order FROM settings ORDER BY sort_order ASC'
    )
    .all();
  return json({ ok: true, data: results ?? [] });
};

export const PUT: APIRoute = async ({ request }) => {
  let body: { key?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const key = typeof body.key === 'string' ? body.key : '';
  if (!key) return json({ ok: false, error: 'A string "key" is required' }, 400);

  // Coerce to string: the column is TEXT, and booleans/numbers from the admin
  // would otherwise bind as their own types and read back inconsistently.
  const value =
    typeof body.value === 'string'
      ? body.value
      : body.value === undefined || body.value === null
        ? ''
        : String(body.value);

  const result = await db()
    .prepare('UPDATE settings SET value = ? WHERE key = ?')
    .bind(value, key)
    .run();

  if (result.meta.changes === 0) {
    return json({ ok: false, error: `Unknown setting "${key}"` }, 404);
  }

  // Only clears this isolate's copy — others expire on their own TTL. Without
  // it, saving a setting and immediately reloading would show the old value in
  // the same isolate and look like the save silently failed.
  invalidateSettingsCache();
  return json({ ok: true });
};
