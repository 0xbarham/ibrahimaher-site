/**
 * Bulk actions and duplication for posts.
 *
 * SECURITY — read before editing:
 *  - Auth is enforced by src/middleware.ts for the whole /api/posts prefix.
 *    This file does not re-check.
 *  - Session cookie is SameSite=Strict, which is what makes these verbs safe
 *    from cross-site form posts.
 *  - `ids` is coerced to integers and the SQL placeholders are generated from
 *    the ARRAY LENGTH, never from the values. Nothing from the request body is
 *    ever interpolated into a statement.
 */
import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json } from '../../../lib/auth';

export const prerender = false;

/**
 * Upper bound on a single bulk call.
 *
 * D1 caps bound parameters per statement, and an unbounded IN (...) list is the
 * classic way to hit that limit at exactly the wrong moment. 100 is far above
 * any real selection on a blog this size and far below the cap.
 */
const MAX_IDS = 100;

/** Statuses the bulk endpoint may set. 'scheduled' is deliberately absent: it
 *  is meaningless without a per-post publish_at, so it belongs to the editor. */
const BULK_STATUSES = new Set(['published', 'draft']);

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

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

/** Integers only, de-duplicated, capped. Returns null when nothing survives. */
function cleanIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = [...new Set(raw.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  return ids.length > 0 && ids.length <= MAX_IDS ? ids : null;
}

/**
 * POST /api/posts/bulk
 *   { action: 'status', ids: [1,2], status: 'published' | 'draft' }
 *   { action: 'delete', ids: [1,2] }
 *   { action: 'duplicate', id: 1 }
 */
export const POST: APIRoute = async ({ request }) => {
  const body = await safeJson(request);
  const action = typeof body?.action === 'string' ? body.action : '';

  if (action === 'duplicate') return duplicate(body);
  if (action === 'status') return setStatus(body);
  if (action === 'delete') return remove(body);

  return json({ ok: false, error: 'action must be one of: status, delete, duplicate' }, 400);
};

async function setStatus(body: Record<string, unknown> | null): Promise<Response> {
  const ids = cleanIds(body?.ids);
  if (!ids) return json({ ok: false, error: `ids must be 1-${MAX_IDS} positive integers` }, 400);

  const status = String(body?.status ?? '');
  if (!BULK_STATUSES.has(status)) {
    return json({ ok: false, error: "status must be 'published' or 'draft'" }, 400);
  }

  const holes = ids.map(() => '?').join(', ');

  /*
   * Clearing publish_at here is correctness, not tidiness. A post left as
   * scheduled with a past date and then bulk-drafted would still satisfy the
   * second clause of PUBLISHED_PREDICATE the moment anything set its status
   * back — republishing it by surprise. Explicitly unscheduling on any manual
   * status change keeps "draft" meaning draft.
   */
  const result = await db()
    .prepare(
      `UPDATE posts SET status = ?, publish_at = NULL, updated_at = ?
        WHERE id IN (${holes})`
    )
    .bind(status, nowIso(), ...ids)
    .run();

  return json({ ok: true, changed: result.meta.changes });
}

async function remove(body: Record<string, unknown> | null): Promise<Response> {
  const ids = cleanIds(body?.ids);
  if (!ids) return json({ ok: false, error: `ids must be 1-${MAX_IDS} positive integers` }, 400);

  const holes = ids.map(() => '?').join(', ');

  /*
   * post_revisions declares ON DELETE CASCADE, but D1 does not guarantee
   * PRAGMA foreign_keys is on for every connection, so the history rows are
   * removed explicitly. Orphaned revisions would otherwise accumulate invisibly
   * and — worse — could later be restored onto an id that AUTOINCREMENT has
   * since handed to a different post.
   */
  await db()
    .prepare(`DELETE FROM post_revisions WHERE post_id IN (${holes})`)
    .bind(...ids)
    .run();

  const result = await db()
    .prepare(`DELETE FROM posts WHERE id IN (${holes})`)
    .bind(...ids)
    .run();

  return json({ ok: true, changed: result.meta.changes });
}

/**
 * Duplicate one post as a draft.
 *
 * Copies everything except identity: a fresh id, a free "-copy" slug, a
 * "(copy)" title, draft status, no publish_at, not featured, and no
 * canonical_url. Cloning the slug would violate UNIQUE; cloning the status would
 * silently publish a second copy of a live article the moment it was created;
 * cloning canonical_url would point the duplicate at the original and quietly
 * de-index it.
 */
async function duplicate(body: Record<string, unknown> | null): Promise<Response> {
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ ok: false, error: 'id must be a positive integer' }, 400);
  }

  const source = await db()
    .prepare('SELECT slug FROM posts WHERE id = ?')
    .bind(id)
    .first<{ slug: string }>();
  if (!source) return json({ ok: false, error: 'No post with that id' }, 404);

  /*
   * Find a free slug rather than assuming "-copy" is available. Duplicating the
   * same post twice is an ordinary thing to do, and a UNIQUE violation on the
   * second attempt would be a confusing way to discover that.
   */
  const taken = await db()
    .prepare("SELECT slug FROM posts WHERE slug LIKE ? || '%'")
    .bind(`${source.slug}-copy`)
    .all<{ slug: string }>();
  const used = new Set((taken.results ?? []).map((r) => r.slug));

  let slug = `${source.slug}-copy`;
  for (let n = 2; used.has(slug); n += 1) slug = `${source.slug}-copy-${n}`;

  const stamp = nowIso();

  try {
    const result = await db()
      .prepare(
        `INSERT INTO posts (
           sort_order, slug, title, category, excerpt, post_date, read_time,
           body_md, status, author_id, tags_json, hero_image, hero_alt, featured,
           created_at, updated_at, publish_at,
           seo_title, seo_description, seo_keywords, canonical_url, noindex,
           og_title, og_description, og_image,
           twitter_title, twitter_description, twitter_image,
           cta_heading, cta_md
         )
         SELECT
           sort_order, ?, title || ' (copy)', category, excerpt, post_date, read_time,
           body_md, 'draft', author_id, tags_json, hero_image, hero_alt, 0,
           ?, ?, NULL,
           -- canonical_url is reset to '' rather than NULL: every text column in
           -- this table is NOT NULL DEFAULT '', so NULL fails the constraint
           -- outright. '' is the schema's own "unset". Only publish_at is
           -- genuinely nullable, which is why it alone is NULL above.
           seo_title, seo_description, seo_keywords, '', noindex,
           og_title, og_description, og_image,
           twitter_title, twitter_description, twitter_image,
           cta_heading, cta_md
         FROM posts WHERE id = ?`
      )
      .bind(slug, stamp, stamp, id)
      .run();

    return json({ ok: true, id: result.meta.last_row_id, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Duplicate failed';
    const conflict = /UNIQUE|constraint/i.test(message);
    return json({ ok: false, error: message }, conflict ? 409 : 500);
  }
}
