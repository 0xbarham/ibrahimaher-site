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
  external_url: string | null;
  external_label: string | null;
  image: string | null;
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

/** Public listing: drafts must never leak to the live site. */
export const getPublishedPosts = (limit?: number) =>
  all<Post>(
    `SELECT * FROM posts WHERE status = 'published'
     ORDER BY post_date DESC, sort_order ASC${limit ? ' LIMIT ?' : ''}`,
    ...(limit ? [limit] : [])
  );

export const getPostBySlug = (slug: string) =>
  first<Post>("SELECT * FROM posts WHERE slug = ? AND status = 'published'", slug);

/** Admin listing: drafts included. */
export const getAllPosts = () =>
  all<Post>('SELECT * FROM posts ORDER BY post_date DESC, sort_order ASC');

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
