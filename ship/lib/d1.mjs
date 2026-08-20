/**
 * Reading and writing the live D1 database, and the R2 bucket, through wrangler.
 *
 * WHY WRANGLER AND NOT THE ADMIN API
 *
 * The site's own write path is `/api/content/<table>`, guarded by a session
 * cookie from the admin login. Driving that from a script means holding the
 * admin password somewhere a script can read it, which is exactly the thing
 * worth not doing. wrangler is already authenticated with an OAuth token
 * carrying `d1 (write)`, so the credential is one the machine's owner already
 * granted, is scoped, and can revoke from the dashboard.
 *
 * The trade is that these writes bypass the column allowlist in
 * src/lib/schema.ts. WRITABLE below mirrors that list on this side, and
 * `ship/bin/doctor.mjs` diffs the two so they cannot quietly disagree.
 *
 * WHY THE SITE GOES LIVE WITHOUT A DEPLOY
 *
 * Every public route is SSR and reads D1 on the request. A row written here is
 * live on the next request, with no build and no `wrangler deploy`. The only
 * things that still need a deploy are build-time assets: `public/assets/**` and
 * the generated OG cards. Images published through ship/ go to R2 instead and
 * are served at `/media/<key>` at runtime, which is what keeps the daily
 * routine deploy-free.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { D1_DATABASE, SITE_DIR } from './config.mjs';

const run = promisify(execFile);

/**
 * A generous buffer. `SELECT *` over the posts table pulls every body_md in the
 * database; node's 1 MB default silently truncates that into invalid JSON.
 */
const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Wrangler is invoked as a JS file under this process's own node, never through
 * the `npx` shim.
 *
 * On Windows `npx` is a .cmd, and since the CVE-2024-27980 fix node refuses to
 * spawn .cmd without `shell: true` - it fails with a bare `spawn EINVAL`, which
 * says nothing about the cause. Turning the shell on would fix that and hand
 * every argument to cmd.exe for a second round of parsing, which is a poor
 * trade when a post body full of quotes is about to travel down this pipe.
 * Resolving the entry point sidesteps both, and skips npx's resolution cost on
 * every call.
 */
const WRANGLER_BIN = fileURLToPath(
  new URL('../../node_modules/wrangler/bin/wrangler.js', import.meta.url)
);

async function wrangler(args) {
  try {
    return await run(process.execPath, [WRANGLER_BIN, ...args], {
      cwd: SITE_DIR,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    });
  } catch (err) {
    // execFile rejects with the streams attached; wrangler's real complaint is
    // almost always on stderr and is far more useful than "exit code 1".
    const detail = [err.stderr, err.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`wrangler ${args.slice(0, 3).join(' ')} failed:\n${detail || err.message}`);
  }
}

/**
 * wrangler prints a banner before the JSON. Anchor on a `[` that starts a line
 * rather than the first `[` anywhere, so a bracket in the banner (a version
 * range, a deprecation notice) cannot shift the slice.
 */
function parseJsonPayload(stdout) {
  const m = /^\[/m.exec(stdout);
  if (!m) throw new Error(`No JSON payload in wrangler output:\n${stdout.slice(0, 800)}`);
  return JSON.parse(stdout.slice(m.index));
}

/** Run a read-only statement against the live database. Returns the rows. */
export async function query(sql) {
  const { stdout } = await wrangler([
    'd1', 'execute', D1_DATABASE, '--remote', '--json', '--command', sql,
  ]);
  return parseJsonPayload(stdout)[0]?.results ?? [];
}

/**
 * Run write statements from a temp file.
 *
 * `--command` is deliberately not used for writes: a project body or a post
 * body is multi-line markdown containing quotes and newlines, and pushing that
 * through an argv string is where quoting bugs turn into half-written rows.
 * A file has no such edge.
 */
export async function execute(sql, { label = 'write' } = {}) {
  const file = path.join(
    os.tmpdir(),
    `ship-${label}-${crypto.randomBytes(6).toString('hex')}.sql`
  );
  await fs.writeFile(file, sql, 'utf8');
  try {
    const { stdout } = await wrangler([
      'd1', 'execute', D1_DATABASE, '--remote', '--json', '--file', file,
    ]);
    return parseJsonPayload(stdout);
  } finally {
    await fs.rm(file, { force: true });
  }
}

/**
 * SQL literal.
 *
 * Doubling the single quote is the whole escape SQLite needs for a string. The
 * other two cases are the ones that bite: `undefined` must become NULL rather
 * than the four letters "undefined", and a boolean must become 1/0 rather than
 * "true", because every flag column in this schema is INTEGER.
 */
export function lit(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Refusing to write non-finite number: ${value}`);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * The writable-column allowlist, mirrored from src/lib/schema.ts.
 *
 * Kept as a copy rather than imported because that module is TypeScript and
 * transitively pulls `cloudflare:workers`, a specifier only the Workers runtime
 * resolves, which would make it unimportable from plain node. The cost is that
 * the two can drift, so `ship/bin/doctor.mjs` diffs them and fails if they do.
 */
export const WRITABLE = {
  projects: [
    'sort_order', 'title', 'body_html', 'tags_json', 'icon_light', 'icon_dark',
    'featured', 'featured_logo', 'featured_logo_dark', 'external_url', 'external_label',
    'image', 'image_dark', 'image_alt', 'hidden',
  ],
  posts: [
    'sort_order', 'slug', 'title', 'category', 'excerpt', 'post_date', 'read_time',
    'body_md', 'status', 'author_id', 'tags_json', 'hero_image', 'hero_alt',
    'featured', 'updated_at', 'created_at',
    'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'noindex',
    'og_title', 'og_description', 'og_image',
    'twitter_title', 'twitter_description', 'twitter_image',
    'cta_heading', 'cta_md', 'publish_at', 'lang',
  ],
  media: ['key', 'url', 'filename', 'mime', 'bytes', 'width', 'height', 'alt', 'created_at'],
};

export function assertColumns(table, row) {
  const allowed = WRITABLE[table];
  if (!allowed) throw new Error(`ship/ does not write to table "${table}"`);
  const bad = Object.keys(row).filter((c) => !allowed.includes(c));
  if (bad.length) {
    throw new Error(
      `Column(s) not writable on "${table}": ${bad.join(', ')}\nAllowed: ${allowed.join(', ')}`
    );
  }
}

export function buildInsert(table, row) {
  assertColumns(table, row);
  const cols = Object.keys(row);
  if (!cols.length) throw new Error(`Nothing to insert into ${table}`);
  return `INSERT INTO ${table} (${cols.join(', ')})\nVALUES (${cols.map((c) => lit(row[c])).join(', ')});`;
}

export function buildUpdate(table, id, row) {
  assertColumns(table, row);
  const cols = Object.keys(row);
  if (!cols.length) throw new Error(`Nothing to update on ${table}`);
  if (!Number.isInteger(id)) throw new Error(`Update needs an integer id, got ${id}`);
  const set = cols.map((c) => `  ${c} = ${lit(row[c])}`).join(',\n');
  return `UPDATE ${table} SET\n${set}\nWHERE id = ${id};`;
}

/** The id of the row a bare INSERT just created. */
export async function lastInsertId(table) {
  const rows = await query(`SELECT MAX(id) AS id FROM ${table};`);
  return Number(rows[0]?.id ?? 0);
}

/** R2 object upload. Same reasoning as the D1 writes: reuse wrangler's token. */
export async function r2Put(bucket, key, file, contentType) {
  await wrangler([
    'r2', 'object', 'put', `${bucket}/${key}`,
    '--file', file,
    '--content-type', contentType,
    '--cache-control', 'public, max-age=31536000, immutable',
    '--remote',
  ]);
  return key;
}

export async function r2Delete(bucket, key) {
  await wrangler(['r2', 'object', 'delete', `${bucket}/${key}`, '--remote']);
}

export async function whoami() {
  const { stdout } = await wrangler(['whoami']);
  return stdout;
}
