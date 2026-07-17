/**
 * Build-time Open Graph card generator.
 *
 * Renders the themed 1200x630 share images to static PNGs under public/assets/og/
 * — one default card, one per published post with its own headline. Run before
 * `astro build` (see package.json). Static PNGs are served by the asset router,
 * so a shared link's card is 100% reliable and edge-cached.
 *
 * WHY BUILD-TIME, NOT AT REQUEST TIME: rendering with Satori + resvg is memory
 * heavy. In the Worker (128 MB, fixed on every plan) a 1200x630 render
 * intermittently tripped Cloudflare error 1102 mid-execution — uncatchable, so a
 * social scraper would sometimes get a 503 and no card. Node has no such limit,
 * so generation moved here. The trade: a brand-new post added in the admin shows
 * the default card until the next build regenerates its own (it has no D1 write).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import satori from 'satori';
import { html } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = join(ROOT, 'public', 'assets', 'fonts');
const OUT_DIR = join(ROOT, 'public', 'assets', 'og');

const W = 1200;
const H = 630;

// Site dark-theme tokens (styles/tokens.css), inlined.
const C = {
  bg: '#12100e',
  ink: '#f4f1ec',
  ink2: '#bdb5aa',
  ink3: '#8b8276',
  accent: '#e08a69',
  accentDeep: '#d97757',
  rule: 'rgba(244,241,236,0.16)',
};

// satori-html does NOT decode HTML entities — it renders "&amp;" and "&#183;"
// literally. So text is passed as raw Unicode (real "&", real "·"); only "<" and
// ">" are stripped, since those are the sole characters its parser treats as
// markup, and no post title contains them.
const esc = (s) => String(s).replace(/[<>]/g, '');

const blobs = `
  <div style="display:flex;position:absolute;top:-170px;left:-130px;width:440px;height:440px;border-radius:9999px;background:${C.accentDeep};opacity:0.16;"></div>
  <div style="display:flex;position:absolute;bottom:-210px;right:-150px;width:480px;height:480px;border-radius:9999px;background:${C.accent};opacity:0.10;"></div>`;

const pill = (label) =>
  `<div style="display:flex;border:2px solid ${C.rule};border-radius:9999px;padding:10px 26px;margin-right:16px;color:${C.ink};font-size:26px;font-weight:600;">${esc(label)}</div>`;

function defaultCard() {
  const tags = ['Social Media', 'AI Automation', 'n8n & Agents', 'Web & Apps'];
  return `
  <div style="display:flex;flex-direction:column;width:${W}px;height:${H}px;background:${C.bg};padding:80px;position:relative;font-family:Inter;">
    ${blobs}
    <div style="display:flex;color:${C.accent};font-size:30px;font-weight:600;">ibrahimaher.com</div>
    <div style="display:flex;flex-direction:column;margin-top:auto;">
      <div style="display:flex;font-family:Sora;font-weight:700;font-size:88px;line-height:1.04;letter-spacing:-2px;color:${C.ink};">Ibrahim Maher</div>
      <div style="display:flex;font-family:Sora;font-weight:700;font-size:88px;line-height:1.04;letter-spacing:-2px;color:${C.accent};">Al-Bander</div>
      <div style="display:flex;margin-top:26px;color:${C.ink2};font-size:36px;">Social Media Marketer · AI Developer</div>
      <div style="display:flex;margin-top:40px;">${tags.map(pill).join('')}</div>
    </div>
  </div>`;
}

/** Trim an excerpt to ~two lines on the card, cutting on a word boundary. */
function clampExcerpt(s) {
  const t = String(s || '').trim();
  if (t.length <= 120) return t;
  return t.slice(0, 118).replace(/\s+\S*$/, '') + '…';
}

function postCard({ title, category, readTime, excerpt }) {
  const len = String(title).length;
  // Larger than before, and the excerpt below fills the lower block so the card
  // reads full like the default card instead of a small title in empty space.
  const size = len > 66 ? 56 : len > 46 ? 64 : 74;
  const ex = clampExcerpt(excerpt);
  const dot = `<div style="display:flex;width:8px;height:8px;border-radius:9999px;background:${C.ink3};margin:0 20px;"></div>`;
  return `
  <div style="display:flex;flex-direction:column;width:${W}px;height:${H}px;background:${C.bg};padding:78px 80px;position:relative;font-family:Inter;">
    ${blobs}
    <div style="display:flex;align-items:center;">
      <div style="display:flex;color:${C.accent};font-size:28px;font-weight:600;">ibrahimaher.com</div>
      ${dot}
      <div style="display:flex;color:${C.ink3};font-size:26px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${esc(category)}</div>
    </div>
    <div style="display:flex;flex-direction:column;margin-top:auto;">
      <div style="display:flex;font-family:Sora;font-weight:700;font-size:${size}px;line-height:1.1;letter-spacing:-1.5px;color:${C.ink};max-width:1050px;">${esc(title)}</div>
      ${ex ? `<div style="display:flex;margin-top:26px;color:${C.ink2};font-size:31px;line-height:1.4;max-width:980px;">${esc(ex)}</div>` : ''}
      <div style="display:flex;align-items:center;margin-top:40px;">
        <div style="display:flex;color:${C.ink2};font-size:29px;">Ibrahim Maher Al-Bander</div>
        ${readTime ? dot + `<div style="display:flex;color:${C.ink3};font-size:29px;">${esc(readTime)}</div>` : ''}
      </div>
    </div>
  </div>`;
}

const fonts = [
  { name: 'Sora', data: readFileSync(join(FONT_DIR, 'sora-700.ttf')), weight: 700, style: 'normal' },
  { name: 'Inter', data: readFileSync(join(FONT_DIR, 'inter-400.ttf')), weight: 400, style: 'normal' },
  { name: 'Inter', data: readFileSync(join(FONT_DIR, 'inter-600.ttf')), weight: 600, style: 'normal' },
];

async function toPng(markup) {
  const svg = await satori(html(markup), { width: W, height: H, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}

function readPublishedPosts() {
  try {
    const raw = execSync(
      `npx wrangler d1 execute ibrahimaher-content --remote --json --command "SELECT slug, title, category, read_time, excerpt FROM posts WHERE status='published'"`,
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    );
    const start = raw.indexOf('[');
    if (start < 0) throw new Error('no JSON in wrangler output');
    return JSON.parse(raw.slice(start))[0].results ?? [];
  } catch (err) {
    console.warn(`[og] could not read posts from D1 (${err.message}). Default card only; existing post cards kept.`);
    return [];
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'default.png'), await toPng(defaultCard()));
  const posts = readPublishedPosts();
  for (const p of posts) {
    writeFileSync(
      join(OUT_DIR, `${p.slug}.png`),
      await toPng(postCard({ title: p.title, category: p.category, readTime: p.read_time, excerpt: p.excerpt }))
    );
  }
  console.log(`[og] generated default.png + ${posts.length} post cards -> public/assets/og/`);
}

await main();
