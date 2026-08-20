#!/usr/bin/env node
/**
 * `npm run ship:harvest` - what did we actually build today.
 *
 * WHY NOT JUST `git log`
 *
 * Because most of the day's real output is not committed. The working
 * repositories carry large amounts of untracked and modified material at any
 * moment, and a harvest that only reads commits reports "nothing new today" on
 * a day that produced three finished things. So this reads three signals and
 * merges them:
 *
 *   1. commits since --since (authored work, already named)
 *   2. `git status` porcelain (modified and untracked, the usual case)
 *   3. an mtime walk (covers directories that are not repositories at all)
 *
 * It proposes; it does not decide. Everything lands in the ledger as `idea`,
 * and a person promotes it to `queued` or `skipped`. That boundary is
 * deliberate: an automatic path from "a file changed" to "published on the
 * public internet" is how a client's private workflow ends up on a portfolio.
 *
 * Flags:
 *   --since YYYY-MM-DD   default: today
 *   --write              record findings in the ledger (default: dry run)
 *   --min-files N        ignore clusters smaller than this (default 2)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as ledgerLib from '../lib/ledger.mjs';
import { sourcesThatExist, missingSources, IGNORE_DIRS, isSensitive, today } from '../lib/config.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const SINCE = flag('since', today());
const MIN_FILES = Number(flag('min-files', '2'));
const WRITE = has('write');

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

const isRepo = (dir) => fs.existsSync(path.join(dir, '.git'));

/**
 * Group changed files into candidate projects.
 *
 * The unit of "a thing we built" is a directory, not a file. Two levels below
 * the repo root is the level that usually names a project
 * (`n8n/bilingual-carousel-publisher`), while the repo root is too coarse and
 * a leaf file is too fine.
 */
function clusterKey(relPath) {
  const parts = relPath.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '.';
  return parts.slice(0, 2).join('/');
}

function collect(source) {
  const files = new Map(); // relPath -> reason

  if (isRepo(source.path)) {
    const log = git(source.path, [
      'log', `--since=${SINCE} 00:00`, '--name-only', '--pretty=format:%H',
    ]);
    for (const line of log.split('\n')) {
      const t = line.trim();
      if (!t || /^[0-9a-f]{40}$/.test(t)) continue;
      files.set(t, 'committed');
    }
    const porcelain = git(source.path, ['status', '--porcelain=v1', '--untracked-files=all']);
    for (const line of porcelain.split('\n')) {
      if (!line.trim()) continue;
      const rel = line.slice(3).trim().replace(/^"(.*)"$/, '$1');
      if (!rel) continue;
      files.set(rel, line.startsWith('??') ? 'untracked' : 'modified');
    }
  }

  // mtime walk. Also covers repos, which catches a file worked on today that
  // git considers unchanged because it was committed and then reverted.
  const cutoff = Date.parse(`${SINCE}T00:00:00`);
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory, most often the E: volume dropping out
    }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.raw') continue;
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, depth + 1);
      } else {
        try {
          if (fs.statSync(full).mtimeMs >= cutoff) {
            const rel = path.relative(source.path, full).replace(/\\/g, '/');
            if (!files.has(rel)) files.set(rel, 'touched');
          }
        } catch { /* raced or unreadable; not worth failing the harvest */ }
      }
    }
  };
  walk(source.path, 0);

  const clusters = new Map();
  for (const [rel, reason] of files) {
    const key = clusterKey(rel);
    if (!clusters.has(key)) clusters.set(key, { key, files: [], reasons: new Set() });
    const c = clusters.get(key);
    c.files.push(rel);
    c.reasons.add(reason);
  }
  return [...clusters.values()]
    .filter((c) => c.files.length >= MIN_FILES)
    .sort((a, b) => b.files.length - a.files.length)
    .map((c) => ({ ...c, source: source.name, root: source.path, reasons: [...c.reasons] }));
}

function main() {
  for (const s of missingSources()) console.log(`!  skipping unreachable source: ${s.path}`);

  const clusters = sourcesThatExist().flatMap(collect);

  if (!clusters.length) {
    console.log(`\nNothing changed in any work source since ${SINCE}.`);
    console.log('If that is a surprise, check the drive before believing it.\n');
    return;
  }

  let ledger = ledgerLib.read();
  const known = new Set(ledger.items.map((i) => i.id));

  console.log(`\n=== WORK SINCE ${SINCE} ===\n`);
  const proposals = [];

  for (const c of clusters) {
    const id = ledgerLib.slugify(c.key);
    const seen = known.has(id);
    const sensitive = isSensitive(c.key);
    console.log(`  ${seen ? 'known' : 'NEW  '}  ${String(c.files.length).padStart(3)} files  ` +
      `${c.source}/${c.key}  [${c.reasons.join(',')}]${sensitive ? '  CONFIDENTIAL' : ''}`);
    for (const f of c.files.slice(0, 4)) console.log(`               ${f}`);
    if (c.files.length > 4) console.log(`               ... and ${c.files.length - 4} more`);
    if (!seen) proposals.push({ id, cluster: c, sensitive });
  }

  const confidential = proposals.filter((p) => p.sensitive).length;
  if (confidential) {
    console.log(`\n  ${confidential} cluster(s) match a confidential path and will be recorded as`);
    console.log('  client-confidential. They stay out of the publish path until a person');
    console.log('  changes that by hand. See SENSITIVE_PATTERNS in ship/lib/config.mjs.');
  }

  if (!proposals.length) {
    console.log('\nEverything here is already in the ledger. Run ship:status for what to do next.\n');
    return;
  }

  console.log(`\n${proposals.length} candidate(s) not yet in the ledger.`);

  if (!WRITE) {
    console.log('Dry run. Re-run with --write to record them as ideas.\n');
    return;
  }

  for (const p of proposals) {
    ledger = ledgerLib.add(ledger, {
      id: p.id,
      title: p.cluster.key,
      kind: 'project',
      source: path.join(p.cluster.root, p.cluster.key).replace(/\\/g, '/'),
      built: today(),
      state: p.sensitive ? 'skipped' : 'idea',
      visibility: p.sensitive ? 'client-confidential' : 'public',
      notes: p.sensitive
        ? `Path matches a confidential pattern, so it was skipped rather than queued. ` +
          `${p.cluster.files.length} files under ${p.cluster.source}/${p.cluster.key}. ` +
          'Reclassify by hand if some part of it is genuinely publishable.'
        : `Harvested from ${p.cluster.source}: ${p.cluster.files.length} files ` +
          `(${p.cluster.reasons.join(', ')}). Title and visibility need a human.`,
    }).ledger;
  }
  ledgerLib.write(ledger);
  console.log(`Recorded ${proposals.length} as "idea" in ship/ledger.json.`);
  console.log('Next: set a real title and visibility, then promote to "queued" or "skipped".\n');
}

main();
