/**
 * Sitemap, built from D1.
 *
 * Served at /sitemap.xml — the exact path robots.txt and Search Console already
 * reference, so the migration costs no indexing continuity. @astrojs/sitemap is
 * not used because it only enumerates prerendered routes; every route on this
 * site renders on demand from the database.
 */
import type { APIRoute } from 'astro';
import { getPublishedPosts, getSettings, setting } from '../lib/db';
import { HREFLANG, altLocalesFor, type Lang } from '../lib/i18n';

export const prerender = false;

/** XML has five predefined entities; a raw & in a URL is the classic sitemap bug. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface Entry {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
}

/**
 * The xhtml:link alternates for a URL, as XML.
 *
 * Sitemap alternates and the <link rel="alternate"> tags in the page head say
 * the same thing; Google accepts either. Emitting both is belt-and-braces on the
 * signal that decides whether an Iraqi searcher gets the Arabic page or the
 * English one, and they cannot drift because both read TRANSLATED.
 *
 * Every entry in a pair — including the page's own URL — must be listed, which
 * is why this does not filter out the self-reference.
 */
function alternatesFor(base: string, path: string): string {
  const pair = altLocalesFor(path);
  if (!pair) return '';
  return (Object.entries(pair) as [Lang, string][])
    .map(
      ([code, href]) =>
        `\n    <xhtml:link rel="alternate" hreflang="${HREFLANG[code]}" href="${xmlEscape(base + href)}"/>`
    )
    .join('');
}

export const GET: APIRoute = async () => {
  // Two calls, not one. getPublishedPosts defaults to English, which is exactly
  // what keeps every other caller unchanged; the sitemap is the one place that
  // wants both languages, so it asks for the second explicitly.
  const [posts, arPosts, settings] = await Promise.all([
    getPublishedPosts(),
    getPublishedPosts(undefined, 'ar'),
    getSettings(),
  ]);
  const base = setting(settings, 'site_url', 'https://ibrahimaher.com').replace(/\/$/, '');

  // Newest post date doubles as the homepage/index lastmod.
  const newest = posts.reduce<string>((acc, p) => {
    const d = (p.updated_at || p.post_date || '').slice(0, 10);
    return d > acc ? d : acc;
  }, '');

  const entries: Entry[] = [
    { loc: `${base}/`, lastmod: newest || undefined, changefreq: 'monthly', priority: '1.0' },
    // Static service landing pages. These are file-based routes (not in D1), so they
    // must be listed explicitly — the live sitemap already carried /n8n-developer, and
    // omitting them here would silently drop the money pages from the sitemap on deploy.
    { loc: `${base}/n8n-developer`, changefreq: 'monthly', priority: '0.9' },
    { loc: `${base}/ai-automation-developer`, changefreq: 'monthly', priority: '0.9' },
    { loc: `${base}/vibe-coder`, changefreq: 'monthly', priority: '0.9' },
    { loc: `${base}/about`, changefreq: 'yearly', priority: '0.8' },
    { loc: `${base}/contact`, changefreq: 'yearly', priority: '0.7' },
    { loc: `${base}/blog/`, lastmod: newest || undefined, changefreq: 'weekly', priority: '0.9' },
    // Arabic. Same priorities as their English counterparts: neither language is
    // the "real" version of the site, and priority is a relative hint within one
    // sitemap, so demoting Arabic here would be arguing against the hreflang
    // pairing declared two lines below.
    { loc: `${base}/ar/`, lastmod: newest || undefined, changefreq: 'monthly', priority: '1.0' },
    { loc: `${base}/ar/n8n-developer`, changefreq: 'monthly', priority: '0.9' },
    { loc: `${base}/ar/ai-automation-developer`, changefreq: 'monthly', priority: '0.9' },
    { loc: `${base}/ar/vibe-coder`, changefreq: 'monthly', priority: '0.9' },
    { loc: `${base}/ar/contact`, changefreq: 'yearly', priority: '0.7' },
    { loc: `${base}/ar/blog/`, changefreq: 'weekly', priority: '0.9' },
    ...posts
      // A post flagged noindex must never appear in the sitemap — telling Google
      // "index this" and "don't index this" at once is a real Semrush finding.
      .filter((p) => p.noindex !== 1)
      .map((p) => ({
        loc: `${base}/blog/${p.slug}`,
        lastmod: (p.updated_at || `${p.post_date}T00:00:00Z`).slice(0, 10),
        changefreq: 'yearly',
        priority: '0.8',
      })),
    // Arabic posts share the /blog/ path: the route renders each post in the
    // language its row declares, so the URL segment is English while the
    // document is Arabic. They are listed separately here only because they come
    // from a separate query, not because they live anywhere else.
    ...arPosts
      .filter((p) => p.noindex !== 1)
      .map((p) => ({
        loc: `${base}/blog/${p.slug}`,
        lastmod: (p.updated_at || `${p.post_date}T00:00:00Z`).slice(0, 10),
        changefreq: 'yearly',
        priority: '0.8',
      })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    (e) => `  <url>
    <loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}${alternatesFor(base, e.loc.slice(base.length) || '/')}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
