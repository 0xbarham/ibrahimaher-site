/**
 * Public image delivery for R2-backed uploads.
 *
 * This route is PUBLIC by design and must stay out of middleware's
 * PROTECTED_PREFIXES — these images render for anonymous visitors on the public
 * site. Only `/api/media` (the writes) is owner-only.
 *
 * Why serve through the Worker at all: R2 objects are private, and the normal
 * answer — an R2 custom domain — needs `dns_records:write`, which this account's
 * wrangler token does not carry (see wrangler.jsonc for the same wall the Worker
 * routes hit). Streaming through the Worker needs no DNS write whatsoever.
 *
 * The cost is one subrequest per uncached image, which is why keys are unique
 * per upload and everything here is immutable: the same key always maps to the
 * same bytes, so Cloudflare's cache and the browser answer almost every request
 * without touching this code. Replacing an image mints a new key; bytes under an
 * existing key never change.
 */
import type { APIRoute } from 'astro';
import { getObject } from '../../lib/media';

export const prerender = false;

/**
 * If-None-Match, reduced to the bare etag `etagDoesNotMatch` is documented to
 * take — the value R2 exposes as `obj.etag`, not the quoted `obj.httpEtag`.
 *
 * MEASURED, because the redundancy here is the whole question: the runtime
 * normalises the header itself. Against the local R2 simulator, all four of
 * `"abc"`, `W/"abc"`, `abc` and `*` produce an identical 304, and a
 * non-matching etag a 200, whether this function runs or not. So it fixes no
 * observed bug and is kept for one reason — it converts the value to the shape
 * the API contract actually specifies, rather than resting on leniency that is
 * nowhere promised and could be tightened without warning. The cost is one
 * regex; the alternative is a cache that depends on undocumented behaviour.
 *
 * Note this can only ever fail SAFE. Every wrong answer here is a missed 304 —
 * the image still renders, it just costs its bytes again — never a wrong body.
 *
 * A multi-etag header (`"a", "b"`) is deliberately not parsed. Nothing produces
 * one: this route sends a single strong etag and the browser echoes it back
 * verbatim.
 */
const bareEtag = (v: string): string => v.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1');

export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key) return new Response('Not found', { status: 404 });

  /*
   * The condition is R2's to evaluate, not this Worker's.
   *
   * This used to read the object unconditionally and then compare If-None-Match
   * against `obj.httpEtag`, under a comment claiming the 304 "saves the R2
   * read". It did not: the read had already happened by then, and all that was
   * saved was the body transfer. Handing `etagDoesNotMatch` to R2 makes the
   * claim true — R2 short-circuits and never reads the object out.
   */
  const ifNoneMatch = request.headers.get('if-none-match');
  const obj = await getObject(
    key,
    ifNoneMatch ? { onlyIf: { etagDoesNotMatch: bareEtag(ifNoneMatch) } } : undefined
  );

  // null still means the object does not exist. A FAILED condition is not null —
  // it comes back as metadata, and is handled after the headers are built.
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  // Re-asserted rather than trusted from object metadata: an object written by
  // some other path (or an older upload) would otherwise decide its own caching.
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  /*
   * The uploader allows raster types only and verifies magic bytes, so a
   * declared type already matches its content. nosniff is the belt to that
   * braces: it stops a browser content-sniffing anything served here into a
   * document and executing it as same-origin script on ibrahimaher.com.
   */
  headers.set('x-content-type-options', 'nosniff');

  /*
   * Cheap 304s. The browser sends If-None-Match after a hard refresh, or once
   * the immutable year lapses.
   *
   * A read whose `onlyIf` failed resolves to a plain R2Object: every scrap of
   * metadata — which is why the headers above are already built from it — and no
   * `.body`. That absence IS the signal; there is no status or flag to read
   * instead. It doubles as the type narrowing that turns R2Object into
   * R2ObjectBody for the return below.
   */
  if (!('body' in obj)) return new Response(null, { status: 304, headers });

  return new Response(obj.body, { headers });
};
