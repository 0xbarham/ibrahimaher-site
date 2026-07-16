/**
 * Markdown -> HTML for content stored in D1.
 *
 * Runs inside the Worker on every render, so it stays dependency-light and
 * synchronous. `marked` is pure JS with no Node built-ins, which is why it was
 * chosen over remark/rehype here.
 *
 * Heading anchors and table wrapping are applied by post-processing the emitted
 * HTML rather than by overriding marked's renderer: the renderer API has changed
 * shape across major versions, whereas `parse()` and the emitted markup have not.
 * Less clever, far less likely to break on upgrade.
 *
 * Trust model: the only writer is the authenticated site owner via /admin, so
 * raw HTML inside Markdown is permitted deliberately — it is how charts and
 * embeds get in. The admin session IS the security boundary. Never feed
 * user-submitted Markdown through this function.
 */
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

/** Give h2/h3 stable ids so long posts have linkable sections. */
function addHeadingAnchors(html: string): string {
  const seen = new Map<string, number>();
  return html.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (match, tag: string, inner: string) => {
    const base = slugify(inner);
    if (!base) return match;
    // Duplicate headings must not produce duplicate ids.
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n + 1}`;
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
}

/** Wide tables scroll inside themselves; the page body never scrolls sideways. */
function wrapTables(html: string): string {
  return html.replace(/<table>[\s\S]*?<\/table>/g, (m) => `<div class="table-scroll">${m}</div>`);
}

export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return '';
  const html = marked.parse(md, { async: false }) as string;
  return wrapTables(addHeadingAnchors(html));
}

/**
 * Plain text from Markdown — for meta descriptions and excerpt fallbacks.
 * Deliberately crude: strips syntax rather than parsing, because it only ever
 * feeds a truncated <meta> tag.
 */
export function markdownToText(md: string | null | undefined, limit = 200): string {
  if (!md) return '';
  const text = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^[#>\-*+]\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(' ', limit);
  return text.slice(0, cut > 0 ? cut : limit).trimEnd() + '…';
}

/** Rough reading time, used when a post has no explicit read_time set. */
export function readingTime(md: string | null | undefined): string {
  const words = markdownToText(md, Number.MAX_SAFE_INTEGER).split(/\s+/).filter(Boolean).length;
  return `~${Math.max(1, Math.round(words / 200))} min read`;
}
