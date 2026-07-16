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

export const GET: APIRoute = async () => {
  const [posts, settings] = await Promise.all([getPublishedPosts(), getSettings()]);
  const base = setting(settings, 'site_url', 'https://ibrahimaher.com').replace(/\/$/, '');

  // Newest post date doubles as the homepage/index lastmod.
  const newest = posts.reduce<string>((acc, p) => {
    const d = (p.updated_at || p.post_date || '').slice(0, 10);
    return d > acc ? d : acc;
  }, '');

  const entries: Entry[] = [
    { loc: `${base}/`, lastmod: newest || undefined, changefreq: 'monthly', priority: '1.0' },
    { loc: `${base}/about`, changefreq: 'yearly', priority: '0.8' },
    { loc: `${base}/contact`, changefreq: 'yearly', priority: '0.7' },
    { loc: `${base}/blog/`, lastmod: newest || undefined, changefreq: 'weekly', priority: '0.9' },
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
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
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
