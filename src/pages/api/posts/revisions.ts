/**
 * Post revision history: list, read, snapshot, restore.
 *
 * SECURITY — read before editing:
 *  - Auth is enforced by src/middleware.ts for the whole /api/posts prefix
 *    (PROTECTED_PREFIXES). This file does not re-check. A route added under
 *    /api/posts without that prefix entry is an unauthenticated write endpoint.
 *  - The session cookie is SameSite=Strict, which is what makes these
 *    state-changing verbs safe from cross-site form posts.
 *  - Every value is bound (`?`). No identifier is interpolated from input at
 *    all — unlike /api/content/[table], this endpoint only ever touches two
 *    known tables, so there is nothing to allowlist.
 */
import type { APIRoute } from 'astro';
import { db, getRevisionList, getRevision } from '../../../lib/db';
import { json } from '../../../lib/auth';

export const prerender = false;

/**
 * How many snapshots to keep per post.
 *
 * Twenty is chosen to survive a bad working session, not to be an archive. The
 * realistic failure this protects against is "I pasted over the body and saved
 * three times before noticing", which twenty covers comfortably. Unbounded
 * history would let one heavily-edited post accumulate hundreds of copies of the
 * largest column in the schema.
 */
const KEEP_PER_POST = 20;

/** The subset of a post worth reverting. Must match the post_revisions columns
 *  in migrations/0013 — SEO/OG/Twitter fields are deliberately not versioned. */
const VERSIONED = [
  'title',
  'slug',
  'excerpt',
  'body_md',
  'status',
  'category',
  'tags_json',
] as const;

/** ISO-8601 UTC to the second, matching posts.created_at / updated_at. */
function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function intParam(value: string | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
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

/**
 * GET /api/posts/revisions?post_id=1  → history for a post (no bodies)
 * GET /api/posts/revisions?id=7       → one full revision, body included
 */
export const GET: APIRoute = async ({ request }) => {
  const params = new URL(request.url).searchParams;

  const revisionId = intParam(params.get('id'));
  if (revisionId) {
    const revision = await getRevision(revisionId);
    if (!revision) return json({ ok: false, error: 'No revision with that id' }, 404);
    return json({ ok: true, data: revision });
  }

  const postId = intParam(params.get('post_id'));
  if (!postId) {
    return json({ ok: false, error: 'Provide either post_id or id' }, 400);
  }
  return json({ ok: true, data: await getRevisionList(postId, KEEP_PER_POST) });
};

/**
 * POST /api/posts/revisions  { post_id, note? }
 *
 * Snapshots the post AS IT CURRENTLY IS in the database, then prunes.
 *
 * The ordering matters and is the whole design: the editor calls this
 * immediately BEFORE writing its changes, so what lands in history is the last
 * known-good version rather than the one being saved. Restoring is therefore
 * always "go back to before this save", which is what a person actually wants
 * at the moment they realise they have destroyed something.
 */
export const POST: APIRoute = async ({ request }) => {
  const body = await safeJson(request);
  const postId = Number(body?.post_id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return json({ ok: false, error: 'post_id must be a positive integer' }, 400);
  }

  const note = typeof body?.note === 'string' ? body.note.slice(0, 120) : 'manual save';

  const snapshot = await db()
    .prepare(
      `INSERT INTO post_revisions
         (post_id, ${VERSIONED.join(', ')}, created_at, note)
       SELECT id, ${VERSIONED.join(', ')}, ?, ?
         FROM posts WHERE id = ?`
    )
    .bind(nowIso(), note, postId)
    .run();

  // INSERT ... SELECT writes nothing when the SELECT matches nothing, which is
  // how a bad post_id shows up. Reporting ok:true here would tell the editor it
  // has a safety net it does not have.
  if (snapshot.meta.changes === 0) {
    return json({ ok: false, error: 'No post with that id' }, 404);
  }

  /*
   * Prune to the newest KEEP_PER_POST for this post only.
   *
   * The subquery is bounded by post_id, so a busy post can never evict another
   * post's history. OFFSET-style pruning rather than a date cutoff: "keep the
   * last 20" stays correct whether the edits were twenty minutes or twenty
   * months apart.
   */
  await db()
    .prepare(
      `DELETE FROM post_revisions
        WHERE post_id = ?
          AND id NOT IN (
            SELECT id FROM post_revisions
             WHERE post_id = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ?
          )`
    )
    .bind(postId, postId, KEEP_PER_POST)
    .run();

  return json({ ok: true, id: snapshot.meta.last_row_id });
};

/**
 * PUT /api/posts/revisions  { id }
 *
 * Restores a revision onto its post.
 *
 * Takes a snapshot of the CURRENT state first, so restoring is itself undoable.
 * Without that, recovering from a bad edit would destroy the good one, and the
 * feature meant to prevent data loss would become a way to cause it.
 */
export const PUT: APIRoute = async ({ request }) => {
  const body = await safeJson(request);
  const revisionId = Number(body?.id);
  if (!Number.isInteger(revisionId) || revisionId <= 0) {
    return json({ ok: false, error: 'id must be a positive integer' }, 400);
  }

  const revision = await getRevision(revisionId);
  if (!revision) return json({ ok: false, error: 'No revision with that id' }, 404);

  await db()
    .prepare(
      `INSERT INTO post_revisions
         (post_id, ${VERSIONED.join(', ')}, created_at, note)
       SELECT id, ${VERSIONED.join(', ')}, ?, ?
         FROM posts WHERE id = ?`
    )
    .bind(nowIso(), `before restore of #${revisionId}`, revision.post_id)
    .run();

  const setClause = VERSIONED.map((c) => `${c} = ?`).join(', ');
  const values = VERSIONED.map((c) => revision[c] as never);

  try {
    const result = await db()
      .prepare(`UPDATE posts SET ${setClause}, updated_at = ? WHERE id = ?`)
      .bind(...values, nowIso(), revision.post_id)
      .run();
    if (result.meta.changes === 0) {
      return json({ ok: false, error: 'The post this revision belongs to no longer exists' }, 404);
    }
    return json({ ok: true, post_id: revision.post_id });
  } catch (err) {
    // Restoring an old slug can collide with a slug taken since. Surface it as a
    // conflict rather than a 500 so the editor can say something useful.
    const message = err instanceof Error ? err.message : 'Restore failed';
    const conflict = /UNIQUE|constraint/i.test(message);
    return json({ ok: false, error: message }, conflict ? 409 : 500);
  }
};
