/**
 * Column allowlist per D1 table.
 *
 * Ported and extended from functions/_lib/schema.js. This is a SECURITY control,
 * not documentation: D1 cannot parametrize identifiers, so table and column names
 * are interpolated into SQL as strings. Everything the content API touches must
 * be validated against these lists — never against user input.
 *
 * If you add a column in a migration, add it here too, or the admin silently
 * cannot write it.
 */

export const TABLE_COLUMNS = {
  jobs: [
    'sort_order', 'eyebrow', 'title', 'company', 'date_range',
    'body_html', 'tags_json', 'logo_light', 'logo_dark',
  ],
  projects: [
    'sort_order', 'title', 'body_html', 'tags_json', 'icon_light', 'icon_dark',
    'featured', 'featured_logo', 'external_url', 'external_label',
    'image', 'image_alt', 'hidden',
  ],
  skills: ['sort_order', 'category', 'subtitle', 'tags_json'],
  certifications: ['sort_order', 'title', 'issuer'],
  education: ['sort_order', 'title', 'school', 'date_range', 'body_html'],
  posts: [
    'sort_order', 'slug', 'title', 'category', 'excerpt', 'post_date', 'read_time',
    'body_md', 'status', 'author_id', 'tags_json', 'hero_image', 'hero_alt',
    'featured', 'updated_at', 'created_at',
    'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'noindex',
    'og_title', 'og_description', 'og_image',
    'twitter_title', 'twitter_description', 'twitter_image',
    'cta_heading', 'cta_md',
  ],
  authors: ['name', 'slug', 'role', 'bio', 'avatar_url', 'profile_url', 'sort_order'],
  redirects: ['source', 'destination', 'code', 'created_at'],
  media: ['key', 'url', 'filename', 'mime', 'bytes', 'width', 'height', 'alt', 'created_at'],
} as const;

export type TableName = keyof typeof TABLE_COLUMNS;

export function isTable(name: string): name is TableName {
  return Object.prototype.hasOwnProperty.call(TABLE_COLUMNS, name);
}

export function columnsFor(table: TableName): readonly string[] {
  return TABLE_COLUMNS[table];
}

/**
 * `settings` is deliberately absent from TABLE_COLUMNS: it is keyed by TEXT, not
 * an autoincrement id, so the generic row CRUD does not apply. It has its own
 * endpoint that only ever updates `value` for an existing key — new keys come
 * from migrations, so a typo in the admin cannot invent dead config.
 */
export const SETTINGS_WRITABLE = ['value'] as const;

/** Field hints so the admin can render the right control per column. */
export type FieldKind =
  | 'text' | 'textarea' | 'markdown' | 'html' | 'number' | 'boolean'
  | 'date' | 'url' | 'image' | 'tags' | 'select';

export interface FieldSpec {
  kind: FieldKind;
  label: string;
  hint?: string;
  options?: string[];
  /** Which admin panel the field belongs to. */
  group?: 'content' | 'seo' | 'social' | 'meta';
  rows?: number;
}

export const POST_FIELDS: Record<string, FieldSpec> = {
  title: { kind: 'text', label: 'Title', group: 'content' },
  slug: { kind: 'text', label: 'Slug', hint: 'Changing this breaks existing links unless you add a redirect.', group: 'content' },
  status: { kind: 'select', label: 'Status', options: ['draft', 'published'], group: 'content' },
  category: { kind: 'text', label: 'Category', group: 'content' },
  excerpt: { kind: 'textarea', label: 'Excerpt', hint: 'Shown on the blog index and used as a meta description fallback.', group: 'content', rows: 3 },
  body_md: { kind: 'markdown', label: 'Body', hint: 'Markdown. Supports headings, lists, tables, code, images and raw HTML.', group: 'content' },
  post_date: { kind: 'date', label: 'Publish date', group: 'content' },
  read_time: { kind: 'text', label: 'Read time', hint: 'Leave blank to calculate from the body.', group: 'content' },
  author_id: { kind: 'number', label: 'Author', group: 'content' },
  tags_json: { kind: 'tags', label: 'Tags', group: 'content' },
  hero_image: { kind: 'image', label: 'Hero image', group: 'content' },
  hero_alt: { kind: 'text', label: 'Hero alt text', hint: 'Describe the image for screen readers.', group: 'content' },
  featured: { kind: 'boolean', label: 'Featured', group: 'content' },
  cta_heading: { kind: 'text', label: 'CTA heading', group: 'content' },
  cta_md: { kind: 'textarea', label: 'CTA text', group: 'content', rows: 3 },

  seo_title: { kind: 'text', label: 'Title tag', hint: 'Aim for under 60 characters. Falls back to the post title.', group: 'seo' },
  seo_description: { kind: 'textarea', label: 'Meta description', hint: '140-160 characters. Falls back to the excerpt.', group: 'seo', rows: 3 },
  seo_keywords: { kind: 'text', label: 'Keywords', group: 'seo' },
  canonical_url: { kind: 'url', label: 'Canonical URL', hint: 'Only set this if the post is republished from elsewhere.', group: 'seo' },
  noindex: { kind: 'boolean', label: 'Hide from search engines', hint: 'Also removes it from the sitemap.', group: 'seo' },

  og_title: { kind: 'text', label: 'Share title', group: 'social' },
  og_description: { kind: 'textarea', label: 'Share description', group: 'social', rows: 2 },
  og_image: { kind: 'image', label: 'Share image', hint: '1200x630.', group: 'social' },
  twitter_title: { kind: 'text', label: 'X / Twitter title', group: 'social' },
  twitter_description: { kind: 'textarea', label: 'X / Twitter description', group: 'social', rows: 2 },
  twitter_image: { kind: 'image', label: 'X / Twitter image', group: 'social' },

  sort_order: { kind: 'number', label: 'Sort order', group: 'meta' },
  created_at: { kind: 'text', label: 'Created', group: 'meta' },
  updated_at: { kind: 'text', label: 'Updated', group: 'meta' },
};
