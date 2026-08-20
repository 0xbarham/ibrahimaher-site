#!/usr/bin/env node
/**
 * `npm run ship:doctor` - preflight. Run before the first publish of a session.
 *
 * Every check here corresponds to a way the routine could write something wrong
 * to a live public site, or silently do nothing and report success. Nothing is
 * checked merely because it is easy to check.
 */
import fs from 'node:fs';
import path from 'node:path';
import { query, whoami, WRITABLE } from '../lib/d1.mjs';
import * as ledgerLib from '../lib/ledger.mjs';
import { SITE_DIR, STYLE_PATH, sourcesThatExist, missingSources } from '../lib/config.mjs';

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const warn = (m) => console.log(`  warn  ${m}`);
const bad = (m) => { failures++; console.log(`  FAIL  ${m}`); };

/**
 * The column allowlist in lib/d1.mjs is a hand-kept copy of the one in
 * src/lib/schema.ts (that module cannot be imported from plain node; the reason
 * is documented there). A copy that drifts is worse than no copy, because it
 * fails at the moment of writing to the live database. So diff them here.
 */
function checkSchemaDrift() {
  const src = path.join(SITE_DIR, 'src', 'lib', 'schema.ts');
  let text;
  try {
    text = fs.readFileSync(src, 'utf8');
  } catch {
    warn(`cannot read ${src}; skipping the allowlist drift check`);
    return;
  }
  const block = /export const TABLE_COLUMNS = \{([\s\S]*?)\n\} as const;/.exec(text);
  if (!block) { warn('TABLE_COLUMNS not found in schema.ts; skipping drift check'); return; }

  /*
    Strip comments before reading the quoted names out.

    Not defensive tidying: the first run of this check reported a phantom column
    "en", picked up from the words `default of 'en'` inside a comment explaining
    the lang column. A drift checker that invents drift gets ignored within a
    week, which costs more than the check was ever worth.
  */
  const source = block[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  for (const table of Object.keys(WRITABLE)) {
    const m = new RegExp(`\\b${table}:\\s*\\[([\\s\\S]*?)\\]`).exec(source);
    if (!m) { bad(`schema.ts has no allowlist for "${table}"`); continue; }
    const theirs = new Set([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
    const ours = new Set(WRITABLE[table]);
    const extra = [...ours].filter((c) => !theirs.has(c));
    const missing = [...theirs].filter((c) => !ours.has(c));
    if (extra.length) {
      bad(`ship writes ${table} column(s) the site does not allow: ${extra.join(', ')}`);
    } else if (missing.length) {
      warn(`schema.ts allows ${table} column(s) ship never writes: ${missing.join(', ')}`);
    } else {
      ok(`${table} allowlist matches src/lib/schema.ts`);
    }
  }
}

async function main() {
  console.log('\n=== ship doctor ===\n');

  try {
    const out = await whoami();
    ok('wrangler is authenticated');
    if (!out.includes('d1 (write)')) bad('the wrangler token lacks d1 (write); publishes will fail');
  } catch (err) {
    bad(`wrangler is not usable: ${err.message.split('\n')[0]}`);
  }

  try {
    const rows = await query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('projects','posts','media');"
    );
    const names = new Set(rows.map((r) => r.name));
    for (const t of ['projects', 'posts', 'media']) {
      if (names.has(t)) ok(`table ${t} exists`);
      else bad(`table ${t} is missing from the live database`);
    }
  } catch (err) {
    bad(`cannot read the live database: ${err.message.split('\n')[0]}`);
  }

  checkSchemaDrift();

  try {
    const l = ledgerLib.read();
    ok(`ledger reads clean (${l.items.length} item(s))`);
    const dupes = l.items.map((i) => i.id).filter((id, i, a) => a.indexOf(id) !== i);
    if (dupes.length) bad(`duplicate ledger ids: ${[...new Set(dupes)].join(', ')}`);
    const badState = l.items.filter((i) => !ledgerLib.STATES.includes(i.state));
    if (badState.length) bad(`unknown state on: ${badState.map((i) => i.id).join(', ')}`);
    const unexplained = l.items.filter((i) => i.state === 'skipped' && !i.notes);
    if (unexplained.length) {
      warn(`skipped with no reason recorded: ${unexplained.map((i) => i.id).join(', ')}`);
    }
  } catch (err) {
    bad(err.message);
  }

  // The routine loads the style guide before it writes a word. Without it there
  // is nothing defining the voice, and the copy reverts to the default one.
  if (fs.existsSync(STYLE_PATH)) ok('style guide present');
  else bad(`no style guide at ${STYLE_PATH}; the routine has nothing to write to`);

  const hasPlaywright = fs.existsSync(path.join(SITE_DIR, 'node_modules', 'playwright-core'));
  const chrome = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].find((p) => fs.existsSync(p));
  if (hasPlaywright && chrome) ok('headless capture available (playwright-core + installed Chrome)');
  else if (!hasPlaywright) warn('playwright-core not installed; ship:capture prints how, manual capture still works');
  else warn('no Chrome found; ship:capture needs one');

  for (const s of sourcesThatExist()) ok(`work source reachable: ${s.path}`);
  for (const s of missingSources()) warn(`work source unreachable: ${s.path}`);

  console.log(failures ? `\n${failures} blocking problem(s). Do not publish yet.\n` : '\nAll clear.\n');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
