-- Migration 0006: light/dark workflow screenshots.
--
-- Additive. Adds `image_dark` to `projects` and repoints the three n8n workflow
-- cards at the themed pairs. The six variants were rendered for v1 and are
-- copied across as-is (1400x783, WebP q80) — they are not regenerated here.
--
-- `image` keeps its meaning as the light-theme shot AND the fallback: a row with
-- image_dark NULL renders `image` in both themes rather than breaking, which is
-- what a project added through the admin with a single screenshot will do.
--
-- Rows are matched on their current `image` value, not id or sort_order:
-- sort_order is admin-editable and could have moved since 0005, and a mismatched
-- WHERE here would silently theme the wrong card. Matching the path means a
-- re-run simply updates 0 rows.

ALTER TABLE projects ADD COLUMN image_dark TEXT;

-- 1. Invoice Fraud Firewall
UPDATE projects SET
  image      = '/assets/projects/invoice-fraud-firewall-light.webp',
  image_dark = '/assets/projects/invoice-fraud-firewall-dark.webp'
WHERE image = '/assets/projects/invoice-fraud-firewall.webp';

-- 2. AI Lead Intelligence & Auto-Response
UPDATE projects SET
  image      = '/assets/projects/ai-lead-intelligence-light.webp',
  image_dark = '/assets/projects/ai-lead-intelligence-dark.webp'
WHERE image = '/assets/projects/ai-lead-intelligence.webp';

-- 3. Multi-Stage Invoice Approval Pipeline
UPDATE projects SET
  image      = '/assets/projects/invoice-approval-pipeline-light.webp',
  image_dark = '/assets/projects/invoice-approval-pipeline-dark.webp'
WHERE image = '/assets/projects/invoice-approval-pipeline.webp';
