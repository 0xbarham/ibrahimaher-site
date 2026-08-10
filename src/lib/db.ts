/**
 * D1 access layer.
 *
 * Astro 6+ on the Cloudflare adapter exposes bindings via `cloudflare:workers`
 * rather than the older `Astro.locals.runtime.env` pattern.
 */
import { env } from 'cloudflare:workers';

export interface Author {
  id: number;
  name: string;
  slug: string;
  role: string;
  bio: string;
  avatar_url: string | null;
  profile_url: string | null;
}

export interface Post {
  id: number;
  sort_order: number;
  slug: string;
  /** 'en' | 'ar'. Drives the lang/dir the post renders in, not its URL. */
  lang: string;
  title: string;
  category: string;
  excerpt: string;
  post_date: string; // YYYY-MM-DD
  read_time: string;
  body_md: string;
  status: 'draft' | 'published';
  author_id: number;
  tags_json: string;
  hero_image: string | null;
  hero_alt: string;
  featured: number;
  updated_at: string; // YYYY-MM-DDTHH:MM:SSZ
  created_at: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  canonical_url: string;
  noindex: number;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image: string;
  // Per-post CTA (migration 0004). Read by blog/[slug].astro via SELECT *; kept
  // on the interface so the column list here stays the source of truth.
  cta_heading: string;
  cta_md: string;
}

export interface Job {
  id: number;
  sort_order: number;
  eyebrow: string;
  title: string;
  company: string;
  date_range: string;
  body_html: string;
  tags_json: string;
  logo_light: string;
  logo_dark: string | null;
}

export interface Project {
  id: number;
  sort_order: number;
  title: string;
  body_html: string;
  tags_json: string;
  icon_light: string | null;
  icon_dark: string | null;
  featured: number;
  featured_logo: string | null;
  /** Dark-theme featured logo. Null falls back to a light plate, exactly like the job logos. */
  featured_logo_dark: string | null;
  external_url: string | null;
  external_label: string | null;
  /** Light-theme screenshot. Also the fallback when `image_dark` is unset. */
  image: string | null;
  /** Dark-theme counterpart. Null means "use `image` in both themes". */
  image_dark: string | null;
  image_alt: string;
  /** Hidden from the public site but kept editable in the admin. */
  hidden: number;
}

export interface Skill {
  id: number;
  sort_order: number;
  category: string;
  subtitle: string;
  tags_json: string;
}

export interface Certification {
  id: number;
  sort_order: number;
  title: string;
  issuer: string;
}

export interface Education {
  id: number;
  sort_order: number;
  title: string;
  school: string;
  date_range: string;
  body_html: string;
}

/** The D1 binding declared in wrangler.jsonc. */
export function db(): D1Database {
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) {
    // Fail loudly: a missing binding means every page would silently render
    // empty, which is far worse to debug than an explicit error.
    throw new Error('D1 binding "DB" is not available. Check wrangler.jsonc.');
  }
  return binding;
}

async function all<T>(sql: string, ...bind: unknown[]): Promise<T[]> {
  const { results } = await db().prepare(sql).bind(...bind).all<T>();
  return results ?? [];
}

async function first<T>(sql: string, ...bind: unknown[]): Promise<T | null> {
  return (await db().prepare(sql).bind(...bind).first<T>()) ?? null;
}

/** Tags are stored as a JSON array string; never let bad JSON break a page. */
export function parseTags(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export const getJobs = () => all<Job>('SELECT * FROM jobs ORDER BY sort_order ASC');
export const getSkills = () => all<Skill>('SELECT * FROM skills ORDER BY sort_order ASC');
export const getCertifications = () =>
  all<Certification>('SELECT * FROM certifications ORDER BY sort_order ASC');
export const getEducation = () =>
  all<Education>('SELECT * FROM education ORDER BY sort_order ASC');
/** Public listing: hidden projects must never render on the live site. */
export const getProjects = () =>
  all<Project>('SELECT * FROM projects WHERE hidden = 0 ORDER BY sort_order ASC');

/** Admin listing: hidden projects included, so they can be brought back. */
export const getAllProjects = () =>
  all<Project>('SELECT * FROM projects ORDER BY sort_order ASC');

export const getAuthor = (id: number) =>
  first<Author>('SELECT * FROM authors WHERE id = ?', id);

export interface Redirect {
  id: number;
  source: string;
  destination: string;
  code: number;
}

/** Looked up by src/middleware.ts only when a route 404s. */
export const findRedirect = (source: string) =>
  first<Redirect>('SELECT * FROM redirects WHERE source = ?', source);

/**
 * What "live" means, in one place.
 *
 * A post is public if it is published outright, or if it is scheduled and its
 * publish_at has passed. Because the site is SSR on every request, that second
 * clause *is* the scheduler — there is no cron trigger and no queue. A scheduled
 * post goes live on the first request after its timestamp, which on this site
 * means a few minutes of drift at worst, and costs no extra moving parts.
 *
 * This is a single exported constant rather than repeated inline, because it is
 * the one predicate in the codebase where getting it wrong leaks an unpublished
 * draft to the public internet. Every public read must use it: listings, the
 * single-post route, RSS, and the sitemap.
 *
 * strftime(...,'now') is UTC in SQLite, and publish_at is written as ISO-8601
 * UTC, so the comparison is like-for-like with no timezone conversion. Storing
 * local time here would silently publish posts hours early or late.
 */
export const PUBLISHED_PREDICATE = `(
  status = 'published'
  OR (status = 'scheduled' AND publish_at IS NOT NULL
      AND publish_at <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)`;

/**
 * Public listing: drafts must never leak to the live site.
 *
 * `lang` defaults to 'en', which is what makes the Arabic blog additive rather
 * than a migration. Every existing caller — the English index, the homepage's
 * "From the blog", the RSS feed, the sitemap — asked for "the posts" back when
 * there was only one language, and still gets exactly the set it got before. An
 * Arabic post cannot leak into an English listing by omission: a caller has to
 * ask for it by name.
 */
export const getPublishedPosts = (limit?: number, lang: string = 'en') =>
  all<Post>(
    `SELECT * FROM posts WHERE ${PUBLISHED_PREDICATE} AND lang = ?
     ORDER BY post_date DESC, sort_order ASC${limit ? ' LIMIT ?' : ''}`,
    ...(limit ? [lang, limit] : [lang])
  );

/**
 * No lang parameter on purpose: `slug` is UNIQUE across the whole table, so it
 * already identifies exactly one post. The route renders it in whatever language
 * the row declares, rather than the language of the URL it was reached through.
 */
export const getPostBySlug = (slug: string) =>
  first<Post>(`SELECT * FROM posts WHERE slug = ? AND ${PUBLISHED_PREDICATE}`, slug);

/** Admin listing: drafts included. */
export const getAllPosts = () =>
  all<Post>('SELECT * FROM posts ORDER BY post_date DESC, sort_order ASC');

/**
 * Any post by slug regardless of status — for the admin's draft preview only.
 *
 * This deliberately does NOT check status, which makes it the one query in this
 * file capable of exposing an unpublished post. Its single caller
 * (src/pages/blog/[slug].astro) gates it behind a valid admin session before it
 * is ever reached, and marks the response noindex. Never call it from a public
 * code path.
 */
export const getPostBySlugAnyStatus = (slug: string) =>
  first<Post>('SELECT * FROM posts WHERE slug = ?', slug);

// ---------------------------------------------------------------- revisions

export interface PostRevision {
  id: number;
  post_id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  body_md: string | null;
  status: string | null;
  category: string | null;
  tags_json: string | null;
  created_at: string;
  note: string | null;
}

/**
 * History for one post, newest first. body_md is excluded on purpose: rendering
 * a list of twenty timestamps does not need twenty copies of the largest column
 * in the schema crossing the wire. getRevision() fetches the body when one is
 * actually opened.
 */
export const getRevisionList = (postId: number, limit = 20) =>
  all<Omit<PostRevision, 'body_md'>>(
    `SELECT id, post_id, title, slug, excerpt, status, category, tags_json,
            created_at, note
       FROM post_revisions
      WHERE post_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    postId,
    limit
  );

/** One full revision, body included — fetched only when previewing or
 *  restoring, which is the only time the body is worth transferring. */
export const getRevision = (id: number) =>
  first<PostRevision>('SELECT * FROM post_revisions WHERE id = ?', id);

/**
 * Global settings as a plain map. Rendering must not depend on a row existing,
 * so callers pass a fallback.
 *
 * Cached in-isolate for a short window. Every page hits this at least twice —
 * once in the page frontmatter and once in Base.astro — and a Worker isolate
 * serves many requests, so without this it is a guaranteed extra D1 round trip
 * on the critical path of every single render.
 *
 * The TTL is the trade: a settings change in the admin takes up to 30s to show.
 * That is bounded and matches the edge cache window, rather than being an
 * unbounded cache that could pin a stale GA id indefinitely.
 */
const SETTINGS_TTL_MS = 30_000;
let settingsCache: { at: number; value: Record<string, string> } | null = null;

export async function getSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.value;
  }
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const value = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  settingsCache = { at: now, value };
  return value;
}

/** Called after a settings write so the admin does not fight its own cache. */
export function invalidateSettingsCache(): void {
  settingsCache = null;
}

export function setting(
  settings: Record<string, string>,
  key: string,
  fallback = ''
): string {
  const v = settings[key];
  return v === undefined || v === '' ? fallback : v;
}
