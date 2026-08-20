#!/usr/bin/env node
/**
 * `npm run ship:draft -- --id <ledger-id> [--kind post]` - scaffold the copy.
 *
 * Writes ship/drafts/<id>.json with every field the publish step needs, each
 * one carrying a prompt in place of a value. Copy is authored in markdown here
 * and converted to HTML at publish time, for one reason: the style checker
 * reads prose, and prose wrapped in tags is prose it has to guess at. Markdown
 * in, HTML at the boundary.
 *
 * The template deliberately ships with placeholder text that fails the linter.
 * A draft nobody edited must not be publishable by accident.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DRAFTS_DIR, today } from '../lib/config.mjs';
import * as ledgerLib from '../lib/ledger.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const id = flag('id');
if (!id) {
  console.error('Usage: node ship/bin/draft.mjs --id <ledger-id> [--kind project|post]');
  process.exit(2);
}

let ledger = ledgerLib.read();
const item = ledgerLib.find(ledger, id);
const kind = flag('kind', item?.kind || 'project');

const TODO = 'TODO: ';

/**
 * Four paragraphs is the shape that works on this site's project cards: the
 * problem in the reader's own terms, what the build does mechanically, the one
 * genuinely hard part, and the outcome with a number in it.
 */
const projectTemplate = {
  id,
  kind: 'project',
  title: item?.title || `${TODO}the plain name of the thing, not a slogan`,
  body_md: `${TODO}paragraph one. The problem, in the words of whoever had it. No throat-clearing.

${TODO}paragraph two. What the thing does, mechanically. Name the tools.

${TODO}paragraph three. The part that was genuinely hard, and what it cost to solve.

${TODO}paragraph four. What changed afterwards, with a number in it.`,
  tags: [],
  external_url: null,
  external_label: null,
  image: item?.images?.[0] ?? null,
  image_dark: item?.images?.[1] ?? null,
  image_alt: `${TODO}describe the frame, not the project`,
  featured: false,
  hidden: false,
};

const postTemplate = {
  id,
  kind: 'post',
  slug: id,
  lang: 'en',
  title: item?.title || `${TODO}title, sentence case, no colon-subtitle pattern`,
  category: `${TODO}Automation | AI | Technology | Social Media | Career`,
  excerpt: `${TODO}one sentence under 160 characters, not the first line of the post`,
  post_date: today(),
  read_time: `${TODO}e.g. 6 min read`,
  body_md: `${TODO}open on the concrete thing that happened.

## ${TODO}a heading that is a claim, not a label

${TODO}body.`,
  tags: [],
  hero_image: item?.images?.[0] ?? null,
  hero_alt: `${TODO}describe the frame`,
  seo_title: `${TODO}under 60 characters`,
  seo_description: `${TODO}under 155 characters, written for a person, not a crawler`,
  // Drafts are born as drafts. Publishing is a separate, deliberate act, and
  // `ship:publish --live` is the only thing that flips this.
  status: 'draft',
  featured: false,
  cta_heading: '',
  cta_md: '',
};

const out = path.join(DRAFTS_DIR, `${id}.json`);
if (fs.existsSync(out)) {
  console.error(`\n${out} already exists. Edit it, or delete it first.\n`);
  process.exit(2);
}

fs.mkdirSync(DRAFTS_DIR, { recursive: true });
fs.writeFileSync(
  out,
  `${JSON.stringify(kind === 'post' ? postTemplate : projectTemplate, null, 2)}\n`,
  'utf8'
);

if (item) {
  ledger = ledgerLib.update(ledger, id, {
    kind,
    state: item.state === 'published' ? 'published' : 'drafted',
  }).ledger;
  ledgerLib.write(ledger);
}

console.log(`\nDraft: ${out}`);
console.log('\nBefore writing a word, read ship/style.md. Then:');
console.log(`  node ship/bin/lint.mjs --id ${id}`);
console.log(`  node ship/bin/publish.mjs --id ${id}          (dry run)`);
console.log(`  node ship/bin/publish.mjs --id ${id} --live    (writes to the live site)\n`);
