/**
 * Batch reorder: assign sort_order from an explicit list of ids.
 *
 * Why this exists rather than reusing /api/content/[table]:
 *
 * The arrow buttons swap two adjacent rows, which the generic single-row PUT can
 * express as two calls with a hand-rolled rollback. Dragging a row to an
 * arbitrary position cannot — moving row 5 to position 1 renumbers everything
 * between them. Doing that as N sequential PUTs means N chances to fail
 * halfway, leaving the list in an order nobody chose and no way to tell which
 * writes landed.
 *
 * D1's batch() runs its statements in a single implicit transaction, so the
 * whole reorder either applies or none of it does.
 *
 * SECURITY — read before editing:
 *  - Auth is enforced by src/middleware.ts for the /api/reorder prefix. This
 *    file does not re-check.
 *  - The table name is interpolated into SQL (D1 cannot parametrize
 *    identifiers), so it is validated against the schema allowlist FIRST and
 *    additionally required to actually own a sort_order column. Ids are always
 *    bound.
 *  - Session cookie is SameSite=Strict, which is what makes this POST safe from
 *    cross-site form submission.
 */
import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { isTable, columnsFor } from '../../lib/schema';
import { json } from '../../lib/auth';

export const prerender = false;

/**
 * Upper bound per call. D1 caps both bound parameters per statement and
 * statements per batch; this sits far above any real content table here (the
 * largest is 16 posts) and far below either limit.
 */
const MAX_ROWS = 200;

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

/**
 * POST /api/reorder  { table: 'jobs', ids: [4, 1, 2, 3, 5] }
 *
 * `ids` is the desired order. Position in the array becomes sort_order, starting
 * at 1 — not 0, because the existing rows are 1-based and mixing conventions
 * would make "first" ambiguous the next time someone reads the data by hand.
 */
export const POST: APIRoute = async ({ request }) => {
  const body = await safeJson(request);
  const table = typeof body?.table === 'string' ? body.table : '';

  if (!isTable(table)) return json({ ok: false, error: 'Unknown table' }, 404);

  // Not every allowlisted table is orderable — media and redirects have no
  // sort_order, and silently succeeding on those would be a lie.
  if (!(columnsFor(table) as readonly string[]).includes('sort_order')) {
    return json({ ok: false, error: `${table} has no sort_order to reorder` }, 400);
  }

  const raw = body?.ids;
  if (!Array.isArray(raw)) return json({ ok: false, error: 'ids must be an array' }, 400);

  const ids = raw.map(Number).filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0 || ids.length !== raw.length) {
    return json({ ok: false, error: 'ids must be positive integers' }, 400);
  }
  // De-duplication is a correctness check, not hygiene: a repeated id means the
  // client sent a list that does not describe a single ordering, and applying it
  // would leave two rows fighting over one position.
  if (ids.length !== new Set(ids).size) {
    return json({ ok: false, error: 'ids contains duplicates' }, 400);
  }
  if (ids.length > MAX_ROWS) {
    return json({ ok: false, error: `Too many rows (max ${MAX_ROWS})` }, 400);
  }

  const statement = db().prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);

  try {
    const results = await db().batch(ids.map((id, i) => statement.bind(i + 1, id)));

    /*
     * An id matching no row updates nothing, and the batch still "succeeds".
     * Without this check the caller would be told the reorder applied when part
     * of it silently did not — exactly the class of bug this endpoint exists to
     * avoid. Reported with the count so the client can reload rather than keep
     * rendering a list that no longer matches the database.
     */
    const applied = results.reduce((n, r) => n + (r.meta?.changes ?? 0), 0);
    if (applied !== ids.length) {
      return json(
        { ok: false, error: `Reordered ${applied} of ${ids.length} rows — the list is out of date` },
        404
      );
    }

    return json({ ok: true, changed: applied });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reorder failed';
    return json({ ok: false, error: message }, 500);
  }
};
