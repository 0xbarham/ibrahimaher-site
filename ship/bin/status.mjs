#!/usr/bin/env node
/**
 * `npm run ship:status` - what is on the site, what is not, and what is stale.
 *
 * The first command of the evening routine, and the only one that is safe to
 * run at any time: it writes nothing, anywhere.
 *
 * It answers three questions in order of how often they are wrong:
 *   1. LIVE      what the public actually sees right now
 *   2. PIPELINE  what we built and have not shipped, and the next action for it
 *   3. DRIFT     where the ledger and the database disagree
 *
 * DRIFT is the section worth reading carefully. The ledger is intent and D1 is
 * fact, and a project the ledger calls published with no row behind it is a
 * build everyone believes is on the site and nobody can see.
 *
 * Flags:  --json   machine-readable, for the routine to reason over
 */
import { query } from '../lib/d1.mjs';
import * as ledgerLib from '../lib/ledger.mjs';
import { today, daysBetween, SITE_ORIGIN, missingSources } from '../lib/config.mjs';

const asJson = process.argv.includes('--json');

/**
 * Days of silence after which the blog reads as abandoned.
 *
 * Set at 21 rather than 30 deliberately. The first run of this tool found a
 * 28-day gap on the English blog, which a 30-day threshold reports as fine.
 * It was not fine. Three weeks is the point where a returning visitor finds
 * the same front page they left, and where "recently updated" stops being a
 * true thing to say about the site.
 */
const STALE_AFTER_DAYS = 21;

function pad(s, n) {
  const str = String(s ?? '');
  return str.length >= n ? str : str + ' '.repeat(n - str.length);
}

function truncate(s, n) {
  const str = String(s ?? '').replace(/\s+/g, ' ').trim();
  return str.length <= n ? str : `${str.slice(0, n - 3)}...`;
}

async function main() {
  const [projects, posts, media] = await Promise.all([
    query(
      `SELECT id, sort_order, title, featured, hidden, external_url, image, image_dark, image_alt
         FROM projects ORDER BY sort_order ASC;`
    ),
    query(
      `SELECT id, slug, lang, title, category, status, post_date, publish_at, featured
         FROM posts ORDER BY post_date DESC;`
    ),
    query('SELECT COUNT(*) AS n FROM media;'),
  ]);

  const ledger = ledgerLib.read();
  const now = today();

  // ------------------------------------------------------------ reconcile
  const liveProjectIds = new Set(projects.map((p) => p.id));
  const livePostIds = new Set(posts.map((p) => p.id));

  const drift = [];
  const claimed = new Set();

  /*
    A row counts as tracked as soon as ANY ledger item points at it, whatever
    that item's state. Only `published` items are checked for drift.

    Those are two different questions and conflating them double-reported: a
    hidden project adopted as `captured` has a perfectly good ledger entry, and
    keying "tracked" off `published` listed it in the pipeline and in the
    untracked backlog at the same time, as though it were both known and
    unknown.
  */
  for (const item of ledger.items) {
    const { table, id } = item.site || {};
    if (table && id != null) claimed.add(`${table}#${id}`);

    if (item.state !== 'published') continue;
    if (!table || id == null) {
      drift.push({ id: item.id, why: 'marked published but the ledger has no site row id' });
      continue;
    }
    const set = table === 'projects' ? liveProjectIds : livePostIds;
    if (!set.has(id)) {
      drift.push({ id: item.id, why: `marked published as ${table}#${id}, but no such row is live` });
    }
  }

  const untracked = [
    ...projects.filter((p) => !claimed.has(`projects#${p.id}`))
      .map((p) => ({ table: 'projects', id: p.id, title: p.title })),
    ...posts.filter((p) => !claimed.has(`posts#${p.id}`))
      .map((p) => ({ table: 'posts', id: p.id, title: p.title })),
  ];

  const pipeline = ledger.items.filter((i) => i.state !== 'published' && i.state !== 'skipped');
  const skipped = ledger.items.filter((i) => i.state === 'skipped');

  // --------------------------------------------------------------- health
  const enPosts = posts.filter((p) => p.lang === 'en' && p.status === 'published');
  const arPosts = posts.filter((p) => p.lang === 'ar' && p.status === 'published');
  const lastEn = enPosts[0]?.post_date ?? null;
  const lastAr = arPosts[0]?.post_date ?? null;

  const health = {
    lastEnglishPost: lastEn,
    daysSinceEnglishPost: lastEn ? daysBetween(lastEn, now) : null,
    lastArabicPost: lastAr,
    daysSinceArabicPost: lastAr ? daysBetween(lastAr, now) : null,
    drafts: posts.filter((p) => p.status === 'draft').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    visibleProjects: projects.filter((p) => !p.hidden).length,
    hiddenProjects: projects.filter((p) => p.hidden).length,
    /*
      The featured project is excluded from the image check, because the
      homepage does not render an image for it.

      src/pages/index.astro builds the featured panel from `featured_logo`,
      the title and `body_html`, and says so in a comment: it "has no
      screenshot, so its weight has to come from scale and space rather than
      from an image". `image` and `image_dark` are read only by the ordinary
      project cards further down.

      This distinction is worth the extra branch. Checking the column alone
      reported the featured project as fixed the moment `image` was populated,
      while the page it appears on had not changed by a pixel, which is the
      most misleading answer this tool could give.
    */
    projectsWithoutImage: projects
      .filter((p) => !p.hidden && !p.featured && !p.image)
      .map((p) => p.title),
    featuredRendersNoImage: projects
      .filter((p) => !p.hidden && p.featured && p.image)
      .map((p) => p.title),
    projectsWithoutAlt: projects
      .filter((p) => !p.hidden && !p.featured && p.image && !p.image_alt)
      .map((p) => p.title),
    mediaObjects: Number(media[0]?.n ?? 0),
  };

  if (asJson) {
    console.log(JSON.stringify(
      { generated: now, health, projects, posts, pipeline, drift, untracked, skipped },
      null, 2
    ));
    return;
  }

  // ---------------------------------------------------------------- print
  const gone = missingSources();
  if (gone.length) {
    console.log(`\n!  Work source unreachable: ${gone.map((s) => s.path).join(', ')}`);
    console.log('   Harvest will skip it. If that is the E: volume, check the drive before');
    console.log('   trusting any "nothing new today".');
  }

  console.log(`\n=== LIVE ON ${SITE_ORIGIN} ===  (${now})\n`);
  console.log(`  PROJECTS  ${health.visibleProjects} visible, ${health.hiddenProjects} hidden`);
  for (const p of projects) {
    const flags = [
      p.featured ? 'FEATURED' : '',
      p.hidden ? 'hidden' : '',
      p.image ? '' : 'NO IMAGE',
      p.image && !p.image_alt ? 'no alt' : '',
    ].filter(Boolean).join(' ');
    console.log(`    #${pad(p.id, 3)} ${pad(truncate(p.title, 58), 60)} ${flags}`);
  }

  console.log(`\n  POSTS     ${enPosts.length} English, ${arPosts.length} Arabic, ` +
    `${health.drafts} draft, ${health.scheduled} scheduled`);
  for (const p of posts.slice(0, 8)) {
    console.log(`    ${p.post_date}  ${pad(p.lang, 3)} ${pad(p.status, 10)} ${truncate(p.slug, 50)}`);
  }
  if (posts.length > 8) console.log(`    ... and ${posts.length - 8} older`);

  // ------------------------------------------------------------- pipeline
  console.log('\n=== NOT PUBLISHED ===\n');
  if (!pipeline.length) {
    console.log("  Nothing queued. Run ship:harvest to scan today's work.");
  } else {
    for (const state of ledgerLib.STATES) {
      const group = pipeline.filter((i) => i.state === state);
      if (!group.length) continue;
      console.log(`  ${state.toUpperCase()}  (next: ${ledgerLib.NEXT_ACTION[state]})`);
      for (const i of group) {
        const age = i.built ? `${daysBetween(i.built, now)}d` : '?';
        const vis = i.visibility === 'public' ? '' : `[${i.visibility}]`;
        console.log(`    ${pad(age, 5)} ${pad(i.kind, 8)} ${pad(truncate(i.title, 52), 54)} ${vis}`);
        if (i.notes) console.log(`          ${truncate(i.notes, 96)}`);
      }
      console.log('');
    }
  }

  if (skipped.length) {
    console.log(`  SKIPPED  ${skipped.length} (deliberate, not a backlog)`);
    for (const i of skipped) {
      console.log(`    ${pad(truncate(i.title, 52), 54)} ${truncate(i.notes || 'no reason recorded', 60)}`);
    }
    console.log('');
  }

  // ---------------------------------------------------------------- drift
  if (drift.length) {
    console.log('=== DRIFT: ledger and database disagree ===\n');
    for (const d of drift) console.log(`  ! ${pad(d.id, 40)} ${d.why}`);
    console.log('');
  }

  if (untracked.length) {
    console.log(`=== LIVE BUT NOT IN THE LEDGER (${untracked.length}) ===`);
    console.log('  Published before the routine existed, or published by hand.');
    console.log('  Adopt with: node ship/bin/adopt.mjs --table <t> --row <id> --id <slug>\n');
    for (const u of untracked.slice(0, 12)) {
      console.log(`    ${pad(`${u.table}#${u.id}`, 14)} ${truncate(u.title, 66)}`);
    }
    if (untracked.length > 12) console.log(`    ... and ${untracked.length - 12} more`);
    console.log('');
  }

  // --------------------------------------------------------------- health
  console.log('=== IS THE SITE ALIVE ===\n');
  const line = (label, value, bad) =>
    console.log(`  ${bad ? '!' : ' '} ${pad(label, 30)} ${value}`);

  const dEn = health.daysSinceEnglishPost;
  const dAr = health.daysSinceArabicPost;
  line('Last English post', lastEn ? `${lastEn}  (${dEn} days ago)` : 'never',
    dEn == null || dEn > STALE_AFTER_DAYS);
  line('Last Arabic post', lastAr ? `${lastAr}  (${dAr} days ago)` : 'never',
    dAr == null || dAr > STALE_AFTER_DAYS);
  line('Projects missing an image', health.projectsWithoutImage.length || 'none',
    health.projectsWithoutImage.length > 0);
  for (const t of health.projectsWithoutImage) console.log(`      - ${truncate(t, 70)}`);
  line('Images missing alt text', health.projectsWithoutAlt.length || 'none',
    health.projectsWithoutAlt.length > 0);
  if (health.featuredRendersNoImage.length) {
    line('Featured project image', 'set in D1, but the featured layout renders no image', true);
    for (const t of health.featuredRendersNoImage) console.log(`      - ${truncate(t, 70)}`);
  }
  line('Media objects in R2 index', health.mediaObjects, false);

  const verdict = [];
  if (dEn == null || dEn > STALE_AFTER_DAYS) {
    verdict.push(`the English blog has been quiet for ${dEn ?? '?'} days`);
  }
  if (health.projectsWithoutImage.length) {
    verdict.push(`${health.projectsWithoutImage.length} project(s) render with no image`);
  }
  if (pipeline.length) verdict.push(`${pipeline.length} build(s) are finished and unpublished`);

  console.log('');
  console.log(verdict.length
    ? `  Verdict: not alive. ${verdict.join('; ')}.`
    : '  Verdict: alive. Nothing stale, nothing queued, every project has an image.');
  console.log('');
}

main().catch((err) => {
  console.error(`\nship:status failed\n${err.message}\n`);
  process.exit(1);
});
