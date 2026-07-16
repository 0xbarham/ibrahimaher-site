-- Migration 0004: preserve the per-post contact CTA copy that 0003 left behind.
--
-- Migration 0003 deliberately excluded the .post-cta block from body_md, treating it
-- as page chrome. The button is chrome and stays in the template, but the <h3> and the
-- pitch paragraph are unique, hand-written prose per post, so they belong in the CMS.
-- These two columns capture that copy and nothing else.
--
-- Strictly additive: ADD COLUMN with defaults (SQLite cannot ADD COLUMN NOT NULL
-- without one), then UPDATE-only back-fill. No row is created or removed, and no
-- column written by 0002/0003 -- body_md included -- is touched.
--
-- Source of truth: the <div class="post-cta"> region of each blog/*.html. All 10 posts
-- share the identical structure (one <h3>, one <p>, one "Get in touch" button), so this
-- is a VERBATIM format conversion: the <h3> text becomes cta_heading, the <p> text
-- becomes cta_md. The prose contains no inline markup and no HTML entities, so the
-- Markdown is byte-identical to the source text. Nothing was reworded or shortened.
--
-- Excluded (rendered by the template, not authored prose): the <a class="btn btn-primary">
-- label "Get in touch", its /contact href, and the &rarr; arrow span.
--
-- Depends on migration 0002 (creates the posts CMS columns).

-- ---------------------------------------------------------------------------
-- Schema: the authored half of the end-of-post contact block.
-- ---------------------------------------------------------------------------
ALTER TABLE posts ADD COLUMN cta_heading TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN cta_md TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- Back-fill: one UPDATE per slug, in the same order as migration 0003.
-- ---------------------------------------------------------------------------

UPDATE posts SET
  cta_heading = 'Have a project that needs building?',
  cta_md = 'I build real, production software and automation with AI tools doing the heavy lifting, not demos.'
WHERE slug = 'ai-assisted-development-no-cs-degree';

UPDATE posts SET
  cta_heading = 'Have a process that still runs on someone''s memory?',
  cta_md = 'If there is a report, an inbox, or a reconciliation step eating hours every week, it is probably automatable.'
WHERE slug = 'ai-automation-beyond-chatbots';

UPDATE posts SET
  cta_heading = 'Building something with AI and it keeps breaking mid-project?',
  cta_md = 'It is usually a context or harness engineering gap, not a prompting problem.'
WHERE slug = 'four-layers-of-working-with-ai';

UPDATE posts SET
  cta_heading = 'Need someone to actually run your social media, not just post to it?',
  cta_md = 'Strategy, content, paid campaigns, and the reporting that proves it worked.'
WHERE slug = 'growing-a-facebook-page-500-percent';

UPDATE posts SET
  cta_heading = 'Running paid social on a tight budget?',
  cta_md = 'I can help you find sharper audience targeting without increasing spend.'
WHERE slug = 'hidden-meta-ads-targeting-data';

UPDATE posts SET
  cta_heading = 'Want automation that keeps you in control?',
  cta_md = 'I design n8n workflows with the right human checkpoints built in from day one, not bolted on after something goes wrong.'
WHERE slug = 'human-in-the-loop-ai-automation';

UPDATE posts SET
  cta_heading = 'Worried about invoice fraud in your own AP process?',
  cta_md = 'I build n8n automations exactly like this one, tailored to how your vendors and approval chain actually work.'
WHERE slug = 'invoice-fraud-firewall-case-study';

UPDATE posts SET
  cta_heading = 'Outgrowing what your current automation tool can do?',
  cta_md = 'If Zapier or Make has hit a wall on logic or scale, n8n is usually the fix.'
WHERE slug = 'n8n-vs-zapier-vs-make';

UPDATE posts SET
  cta_heading = 'Need someone to actually own your books, not just enter numbers?',
  cta_md = 'AP/AR setup, reconciliation, and inventory workflows that hold up under audit.'
WHERE slug = 'quickbooks-ap-ar-from-scratch';

UPDATE posts SET
  cta_heading = 'Curious how this applies to your business?',
  cta_md = 'I bring the same practical, learn-it-under-deadline approach to every automation and AI project I take on.'
WHERE slug = 'traffic-sign-recognition-to-ai-agents';
