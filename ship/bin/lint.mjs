#!/usr/bin/env node
/**
 * `npm run ship:lint -- --id <draft-id>` - check the copy before it goes out.
 *
 * Runs every user-visible string in a draft through the house-style rules. The
 * publish step runs this too and refuses on any error, so this command exists
 * to surface the problems while the draft is still open, rather than at the
 * moment of publishing.
 *
 * Exit codes:  0 clean  1 errors  2 usage
 *
 * Flags:
 *   --id <slug>   lint ship/drafts/<slug>.json
 *   --file <p>    lint any file, markdown or JSON draft
 *   --fix         apply the safe fixes and rewrite the draft
 *   --quiet       errors only, suppress warnings and notes
 */
import fs from 'node:fs';
import path from 'node:path';
import { DRAFTS_DIR } from '../lib/config.mjs';
import { lint, autofix, formatReport } from '../lib/style.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const id = flag('id');
const file = flag('file');
if (!id && !file) {
  console.error('Usage: node ship/bin/lint.mjs --id <draft-id> | --file <path> [--fix] [--quiet]');
  process.exit(2);
}

const target = file ? path.resolve(file) : path.join(DRAFTS_DIR, `${id}.json`);
if (!fs.existsSync(target)) {
  console.error(`No such file: ${target}`);
  process.exit(2);
}

const raw = fs.readFileSync(target, 'utf8');

/**
 * Which fields carry prose.
 *
 * Slugs, categories, tags and image paths are excluded on purpose. A slug
 * legitimately contains hyphens, and flagging `n8n-automation-erbil-iraq` as an
 * en-dash violation on every run is how a linter earns being ignored.
 */
const PROSE_FIELDS = [
  'title', 'body_md', 'excerpt', 'image_alt', 'hero_alt',
  'seo_title', 'seo_description', 'og_title', 'og_description',
  'external_label', 'cta_heading', 'cta_md',
];

let results = [];
let draft = null;

if (target.endsWith('.json')) {
  try {
    draft = JSON.parse(raw);
  } catch (err) {
    console.error(`${target} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  for (const field of PROSE_FIELDS) {
    const value = draft[field];
    if (typeof value !== 'string' || !value.trim()) continue;
    results.push({ field, ...lint(value, { label: field }) });
  }
  // A template nobody filled in is the single most likely thing to be published
  // by mistake, and no prose rule would catch it.
  const todos = PROSE_FIELDS.filter(
    (f) => typeof draft[f] === 'string' && draft[f].includes('TODO:')
  );
  if (todos.length) {
    results.push({
      field: 'template',
      errors: todos.map((f) => ({
        label: f, rule: 'unfilled-template', line: 1, column: 1,
        message: 'Still contains the scaffold text.', excerpt: '',
      })),
      warnings: [], notes: [], ok: false,
    });
  }
} else {
  results = [{ field: path.basename(target), ...lint(raw, { label: path.basename(target) }) }];
}

if (has('fix')) {
  if (draft) {
    let changed = 0;
    for (const field of PROSE_FIELDS) {
      if (typeof draft[field] !== 'string') continue;
      const fixed = autofix(draft[field]);
      if (fixed !== draft[field]) { draft[field] = fixed; changed++; }
    }
    fs.writeFileSync(target, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');
    console.log(`Applied safe fixes to ${changed} field(s).`);
  } else {
    fs.writeFileSync(target, autofix(raw), 'utf8');
    console.log('Applied safe fixes.');
  }
  console.log('Em dashes are never auto-fixed: replacing one needs to know whether');
  console.log('the clause wanted a comma, a full stop or brackets.\n');
}

const errors = results.flatMap((r) => r.errors);
const warnings = results.flatMap((r) => r.warnings);
const notes = [...new Set(results.flatMap((r) => r.notes))];

console.log(`\n=== style check: ${path.basename(target)} ===\n`);
const report = formatReport({ errors, warnings, notes }, { showWarnings: !has('quiet') });
console.log(report || '  Nothing to report.');

console.log('');
if (errors.length) {
  console.log(`  ${errors.length} error(s). Publishing is blocked until these are gone.\n`);
  process.exit(1);
}
console.log(`  Clean. ${warnings.length} warning(s), ${notes.length} note(s), none blocking.\n`);
