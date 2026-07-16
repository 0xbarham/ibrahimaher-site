/**
 * Generic row CRUD for the content tables.
 *
 * Ported from functions/api/content/[table].js.
 *
 * SECURITY — read before editing:
 *  - Auth is enforced by src/middleware.ts for the whole /api/content prefix.
 *    This file must never be reachable unauthenticated; it does not re-check.
 *  - D1 cannot parametrize identifiers, so the table name and every column name
 *    are interpolated into the SQL string. They are therefore validated against
 *    the allowlist in src/lib/schema.ts FIRST. Values are always bound (`?`),
 *    never interpolated.
 *  - The session cookie is SameSite=Strict, which is what makes these
 *    state-changing verbs safe from cross-site form posts.
 */
import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { isTable, columnsFor } from '../../../lib/schema';
import { json } from '../../../lib/auth';

export const prerender = false;

async function safeJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ params }) => {
  const table = params.table ?? '';
  if (!isTable(table)) return json({ ok: false, error: 'Unknown table' }, 404);

  // `media` and `redirects` have no sort_order column.
  const orderBy = (columnsFor(table) as readonly string[]).includes('sort_order')
    ? 'sort_order ASC'
    : 'id DESC';
  const { results } = await db().prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
  return json({ ok: true, data: results ?? [] });
};

export const POST: APIRoute = async ({ params, request }) => {
  const table = params.table ?? '';
  if (!isTable(table)) return json({ ok: false, error: 'Unknown table' }, 404);

  const body = await safeJson(request);
  if (!body) return json({ ok: false, error: 'Invalid JSON body' }, 400);

  const allowed = columnsFor(table) as readonly string[];
  const cols = allowed.filter((c) => c in body);
  if (cols.length === 0) return json({ ok: false, error: 'No valid fields provided' }, 400);

  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => body[c] as never);

  try {
    const result = await db()
      .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
      .bind(...values)
      .run();
    return json({ ok: true, id: result.meta.last_row_id });
  } catch (err) {
    // UNIQUE(slug) is the realistic failure here; surface it rather than a 500.
    const message = err instanceof Error ? err.message : 'Insert failed';
    const conflict = /UNIQUE|constraint/i.test(message);
    return json({ ok: false, error: message }, conflict ? 409 : 500);
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const table = params.table ?? '';
  if (!isTable(table)) return json({ ok: false, error: 'Unknown table' }, 404);

  const body = await safeJson(request);
  if (!body || !Number.isInteger(body.id)) {
    return json({ ok: false, error: 'Request body must include an integer id' }, 400);
  }

  const allowed = columnsFor(table) as readonly string[];
  const cols = allowed.filter((c) => c in body);
  if (cols.length === 0) return json({ ok: false, error: 'No valid fields provided' }, 400);

  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  const values = cols.map((c) => body[c] as never);

  try {
    const result = await db()
      .prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`)
      .bind(...values, body.id as number)
      .run();
    // A silent no-op update is a real bug source — tell the caller.
    if (result.meta.changes === 0) return json({ ok: false, error: 'No row with that id' }, 404);
    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    const conflict = /UNIQUE|constraint/i.test(message);
    return json({ ok: false, error: message }, conflict ? 409 : 500);
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const table = params.table ?? '';
  if (!isTable(table)) return json({ ok: false, error: 'Unknown table' }, 404);

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) {
    return json({ ok: false, error: 'Missing or invalid id query param' }, 400);
  }

  const result = await db().prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  if (result.meta.changes === 0) return json({ ok: false, error: 'No row with that id' }, 404);
  return json({ ok: true });
};
