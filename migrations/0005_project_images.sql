-- Migration 0005: project screenshots, LinkedIn links, and a reversible hide.
--
-- Additive only. Adds three columns to `projects` and rewrites the body/link of
-- the three n8n workflow cards.
--
-- The descriptions below are SUMMARISED FROM IBRAHIM'S OWN LINKEDIN POSTS
-- (fetched 2026-07-17), not invented. Each card now links to its post for the
-- full write-up:
--   Invoice Fraud Firewall  -> urn:li:activity:7479080109807874049
--   AI Lead Intelligence    -> urn:li:activity:7477038000389046272
--   Invoice Approval        -> urn:li:activity:7477771074957426688

ALTER TABLE projects ADD COLUMN image TEXT;
ALTER TABLE projects ADD COLUMN image_alt TEXT NOT NULL DEFAULT '';
-- `hidden` rather than DELETE: "remove it for now" implies it may come back,
-- and a delete would destroy the copy with no way back from the admin.
ALTER TABLE projects ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

-- 1. Invoice Fraud Firewall
UPDATE projects SET
  body_html = '<p>Vendors do not usually email asking you to change their bank details. Fraudsters do, and they pick the end of a long day to do it. This workflow watches the finance inbox, uses Gemini to pull the vendor, amount and banking details out of every invoice email, and checks the account against a verified vendor registry. Mismatched banks, lookalike domains and urgency language all get flagged.</p><p>Every email is scored Clean, Review or Critical. Anything risky is held with a Telegram and email alert before the money moves, and the whole trail is logged to Sheets. The point is that a human gets a warning before the mistake, not an audit after it.</p>',
  tags_json = '["n8n","Gemini","Gmail","Google Sheets","Telegram"]',
  image = '/assets/projects/invoice-fraud-firewall.webp',
  image_alt = 'The Invoice Fraud Firewall workflow open in the n8n editor: a Gmail trigger feeding vendor-registry lookup and Gemini payment-detail extraction, then a fraud-risk assessment routing invoices into Critical, Review and Clean branches with Sheets logging and Telegram alerts.',
  external_url = 'https://www.linkedin.com/feed/update/urn:li:activity:7479080109807874049/',
  external_label = 'Read the full write-up on LinkedIn'
WHERE sort_order = 1;

-- 2. AI Lead Intelligence & Auto-Response
UPDATE projects SET
  body_html = '<p>Slow replies lose deals. Gemini reads every inbound lead, scores it HOT, WARM or COLD, and writes a personalised reply that references what the person actually asked about rather than a template.</p><p>Hot leads trigger an instant Telegram alert on my phone and a calendar follow-up for the next day. Warm leads get an email and a standard notification. Cold leads get a polite acknowledgement and nothing else. Everything lands in Sheets, and it runs entirely on free tiers.</p>',
  tags_json = '["n8n","Gemini","Gmail","Google Sheets","Google Calendar","Telegram"]',
  image = '/assets/projects/ai-lead-intelligence.webp',
  image_alt = 'The AI Lead Intelligence workflow in the n8n editor: a webhook and Sheets trigger feeding a Gemini scoring step, then routing leads into colour-coded HOT, WARM and COLD pipelines with email, Telegram and calendar follow-up nodes.',
  external_url = 'https://www.linkedin.com/feed/update/urn:li:activity:7477038000389046272/',
  external_label = 'Read the full write-up on LinkedIn'
WHERE sort_order = 2;

-- 3. Multi-Stage Invoice Approval Pipeline
UPDATE projects SET
  body_html = '<p>Invoice approvals are not hard. They are boring, repetitive and easy to forget, which is exactly why they stall. Gemini reads the attachment in whatever format it arrives and pulls out the vendor, amount, invoice number, due date and line items.</p><p>From there it routes on the amount: under $500 auto-approves and sends a receipt, $501 to $5,000 goes to a manager with one-click approve or reject, and anything over $5,000 needs the manager first and then finance sign-off. Every decision is logged to Sheets with a timestamp, and the person who sent the invoice is told at each stage, so nobody has to chase it.</p>',
  tags_json = '["n8n","Gemini","Gmail","Google Sheets"]',
  image = '/assets/projects/invoice-approval-pipeline.webp',
  image_alt = 'The Invoice Auto-Approval Pipeline in the n8n editor: a Gmail trigger and document analysis step feeding an amount-based router that branches into auto-approved, manager-approved and dual finance approval paths, each logging to Sheets and notifying by email.',
  external_url = 'https://www.linkedin.com/feed/update/urn:li:activity:7477771074957426688/',
  external_label = 'Read the full write-up on LinkedIn'
WHERE sort_order = 3;

-- 4. Facebook Audience-Interest Tool — hidden for now, not deleted.
UPDATE projects SET hidden = 1 WHERE sort_order = 4;
