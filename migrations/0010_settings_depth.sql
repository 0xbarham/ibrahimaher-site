-- Migration 0010: give the Settings screen real controls, for tags Base.astro
-- already emits or now emits.
--
-- The settings table had 12 rows, which is why the admin's Settings screen looks
-- thin next to the post editor. settings.astro is a generic renderer over this
-- table — it grows a labelled, typed control per row automatically — so depth is
-- purely a question of which rows exist.
--
-- THE RULE APPLIED HERE: every row below is read by src/layouts/Base.astro in the
-- same commit. A row nothing reads is a switch wired to nothing: it looks like a
-- feature, invites the owner to change it, and then silently does nothing — worse
-- than the thin menu it was meant to fix. Several obvious-looking candidates were
-- rejected on exactly that test; they are listed at the bottom.
--
-- EVERY DEFAULT IS THE VALUE THE SITE ALREADY SHIPS, so applying this migration
-- changes zero bytes of rendered HTML. `og_locale` seeds 'en_US' because that is
-- what Base.astro hard-coded; the rest seed '' or '0', and Base.astro emits their
-- tags only when non-empty / '1'. The first behaviour change is the owner's, not
-- this migration's.
--
-- BOOLEANS ARE TEXT '0'/'1'. settings.value is `TEXT NOT NULL DEFAULT ''`, and the
-- checkbox branch in settings.astro reads back `checked ? '1' : '0'`. So the seed
-- is the STRING '0', not 0 or '', and Base.astro tests `=== '1'` rather than
-- truthiness — under truthiness the string '0' is TRUE, which would ship a
-- site-wide noindex the moment someone ticked the box and unticked it again.
--
-- INSERT OR IGNORE, matching 0002: `key` is the PRIMARY KEY, so a re-run is a
-- no-op and — importantly — cannot revert a value the owner has since edited.

INSERT OR IGNORE INTO settings (key, value, type, grp, label, hint, sort_order) VALUES
  -- Sits at 13, immediately after default_og_image (12): alt text is meaningless
  -- away from the image it describes.
  ('default_og_image_alt', '', 'text', 'seo', 'Default share image alt text',
   'Describes the default share image for screen readers. Only used on pages that have not set their own share image — a post with its own picture is described by its own alt text, never this one. Leave blank to omit the tag.', 13),

  ('robots_noindex', '0', 'boolean', 'seo', 'Hide the whole site from search engines',
   'Emergency switch. Ticking this adds noindex,nofollow to EVERY page and Google will drop the site from results within days. Only for taking the site dark. Preview deploys are already noindexed automatically — you do not need this for those.', 14),

  ('robots_max_image_preview', '0', 'boolean', 'seo', 'Allow large image previews',
   'Lets Google show a full-size picture next to your pages in search results and Discover, instead of a thumbnail. Safe to turn on. Ignored while the site is hidden from search engines.', 15),

  ('google_site_verification', '', 'text', 'seo', 'Google Search Console verification code',
   'Only the code itself, not the whole meta tag — the part inside content="...". Paste it here, then press Verify in Search Console. Leave blank once verified by DNS.', 16),

  ('bing_site_verification', '', 'text', 'seo', 'Bing Webmaster Tools verification code',
   'Same idea as the Google one: the code only, not the whole tag. Bing also feeds Microsoft Copilot, so it is worth doing.', 17),

  -- Social group, after social_x (32).
  ('twitter_handle', '', 'text', 'social', 'X / Twitter handle',
   'Your username, so shared links credit you on X. Type it any way you like — ibrahim, @ibrahim, or the full profile URL all work. Leave blank to omit the tags.', 33),

  ('og_locale', 'en_US', 'text', 'social', 'Share card language',
   'The language Facebook and LinkedIn assume when they render a shared link. Underscore, not a hyphen: en_US, en_GB, ar_IQ. This does not translate the site or change the page language — it only labels the share card.', 34);

-- ---------------------------------------------------------------------------
-- Deliberately NOT added, so the next person does not "fix" the omission:
--
--   * seo_title_template ('%s | Ibrahim Maher Al-Bander'). Base.astro renders
--     <title>{title}</title> from a prop, and EVERY page already passes a
--     finished title with the brand suffix baked in — about.astro passes
--     'About Ibrahim Maher Al-Bander | Marketer & AI Developer', blog/[slug]
--     passes `${post.title} | ${authorName}`. A template applied in Base would
--     append the brand a second time on every page. Making it real means cutting
--     the suffix out of five page files first (about, contact, index, blog/index,
--     blog/[slug]) — those are not this change's to edit. A pass-through '%s'
--     default would seed a row that breaks the site the first time it is used,
--     which is the exact failure mode this migration exists to avoid.
--
--   * canonical_host. Base.astro already derives it: `new URL(siteUrl).host`,
--     from the site_url row above. A second row would be a second source of truth
--     for the check that decides whether a page is indexable at all — set it to a
--     host that disagrees with site_url and the live site noindexes itself.
--     site_url already does this job.
--
--   * person_job_title / person_works_for / person_location. The Person JSON-LD
--     is not in Base.astro — it is hard-coded in index.astro and about.astro, and
--     Base only stringifies whatever `jsonLd` prop it is handed. Wiring these
--     needs those two pages. Note also 0008's standing warning: jobTitle should
--     match LinkedIn string-for-string, so an admin box that invites casual edits
--     to it is a mild SEO hazard rather than a feature.
--
--   * Anything else under Analytics. ga_measurement_id is the only analytics
--     value Base.astro reads, and it is already here. The 15s gtag deferral is a
--     performance decision with a measured reason, not a preference.
-- ---------------------------------------------------------------------------
