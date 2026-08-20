#!/usr/bin/env node
/**
 * `npm run ship:ingest -- --id <ledger-id> --alt "..."` - put images on the CDN.
 *
 * Takes whatever is sitting in ship/inbox/<id>/, normalises it, uploads it to
 * R2, and indexes it in the `media` table. Prints the `/media/<key>` URLs that
 * a project or post row then points at.
 *
 * THE KEY FORMAT IS NOT ARBITRARY. It reproduces `buildKey()` in
 * src/lib/media.ts exactly: `YYYY/MM/<slug>-<8 hex>.<ext>`. An image uploaded
 * here is therefore indistinguishable from one uploaded through the admin
 * panel, which means the admin's media library lists it, its delete button
 * works on it, and nothing downstream needs to know which path produced it.
 *
 * The random suffix is what makes `/media/*` safe to serve `immutable`: a key
 * always maps to the same bytes, and re-uploading mints a new key rather than
 * silently swapping the image under every page that already embeds it.
 *
 * ALT TEXT IS REQUIRED, and the check is not politeness. These images are the
 * only evidence on a portfolio page that the work exists; a screen reader
 * reaching an empty alt finds a project with no content at all. `--alt` should
 * describe what is in the frame rather than repeat the project title.
 *
 * Flags:
 *   --id <slug>     required, the ledger item
 *   --alt "..."     required, unless every file has a sidecar .txt beside it
 *   --file <path>   ingest one specific file instead of the whole inbox folder
 *   --width N       override the stored width (default 1600)
 *   --dry           show what would happen, upload nothing
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { INBOX_DIR, R2_BUCKET, SHOT, nowUtc } from '../lib/config.mjs';
import { r2Put, execute, buildInsert, query } from '../lib/d1.mjs';
import * as ledgerLib from '../lib/ledger.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const id = flag('id');
const alt = flag('alt');
const dry = has('dry');

if (!id) {
  console.error('Usage: node ship/bin/ingest.mjs --id <slug> --alt "what the image shows"');
  process.exit(2);
}

/** Mirrors buildKey() in src/lib/media.ts. Kept in step by ship:doctor. */
function buildKey(filename, ext, now = new Date()) {
  const base = filename
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

async function main() {
  const single = flag('file');
  const dir = path.join(INBOX_DIR, id);

  let files;
  if (single) {
    files = [path.resolve(single)];
  } else {
    if (!fs.existsSync(dir)) {
      console.error(`Nothing to ingest: ${dir} does not exist.`);
      console.error('Capture into it first, or pass --file <path>.');
      process.exit(2);
    }
    files = fs.readdirSync(dir)
      .filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f))
      .sort() // dark before light, which keeps output order stable run to run
      .map((f) => path.join(dir, f));
  }

  if (!files.length) {
    console.error(`No images found in ${dir}`);
    process.exit(2);
  }

  // Alt text can come from a sidecar file per image, which is how a set of
  // three screenshots gets three different descriptions instead of one reused.
  const altFor = (file) => {
    const sidecar = file.replace(/\.[^.]+$/, '.txt');
    if (fs.existsSync(sidecar)) return fs.readFileSync(sidecar, 'utf8').trim();
    return alt;
  };

  const missingAlt = files.filter((f) => !altFor(f));
  if (missingAlt.length) {
    console.error(`\nAlt text missing for: ${missingAlt.map((f) => path.basename(f)).join(', ')}`);
    console.error('Pass --alt "..." or drop a matching .txt beside each image.');
    console.error('An unlabelled screenshot is an empty project to anyone using a screen reader.\n');
    process.exit(2);
  }

  const maxWidth = Number(flag('width', String(SHOT.maxWidth)));
  const results = [];

  for (const file of files) {
    const label = path.basename(file, path.extname(file));
    const meta = await sharp(file).metadata();

    // webp at q82, never upscaled. Metadata is dropped: a screenshot carries
    // the machine's colour profile and sometimes a filesystem path, neither of
    // which belongs on a public CDN.
    const buffer = await sharp(file)
      .resize({ width: Math.min(maxWidth, meta.width || maxWidth), withoutEnlargement: true })
      .webp({ quality: SHOT.quality })
      .toBuffer();
    const out = await sharp(buffer).metadata();

    const key = buildKey(`${id}-${label}`, 'webp');
    const url = `/media/${key}`;
    const saved = 1 - buffer.length / fs.statSync(file).size;

    console.log(
      `  ${path.basename(file)}  ${meta.width}x${meta.height} ` +
      `-> ${out.width}x${out.height} webp  ` +
      `${(buffer.length / 1024).toFixed(0)} KB (${(saved * 100).toFixed(0)}% smaller)`
    );

    if (dry) { results.push({ key, url, label }); continue; }

    const tmp = path.join(os.tmpdir(), `ship-${path.basename(key)}`);
    await fsp.writeFile(tmp, buffer);
    try {
      await r2Put(R2_BUCKET, key, tmp, 'image/webp');
    } finally {
      await fsp.rm(tmp, { force: true });
    }

    // Row after bytes, matching putMedia()'s ordering: an object with no row is
    // invisible junk costing a fraction of a cent, while a row pointing at
    // bytes that were never written is a broken image on the live site.
    await execute(
      buildInsert('media', {
        key,
        url,
        filename: `${id}-${label}.webp`,
        mime: 'image/webp',
        bytes: buffer.length,
        width: out.width ?? null,
        height: out.height ?? null,
        alt: altFor(file).slice(0, 500),
        created_at: nowUtc(),
      }),
      { label: 'media' }
    );

    results.push({ key, url, label });
  }

  if (dry) {
    console.log('\nDry run. Nothing uploaded.\n');
    return;
  }

  // Confirm the rows actually landed rather than trusting the write.
  const keys = results.map((r) => `'${r.key.replace(/'/g, "''")}'`).join(', ');
  const seen = await query(`SELECT key FROM media WHERE key IN (${keys});`);
  if (seen.length !== results.length) {
    console.error(`\n! Uploaded ${results.length} object(s) but only ${seen.length} media row(s) exist.`);
    process.exit(1);
  }

  let ledger = ledgerLib.read();
  const existing = ledgerLib.find(ledger, id);
  if (existing) {
    ledger = ledgerLib.update(ledger, id, {
      images: [...new Set([...(existing.images || []), ...results.map((r) => r.url)])],
      // Only ever advance. A new screenshot added to a live project must not
      // drag it back out of `published`.
      state: existing.state === 'published' ? 'published' : 'captured',
    }).ledger;
    ledgerLib.write(ledger);
    console.log(`\nLedger: ${id} -> ${ledgerLib.find(ledger, id).state}`);
  } else {
    console.log(`\nNote: no ledger item "${id}". Images uploaded, nothing recorded against them.`);
  }

  console.log('\nURLs for the project or post row:');
  for (const r of results) console.log(`  ${r.label.padEnd(8)} ${r.url}`);
  console.log('');
}

main().catch((err) => {
  console.error(`\nship:ingest failed\n${err.message}\n`);
  process.exit(1);
});
