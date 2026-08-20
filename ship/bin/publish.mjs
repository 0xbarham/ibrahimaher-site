#!/usr/bin/env node
/**
 * `npm run ship:publish -- --id <draft-id> [--live]` - put it on the site.
 *
 * DRY BY DEFAULT. Without `--live` this prints the exact SQL it would run and
 * touches nothing. The flag exists because this is the one command in ship/
 * whose mistakes are visible to the public within seconds: the site is SSR from
 * D1, so a row written here is live on the next request, with no build and no
 * deploy in between to act as a pause.
 *
 * ORDER OF OPERATIONS, and why it is this way:
 *   1. lint          bad copy must never reach the database, not even as a draft
 *   2. slug conflict checked before the write, so the failure is a message
 *                    rather than a UNIQUE constraint at the halfway point
 *   3. write         insert, or update when the ledger already knows the row id
 *   4. read back     confirm the row exists holding the values we sent
 *   5. ledger + log  only after the read-back agrees
 *
 * Step 4 is not ceremony. Every earlier step can succeed while the row lands
 * wrong, and a ledger claiming `published` for a row nobody can see is exactly
 * the drift `ship:status` then has to report.
 *
 * Flags:
 *   --id <slug>        required, reads ship/drafts/<slug>.json
 *   --live             actually write
 *   --status <s>       posts only: draft | published | scheduled
 *   --publish-at <iso> posts only, with --status scheduled
 *   --force            publish despite style warnings (errors always block)
 */
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { DRAFTS_DIR, LOG_PATH, SITE_ORIGIN, today, nowUtc } from '../lib/config.mjs';
import { query, execute, buildInsert, buildUpdate, lastInsertId } from '../lib/d1.mjs';
import { lint, formatReport } from '../lib/style.mjs';
import * as ledgerLib from '../lib/ledger.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const id = flag('id');
const live = has('live');
if (!id) {
  console.error('Usage: node ship/bin/publish.mjs --id <draft-id> [--live]');
  process.exit(2);
}

const draftPath = path.join(DRAFTS_DIR, `${id}.json`);
if (!fs.existsSync(draftPath)) {
  console.error(`No draft at ${draftPath}. Run: node ship/bin/draft.mjs --id ${id}`);
  process.exit(2);
}
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));

const PROSE_FIELDS = [
  'title', 'body_md', 'excerpt', 'image_alt', 'hero_alt',
  'seo_title', 'seo_description', 'external_label', 'cta_heading', 'cta_md',
];

function checkStyle() {
  const errors = [];
  const warnings = [];
  const notes = new Set();
  for (const f of PROSE_FIELDS) {
    const v = draft[f];
    if (typeof v !== 'string' || !v.trim()) continue;
    if (v.includes('TODO:')) {
      errors.push({
        label: f, rule: 'unfilled-template', line: 1, column: 1,
        message: 'Still contains the scaffold text.', excerpt: '',
      });
      continue;
    }
    const r = lint(v, { label: f });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    r.notes.forEach((n) => notes.add(n));
  }
  return { errors, warnings, notes: [...notes] };
}

function required(fields) {
  const missing = fields.filter((f) => {
    const v = draft[f];
    return v === undefined || v === null || (typeof v === 'string' && !v.trim());
  });
  if (missing.length) {
    console.error(`\nDraft is missing required field(s): ${missing.join(', ')}\n`);
    process.exit(2);
  }
}

/** Append to the end of the list rather than fighting for a position. Featured
 *  placement is the `featured` flag, not `sort_order`. */
async function nextSortOrder(table) {
  const rows = await query(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM ${table};`);
  return Number(rows[0]?.n ?? 1);
}

async function buildProjectRow(existingId) {
  required(['title', 'body_md', 'image_alt']);
  const row = {
    title: draft.title.trim(),
    // The column is HTML and the draft is markdown. Converting here rather than
    // storing markdown keeps this byte-identical to what the admin panel writes.
    body_html: marked.parse(draft.body_md, { async: false }).trim(),
    tags_json: JSON.stringify(draft.tags ?? []),
    external_url: draft.external_url || null,
    external_label: draft.external_label || null,
    image: draft.image || null,
    image_dark: draft.image_dark || null,
    image_alt: draft.image_alt.trim(),
    featured: draft.featured ? 1 : 0,
    hidden: draft.hidden ? 1 : 0,
  };
  if (!existingId) row.sort_order = draft.sort_order ?? (await nextSortOrder('projects'));
  return row;
}

async function buildPostRow(existingId) {
  required(['slug', 'title', 'category', 'excerpt', 'body_md', 'read_time']);
  const status = flag('status', draft.status || 'draft');
  if (!['draft', 'published', 'scheduled'].includes(status)) {
    console.error(`Unknown status "${status}". One of: draft, published, scheduled`);
    process.exit(2);
  }
  const publishAt = flag('publish-at', draft.publish_at || null);
  if (status === 'scheduled' && !publishAt) {
    console.error('--status scheduled needs --publish-at <ISO-8601 UTC>');
    process.exit(2);
  }

  const row = {
    slug: draft.slug.trim(),
    lang: draft.lang || 'en',
    title: draft.title.trim(),
    category: draft.category.trim(),
    excerpt: draft.excerpt.trim(),
    post_date: draft.post_date || today(),
    read_time: draft.read_time.trim(),
    body_md: draft.body_md,
    status,
    author_id: draft.author_id ?? 1,
    tags_json: JSON.stringify(draft.tags ?? []),
    hero_image: draft.hero_image || null,
    hero_alt: draft.hero_alt || '',
    featured: draft.featured ? 1 : 0,
    updated_at: nowUtc(),
    seo_title: draft.seo_title || '',
    seo_description: draft.seo_description || '',
    seo_keywords: draft.seo_keywords || '',
    canonical_url: draft.canonical_url || '',
    noindex: draft.noindex ? 1 : 0,
    og_title: draft.og_title || '',
    og_description: draft.og_description || '',
    og_image: draft.og_image || '',
    twitter_title: draft.twitter_title || '',
    twitter_description: draft.twitter_description || '',
    twitter_image: draft.twitter_image || '',
    cta_heading: draft.cta_heading || '',
    cta_md: draft.cta_md || '',
    publish_at: publishAt,
  };
  if (!existingId) {
    row.created_at = nowUtc();
    row.sort_order = draft.sort_order ?? (await nextSortOrder('posts'));
  }
  return row;
}

async function main() {
  const kind = draft.kind === 'post' ? 'post' : 'project';
  const table = kind === 'post' ? 'posts' : 'projects';

  // ------------------------------------------------------------- 1. style
  const style = checkStyle();
  console.log('\n=== style check ===\n');
  const report = formatReport(style);
  console.log(report || '  Nothing to report.');
  if (style.errors.length) {
    console.log(`\n  ${style.errors.length} error(s). Nothing was written.\n`);
    process.exit(1);
  }
  if (style.warnings.length && !has('force') && live) {
    console.log(`\n  ${style.warnings.length} warning(s). Read them, then re-run with --force`);
    console.log('  if they are wrong. Nothing was written.\n');
    process.exit(1);
  }

  // -------------------------------------------------- 2. identify the row
  let ledger = ledgerLib.read();
  const item = ledgerLib.find(ledger, id);
  const existingId = item?.site?.table === table ? item.site.id : null;

  if (kind === 'post' && !existingId) {
    const clash = await query(
      `SELECT id, slug FROM posts WHERE slug = '${String(draft.slug).replace(/'/g, "''")}';`
    );
    if (clash.length) {
      console.error(`\nA post already exists with slug "${draft.slug}" (posts#${clash[0].id}).`);
      console.error('Change the slug, or adopt that row into the ledger:');
      console.error(`  node ship/bin/adopt.mjs --table posts --row ${clash[0].id} --id ${id}\n`);
      process.exit(2);
    }
  }

  const row = kind === 'post' ? await buildPostRow(existingId) : await buildProjectRow(existingId);
  const sql = existingId ? buildUpdate(table, existingId, row) : buildInsert(table, row);

  console.log(`\n=== ${existingId ? 'UPDATE' : 'INSERT'} ${table}${existingId ? `#${existingId}` : ''} ===\n`);
  console.log(sql.length > 2000 ? `${sql.slice(0, 2000)}\n  ... (${sql.length} chars total)` : sql);

  if (!live) {
    console.log('\nDry run. Nothing was written. Add --live to publish.\n');
    return;
  }

  // ------------------------------------------------------------- 3. write
  await execute(sql, { label: table });
  const rowId = existingId ?? (await lastInsertId(table));

  // --------------------------------------------------------- 4. read back
  const check = await query(`SELECT * FROM ${table} WHERE id = ${rowId};`);
  if (!check.length) {
    console.error(`\n! Wrote ${table}#${rowId} but cannot read it back. Ledger not updated.\n`);
    process.exit(1);
  }
  if (String(check[0].title).trim() !== String(row.title).trim()) {
    console.error(`\n! ${table}#${rowId} exists but its title does not match what was sent.`);
    console.error(`  sent: ${row.title}\n  live: ${check[0].title}\n`);
    process.exit(1);
  }

  // Every post lives at /blog/<slug>, Arabic included. There is no
  // /ar/blog/[slug] route: `slug` is UNIQUE table-wide, so it already
  // identifies one post, and the route renders it in whatever language the row
  // declares rather than the language of the URL (src/lib/db.ts:getPostBySlug).
  // Only the blog index is per-language.
  const url = kind === 'post'
    ? `${SITE_ORIGIN}/blog/${row.slug}`
    : `${SITE_ORIGIN}/#projects`;

  // ------------------------------------------------------- 5. ledger, log
  const state = kind === 'post' && row.status !== 'published' ? 'captured' : 'published';
  ledger = item
    ? ledgerLib.update(ledger, id, { state, site: { table, id: rowId, url } }).ledger
    : ledgerLib.add(ledger, {
        id, title: row.title, kind, built: today(), state,
        site: { table, id: rowId, url },
        notes: 'Published without a prior ledger entry.',
      }).ledger;
  ledgerLib.write(ledger);

  fs.appendFileSync(
    LOG_PATH,
    `${today()}\t${existingId ? 'update' : 'insert'}\t${table}#${rowId}\t${id}\t${url}\n`,
    'utf8'
  );

  console.log(`\nLive: ${table}#${rowId}`);
  console.log(`      ${url}`);
  if (kind === 'post' && row.status !== 'published') {
    console.log(`      status="${row.status}", so it is not public yet.`);
  }
  console.log(`\nConfirm it renders: node ship/bin/verify.mjs --id ${id}\n`);
}

main().catch((err) => {
  console.error(`\nship:publish failed\n${err.message}\n`);
  process.exit(1);
});
