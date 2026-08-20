#!/usr/bin/env node
/**
 * `npm run ship:patch -- --table projects --row 6 --set image=/media/... --live`
 *
 * Change named columns on one existing row, and nothing else.
 *
 * WHY THIS EXISTS ALONGSIDE ship:publish
 *
 * `publish` owns a whole row and rebuilds it from a draft, converting `body_md`
 * to HTML on the way. That is right for new copy and wrong for an existing
 * project whose body is already good HTML in the database: round-tripping
 * stored HTML out to markdown and back to change one image path would silently
 * reformat prose nobody asked to touch.
 *
 * So this is the narrow tool. It writes the columns you name and leaves every
 * other column exactly as it found it.
 *
 * Same guarantees as publish: the column allowlist is enforced, prose values
 * are style-checked, it is dry unless `--live`, and it reads the row back
 * afterwards rather than trusting the write.
 *
 * Flags:
 *   --table projects|posts   required
 *   --row <id>               required
 *   --set col=value          repeatable; the literal `null` writes NULL
 *   --live                   actually write
 *   --force                  proceed despite style warnings
 */
import fs from 'node:fs';
import { query, execute, buildUpdate, WRITABLE } from '../lib/d1.mjs';
import { lint, formatReport } from '../lib/style.mjs';
import { LOG_PATH, today } from '../lib/config.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const table = flag('table');
const row = Number(flag('row'));
const live = has('live');

if (!['projects', 'posts'].includes(table) || !Number.isInteger(row)) {
  console.error('Usage: node ship/bin/patch.mjs --table projects|posts --row <id> --set col=value [--set ...] [--live]');
  process.exit(2);
}

/** Collect every --set. Split on the FIRST '=' only, so a value containing an
 *  equals sign (a URL with a query string) survives intact. */
const patch = {};
argv.forEach((a, i) => {
  if (a !== '--set') return;
  const pair = argv[i + 1];
  if (!pair || !pair.includes('=')) {
    console.error(`--set needs col=value, got: ${pair}`);
    process.exit(2);
  }
  const eq = pair.indexOf('=');
  const col = pair.slice(0, eq).trim();
  const raw = pair.slice(eq + 1);
  // "null" is how the command line says NULL, which matters here: image_dark
  // set to NULL is the documented way to say "use the light image in both
  // themes", and the string "null" in that column would render as a broken img.
  patch[col] = raw === 'null' ? null : raw;
});

if (!Object.keys(patch).length) {
  console.error('Nothing to set.');
  process.exit(2);
}

const unknown = Object.keys(patch).filter((c) => !WRITABLE[table].includes(c));
if (unknown.length) {
  console.error(`\nNot writable on ${table}: ${unknown.join(', ')}`);
  console.error(`Allowed: ${WRITABLE[table].join(', ')}\n`);
  process.exit(2);
}

/** Integer columns, so `--set featured=1` stores 1 rather than the string "1". */
const INT_COLS = new Set(['featured', 'hidden', 'noindex', 'sort_order', 'author_id']);
for (const [col, value] of Object.entries(patch)) {
  if (INT_COLS.has(col) && value !== null) patch[col] = Number(value);
}

/**
 * Undo MSYS path mangling.
 *
 * Git Bash on Windows rewrites any argument that looks like a Unix absolute
 * path into a Windows one before the process ever sees it, so
 * `--set image=/media/2026/08/x.webp` arrives as
 * `C:/Program Files/Git/media/2026/08/x.webp`. Every site-relative image path
 * starts with a slash, so this fires on essentially every real invocation, and
 * the result is a row holding a path that 404s on the live site.
 *
 * Repairing is right rather than rejecting: the intent is unambiguous, there is
 * no legitimate reason for one of these columns to hold a local filesystem
 * path, and a hard error would just teach the operator to fight the shell. It
 * says what it did, loudly, so the repair is never silent.
 */
const PATH_COLS = new Set(['image', 'image_dark', 'hero_image', 'og_image', 'twitter_image']);
for (const [col, value] of Object.entries(patch)) {
  if (!PATH_COLS.has(col) || typeof value !== 'string') continue;
  const m = /^[A-Za-z]:[\\/].*?(\/(?:media|assets)\/.*)$/.exec(value.replace(/\\/g, '/'));
  if (m) {
    console.log(`  note: repaired an MSYS-mangled path on "${col}"`);
    console.log(`        ${value}`);
    console.log(`     -> ${m[1]}`);
    patch[col] = m[1];
  } else if (/^[A-Za-z]:[\\/]/.test(value)) {
    console.error(`\n"${col}" looks like a local filesystem path, not a site path: ${value}`);
    console.error('Expected something like /media/2026/08/name-abcd1234.webp\n');
    process.exit(2);
  }
}

const PROSE_COLS = new Set([
  'title', 'image_alt', 'hero_alt', 'excerpt', 'external_label',
  'seo_title', 'seo_description', 'cta_heading', 'cta_md', 'body_md',
]);

async function main() {
  const before = await query(`SELECT * FROM ${table} WHERE id = ${row};`);
  if (!before.length) {
    console.error(`No row ${table}#${row}.`);
    process.exit(2);
  }

  // ---------------------------------------------------------------- style
  const errors = [];
  const warnings = [];
  const notes = new Set();
  for (const [col, value] of Object.entries(patch)) {
    if (!PROSE_COLS.has(col) || typeof value !== 'string') continue;
    const r = lint(value, { label: col });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    r.notes.forEach((n) => notes.add(n));
  }
  if (errors.length || warnings.length) {
    console.log('\n=== style check ===\n');
    console.log(formatReport({ errors, warnings, notes: [...notes] }));
  }
  if (errors.length) {
    console.log(`\n  ${errors.length} error(s). Nothing was written.\n`);
    process.exit(1);
  }
  if (warnings.length && live && !has('force')) {
    console.log('\n  Warnings above. Re-run with --force if they are wrong. Nothing written.\n');
    process.exit(1);
  }

  // ----------------------------------------------------------- the change
  console.log(`\n=== ${table}#${row}  "${String(before[0].title).slice(0, 60)}" ===\n`);
  for (const [col, value] of Object.entries(patch)) {
    const was = before[0][col];
    console.log(`  ${col}`);
    console.log(`    was: ${was === null ? 'NULL' : String(was).slice(0, 100)}`);
    console.log(`    now: ${value === null ? 'NULL' : String(value).slice(0, 100)}`);
  }

  const sql = buildUpdate(table, row, patch);
  console.log(`\n${sql}\n`);

  if (!live) {
    console.log('Dry run. Nothing was written. Add --live to apply.\n');
    return;
  }

  await execute(sql, { label: `patch-${table}` });

  // --------------------------------------------------------- read it back
  const after = await query(`SELECT * FROM ${table} WHERE id = ${row};`);
  const wrong = Object.entries(patch).filter(([col, value]) => {
    const got = after[0][col];
    if (value === null) return got !== null;
    return String(got) !== String(value);
  });
  if (wrong.length) {
    console.error(`\n! These columns did not take: ${wrong.map(([c]) => c).join(', ')}\n`);
    process.exit(1);
  }

  /*
    Log it, exactly as ship:publish does.

    A patch is a live write to a public site, and the first evening this tool
    ran it changed two project rows while shipped.log stayed empty, so the only
    record of what had gone out was the terminal scrollback. An audit trail with
    a hole in it is worse than none, because it looks complete.
  */
  fs.appendFileSync(
    LOG_PATH,
    `${today()}\tpatch\t${table}#${row}\t${Object.keys(patch).join(',')}\t-\n`,
    'utf8'
  );

  console.log(`Applied to ${table}#${row}, and read back matching.\n`);
}

main().catch((err) => {
  console.error(`\nship:patch failed\n${err.message}\n`);
  process.exit(1);
});
