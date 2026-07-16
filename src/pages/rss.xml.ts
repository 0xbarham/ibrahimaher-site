/**
 * RSS 2.0 feed, hand-built.
 *
 * `@astrojs/rss` is deliberately not a dependency — the feed is a few hundred
 * bytes of well-understood XML and this route is rendered per request inside the
 * Worker, so pulling in a package to concatenate strings would cost more than it
 * saves. The one thing that genuinely matters here is escaping: every value below
 * comes out of D1 and can legally contain `&`, `<`, `>` or a quote, so it all
 * goes through `esc()` on the way in. Nothing is interpolated raw.
 */
import type { APIRoute } from 'astro';
import { getPublishedPosts, getAuthor, getSettings, setting } from '../lib/db';
import { markdownToText } from '../lib/markdown';

export const prerender = false;

/** XML text/attribute escaping, plus a scrub of control characters that are not
 *  representable in XML 1.0 at all (a stray one makes the whole feed unparseable). */
function esc(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RFC-822 date. post_date is a bare YYYY-MM-DD, so it is pinned to UTC midnight
 *  rather than being read in the Worker's local zone. */
function rfc822(postDate: string): string {
  const d = new Date(`${postDate}T00:00:00Z`);
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export const GET: APIRoute = async () => {
  const [posts, settings, author] = await Promise.all([
    getPublishedPosts(),
    getSettings(),
    getAuthor(1),
  ]);

  const siteUrl = setting(settings, 'site_url', 'https://ibrahimaher.com').replace(/\/$/, '');
  const siteName = setting(settings, 'site_name', 'Ibrahim Maher Al-Bander');
  const authorName = author?.name ?? siteName;
  // RSS wants an address here, not a display name: "me@example.com (Name)".
  const email = setting(settings, 'contact_email');
  const description = setting(
    settings,
    'default_seo_description',
    'Notes on AI automation, n8n workflows, social media marketing, and AI-assisted software development.'
  );

  const items = posts
    .map((post) => {
      const link = `${siteUrl}/blog/${post.slug}`;
      const summary = post.excerpt || markdownToText(post.body_md, 300);
      return `    <item>
      <title>${esc(post.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <description>${esc(summary)}</description>
      <pubDate>${esc(rfc822(post.post_date))}</pubDate>${
        post.category ? `\n      <category>${esc(post.category)}</category>` : ''
      }
    </item>`;
    })
    .join('\n');

  const latest = posts[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(`${siteName} — Writing`)}</title>
    <link>${esc(`${siteUrl}/blog/`)}</link>
    <description>${esc(description)}</description>
    <language>en</language>
${email ? `    <managingEditor>${esc(`${email} (${authorName})`)}</managingEditor>\n` : ''}    <lastBuildDate>${esc(latest ? rfc822(latest.post_date) : new Date().toUTCString())}</lastBuildDate>
    <atom:link href="${esc(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
