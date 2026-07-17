/**
 * Media library CRUD. Owner-only.
 *
 * Auth is NOT re-checked here: src/middleware.ts guards the whole `/api/media`
 * prefix and fails closed, the same contract /api/content/[table].ts documents.
 * That prefix list is the single point of failure for this route — if
 * `/api/media` ever leaves PROTECTED_PREFIXES, this becomes an anonymous upload
 * endpoint on the apex domain.
 */
import type { APIRoute } from 'astro';
import { json } from '../../lib/auth';
import {
  MAX_UPLOAD_BYTES,
  allowedMimeList,
  deleteMedia,
  isAllowedMime,
  listMedia,
  putMedia,
} from '../../lib/media';

export const prerender = false;

/**
 * Magic-byte signatures, checked against the browser-declared mime.
 *
 * `file.type` is whatever the client says it is, so on its own it decides only
 * the stored extension and Content-Type — not what the bytes actually are.
 * Serving is already hardened (nosniff, and no SVG in the allowlist), so a
 * spoofed type cannot reach script execution. This exists so a mislabelled file
 * fails at UPLOAD with a clear message instead of becoming a permanently broken
 * image that renders as a grey box months later.
 */
const SIGNATURES: Array<{ mime: string; test: (b: Uint8Array) => boolean }> = [
  {
    mime: 'image/png',
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    mime: 'image/webp',
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    // ISO-BMFF: 'ftyp' at offset 4, brand 'avif'/'avis' at 8.
    mime: 'image/avif',
    test: (b) =>
      b[4] === 0x66 &&
      b[5] === 0x74 &&
      b[6] === 0x79 &&
      b[7] === 0x70 &&
      b[8] === 0x61 &&
      b[9] === 0x76 &&
      b[10] === 0x69 &&
      (b[11] === 0x66 || b[11] === 0x73),
  },
];

function bytesMatchMime(buf: ArrayBuffer, mime: string): boolean {
  const head = new Uint8Array(buf.slice(0, 16));
  const sig = SIGNATURES.find((s) => s.mime === mime);
  return sig ? sig.test(head) : false;
}

/**
 * Multipart framing — the boundaries, and a Content-Disposition header per part
 * (`file`, `width`, `height`) — rides on top of the file's own bytes, so
 * Content-Length is always a few hundred bytes larger than the file it carries.
 * Compared against the cap raw, a file legitimately just under it would be
 * refused. This slack keeps the early check CONSERVATIVE: it fires only when the
 * body is too big to contain a legal file no matter how it is framed.
 */
const MULTIPART_SLACK_BYTES = 4096;

/** One message, two callers — see the split documented in POST. */
const tooLarge = (bytes: number) =>
  json(
    {
      ok: false,
      error: `That file is ${(bytes / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB — export it smaller, ideally as WebP.`,
    },
    413
  );

export const GET: APIRoute = async () => {
  try {
    return json({ ok: true, data: await listMedia() });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : 'Could not list media' },
      500
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  /*
   * The size cap is checked TWICE, and the two checks do different jobs.
   *
   * This one reads Content-Length, which arrives with the headers, so an
   * oversized upload is refused before formData() buffers a single byte of it —
   * the point of a cap in a Worker being to not hold the bytes at all. But the
   * header is written by the client: it can be absent (a chunked body has none)
   * and it can lie in either direction. So it may only ever REJECT early, never
   * approve, and a body that passes here has proved nothing.
   *
   * The `file.size` check after the parse is therefore the authoritative one. It
   * measures bytes actually received and is what a lying or missing header falls
   * through to. Deleting either is a real loss: without this one the Worker
   * buffers whatever it is sent before objecting; without that one the cap is
   * advisory and a crafted request walks straight past it.
   */
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + MULTIPART_SLACK_BYTES) {
    return tooLarge(declared);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Expected a multipart form upload.' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return json({ ok: false, error: 'No file was included in the upload.' }, 400);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return tooLarge(file.size);
  }
  if (file.size === 0) {
    return json({ ok: false, error: 'That file is empty.' }, 400);
  }

  const mime = file.type;
  if (!isAllowedMime(mime)) {
    return json(
      {
        ok: false,
        error: `${mime || 'That file type'} is not accepted. Allowed: ${allowedMimeList().join(
          ', '
        )}.`,
      },
      415
    );
  }

  const body = await file.arrayBuffer();
  if (!bytesMatchMime(body, mime)) {
    return json(
      { ok: false, error: `That file claims to be ${mime} but its contents are not.` },
      415
    );
  }

  /*
   * Dimensions come from the browser, which already decoded the image to preview
   * it. Workers have no image decoder, so the alternative is hand-parsing five
   * header formats for values used only to render an admin thumbnail and warn
   * about aspect ratio. Absent or garbage values degrade to NULL, which the
   * schema allows.
   */
  const num = (v: FormDataEntryValue | null): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  try {
    const alt = form.get('alt');
    const row = await putMedia({
      body,
      filename: file.name || 'upload',
      mime,
      alt: typeof alt === 'string' ? alt : '',
      width: num(form.get('width')),
      height: num(form.get('height')),
      now: new Date(),
    });
    return json({ ok: true, data: row }, 201);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Upload failed' }, 500);
  }
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return json({ ok: false, error: 'A numeric id is required.' }, 400);
  }
  try {
    const done = await deleteMedia(id);
    if (!done) return json({ ok: false, error: 'No such image.' }, 404);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Delete failed' }, 500);
  }
};
