/**
 * The ledger: the answer to "what have we built, and is it on the site yet".
 *
 * WHY A FILE AND NOT JUST THE DATABASE
 *
 * D1 knows what is published. It cannot know what was built and deliberately
 * held back, what is waiting on a screenshot, or what is a client's and will
 * never be published at all. Those three states are most of the interesting
 * ones, and without somewhere to record them every end-of-day review starts by
 * rediscovering the same decisions.
 *
 * The ledger is therefore the intent, and D1 is the fact. `status` reconciles
 * the two and reports where they disagree, which is the only place a bug hides.
 *
 * SHAPE
 *   { version, updated, items: [ {
 *       id          kebab-case, stable, never reused
 *       title       working title, not necessarily the published one
 *       kind        'project' | 'post'
 *       source      absolute path to where it was built, or ''
 *       built       YYYY-MM-DD, the day it became a real thing
 *       state       see STATES
 *       visibility  'public' | 'client-confidential' | 'internal'
 *       site        { table, id, url }   id is null until published
 *       images      [ '/media/2026/08/foo-ab12cd34.webp', ... ]
 *       notes       free text, usually why it is not shipped
 *   } ] }
 */
import fs from 'node:fs';
import { LEDGER_PATH, today } from './config.mjs';

/**
 * The state machine, in order. Each state answers "what is the next action".
 *
 *   idea       captured so it is not forgotten. No action yet.
 *   queued     decided it should ship. Next: write and capture.
 *   drafted    copy exists in ship/drafts. Next: capture images.
 *   captured   images are in R2. Next: publish.
 *   published  live. Terminal, unless it is revised.
 *   skipped    deliberately not shipping. Terminal, and `notes` must say why.
 */
export const STATES = ['idea', 'queued', 'drafted', 'captured', 'published', 'skipped'];

/** What to do next, given a state. Printed by `status`, so the routine never
 *  has to remember the order. */
export const NEXT_ACTION = {
  idea: 'decide: queue it or skip it',
  queued: 'write the draft (ship/bin/new-draft.mjs)',
  drafted: 'capture and ingest an image',
  captured: 'publish',
  published: 'nothing',
  skipped: 'nothing',
};

const EMPTY = { version: 1, updated: today(), items: [] };

export function read() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    if (!Array.isArray(parsed.items)) throw new Error('ledger.items is not an array');
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return structuredClone(EMPTY);
    // A corrupt ledger must never be silently replaced with an empty one: that
    // erases the record of every decision already made.
    throw new Error(`Cannot read ${LEDGER_PATH}: ${err.message}`);
  }
}

export function write(ledger) {
  const next = { ...ledger, updated: today() };
  next.items = [...ledger.items].sort((a, b) => (b.built || '').localeCompare(a.built || ''));
  fs.writeFileSync(LEDGER_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function find(ledger, id) {
  return ledger.items.find((i) => i.id === id) || null;
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Add an item, or return the existing one. Never silently overwrites: two
 *  different builds landing on one id is a naming problem, not a merge. */
export function add(ledger, item) {
  if (!item.id) throw new Error('Ledger item needs an id');
  if (item.state && !STATES.includes(item.state)) {
    throw new Error(`Unknown state "${item.state}". One of: ${STATES.join(', ')}`);
  }
  const existing = find(ledger, item.id);
  if (existing) return { ledger, item: existing, created: false };
  const full = {
    id: item.id,
    title: item.title || item.id,
    kind: item.kind || 'project',
    source: item.source || '',
    built: item.built || today(),
    state: item.state || 'idea',
    visibility: item.visibility || 'public',
    site: { table: null, id: null, url: null, ...(item.site || {}) },
    images: item.images || [],
    notes: item.notes || '',
  };
  return { ledger: { ...ledger, items: [...ledger.items, full] }, item: full, created: true };
}

export function update(ledger, id, patch) {
  const existing = find(ledger, id);
  if (!existing) throw new Error(`No ledger item with id "${id}"`);
  if (patch.state && !STATES.includes(patch.state)) {
    throw new Error(`Unknown state "${patch.state}". One of: ${STATES.join(', ')}`);
  }
  const merged = { ...existing, ...patch, site: { ...existing.site, ...(patch.site || {}) } };
  return {
    ledger: { ...ledger, items: ledger.items.map((i) => (i.id === id ? merged : i)) },
    item: merged,
  };
}
