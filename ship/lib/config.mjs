/**
 * One place for every path and constant the ship/ tooling depends on.
 *
 * Everything here is deliberately explicit rather than discovered. The routine
 * runs at the end of a working day, often tired, and a tool that guesses which
 * database it is writing to is a tool that will one day guess wrong on a live
 * public site.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export const SHIP_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const SITE_DIR = path.resolve(SHIP_DIR, '..');

export const LEDGER_PATH = path.join(SHIP_DIR, 'ledger.json');
export const DRAFTS_DIR = path.join(SHIP_DIR, 'drafts');
export const INBOX_DIR = path.join(SHIP_DIR, 'inbox');
export const STYLE_PATH = path.join(SHIP_DIR, 'style.md');
export const LOG_PATH = path.join(SHIP_DIR, 'shipped.log');

/** The live D1 database. Named, not id'd, because wrangler resolves the name
 *  against wrangler.jsonc, so this cannot drift from the deployed binding. */
export const D1_DATABASE = 'ibrahimaher-content';
export const R2_BUCKET = 'ibrahimaher-media';

export const SITE_ORIGIN = 'https://ibrahimaher.com';

/**
 * Screenshot geometry.
 *
 * 1600x1000 is a 1.6:1 frame close to how the project cards crop on the
 * homepage. Captured at deviceScaleFactor 2 and downscaled to 1600 wide, so
 * text in an n8n canvas stays legible after webp compression.
 */
export const SHOT = {
  width: 1600,
  height: 1000,
  scale: 2,
  /** Final stored width. Anything wider is bytes no layout will ever use. */
  maxWidth: 1600,
  quality: 82,
};

/**
 * Where the day's work happens.
 *
 * `harvest` walks these looking for what changed today. A path that does not
 * exist is skipped with a warning rather than throwing: the E: volume has a
 * history of dropping out mid-session, and a missing drive must not take the
 * whole routine down with it.
 */
export const WORK_SOURCES = [
  { name: 'brain', path: 'E:/Second Brain/claude-brain' },
  { name: 'site', path: 'C:/Users/Ibrahim/projects/ibrahimaher' },
  { name: 'career-ops', path: 'C:/Users/Ibrahim/career-ops' },
];

/**
 * Path fragments that mean "this contains other people's information".
 *
 * Anything matching is harvested as `client-confidential` rather than `public`,
 * which keeps it out of the publish path unless a person reclassifies it by
 * hand. This is not a nice-to-have: the first real harvest run returned, as its
 * six largest clusters, outreach directories holding named prospects, their
 * email addresses and research notes about their businesses. Those clusters
 * look exactly like a finished project to any heuristic counting changed files.
 *
 * Default deny, and the failure mode is an extra keystroke rather than a
 * stranger's contact details on a public portfolio.
 */
export const SENSITIVE_PATTERNS = [
  /(^|\/)outreach(\/|$)/i,
  /(^|\/)clients?(\/|$)/i,
  /(^|\/)leads?(\/|$)/i,
  /(^|\/)job-hunt(\/|$)/i,
  /(^|\/)resumes?/i,
  /(^|\/)\.raw(\/|$)/i,
  /(^|\/)(cv|contracts?|invoices?|proposals?|agreements?)(\/|$)/i,
  /prospect/i,
  /-(20\d\d)-\d\d(\/|$)/, // dated campaign folders, e.g. iraq-clinics-2026-08
];

export function isSensitive(relPath) {
  return SENSITIVE_PATTERNS.some((re) => re.test(String(relPath).replace(/\\/g, '/')));
}

/** Directories that are never interesting work product. */
export const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', '.astro', '.wrangler', '__pycache__',
  '.venv', 'venv', 'backups', '.obsidian', 'out', '.cache', 'coverage',
  '.next', 'target', 'build', '.pytest_cache', 'shell-snapshots',
]);

export function sourcesThatExist() {
  return WORK_SOURCES.filter((s) => {
    try {
      return fs.statSync(s.path).isDirectory();
    } catch {
      return false;
    }
  });
}

export function missingSources() {
  const live = new Set(sourcesThatExist().map((s) => s.name));
  return WORK_SOURCES.filter((s) => !live.has(s.name));
}

/** YYYY-MM-DD in local time. The working day is local, not UTC. */
export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The timestamp format the existing D1 rows already use: ISO-8601 UTC, no millis. */
export function nowUtc(d = new Date()) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Whole days between two YYYY-MM-DD strings. */
export function daysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}
