-- Migration 0011: bring the D1-resident meta copy inside the lengths Google renders.
--
-- Measured by curl against the live site, not estimated. Every string below was
-- over one of the two windows that matter:
--
--   * title: ~60 characters. Google truncates on pixel width near 580-600px;
--     Semrush hard-flags over 70. Only ONE title on the site was over — the
--     Facebook post, at 75, which is the "Failed: 1" page in Semrush.
--   * description: 120-160. Over 160 is not penalised, it is simply cut, and the
--     cut always lands on the tail — which is where these descriptions kept the
--     specific, clickable half (the ROI number, the Claude Code mention, the
--     "not the highlight reel" line). Length was costing the best copy.
--
-- This is 0008's deferred half. That migration shortened `default_seo_title` and
-- explicitly left `default_seo_description` ("The same argument applies, but it is
-- a separate call"). The call: LENGTH ONLY. The description still leads with
-- "Social media marketer" rather than the AI/n8n identity 0008 moved the title to.
-- Reordering it is a positioning decision, it is Ibrahim's to make, and it does not
-- belong in a migration whose stated job is trimming — one decision per migration.
-- Only "and inventory" is gone; "Erbil, Iraq" is kept over the fuller job title
-- because it is the geo pair the page ranks locally on.
--
-- Rows are matched on `key` / `slug`. `key` is the settings lookup and is not
-- admin-editable (only `value` is), and `slug` is the public URL of the post —
-- changing one is already a redirect-shaped decision, so neither drifts silently
-- the way an id or sort_order would (see 0006/0007). Every statement is a plain
-- UPDATE to a literal, so a re-run rewrites the same value: idempotent, and safe
-- to apply after someone has edited these in the admin — it will overwrite them.
--
-- Titles keep the " | Ibrahim Maher Al-Bander" suffix (26 characters of the 60).
-- Only the left side was shortened. og:title is a separate column and deliberately
-- carries the full editorial headline for social — it is NOT touched here.

-- 163 -> 149. Drops "and inventory" from the job title; keeps the 500%+ proof and
-- "production n8n workflows", which is the tail Google was cutting.
UPDATE settings
SET value = 'Social media marketer, accounts officer, and AI automation developer in Erbil, Iraq. I grew a business page 500%+ and build production n8n workflows.'
WHERE key = 'default_seo_description';

-- 75 -> 57. The only over-length title on the site. "Small Business" and the
-- "How I Grew a Small Business Facebook Page by 500%" phrasing spent 18 characters
-- restating what the description says better; "small business" survives there.
-- First person and the 500% number — the two things that make this clickable —
-- both stay in the shop window.
UPDATE posts
SET seo_title = 'How I Grew a Facebook Page 500% | Ibrahim Maher Al-Bander'
WHERE slug = 'growing-a-facebook-page-500-percent';

-- 170 -> 156. "more than 500%" -> "500%+" and "got close to" -> "got near".
-- The ROI figure and the audience-data hook were both past the cut before.
UPDATE posts
SET seo_description = 'No agency, no big budget. How I grew a small business Facebook page 500%+ and got near 100% ROI on paid ads, using audience data most marketers never check.'
WHERE slug = 'growing-a-facebook-page-500-percent';

-- 185 -> 158. The longest post description. "not a computer science one" ->
-- "not computer science"; the degree contrast is the whole premise, so it stays.
UPDATE posts
SET seo_description = 'I have a computer engineering technology degree, not computer science. Here is how I still shipped a live e-commerce site and a dozen AI-assisted automations.'
WHERE slug = 'ai-assisted-development-no-cs-degree';

-- 170 -> 154. "Here is the difference between" -> "Here is what separates" and
-- "only ever touch the first" -> "stop at the first". All four layer names are
-- kept — they are the post's actual terminology and its search surface.
UPDATE posts
SET seo_description = 'Prompt engineering is one skill out of four. Here is what separates prompt, context, harness, and loop engineering, and why most people stop at the first.'
WHERE slug = 'four-layers-of-working-with-ai';

-- 164 -> 157. Drops the redundant " system" after "AP/AR".
UPDATE posts
SET seo_description = 'No accounting degree, no prior bookkeeping experience. How I built a company''s full QuickBooks AP/AR and reconciliation process from scratch, under deadline.'
WHERE slug = 'quickbooks-ap-ar-from-scratch';

-- 164 -> 156. "paid campaign targeting" -> "my ad targeting"; "Meta Ads Manager"
-- stays at the front, where it is doing the keyword work.
UPDATE posts
SET seo_description = 'Meta Ads Manager hides audience interest data most small-business marketers never dig for. Here is how I surfaced it and used it to sharpen my ad targeting.'
WHERE slug = 'hidden-meta-ads-targeting-data';

-- 164 -> 151. Drops "at the point" — "in the approval chain where a mistake
-- actually costs money" says it in fewer words.
UPDATE posts
SET seo_description = 'Full autonomy sounds appealing, but the most reliable n8n automations I build keep a person in the approval chain where a mistake actually costs money.'
WHERE slug = 'human-in-the-loop-ai-automation';

-- 163 -> 153. "e-commerce site" -> "store"; "AI-built" already carries the point,
-- and "not the highlight reel" was the part being cut.
UPDATE posts
SET seo_description = 'A CNN capstone project in 2021 turned into production n8n automations and a live AI-built store by 2026. Here is the actual path, not the highlight reel.'
WHERE slug = 'traffic-sign-recognition-to-ai-agents';

-- 161 -> 153. One character over the window, which is still a truncation. Drops
-- "of them" from "Only one of them lets you write real logic".
UPDATE posts
SET seo_description = 'n8n, Zapier, and Make all connect apps. Only one lets you write real logic. Here is what actually differs after building production automations with n8n.'
WHERE slug = 'n8n-vs-zapier-vs-make';
