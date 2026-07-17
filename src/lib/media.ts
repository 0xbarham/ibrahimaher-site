/**
 * Media uploads: R2 for the bytes, the `media` D1 table as the queryable index.
 *
 * The table has existed since migration 0002 describing exactly this split, but
 * the bucket did not, so nothing ever wrote a row. Every image on the site is
 * still a build-time asset under public/assets/ that only changes by committing
 * a file and redeploying. This module is what finally makes `media` real.
 *
 * HOW UPLOADS BECOME URLs — the non-obvious part.
 *
 * R2 objects are not public. The usual fix is an R2 custom domain, which needs
 * `dns_records:write`; the wrangler OAuth token here carries zone:read only, the
 * same wall the Worker's Custom Domains hit (see wrangler.jsonc). So objects are
 * streamed back through the Worker at `/media/<key>` instead. That costs a
 * subrequest per image, which is why keys are unique per upload and the route
 * serves `immutable` — the browser and Cloudflare's cache should never ask twice.
 *
 * Consequence worth knowing: `/media/*` must stay OUT of the middleware's
 * PROTECTED_PREFIXES. `/api/media` is protected (owner-only writes); `/media/*`
 * is public, because these images render on the public site.
 */
import { env } from 'cloudflare:workers';
import { db } from './db';

/**
 * 10 MB. Not a platform limit — Workers accept far more — but a screenshot that
 * exceeds this is one nobody optimised, and letting it through means shipping it
 * to every visitor. Failing the upload is the more useful outcome.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * SVG is deliberately absent. `/media/*` is same-origin with the site, and an
 * SVG is a document: one with an inline <script> served from ibrahimaher.com
 * executes as ibrahimaher.com. Only the owner can upload, so this is defence in
 * depth rather than a live hole — but the cost of allowing it is a stored-XSS
 * primitive on the apex domain, and the benefit is nil. Raster only.
 */
const MIME_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
};

export interface MediaRow {
  id: number;
  key: string;
  url: string;
  filename: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt: string;
  created_at: string;
}

interface MediaEnv {
  MEDIA?: R2Bucket;
}

function bucket(): R2Bucket {
  const b = (env as unknown as MediaEnv).MEDIA;
  // A missing binding is a deploy/config fault, not a request fault. Throwing
  // here surfaces it as a 500 with a real message instead of `undefined.put`.
  if (!b) throw new Error('R2 bucket binding MEDIA is not configured');
  return b;
}

export function isAllowedMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(MIME_EXT, mime);
}

export function allowedMimeList(): string[] {
  return Object.keys(MIME_EXT);
}

/**
 * Build the R2 object key.
 *
 * The filename from the browser is NEVER trusted as a path: it is flattened to
 * a slug, so `../../etc/passwd` and `a/b.png` both collapse to a single safe
 * segment. The extension comes from the VERIFIED mime type, not from the name,
 * so `payload.html` uploaded as image/png is stored as `.png`.
 *
 * A random suffix makes the key unique, which is what lets `/media/<key>` be
 * cached immutably: the same key always maps to the same bytes, and re-uploading
 * a file with an identical name mints a new key rather than silently swapping
 * the image under every page that already embeds it.
 */
export function buildKey(filename: string, mime: string, now: Date): string {
  const ext = MIME_EXT[mime] ?? 'bin';
  const base =
    filename
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image';
  const rand = crypto.randomUUID().slice(0, 8);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${base}-${rand}.${ext}`;
}

export function publicUrlFor(key: string): string {
  return `/media/${key}`;
}

export async function listMedia(): Promise<MediaRow[]> {
  const res = await db()
    .prepare('SELECT * FROM media ORDER BY created_at DESC, id DESC')
    .all<MediaRow>();
  return res.results ?? [];
}

export async function findMedia(id: number): Promise<MediaRow | null> {
  return (await db().prepare('SELECT * FROM media WHERE id = ?').bind(id).first<MediaRow>()) ?? null;
}

/**
 * Write bytes to R2, then index the object in D1.
 *
 * Order matters and is not symmetric: an object in R2 with no row is invisible
 * junk costing a fraction of a cent, while a row pointing at bytes that were
 * never written is a broken image on the live site. So the bucket is written
 * first, and a failed INSERT deletes the orphan rather than leaving the pair
 * inconsistent. D1 and R2 cannot share a transaction, so this is the closest
 * thing to atomicity available.
 */
export async function putMedia(input: {
  body: ArrayBuffer;
  filename: string;
  mime: string;
  alt: string;
  width: number | null;
  height: number | null;
  now: Date;
}): Promise<MediaRow> {
  const key = buildKey(input.filename, input.mime, input.now);
  const url = publicUrlFor(key);
  const created = input.now.toISOString().replace(/\.\d{3}Z$/, 'Z');

  await bucket().put(key, input.body, {
    httpMetadata: {
      contentType: input.mime,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  try {
    const res = await db()
      .prepare(
        `INSERT INTO media (key, url, filename, mime, bytes, width, height, alt, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        key,
        url,
        input.filename.slice(0, 200),
        input.mime,
        input.body.byteLength,
        input.width,
        input.height,
        input.alt.slice(0, 500),
        created
      )
      .run();

    const id = Number(res.meta?.last_row_id ?? 0);
    return {
      id,
      key,
      url,
      filename: input.filename,
      mime: input.mime,
      bytes: input.body.byteLength,
      width: input.width,
      height: input.height,
      alt: input.alt,
      created_at: created,
    };
  } catch (err) {
    await bucket()
      .delete(key)
      .catch(() => {
        // Swallowed deliberately: the INSERT error is the one worth reporting,
        // and a failed cleanup only leaves an unreferenced object behind.
      });
    throw err;
  }
}

/**
 * Delete the row first, then the object.
 *
 * The mirror of putMedia's reasoning: dropping the row makes the image
 * unreachable from the admin immediately, and a leftover object is harmless. If
 * R2 fails after the row is gone the object leaks, which is the cheaper failure.
 */
export async function deleteMedia(id: number): Promise<boolean> {
  const row = await findMedia(id);
  if (!row) return false;
  await db().prepare('DELETE FROM media WHERE id = ?').bind(id).run();
  await bucket()
    .delete(row.key)
    .catch(() => {});
  return true;
}

/**
 * Read an object, optionally CONDITIONALLY.
 *
 * `options` is passed straight through to R2 rather than interpreted here, and
 * that is the entire value of the parameter: the only caller that wants a
 * condition is /media/[...key].ts, and the point of pushing `onlyIf` down is
 * that R2 evaluates it and never reads the object out. A condition checked in
 * the Worker is checked against a read that has already happened.
 *
 * The return type widens to include a bodyless R2Object, which is not cosmetic.
 * A conditional read whose condition FAILS resolves to exactly that — full
 * metadata, no `.body` — and it is the caller's 304 signal. A missing object is
 * still null, so the two stay distinguishable.
 */
export async function getObject(
  key: string,
  options?: R2GetOptions
): Promise<R2Object | R2ObjectBody | null> {
  return bucket().get(key, options);
}
