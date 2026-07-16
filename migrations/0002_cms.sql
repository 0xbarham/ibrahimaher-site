-- Migration 0002: turn the content tables into a full CMS.
--
-- Strictly additive. Every statement is ADD COLUMN or CREATE TABLE IF NOT EXISTS,
-- so existing rows in jobs/projects/skills/certifications/education/posts survive
-- untouched. SQLite cannot ADD COLUMN with NOT NULL and no default, so new columns
-- carry defaults that preserve current behaviour.
--
-- Dates are ISO-8601. post_date stays 'YYYY-MM-DD' (matching the existing seed data,
-- e.g. '2026-07-14'); timestamps use 'YYYY-MM-DDTHH:MM:SSZ'.

-- ---------------------------------------------------------------------------
-- Authors: "setting writer name" — posts attribute to a person record.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  profile_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO authors (id, name, slug, role, bio, profile_url, sort_order)
VALUES (
  1,
  'Ibrahim Maher Al-Bander',
  'ibrahim-maher-al-bander',
  'Social Media Marketer · Accounts & Automation',
  'Social media marketer, accounts and inventory officer, and freelance AI automation developer based in Erbil, Iraq.',
  'https://ibrahimaher.com/about',
  1
);

-- ---------------------------------------------------------------------------
-- Settings: global, admin-editable key/value config (GA id, social links,
-- default SEO, feature toggles). Typed so the admin can render proper inputs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text',   -- text | textarea | url | boolean | image
  grp TEXT NOT NULL DEFAULT 'general', -- general | seo | analytics | social
  label TEXT NOT NULL DEFAULT '',
  hint TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 1
);

-- Seeded from the values currently hard-coded in the static HTML, so behaviour
-- is identical until deliberately changed in the admin.
INSERT OR IGNORE INTO settings (key, value, type, grp, label, hint, sort_order) VALUES
  ('site_name',         'Ibrahim Maher Al-Bander', 'text',     'general',   'Site name',            'Used in OG tags and schema.', 1),
  ('site_tagline',      'Social Media Marketer · Accounts & Automation', 'text', 'general', 'Tagline', 'Shown under your name.', 2),
  ('site_url',          'https://ibrahimaher.com', 'url',      'general',   'Canonical site URL',   'No trailing slash.', 3),
  ('contact_email',     'me@ibrahimaher.com',      'text',     'general',   'Contact email',        '', 4),
  ('web3forms_key',     '895621a3-6323-4999-abfe-c9aac01649d2', 'text', 'general', 'Web3Forms access key', 'Powers the contact form.', 5),
  ('default_seo_title', 'Ibrahim Maher Al-Bander | Social Media Marketing, Accounting & AI Automation', 'text', 'seo', 'Default title tag', 'Under 60 characters where possible.', 10),
  ('default_seo_description', 'Social media marketer, accounts and inventory officer, and AI automation developer in Erbil, Iraq. I grew a business page 500%+ and build production n8n workflows.', 'textarea', 'seo', 'Default meta description', 'Aim for 140-160 characters.', 11),
  ('default_og_image',  '/assets/og-image.png',    'image',    'seo',       'Default share image',  '1200x630 recommended.', 12),
  ('ga_measurement_id', 'G-LHV76XLD3M',            'text',     'analytics', 'Google Analytics ID',  'GA4 measurement ID. Leave blank to disable analytics.', 20),
  ('social_linkedin',   '',                        'url',      'social',    'LinkedIn URL',         '', 30),
  ('social_github',     '',                        'url',      'social',    'GitHub URL',           '', 31),
  ('social_x',          '',                        'url',      'social',    'X / Twitter URL',      '', 32);

-- ---------------------------------------------------------------------------
-- Posts: full CMS fields. Existing 10 rows keep their slug/title/excerpt/date
-- and are back-filled by migration 0003.
-- ---------------------------------------------------------------------------
ALTER TABLE posts ADD COLUMN body_md TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN status TEXT NOT NULL DEFAULT 'published';  -- draft | published
ALTER TABLE posts ADD COLUMN author_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE posts ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE posts ADD COLUMN hero_image TEXT;
ALTER TABLE posts ADD COLUMN hero_alt TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN created_at TEXT NOT NULL DEFAULT '';

-- Per-post SEO, mirroring the tags currently hand-written in each blog/*.html.
ALTER TABLE posts ADD COLUMN seo_title TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN seo_description TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN seo_keywords TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN canonical_url TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN noindex INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN og_title TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN og_description TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN og_image TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN twitter_title TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN twitter_description TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN twitter_image TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_posts_status_date ON posts (status, post_date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts (slug);

-- ---------------------------------------------------------------------------
-- Media: uploaded images, so posts can embed pictures without a redeploy.
-- Binary lives in R2; this table is the queryable index.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,       -- R2 object key
  url TEXT NOT NULL,              -- public URL used in markdown
  filename TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT '',
  bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------------
-- Redirects: admin-managed, so changing a slug never orphans an indexed URL.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS redirects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL UNIQUE,
  destination TEXT NOT NULL,
  code INTEGER NOT NULL DEFAULT 301,
  created_at TEXT NOT NULL DEFAULT ''
);
