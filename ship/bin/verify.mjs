#!/usr/bin/env node
/**
 * `npm run ship:verify` - did the thing we published actually render.
 *
 * The database agreeing with itself is not evidence. This fetches the real
 * public URL over the real internet and looks for the text in the response, so
 * a row that is live but does not reach the page (a stale edge response, a
 * hidden flag, a broken image path) is caught here rather than by whoever opens
 * the site next.
 *
 * Images are checked separately. `/media/<key>` is served by the Worker out of
 * R2, and a project row can hold a perfectly well-formed image path pointing at
 * an object that was never uploaded. The page still returns 200; only the image
 * 404s, and nothing else in the pipeline would notice.
 *
 * Flags:
 *   --id <slug>   verify one ledger item (default: everything published today)
 *   --all         verify every published ledger item
 */
import * as ledgerLib from '../lib/ledger.mjs';
import { SITE_ORIGIN, today } from '../lib/config.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const ledger = ledgerLib.read();
const id = flag('id');

const targets = id
  ? ledger.items.filter((i) => i.id === id)
  : ledger.items.filter((i) => i.state === 'published' && (has('all') || i.built === today()));

if (!targets.length) {
  console.log(id ? `\nNo ledger item "${id}".\n` : '\nNothing published today to verify. Use --all.\n');
  process.exit(id ? 2 : 0);
}

let failures = 0;

/** Cache-buster. Without it a 200 can be an edge copy from before the write,
 *  which makes a genuinely broken publish look fine. */
const bust = (url) => `${url}${url.includes('?') ? '&' : '?'}_ship=${Date.now()}`;

async function get(url) {
  try {
    const res = await fetch(bust(url), {
      redirect: 'follow',
      headers: { 'user-agent': 'ship-verify (ibrahimaher.com self-check)' },
    });
    const text = res.headers.get('content-type')?.includes('text') ? await res.text() : '';
    return { status: res.status, body: text };
  } catch (err) {
    return { status: 0, body: '', error: err.message };
  }
}

console.log(`\n=== verify (${targets.length} item(s)) ===\n`);

for (const item of targets) {
  console.log(`  ${item.id}`);
  const url = item.site?.url || SITE_ORIGIN;

  const page = await get(url);
  if (page.status !== 200) {
    failures++;
    console.log(`    FAIL  ${url} -> ${page.status || page.error}`);
  } else {
    console.log(`    ok    ${url} -> 200`);
    /*
      Match a distinctive slice of the title, with both sides reduced to
      alphanumerics.

      Naive substring matching fails on real titles for reasons that have
      nothing to do with the page being wrong. "AI Lead Intelligence &
      Auto-Response" is stored with an HTML entity, printed through a decoder,
      then re-escaped by Astro, so the bytes on the wire are `&amp;` while the
      ledger holds `&`. Stripping everything that is not a letter or a digit
      from both sides compares the words, which is the only part worth
      comparing.
    */
    const flatten = (s) => String(s)
      // Entities have to go before the alphanumeric squeeze, not after: `&amp;`
      // squeezes down to the letters "amp", which lands in the middle of the
      // very words being compared and breaks a match that should succeed.
      .replace(/&[a-z]+;|&#\d+;/gi, ' ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
    const words = String(item.title).split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
    const needle = flatten(words.slice(0, 4).join(''));
    if (needle.length > 8) {
      if (flatten(page.body).includes(needle)) {
        console.log(`    ok    the page contains "${words.slice(0, 4).join(' ')}"`);
      } else {
        failures++;
        console.log(`    FAIL  the page does not contain "${words.slice(0, 4).join(' ')}"`);
      }
    }
  }

  for (const img of item.images || []) {
    const res = await get(`${SITE_ORIGIN}${img}`);
    if (res.status !== 200) {
      failures++;
      console.log(`    FAIL  ${img} -> ${res.status || res.error}`);
    } else {
      console.log(`    ok    ${img} -> 200`);
    }
  }
  console.log('');
}

if (failures) {
  console.log(`${failures} check(s) failed. The site is not showing what the ledger claims.\n`);
  process.exit(1);
}
console.log('Everything checked renders.\n');
