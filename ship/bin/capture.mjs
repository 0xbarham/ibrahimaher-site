#!/usr/bin/env node
/**
 * `npm run ship:capture -- --id <ledger-id> --url <url>` - screenshot a page.
 *
 * Drives the Chrome already installed on this machine through playwright-core,
 * rather than downloading Playwright's own browser bundle. Two reasons: the
 * bundle is a few hundred megabytes for a browser that is already here, and the
 * n8n editor and the Cloudflare dashboard are both places where the useful shot
 * is one taken while logged in, which needs a real profile.
 *
 * Captures light and dark separately. The site stores `image` and `image_dark`
 * per project and renders whichever matches the reader's theme, so a single
 * light screenshot on a dark page is a bright rectangle in the middle of the
 * layout. Producing both is cheaper than remembering not to.
 *
 * NOT EVERY SHOT CAN BE TAKEN THIS WAY, and that is fine. A workflow canvas
 * behind a login, a Telegram approval card, a phone screen: capture those by
 * hand or through a driven browser, drop the file into ship/inbox/<id>/, and
 * `ship:ingest` treats it identically. This is the convenient path, not the
 * only one.
 *
 * Flags:
 *   --id <slug>        required. Names the output folder under ship/inbox.
 *   --url <url>        required.
 *   --selector <css>   clip to one element instead of the viewport
 *   --full             full scrollable page instead of the viewport
 *   --wait <ms>        settle time after load (default 1200)
 *   --profile          use a real Chrome profile, for pages behind a login
 */
import fs from 'node:fs';
import path from 'node:path';
import { INBOX_DIR, SHOT } from '../lib/config.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const id = flag('id');
const url = flag('url');
if (!id || !url) {
  console.error('Usage: node ship/bin/capture.mjs --id <slug> --url <url> [--selector css] [--full] [--profile]');
  process.exit(2);
}

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error(`
playwright-core is not installed, so the headless path is unavailable.

  npm i -D playwright-core

It needs no browser download: it drives the Chrome already on this machine.

Until then, capture by hand and drop the file here:
  ${path.join(INBOX_DIR, id)}
then run: node ship/bin/ingest.mjs --id ${id}
`);
  process.exit(3);
}

if (!CHROME) {
  console.error('No Chrome found. Install Chrome, or capture by hand into ship/inbox/<id>/.');
  process.exit(3);
}

const outDir = path.join(INBOX_DIR, id);
fs.mkdirSync(outDir, { recursive: true });

const persistent = has('profile');
const launched = persistent
  ? await chromium.launchPersistentContext(
      path.join(process.env.LOCALAPPDATA || process.env.HOME || '.', 'ship-capture-profile'),
      {
        executablePath: CHROME,
        headless: false,
        viewport: { width: SHOT.width, height: SHOT.height },
        deviceScaleFactor: SHOT.scale,
      }
    )
  : await chromium.launch({ executablePath: CHROME, headless: true });

// launchPersistentContext returns a context; launch returns a browser. Normalise.
const context = persistent
  ? launched
  : await launched.newContext({
      viewport: { width: SHOT.width, height: SHOT.height },
      deviceScaleFactor: SHOT.scale,
      /*
        Reduced motion, so scroll-driven reveals render settled.

        This site animates content in with `.settle-in`, which uses
        `animation-timeline: view()`. In a headless capture the scroll position
        never enters an off-screen element's range, so the animation sits on its
        first keyframe and the element photographs as blank. Whole screen-heights
        of the homepage came out as empty cream because of it.

        The stylesheet guards that rule behind
        `@media (prefers-reduced-motion: no-preference)`, so asking for reduced
        motion switches it off through the site's own escape hatch rather than
        by injecting CSS. It also matches what a visitor with that preference
        actually sees, which is the more honest thing to screenshot.
      */
      reducedMotion: 'reduce',
    });

const written = [];

for (const scheme of ['light', 'dark']) {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: scheme });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  } catch {
    // networkidle never settles on a page holding a live socket open (the n8n
    // editor is one). Falling back to `load` still produces a usable frame.
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  }
  await page.waitForTimeout(Number(flag('wait', '1200')));

  /*
    Force every lazy image to load before the shutter.

    MEASURED, because the obvious fix is the one that does not work. A
    full-page capture of the homepage came back as 13,000 pixels of blank
    cream: each project screenshot carries loading="lazy", and in headless
    Chrome none of them ever load. Scrolling the whole document first, which is
    the usual advice, changed nothing at all: 0 of 7 images had a non-zero
    naturalWidth before the scroll and 0 of 7 after it. Flipping the attribute
    to "eager" loaded 7 of 7.

    So the attribute is the blocker rather than the scroll position, and this
    is the narrower fix as well as the working one. It changes only how the
    capture browser fetches; the real site is untouched.

    NOT FULLY SOLVED, so do not trust a screenshot over an HTTP check. On a
    very tall `--selector` capture (the homepage #projects section is 13,208px)
    an image frame near the bottom still photographed empty after this ran,
    while the same image was confirmed present in the served HTML and returning
    200. Verify what is live with ship:verify, and treat these captures as
    something to look at rather than as evidence.
  */
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      img.loading = 'eager';
      if (img.dataset.src) img.src = img.dataset.src;
    });
  });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(600);

  const file = path.join(outDir, `${scheme}.png`);
  const sel = flag('selector');
  if (sel) {
    const el = await page.$(sel);
    if (!el) {
      console.error(`Selector not found on the page: ${sel}`);
      await context.close().catch(() => {});
      process.exit(4);
    }
    await el.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: has('full') });
  }
  written.push(file);
  await page.close();
}

await context.close().catch(() => {});
if (!persistent) await launched.close().catch(() => {});

console.log(`\nCaptured ${written.length} frame(s):`);
for (const f of written) console.log(`  ${f}  (${(fs.statSync(f).size / 1024).toFixed(0)} KB)`);
console.log(`\nLook at them before publishing. Then:`);
console.log(`  node ship/bin/ingest.mjs --id ${id} --alt "<what the image shows>"\n`);
