#!/usr/bin/env node
/**
 * `npm run ship:adopt -- --table projects --row 6 --id rabt-labs` - take an
 * existing live row into the ledger.
 *
 * Everything already on the site predates this tooling, so on a first run
 * `ship:status` reports the whole site as untracked. That is correct, and it is
 * noise. Adopting a row records that it is live and accounted for, which turns
 * the untracked list into a real signal: once the backlog is adopted, anything
 * appearing there was published outside the routine, and that is worth knowing.
 *
 * Reads D1, never writes to it. The row is already live; this only records the
 * fact locally.
 *
 * Flags:
 *   --table projects|posts   required
 *   --row <id>               the D1 row id
 *   --all                    adopt every row in the table not already tracked
 *   --id <slug>              ledger id (default: derived from slug or title)
 *   --built YYYY-MM-DD       when it was built (default: post_date, else today)
 */
import { query } from '../lib/d1.mjs';
import * as ledgerLib from '../lib/ledger.mjs';
import { SITE_ORIGIN, today } from '../lib/config.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const table = flag('table');
if (!['projects', 'posts'].includes(table)) {
  console.error('Usage: node ship/bin/adopt.mjs --table projects|posts (--row <id> | --all) [--id <slug>]');
  process.exit(2);
}

/**
 * Every post lives at /blog/<slug>, Arabic included.
 *
 * There is no /ar/blog/[slug] route and that is deliberate: `slug` is UNIQUE
 * across the whole table, so it already identifies one post, and the route
 * renders it in whatever language the row declares rather than the language of
 * the URL it was reached through (see src/lib/db.ts:getPostBySlug). Only the
 * blog *index* is per-language. Building /ar/blog/<slug> produces a 404, which
 * is what the first verify run reported.
 */
function urlFor(t, row) {
  if (t === 'posts') return `${SITE_ORIGIN}/blog/${row.slug}`;
  return `${SITE_ORIGIN}/#projects`;
}

/** Titles in this database contain HTML entities (one project is literally
 *  titled "...&amp;..."), so decode before slugifying, or the ledger id ends up
 *  with "amp" in the middle of it. */
function decode(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function main() {
  let ledger = ledgerLib.read();
  const tracked = new Set(
    ledger.items
      .filter((i) => i.site?.table === table && i.site?.id != null)
      .map((i) => i.site.id)
  );

  const rows = has('all')
    ? await query(`SELECT * FROM ${table} ORDER BY id ASC;`)
    : await query(`SELECT * FROM ${table} WHERE id = ${Number(flag('row'))};`);

  if (!rows.length) {
    console.error(`No matching row in ${table}.`);
    process.exit(2);
  }

  let added = 0;
  for (const row of rows) {
    if (tracked.has(row.id)) continue;
    const title = decode(row.title);
    const id = has('all')
      ? ledgerLib.slugify(row.slug || title)
      : (flag('id') || ledgerLib.slugify(row.slug || title));

    const res = ledgerLib.add(ledger, {
      id,
      title,
      kind: table === 'posts' ? 'post' : 'project',
      built: flag('built', row.post_date || row.created_at?.slice(0, 10) || today()),
      // Adoption records reality. A hidden project or an unpublished draft is
      // live-but-invisible, which is not `published`, so it re-enters the
      // pipeline as `captured` and the routine asks about it again.
      state: row.hidden || row.status === 'draft' ? 'captured' : 'published',
      visibility: 'public',
      site: { table, id: row.id, url: urlFor(table, row) },
      images: [row.image, row.image_dark, row.hero_image].filter(Boolean),
      notes: 'Adopted: published before ship/ existed.',
    });
    if (res.created) {
      ledger = res.ledger;
      added++;
      console.log(`  + ${table}#${row.id}  ${id}`);
    } else {
      console.log(`  ! ledger id "${id}" is taken; ${table}#${row.id} not adopted`);
    }
  }

  if (added) {
    ledgerLib.write(ledger);
    console.log(`\nAdopted ${added} row(s) into the ledger.\n`);
  } else {
    console.log('\nNothing new to adopt.\n');
  }
}

main().catch((err) => {
  console.error(`\nship:adopt failed\n${err.message}\n`);
  process.exit(1);
});
