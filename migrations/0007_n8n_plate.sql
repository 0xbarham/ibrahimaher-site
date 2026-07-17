-- Migration 0007: box the n8n logo.
--
-- n8n was the ONLY mark on the site carrying a dark counterpart, and that is
-- precisely why it was the only one rendered without a box. The plate is applied
-- by the `!logo_dark` / `!icon_dark` branch in index.astro — a mark with no dark
-- variant gets a light ground so its dark ink stays legible on dark paper — so
-- shipping a white variant silently opted n8n OUT of the plate. Measured on the
-- live page: Help Tech (x3) and YourVisio all plated, n8n alone unplated, in the
-- same column. It read as an unanchored mark floating beside boxed ones.
--
-- Clearing the dark variant hands n8n the same treatment as every other logo:
-- the existing branch plates it and stops swapping in the white file, so the
-- dark-ink n8n logo sits on a light plate in both themes. No template change is
-- needed — this is the mechanism the plate already exists for. The white file
-- could not simply be kept AND plated: n8n-logo-white.svg on the #faf8f5 plate
-- is white-on-cream, i.e. invisible.
--
-- Rows are matched on the n8n path rather than id/sort_order, per 0006: both are
-- admin-editable and a mismatched WHERE would silently unbox the wrong logo.
-- Matching the path means a re-run updates 0 rows.
--
-- public/assets/logos/n8n-logo-white.svg is deliberately left on disk. It stays a
-- valid brand asset, and setting the field again in the admin opts that logo back
-- out of the plate — this migration changes data, not the rule.
--
-- Scope note: the tool strip's n8n mark (`.tool__mark--n8n`, n8n-mark.svg) is a
-- CSS mask painted in the page's ink, NOT one of these <img> rows. It is
-- untouched and needs no plate.

UPDATE jobs SET logo_dark = NULL
WHERE logo_dark LIKE '%n8n-logo-white.svg%';

UPDATE projects SET icon_dark = NULL
WHERE icon_dark LIKE '%n8n-logo-white.svg%';
