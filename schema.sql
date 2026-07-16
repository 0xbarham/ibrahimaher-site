-- Content schema for ibrahimaher.com admin panel.
-- Body/paragraph fields store raw inner-HTML snippets (e.g. "<p>...</p><p>...</p>")
-- rendered directly into the page templates. Tag lists are stored as JSON arrays.

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort_order INTEGER NOT NULL,
  eyebrow TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  date_range TEXT NOT NULL,
  body_html TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  logo_light TEXT NOT NULL,
  logo_dark TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  icon_light TEXT,
  icon_dark TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  featured_logo TEXT,
  external_url TEXT,
  external_label TEXT
);

CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort_order INTEGER NOT NULL,
  category TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  tags_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS certifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  school TEXT NOT NULL,
  date_range TEXT NOT NULL,
  body_html TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort_order INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  post_date TEXT NOT NULL,
  read_time TEXT NOT NULL
);

-- Jobs (matches current Experience section, newest-relevant order preserved)
INSERT INTO jobs (sort_order, eyebrow, title, company, date_range, body_html, tags_json, logo_light, logo_dark) VALUES
(1, 'Social Media', 'Social Media Marketing Specialist', 'Help Tech Co. Ltd. &middot; Erbil, Iraq', 'Sep 2022 to present',
'<p>This is the role I am proudest of. I took the company Facebook page from barely active to a page that actually gets people talking, growing it more than 500 percent in the process. I plan and run paid campaigns myself, and the last batch landed close to 100 percent ROI, which for a small company budget is not a small thing to pull off.</p><p>I also got tired of digging through Meta''s ads manager every week to find decent audience targeting, so I built my own tool that surfaces hidden audience interest data. And since nobody enjoys writing the same KPI report by hand every Monday, I automated our weekly reporting with n8n so the numbers are ready before anyone asks for them.</p>',
'["Content strategy","Paid social","Meta Ads","Audience research","KPI reporting"]',
'assets/logos/helptech-logo.png', NULL),
(2, 'Accounting', 'Accounts &amp; Inventory Officer', 'Help Tech Co. Ltd. &middot; Erbil, Iraq', 'Oct 2024 to present',
'<p>I walked into this role with no chart of accounts and no real bookkeeping system in place, so I built one from scratch in QuickBooks. That meant setting up accounts payable and receivable, reconciling everything month over month, and clearing out a backlog that had been sitting untouched for a while. I also designed the inventory workflow the company still uses today, since there was not really one before.</p>',
'["QuickBooks","AP / AR","Reconciliation","Inventory systems"]',
'assets/logos/helptech-logo.png', NULL),
(3, 'Operations', 'Assistant Sales Manager', 'Help Tech Co. Ltd. &middot; Erbil, Iraq', 'Jan 2022 to Oct 2024',
'<p>Before I moved into accounts, I ran the procurement and vendor side of things: requesting quotes, negotiating with suppliers, and handling purchase orders from start to finish. It gave me a full picture of how a small business actually runs behind the scenes, which turned out to be useful for everything I do now.</p>',
'["Procurement","Vendor negotiation","Purchase orders"]',
'assets/logos/helptech-logo.png', NULL),
(4, 'AI Automation', 'Freelance AI Automation Developer', 'Self-employed, n8n workflows', 'Jun 2025 to present',
'<p>On the side, I build production automation workflows for clients using n8n, connecting things like OpenAI, Claude and Gemini to Google Workspace, Telegram and GoHighLevel. I write custom JavaScript function nodes when the built in ones are not enough, and I always validate against a schema and log everything, because an automation that fails silently is worse than no automation at all. Every workflow I hand off comes documented, so the client is never stuck if I am not around.</p>',
'["n8n","OpenAI / Claude / Gemini","Google Workspace","Telegram bots","GoHighLevel"]',
'assets/logos/n8n-logo.svg?v=2', 'assets/logos/n8n-logo-white.svg?v=2'),
(5, 'Social Media', 'Social Media Marketing Specialist, Internship', 'YourVisio Media', 'Dec 2023 to May 2024',
'<p>My first real taste of agency style social media work. I got hands on experience managing content and campaigns in a faster paced environment than I was used to, which sharpened how I think about strategy before I brought those habits back into my main role.</p>',
'["Content creation","Campaign support"]',
'assets/logos/yourvisio-logo.jpeg', NULL);

-- Projects (small cards)
INSERT INTO projects (sort_order, title, body_html, tags_json, icon_light, icon_dark, featured) VALUES
(1, 'Invoice Fraud Firewall',
'<p>Screens incoming payment emails for vendor and IBAN mismatches and other fraud signals, then holds anything risky for a human to check before money moves. Built with n8n, Gemini, Gmail, Sheets and Telegram.</p>',
'[]', 'assets/logos/n8n-logo.svg?v=2', 'assets/logos/n8n-logo-white.svg?v=2', 0),
(2, 'AI Lead Intelligence &amp; Auto-Response',
'<p>Scores inbound leads as hot, warm or cold, routes them accordingly, and sends an automatic first response. Runs on n8n, Gemini, webhooks, Sheets, Telegram and Calendar.</p>',
'[]', 'assets/logos/n8n-logo.svg?v=2', 'assets/logos/n8n-logo-white.svg?v=2', 0),
(3, 'Multi-Stage Invoice Approval Pipeline',
'<p>Routes invoices for approval based on amount, keeps a human in the loop at the right stage, and logs the full audit trail. Built with n8n, Gemini, Gmail and Sheets.</p>',
'[]', 'assets/logos/n8n-logo.svg?v=2', 'assets/logos/n8n-logo-white.svg?v=2', 0),
(4, 'Facebook Audience-Interest Tool',
'<p>A tool I built out of necessity, to surface hidden Meta targeting data that is normally buried or missing entirely from Ads Manager. It is what sharpened the targeting behind my paid campaigns at Help Tech.</p>',
'[]', 'assets/logos/n8n-logo.svg?v=2', 'assets/logos/n8n-logo-white.svg?v=2', 0);

-- Featured project (DAD LINK)
INSERT INTO projects (sort_order, title, body_html, tags_json, featured, featured_logo, external_url, external_label) VALUES
(5, 'DAD LINK: a live e-commerce site for network infrastructure equipment in Iraq',
'<p>DAD LINK is a fully working B2B online store I designed and launched for a network infrastructure supplier serving Iraq, built around the tagline "Build a Network That Never Fails." It sells certified Cat.6 and Cat.6A structured copper cabling, fiber optic patch cords from OM1 to OS2, server racks and cabinets from 4U to 42U, and HDMI 2.1 cables rated for 8K at 60Hz up to 50 meters, all engineered to ISO/IEC 11801 and TIA-568 standards.</p><p>I built the entire site on Odoo, the open source e-commerce and ERP platform, with Claude Code doing most of the heavy lifting: product catalog structure, category pages, on-page SEO, and the storefront layout itself, plus blog content on real installer questions like Wi-Fi 6E versus Wi-Fi 7 cabling requirements, Power over Ethernet variants, and structured cabling installation planning. The result is a real production store, not a demo, built around three pillars the brand leads with: certified quality, infrastructure built to scale, and a local partner network of authorized distributors across Baghdad, Erbil, and Sulaimaniyah, including Help Tech Co. Ltd, the same company I work at.</p><p>This project is the clearest proof point I have for what AI-assisted development actually looks like day to day: not a chatbot answering questions, but a working partner that plans the information architecture, writes product and category copy that targets real search terms like network cables Iraq, Cat6 cable, fiber optic patch cord, and server rack cabinet, and ships a site that is fast, indexable, and genuinely used by customers.</p>',
'["Odoo e-commerce","Claude Code","Technical SEO","B2B catalog design","Content strategy"]',
1, 'assets/logos/dadlink-logo.png?v=2', 'https://www.dad-link.com', 'Visit dad-link.com');

-- Skills
INSERT INTO skills (sort_order, category, subtitle, tags_json) VALUES
(1, 'Social Media', 'Strategy, content, and paid', '["Meta Ads Manager","Content calendars","Community management","Audience research"]'),
(2, 'Accounting &amp; Ops', 'Numbers that actually reconcile', '["QuickBooks","AP / AR","Inventory control","Procurement"]'),
(3, 'AI &amp; Automation', 'Workflows that do not break quietly', '["n8n","OpenAI / Claude / Gemini","Prompt engineering","Context engineering","Agent harness design","Webhooks &amp; APIs","Schema validation"]'),
(4, 'IT &amp; Technical', 'The tools behind everything above', '["Python","JavaScript","HTML / CSS","Software testing","Canva / Photoshop","Microsoft Excel &amp; 365"]');

-- Certifications
INSERT INTO certifications (sort_order, title, issuer) VALUES
(1, 'Meta Certified Digital Marketing Associate', 'Meta'),
(2, 'Social Media Marketing Professional Certificate', 'Meta, via Coursera'),
(3, 'n8n Automation Level 1', 'n8n'),
(4, 'Intro to Programming Using Python', 'Mosul Space'),
(5, 'Web Development', 'Udacity'),
(6, 'Microsoft Office 365', 'ICT Taskforce Initiative');

-- Education
INSERT INTO education (sort_order, title, school, date_range, body_html) VALUES
(1, 'B.Sc. Computer Engineering Technology', 'Northern Technical University, Mosul', '2017 to 2021 &middot; Ranked 9th in class &middot; GPA 2.81 / 4.0',
'<p>My capstone project was a CNN based traffic sign recognition system, built in Python. It was my first real deep learning project, and it is a big part of why I ended up comfortable working with AI models later on rather than being intimidated by them.</p>');

-- Blog post metadata (bodies remain static HTML files in /blog/)
INSERT INTO posts (sort_order, slug, title, category, excerpt, post_date, read_time) VALUES
(1, 'ai-automation-beyond-chatbots', 'What AI Automation Actually Means in a Small Business (Not Just Chatbots)', 'Automation', 'Automation is not a chatbot bolted onto your website. It is invoice routing, lead scoring, and reporting that runs unattended and does not break quietly.', '2026-07-14', '~7 min read'),
(2, 'growing-a-facebook-page-500-percent', 'How I Grew a Small Business Facebook Page by 500% Without an Agency', 'Social Media', 'No agency retainer, no ad budget to start. Just consistent content, an audience data tool I built myself, and paying attention to what actually worked.', '2026-07-14', '~6 min read'),
(3, 'n8n-vs-zapier-vs-make', 'n8n vs Zapier vs Make: What I Learned Building Production Workflows', 'Technology', 'I have shipped real client automations on n8n. Here is where it genuinely wins over Zapier and Make, and where it does not.', '2026-07-14', '~6 min read'),
(4, 'four-layers-of-working-with-ai', 'Prompt, Context, Harness, and Loop Engineering: The Four Layers of Working With AI', 'AI', 'Most people who say they "know AI" have only touched prompting. Here is what the other three layers actually mean, and why they matter more.', '2026-07-14', '~6 min read'),
(5, 'quickbooks-ap-ar-from-scratch', 'Why I Set Up QuickBooks AP/AR From Scratch With No Accounting Background', 'Career', 'Nobody trained me to do this. Here is how I built a company''s entire bookkeeping system under deadline anyway, and what it taught me about learning fast.', '2026-07-14', '~6 min read'),
(6, 'invoice-fraud-firewall-case-study', 'Building an Invoice Fraud Firewall With n8n and Gemini: A Case Study', 'Automation', 'A walkthrough of the automation that screens payment emails for vendor mismatches and IBAN fraud before money ever moves.', '2026-07-14', '~7 min read'),
(7, 'hidden-meta-ads-targeting-data', 'The Hidden Meta Ads Targeting Data Most Small-Business Marketers Never See', 'Social Media', 'Ads Manager does not show you everything. Here is the audience data I had to go build a tool to surface myself.', '2026-07-14', '~6 min read'),
(8, 'ai-assisted-development-no-cs-degree', 'AI-Assisted Development: How I Built and Shipped Real Software Without a CS Degree', 'Technology', 'DAD LINK is a live e-commerce store, not a demo. Here is what it actually takes to ship something real with Claude Code instead of a computer science degree.', '2026-07-14', '~7 min read'),
(9, 'human-in-the-loop-ai-automation', 'Human-in-the-Loop: Why the Best AI Automations Still Need a Person in the Approval Chain', 'AI', 'Full autonomy is not always the goal. Why I build approval gates into automations that handle money or client-facing decisions.', '2026-07-14', '~6 min read'),
(10, 'traffic-sign-recognition-to-ai-agents', 'From a Traffic-Sign Recognition Capstone to Production AI Agents: My Path Into Automation', 'Technology', 'My university capstone was a CNN that read road signs. Here is the line from that project to the automations I build for clients today.', '2026-07-14', '~6 min read');
