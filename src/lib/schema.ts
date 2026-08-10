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

/**
 * `import type`, and the keyword is load-bearing rather than a style preference.
 *
 * It is erased before the bundler ever sees it. A value import of the same name
 * would pull src/lib/media.ts — and the `import { env } from 'cloudflare:workers'`
 * it opens with, a specifier only the Workers runtime resolves — into the two
 * admin pages' BROWSER bundles, which import this module. That does not degrade;
 * it fails the build. See ACCEPT_MIME below, which pays the same toll in the
 * other currency.
 */
import type { MediaRow } from './media';

export const TABLE_COLUMNS = {
  jobs: [
    'sort_order', 'eyebrow', 'title', 'company', 'date_range',
    'body_html', 'tags_json', 'logo_light', 'logo_dark',
  ],
  projects: [
    'sort_order', 'title', 'body_html', 'tags_json', 'icon_light', 'icon_dark',
    'featured', 'featured_logo', 'featured_logo_dark', 'external_url', 'external_label',
    'image', 'image_dark', 'image_alt', 'hidden',
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
    // Scheduled publishing (migration 0013). Nullable ISO-8601 UTC. Must be
    // writable through /api/content/posts or the editor could only ever set a
    // schedule, never clear one — which is how a post gets stuck queued.
    'publish_at',
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
  | 'date' | 'datetime' | 'url' | 'image' | 'tags' | 'select';

/**
 * Which admin panel the field belongs to.
 *
 * The first four are the post editor's tabs; the rest are the content row
 * editor's sections. One union rather than two because FieldSpec is shared — a
 * table simply never uses the other editor's keys.
 */
export type FieldGroup =
  | 'content' | 'seo' | 'social' | 'meta'
  | 'basics' | 'media' | 'link' | 'placement';

export interface FieldSpec {
  kind: FieldKind;
  label: string;
  hint?: string;
  options?: string[];
  group?: FieldGroup;
  rows?: number;
  /**
   * Block saving when the value is blank.
   *
   * This is NOT the column's NOT NULL. '' satisfies NOT NULL on a TEXT column,
   * so D1 happily stores a project with no title and no body, and the live site
   * renders it as an empty card — no error anywhere. Set this only where blank
   * makes the public page wrong, not merely where SQLite would complain.
   */
  required?: true;
}

export const POST_FIELDS: Record<string, FieldSpec> = {
  title: { kind: 'text', label: 'Title', group: 'content' },
  slug: { kind: 'text', label: 'Slug', hint: 'Changing this breaks existing links unless you add a redirect.', group: 'content' },
  status: {
    kind: 'select',
    label: 'Status',
    options: ['draft', 'scheduled', 'published'],
    hint: 'Scheduled posts go live automatically at the time below — no cron, no manual step.',
    group: 'content',
  },
  /*
    Scheduled publish time. Separate from post_date on purpose: post_date is the
    DISPLAYED date (byline, BlogPosting JSON-LD) and is legitimately backdated,
    while this is when the post becomes visible. Conflating them would make one
    of the two impossible to express.
  */
  publish_at: {
    kind: 'datetime',
    label: 'Publish at',
    hint: 'Only used when status is “scheduled”. Entered in your local time, stored as UTC.',
    group: 'content',
  },
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

/** Reused verbatim across the three tables that carry a light/dark logo pair. */
const DARK_LOGO_HINT =
  'Optional. Left blank, the light logo is drawn on a light plate so its dark ink stays legible ' +
  'in dark mode. Setting a dark variant opts this logo OUT of the plate — only do that if the ' +
  'file is designed to sit directly on dark paper (migration 0007 is the story of getting this ' +
  'wrong).';

const SORT_ORDER_FIELD: FieldSpec = {
  kind: 'number',
  label: 'Sort order',
  hint: 'Low numbers render first. Prefer the ↑ ↓ arrows in the row header — they swap two rows and save both.',
  group: 'placement',
};

/**
 * Per-column metadata for the CV tables — the same shape POST_FIELDS gives the
 * post editor, so admin/content/[table].astro can render a real control per
 * column instead of guessing one.
 *
 * This REPLACED a `kindOf(col)` in that page which sniffed the column NAME
 * (`endsWith('_html')` and friends). Name sniffing is precisely how `hidden` came
 * to render as a text box: no rule matched it, the fallback was `text`, "Add"
 * seeded `''`, SQLite stored TEXT '' in an INTEGER column, and the public
 * `WHERE hidden = 0` then compared TEXT to INTEGER, came out false, and dropped
 * the project from the live site while the admin still looked correct. A column
 * is now either described here or refused outright — see contentFieldsFor().
 *
 * KEY ORDER IS FIELD ORDER. It is deliberately not column order: the columns sit
 * in whatever order migrations added them, which leads every table with
 * `sort_order` and buries `image_alt` behind the icons. Order these for the
 * person filling the form — what the thing IS, then what it looks like, then
 * where it goes.
 */
export const CONTENT_FIELDS: Partial<Record<TableName, Record<string, FieldSpec>>> = {
  jobs: {
    title: { kind: 'text', label: 'Role', hint: 'The job title, e.g. “Accounts & Inventory Officer”.', group: 'basics', required: true },
    company: { kind: 'text', label: 'Company', hint: 'Company and location. HTML entities are decoded on render, so “&middot;” shows as “·”.', group: 'basics', required: true },
    eyebrow: { kind: 'text', label: 'Eyebrow', hint: 'The small label above the role — one or two words, e.g. “Accounting”.', group: 'basics' },
    date_range: { kind: 'text', label: 'Dates', hint: 'Free text, printed verbatim — e.g. “Sep 2022 to present”. Nothing parses it.', group: 'basics' },
    body_html: { kind: 'html', label: 'Description', hint: 'Raw HTML, rendered as-is on the public site. Wrap each paragraph in <p>…</p>.', group: 'basics', required: true },
    tags_json: { kind: 'tags', label: 'Skills', hint: 'The chips under the role.', group: 'basics' },
    logo_light: { kind: 'image', label: 'Company logo', hint: 'Shown beside the role. Leave blank for no logo.', group: 'media' },
    logo_dark: { kind: 'image', label: 'Company logo (dark theme)', hint: DARK_LOGO_HINT, group: 'media' },
    sort_order: SORT_ORDER_FIELD,
  },

  projects: {
    title: { kind: 'text', label: 'Project name', hint: 'The card heading, and the link text when a URL is set.', group: 'basics', required: true },
    body_html: { kind: 'html', label: 'Description', hint: 'Raw HTML, rendered as-is on the public site. Wrap each paragraph in <p>…</p>.', group: 'basics', required: true, rows: 6 },
    tags_json: { kind: 'tags', label: 'Stack', hint: 'The chips under the card — the tools this was built with, e.g. n8n, Gemini, Gmail.', group: 'basics' },

    image: { kind: 'image', label: 'Screenshot', hint: '1400×783 WebP. Also the fallback: with no dark variant set, this one renders in both themes.', group: 'media' },
    image_dark: { kind: 'image', label: 'Screenshot (dark theme)', hint: 'Optional. Only fetched when the reader is actually in dark mode.', group: 'media' },
    image_alt: {
      kind: 'text',
      label: 'Screenshot alt text',
      hint: 'Accessibility-critical, and used for BOTH screenshots. It is what a screen reader reads and what shows if the image 404s, so describe what the workflow does and how it branches — not “screenshot of n8n”. A sentence is not too long here.',
      group: 'media',
    },
    icon_light: { kind: 'image', label: 'Card icon', hint: 'The small mark beside the project name — usually the main tool’s logo. 52×52.', group: 'media' },
    icon_dark: { kind: 'image', label: 'Card icon (dark theme)', hint: DARK_LOGO_HINT, group: 'media' },

    external_url: { kind: 'url', label: 'Link URL', hint: 'Makes the whole card clickable. Leave blank for a card that just sits there.', group: 'link' },
    external_label: { kind: 'text', label: 'Link text', hint: 'The call to action under the card. Blank falls back to “Read more”.', group: 'link' },

    featured: {
      kind: 'boolean',
      label: 'Feature this project',
      hint: 'Promotes it out of the grid into the big headline block. Only the FIRST ticked row is promoted; ticking a second one just leaves it in the grid.',
      group: 'placement',
    },
    featured_logo: { kind: 'image', label: 'Featured logo', hint: 'Only the headline block draws this, so it does nothing unless “Feature this project” is ticked. With no dark variant set, it sits on a light plate in both themes.', group: 'placement' },
    featured_logo_dark: { kind: 'image', label: 'Featured logo (dark theme)', hint: DARK_LOGO_HINT, group: 'placement' },
    hidden: {
      kind: 'boolean',
      label: 'Hide from the live site',
      hint: 'Keeps the row and its copy but removes it from the public page. This is the reversible alternative to Delete.',
      group: 'placement',
    },
    sort_order: SORT_ORDER_FIELD,
  },

  skills: {
    category: { kind: 'text', label: 'Category', hint: 'The group heading, e.g. “Automation & AI”.', group: 'basics', required: true },
    subtitle: { kind: 'text', label: 'Subtitle', hint: 'One line under the heading.', group: 'basics' },
    tags_json: { kind: 'tags', label: 'Skills', hint: 'The chips in this group.', group: 'basics' },
    sort_order: SORT_ORDER_FIELD,
  },

  certifications: {
    title: { kind: 'text', label: 'Certificate', hint: 'The name as it appears on the certificate.', group: 'basics', required: true },
    issuer: { kind: 'text', label: 'Issued by', hint: 'The awarding body, e.g. “Google”.', group: 'basics', required: true },
    sort_order: SORT_ORDER_FIELD,
  },

  education: {
    title: { kind: 'text', label: 'Qualification', hint: 'The degree or programme.', group: 'basics', required: true },
    school: { kind: 'text', label: 'Institution', hint: 'The university or college.', group: 'basics', required: true },
    date_range: { kind: 'text', label: 'Dates', hint: 'Free text, printed verbatim — e.g. “2018 to 2022”.', group: 'basics' },
    body_html: { kind: 'html', label: 'Description', hint: 'Raw HTML, rendered as-is on the public site. Wrap each paragraph in <p>…</p>.', group: 'basics' },
    sort_order: SORT_ORDER_FIELD,
  },
};

/**
 * The INTEGER columns of the content tables, mirrored from schema.sql and
 * migration 0005.
 *
 * SQLite gives an INTEGER column integer affinity, but affinity only converts a
 * *well-formed* numeric string — '' is not one, so it lands as TEXT '' and every
 * later `WHERE hidden = 0` silently misses the row. That is the entire reason
 * this list exists: contentFieldsFor() refuses to render a column named here
 * through any control that can emit '', no matter what CONTENT_FIELDS claims.
 * Metadata is hand-written and can be wrong; the column's declared type cannot.
 *
 * Scoped to the tables admin/content/[table].astro serves. posts has INTEGER
 * columns too, but its editor is driven by POST_FIELDS and never reaches here.
 */
const INTEGER_COLUMNS: Record<string, readonly string[]> = {
  jobs: ['sort_order'],
  projects: ['sort_order', 'featured', 'hidden'],
  skills: ['sort_order'],
  certifications: ['sort_order'],
  education: ['sort_order'],
};

/** The only two kinds that cannot hand SQLite an empty string. */
const NUMERIC_KINDS: readonly FieldKind[] = ['number', 'boolean'];

export interface ContentField extends FieldSpec {
  name: string;
  /**
   * Set when CONTENT_FIELDS has no usable entry for this column. The editor
   * renders it read-only and drops it from the payload entirely: deliberately
   * loud and useless, rather than quietly writable. The last time an undescribed
   * column got a "harmless" text box, it took a project off the live site.
   */
  unspecified?: true;
}

const humanize = (col: string) =>
  col
    .replace(/_json$/, '')
    .replace(/_html$/, '')
    .replace(/_/g, ' ')
    .replace(/^./, (m) => m.toUpperCase());

/**
 * The field list for one content table: every allowed column, in CONTENT_FIELDS
 * order, each carrying its control metadata.
 *
 * TABLE_COLUMNS stays the authority on what EXISTS — CONTENT_FIELDS only says
 * how it looks and where it sits. So a key in CONTENT_FIELDS that is not a real
 * column contributes nothing but ordering, and a column with no key still shows
 * up (at the end, marked `unspecified`) instead of vanishing from the admin the
 * way it would if the metadata drove the list.
 */
export function contentFieldsFor(table: TableName): ContentField[] {
  const specs: Record<string, FieldSpec | undefined> = CONTENT_FIELDS[table] ?? {};
  const ints = INTEGER_COLUMNS[table] ?? [];
  const order = Object.keys(specs);
  const rank = (c: string) => (order.indexOf(c) === -1 ? order.length : order.indexOf(c));

  return [...columnsFor(table)]
    .sort((a, b) => rank(a) - rank(b))
    .map((name) => {
      const spec = specs[name];
      const safe = spec && (!ints.includes(name) || NUMERIC_KINDS.includes(spec.kind));
      return safe
        ? { name, ...spec }
        : { name, kind: 'text' as const, label: humanize(name), unspecified: true as const };
    });
}

/**
 * Mirrors `asset()` in src/pages/index.astro.
 *
 * The seed data stores some paths without a leading slash
 * ('assets/logos/helptech-logo.png') and the public page prepends one. A preview
 * that skipped this would resolve them against /admin/content/jobs and show a
 * 404 for a file that renders perfectly on the live site — the exact opposite of
 * what the preview is for.
 */
const assetUrl = (p: string) => (/^(https?:)?\//.test(p) ? p : `/${p}`);

export interface ImageControl {
  /** Put this in the form. */
  el: HTMLElement;
  /** The path box. Callers wire their own dirty/save/read logic to it. */
  input: HTMLInputElement;
}

/**
 * Mirrors MIME_EXT in src/lib/media.ts, and deliberately does not import it —
 * see the `import type` note at the top of this file for the wall in the way.
 *
 * Restating a list is a drift risk, so it is worth being precise about what this
 * copy actually decides: nothing. It is the file picker's filter and no more.
 * /api/media re-checks the declared type against its own allowlist AND verifies
 * the magic bytes, so the worst a stale copy here can do is offer a type the
 * server then refuses with a real 415 — which this control displays verbatim.
 * SVG is absent for the reason media.ts gives at length: same-origin delivery
 * makes it a stored-XSS primitive.
 */
const ACCEPT_MIME = 'image/webp,image/avif,image/png,image/jpeg,image/gif';

/**
 * Both admin pages already handle a 401 by showing a "log in again" link on
 * their own status line. This control cannot reach that line — it is one field
 * on a page of many, built by a module that knows nothing about either page's
 * chrome — so it says the same thing in its own words. Another tab, because the
 * form very likely holds unsaved edits by the time a session lapses.
 */
const SESSION_MSG = 'Session expired — log in again in another tab, then retry.';

/**
 * The media library, fetched once per page rather than once per control.
 *
 * A project row renders five image fields, and every row is on the page at once,
 * so "GET on open" without this is a request per panel per open. Module scope is
 * the same reason buildImageControl lives here at all: both admin pages import
 * this one module, so they share the cache for free.
 *
 * Invalidated after every successful upload — a picker that cannot show the file
 * you just added is worse than no picker.
 */
let libraryCache: Promise<MediaRow[]> | null = null;

async function fetchLibrary(): Promise<MediaRow[]> {
  const res = await fetch('/api/media', { headers: { Accept: 'application/json' } });
  if (res.status === 401) throw new Error(SESSION_MSG);
  const payload = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: MediaRow[];
    error?: string;
  } | null;
  if (!res.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error || `Could not load the library (${res.status}).`);
  }
  return payload.data;
}

function loadLibrary(): Promise<MediaRow[]> {
  if (!libraryCache) {
    const pending = fetchLibrary();
    /*
      A REJECTED promise must not stay in the cache. Reopening the panel is how a
      reader retries, and a cached rejection would answer every future open with
      the same stale error without ever asking the server again — the failure
      would look permanent because it had been made permanent.
    */
    pending.catch(() => {
      if (libraryCache === pending) libraryCache = null;
    });
    libraryCache = pending;
  }
  return libraryCache;
}

/**
 * Ask the BROWSER for the image's real pixel dimensions.
 *
 * Workers have no image decoder, so /api/media takes these on trust from here —
 * see its own note. The browser is about to decode the file anyway to preview
 * it, which makes this nearly free.
 *
 * Never rejects. Dimensions are optional all the way down (the columns are
 * NULLable and the endpoint coerces junk to NULL), so a file the browser cannot
 * decode should still upload and let the server's magic-byte check be the thing
 * that judges it. Failing here would substitute a worse error for a better one.
 */
function readDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const probe = new Image();
    const done = (width: number | null, height: number | null) => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };
    probe.addEventListener('load', () => done(probe.naturalWidth || null, probe.naturalHeight || null));
    probe.addEventListener('error', () => done(null, null));
    probe.src = objectUrl;
  });
}

/**
 * POST the file to /api/media.
 *
 * XMLHttpRequest, not fetch, and that is the whole reason this is not four lines:
 * fetch cannot report UPLOAD progress. The cap is 10 MB and the audience is one
 * person on whatever connection he has, so the difference is between a button
 * that says nothing for eight seconds and one that counts. `xhr.upload.progress`
 * is the only API in the platform that answers this.
 *
 * The error text is the SERVER'S wherever there is one. /api/media writes real
 * messages for the cases that actually happen — 413 says how big the file is and
 * what the limit is, 415 names the type it refused — and paraphrasing them here
 * would mean maintaining a second, worse copy of rules this control does not own.
 */
function postUpload(
  file: File,
  dims: { width: number | null; height: number | null },
  onProgress: (percent: number) => void
): Promise<MediaRow> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    if (dims.width) form.append('width', String(dims.width));
    if (dims.height) form.append('height', String(dims.height));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status === 401) {
        reject(new Error(SESSION_MSG));
        return;
      }
      let payload: { ok?: boolean; data?: MediaRow; error?: string } | null = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // A non-JSON body means something upstream of the route answered — a
        // platform error page, say. Fall through to the status-code message.
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.ok && payload.data) {
        resolve(payload.data);
        return;
      }
      reject(new Error(payload?.error || `Upload failed (${xhr.status}).`));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed — the network dropped it.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')));
    xhr.send(form);
  });
}

/** "1400×783 · 84 KB" — what tells two screenshots apart in a grid of thumbnails. */
function describeRow(row: MediaRow): string {
  const dims = row.width && row.height ? `${row.width}×${row.height}` : 'size unknown';
  const size =
    row.bytes >= 1024 * 1024
      ? `${(row.bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(row.bytes / 1024))} KB`;
  return `${dims} · ${size}`;
}

/**
 * appendChild, not append. Do not "tidy" this back to `parent.append(...kids)`.
 *
 * @cloudflare/workers-types declares a global `interface Element` for
 * HTMLRewriter carrying its own `append(content: string | Response |
 * ReadableStream, options?)`. TypeScript merges that declaration into lib.dom's
 * `Element` — and because lib.dom does not declare `append` on Element itself
 * but INHERITS it from ParentNode, a member declared directly on Element
 * shadows the inherited one outright instead of overloading with it. The result
 * is that in any .ts file here (tsconfig sets types: ["@cloudflare/workers-
 * types"]) `el.append(node)` is a type error, and only the HTMLRewriter
 * signature is on offer.
 *
 * `appendChild` lives on Node, a name workers-types does not claim, so it comes
 * through intact. The admin's .astro <script> blocks use plain `.append` and are
 * fine only because tsc never sees them — this collision is specific to being a
 * real module, which is the price of the two pages sharing one control.
 */
const put = (parent: HTMLElement, ...kids: HTMLElement[]) => {
  for (const k of kids) parent.appendChild(k);
};

/**
 * The `image` control: a path box, an uploader, a library picker, and a live
 * thumbnail proving whatever the box currently says.
 *
 * WHY IT LIVES IN schema.ts, of all places: both admin/content/[table].astro and
 * admin/settings.astro must render `image` identically, and neither can import
 * from the other — they are pages. This module already owns the metadata that
 * names the kind, so it is the one place both may import. The cost is a DOM
 * builder inside a module the Worker also imports: nothing here runs at module
 * scope, so the API routes carry a few dead bytes and never touch `document`.
 *
 * THE BOX STILL TAKES A TYPED PATH, and that is not legacy tolerance. The seed
 * data is full of build-time assets under public/assets/, some stored WITHOUT a
 * leading slash ('assets/logos/helptech-logo.png'), which is why the preview
 * resolves through assetUrl() — index.astro's own `asset()` helper, mirrored. An
 * upload and a typed path produce the same thing here: a string in `input`,
 * previewed the same way, collected by the same `[data-field]` sweep.
 *
 * THE CONTRACT WITH BOTH CALLERS is the `input` event, and every write goes
 * through setValue() to honour it: [table].astro listens to mark the row dirty,
 * settings.astro to enable its Save button. A value assigned without dispatching
 * it looks correct on screen and saves nothing — the reader picks an image, sees
 * it appear, and the Save button never wakes up. Nothing outside this function
 * needs to know an upload happened.
 */
export function buildImageControl(opts: {
  id: string;
  value: string;
  /** Set to make the editor's generic `[data-field]` collector pick the value up. */
  field?: string;
  /**
   * The field's human label, used only for the buttons' accessible names. A
   * project row carries five of these controls, so five buttons all named
   * "Upload" is a screen reader listing them with no way to tell which is the
   * screenshot and which is the dark icon.
   */
  label?: string;
}): ImageControl {
  const wrap = document.createElement('div');
  wrap.className = 'media-field';

  const input = document.createElement('input');
  input.className = 'input input--mono';
  input.type = 'text';
  input.id = opts.id;
  input.value = opts.value ?? '';
  input.placeholder = '/assets/…';
  input.spellcheck = false;
  if (opts.field) {
    input.dataset.field = opts.field;
    input.dataset.kind = 'image';
  }

  const forField = (verb: string) => (opts.label ? `${verb} for ${opts.label}` : verb);

  // --- Actions row: upload, library, and this control's own status line -----
  const actions = document.createElement('div');
  actions.className = 'media-field__actions';

  /*
    Hidden and driven by a real <button>, rather than styled to look like one.
    A file input restyled into a button is the usual source of a control that
    cannot be reached from the keyboard; a plain button that forwards .click()
    to a hidden input is focusable, labellable and Enter-activated for free.
  */
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = ACCEPT_MIME;
  fileInput.hidden = true;

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'btn btn--sm';
  uploadBtn.textContent = 'Upload';
  uploadBtn.setAttribute('aria-label', forField('Upload an image'));

  const libraryBtn = document.createElement('button');
  libraryBtn.type = 'button';
  libraryBtn.className = 'btn btn--sm btn--ghost';
  libraryBtn.textContent = 'Library';
  libraryBtn.setAttribute('aria-label', forField('Choose an uploaded image'));
  libraryBtn.setAttribute('aria-expanded', 'false');

  const status = document.createElement('span');
  status.className = 'status media-field__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  put(actions, uploadBtn, libraryBtn, status, fileInput);

  const setStatus = (msg: string, kind?: 'ok' | 'err' | 'busy') => {
    status.textContent = msg;
    status.className = 'status media-field__status' + (kind ? ` status--${kind}` : '');
  };

  // --- Library panel --------------------------------------------------------
  const panel = document.createElement('div');
  panel.className = 'media-lib';
  panel.id = `${opts.id}-library`;
  panel.hidden = true;
  libraryBtn.setAttribute('aria-controls', panel.id);

  const thumb = document.createElement('div');
  thumb.className = 'media-field__thumb';

  const img = document.createElement('img');
  img.alt = ''; // decorative — the path it is proving sits in the box above
  img.hidden = true;
  /*
    Deliberately NOT loading="lazy". A lazy image that starts `hidden` is
    display:none, never intersects the viewport, and is therefore never fetched —
    the same behaviour index.astro relies on to keep its dark screenshots off the
    wire. Here that would mean the preview simply never appears.
  */

  const note = document.createElement('span');
  note.className = 'media-field__note';

  put(thumb, img, note);

  const hint = document.createElement('p');
  hint.className = 'field__hint';
  hint.textContent =
    'Drop an image anywhere on this field, or press Upload — it is stored in R2 and its path fills ' +
    'itself in. Library picks one already uploaded. A path to a file committed under public/assets/ ' +
    'still works and is what the older rows use.';

  put(wrap, input, actions, panel, thumb, hint);

  const say = (msg: string) => {
    img.hidden = true;
    note.hidden = false;
    note.textContent = msg;
  };

  img.addEventListener('load', () => {
    img.hidden = false;
    note.hidden = true;
  });
  // A 404 is the ordinary case mid-typing, and the useful one once you stop: it
  // is the only thing separating "wrong path" from "file not deployed yet".
  img.addEventListener('error', () => say(`Not found: ${img.getAttribute('src') ?? ''}`));

  /*
    Debounced because this box holds a path the reader TYPES, not a URL they
    picked: undebounced, "/assets/projects/x.webp" is twenty-four 404s.
  */
  let timer: ReturnType<typeof setTimeout> | undefined;

  const preview = () => {
    const v = input.value.trim();
    if (!v) {
      img.removeAttribute('src');
      say('No image set');
      return;
    }
    const url = assetUrl(v);
    // Re-setting the same src fires neither load nor error, which would strand
    // the box on "Loading…" — so leave the resolved state alone.
    if (img.getAttribute('src') === url) return;
    say('Loading…');
    img.src = url;
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(preview, 250);
  });

  /** The ONLY way code writes this box. See the contract note above the function. */
  const setValue = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const closeLibrary = (refocus = false) => {
    if (panel.hidden) return;
    panel.hidden = true;
    libraryBtn.setAttribute('aria-expanded', 'false');
    if (refocus) libraryBtn.focus();
  };

  const fillPanel = (child: HTMLElement) => {
    panel.textContent = '';
    put(panel, child);
  };

  function renderLibrary(rows: MediaRow[]) {
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'media-lib__empty';
      empty.textContent = 'Nothing uploaded yet. Drop an image on this field to add the first one.';
      fillPanel(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'media-lib__grid';

    const current = input.value.trim();
    for (const row of rows) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'media-lib__item';
      if (current === row.url) item.setAttribute('aria-current', 'true');

      const itemThumb = document.createElement('img');
      itemThumb.className = 'media-lib__thumb';
      itemThumb.src = row.url;
      /*
        alt="" and no loading="lazy". The filename and dimensions below are the
        item's accessible name, so a described thumbnail would say everything
        twice; and lazy inside a panel that starts `hidden` is the footgun the
        preview above documents. The grid is only built when the panel opens, so
        nothing is fetched for a picker nobody used.
      */
      itemThumb.alt = '';

      const name = document.createElement('span');
      name.className = 'media-lib__name';
      name.textContent = row.filename;

      const meta = document.createElement('span');
      meta.className = 'media-lib__meta';
      meta.textContent = describeRow(row);

      put(item, itemThumb, name, meta);
      item.addEventListener('click', () => {
        setValue(row.url);
        setStatus(`Picked ${row.filename}.`, 'ok');
        closeLibrary(true);
      });
      put(grid, item);
    }

    fillPanel(grid);
    // The panel is a disclosure the reader just asked for, so the keyboard
    // follows it in. Escape (below) puts focus back on the button.
    grid.querySelector<HTMLButtonElement>('.media-lib__item')?.focus();
  }

  async function openLibrary() {
    panel.hidden = false;
    libraryBtn.setAttribute('aria-expanded', 'true');

    const loading = document.createElement('p');
    loading.className = 'media-lib__empty';
    loading.textContent = 'Loading the library…';
    fillPanel(loading);

    try {
      renderLibrary(await loadLibrary());
    } catch (err) {
      const p = document.createElement('p');
      p.className = 'status status--err media-lib__empty';
      p.textContent = err instanceof Error ? err.message : 'Could not load the library.';
      fillPanel(p);
    }
  }

  libraryBtn.addEventListener('click', () => {
    if (panel.hidden) void openLibrary();
    else closeLibrary(true);
  });

  /*
    stopPropagation because [table].astro runs a document-level Escape handler
    for its delete-confirm popover. It happens to no-op when no confirm is open,
    but a panel that lets Escape through to a sibling widget's handler is one
    refactor away from closing two things at once.
  */
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    closeLibrary(true);
  });

  // --- Upload ---------------------------------------------------------------
  let busy = false;

  async function upload(file: File) {
    // One at a time per field. Two uploads racing would both call setValue and
    // the box would end up holding whichever finished last, not whichever was
    // asked for last.
    if (busy) return;
    busy = true;
    uploadBtn.disabled = true;
    libraryBtn.disabled = true;

    try {
      setStatus('Reading the image…', 'busy');
      const dims = await readDimensions(file);
      setStatus('Uploading…', 'busy');
      const row = await postUpload(file, dims, (percent) =>
        setStatus(`Uploading… ${percent}%`, 'busy')
      );
      // The new row must be visible the next time any panel on this page opens.
      libraryCache = null;
      setValue(row.url);
      setStatus(`Uploaded ${row.filename}.`, 'ok');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Upload failed.', 'err');
    } finally {
      busy = false;
      uploadBtn.disabled = false;
      libraryBtn.disabled = false;
      /*
        Cleared so that choosing the SAME file again fires `change`. The event is
        keyed on the value changing, so a reader who exports a corrected file over
        the old one, reopens the picker and selects it gets silence otherwise —
        the one case where retrying is exactly the right instinct.
      */
      fileInput.value = '';
    }
  }

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void upload(file);
  });

  // --- Drag and drop --------------------------------------------------------
  /*
    dragover MUST preventDefault, and this is not a nicety: without it the
    browser's default action wins and dropping an image NAVIGATES the tab to the
    file:// URL, taking every unsaved edit in the form with it. A field that
    silently destroys the row when you miss it is worse than one that cannot
    accept a drop at all.

    The counter exists because dragleave also fires when the cursor crosses onto
    a CHILD element — the thumb, a button — so a plain add/remove strobes the
    highlight the entire time a file is held over the field.
  */
  const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types?.includes('Files'));
  let dragDepth = 0;

  const clearDrag = () => {
    dragDepth = 0;
    wrap.classList.remove('media-field--drop');
  };

  wrap.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return; // dragged text or a link is not an upload
    e.preventDefault();
    dragDepth++;
    wrap.classList.add('media-field--drop');
  });

  wrap.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  wrap.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) wrap.classList.remove('media-field--drop');
  });

  wrap.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    clearDrag();
    /*
      Only the first file. The box holds one path, so a multi-file drop has no
      meaning here — silently taking one of several is still better than the
      alternative of five uploads racing to write one field.
    */
    const file = e.dataTransfer?.files?.[0];
    if (file) void upload(file);
  });

  preview();

  return { el: wrap, input };
}
