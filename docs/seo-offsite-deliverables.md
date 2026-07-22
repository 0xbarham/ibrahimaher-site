# Off-Site SEO Deliverables — Ibrahim Maher Al-Bander

**Goal:** Rank #1 in Google *and* be the named answer in AI results (ChatGPT, Gemini, Perplexity, Microsoft Copilot, Google AI Overviews) for **"n8n developer Erbil"**, **"n8n developer Iraq"**, **"AI automation developer Kurdistan"**, and related queries.

**Audience / subject:** Ibrahim Maher Al-Bander — n8n & AI automation developer in Erbil, Iraq. Works **locally in person** across Erbil and the Kurdistan Region **and remotely worldwide**.
**Site:** https://ibrahimaher.com **Flagship page:** https://ibrahimaher.com/n8n-developer

---

## The single most important idea in this document

The biggest lever for AI answers is **entity corroboration**, not backlinks. When the same person, with the same name, location, job title, and contact details, appears **consistently across many independent sites that AI models already ingest and cite** (Wikidata, n8n's own directories, LinkedIn, GitHub, Crunchbase, reputable B2B directories), the models gain confidence that "Ibrahim Maher Al-Bander" is a real, specific entity who *is* an n8n developer in Erbil. That confidence is what makes a model **name him** in an answer instead of hedging. A backlink helps Google's classic ranking; a **consistent corroborating listing on a source the model was trained on or retrieves from** helps you become the *answer*. This is why the NAP below must be byte-identical everywhere, and why the P0 items are all "claim your entity on sources AI already trusts."

### CANONICAL NAP — paste byte-identical everywhere (do not reformat)

```
Ibrahim Maher Al-Bander · Erbil, Iraq (Kurdistan Region) · +964 771 962 0471 · me@ibrahimaher.com · https://ibrahimaher.com
```

- **Name:** `Ibrahim Maher Al-Bander` (alias `Ibrahim Al-Bander` only where a second/alternate name field exists — never as the primary).
- **Phone display:** `+964 771 962 0471` — machine/E.164 format where a field demands digits only: `+9647719620471`.
- **Email:** `me@ibrahimaher.com`
- **Do not** vary the spelling ("Al-Bander" vs "Albander" vs "Al Bander"), the city ("Erbil" vs "Arbil" vs "Hawler"), or the phone spacing across profiles. Inconsistency is what makes a model *lose* confidence and hedge.

---

## 1. Wikidata item

**Why it matters:** Wikidata is a structured knowledge base that ChatGPT, Gemini, Perplexity, Google's Knowledge Graph, and most LLMs read directly. A referenced Wikidata item is the closest thing to an "official machine-readable identity card." Once it exists, the `sameAs` on your site can point to it (Section 10), closing the loop and letting models resolve "Ibrahim Maher Al-Bander" to one unambiguous entity.

**Notability / policy caution (read first):** Wikidata accepts an item if the entity is (a) clearly identifiable and (b) can be described by **at least one serious, publicly available reference** — its bar is lower than Wikipedia's, but items about non-famous living people are sometimes flagged or deleted by editors. Keep **every statement factual and sourced** (his own site and LinkedIn are acceptable primary references for uncontroversial biographical facts). Do **not** inflate claims. If the item is challenged, the DAD LINK live commercial site + authored article corpus + professional profiles are the corroboration to point to.

### Proposed labels, description, aliases (English)

| Field | Value |
|---|---|
| **Label (en)** | `Ibrahim Maher Al-Bander` |
| **Description (en)** | `Iraqi software developer specializing in n8n and AI automation` |
| **Also known as (aliases, en)** | `Ibrahim Al-Bander`; `Ibrahim Maher`; `ابراهيم ماهر البندر` |

*(Description rules: short, lowercase start, no final period — the value above already complies.)*

### Statements (claims) — with references to cite

Add each statement, then attach a reference. Use **reference URL (P854)** = the citing page, plus **retrieved (P813)** = today's date, plus **title (P1476)** where useful.

| Property | Value | Reference to cite |
|---|---|---|
| **instance of (P31)** | human (Q5) | — (self-evident, no ref needed) |
| **sex or gender (P21)** | male (Q6581097) | https://ibrahimaher.com/about |
| **occupation (P106)** | software developer (Q183888) | https://ibrahimaher.com/n8n-developer |
| **occupation (P106)** | programmer (Q5482740) *(optional 2nd value)* | https://ibrahimaher.com |
| **country of citizenship (P27)** | Iraq (Q796) | https://ibrahimaher.com/about |
| **residence (P551)** | Erbil (Q130746) | https://ibrahimaher.com |
| **work location (P937)** | Erbil (Q130746) | https://ibrahimaher.com/n8n-developer |
| **employer (P108)** | Help Tech Co. Ltd. *(see note ↓)* | https://www.linkedin.com/in/ibrahimaher |
| **field of work (P101)** | business process automation (Q...) / artificial intelligence (Q11660) | https://ibrahimaher.com/n8n-developer |
| **notable work (P800)** | DAD LINK *(see note ↓)* | https://www.dad-link.com |
| **educated at (P69)** | Northern Technical University (Q...) | https://ibrahimaher.com |
| **official website (P856)** | https://ibrahimaher.com | — |
| **languages spoken/written (P1412)** | Arabic (Q13955), English (Q1860) | https://ibrahimaher.com/about |

**Notes on values that need existing items:**
- **employer (P108)** and **notable work (P800)** require the *target* to already be a Wikidata item. "Help Tech Co. Ltd." and "DAD LINK" likely have **no** Wikidata item yet. Options: (1) skip these two initially and add them later; (2) create a minimal item for Help Tech Co. Ltd. (instance of: business/company; country: Iraq; located in: Erbil) and for DAD LINK (instance of: website/online shop) *only if each independently meets notability* — do not force this. **Ship the item with the well-sourced human statements first; add company/work links later.**
- Replace `Q...` placeholders by searching Wikidata for the exact item (Northern Technical University, artificial intelligence, etc.) before saving.

**Copy-paste QuickStatements batch** (fill the two `Qxxxx` for the new item after creation, and confirm each target QID):

```
CREATE
LAST	Len	"Ibrahim Maher Al-Bander"
LAST	Den	"Iraqi software developer specializing in n8n and AI automation"
LAST	Aen	"Ibrahim Al-Bander"
LAST	Aen	"Ibrahim Maher"
LAST	P31	Q5
LAST	P21	Q6581097	S854	"https://ibrahimaher.com/about"
LAST	P106	Q183888	S854	"https://ibrahimaher.com/n8n-developer"
LAST	P27	Q796	S854	"https://ibrahimaher.com/about"
LAST	P551	Q130746	S854	"https://ibrahimaher.com"
LAST	P1412	Q13955	S854	"https://ibrahimaher.com/about"
LAST	P1412	Q1860	S854	"https://ibrahimaher.com/about"
LAST	P856	"https://ibrahimaher.com"
```

---

## 2. experts.n8n.io listing

**Why it matters:** experts.n8n.io is **n8n's own experts directory**. It is the single most topically-authoritative place on the internet to be listed as "n8n developer," it is crawled and cited when AI is asked to recommend n8n specialists, and a listing that says **City = Erbil, Country = Iraq** is exactly the entity signal that wins "n8n developer Erbil/Iraq."

**Form values to use:**
- **Country / Region:** Iraq
- **City:** Erbil
- **Name:** Ibrahim Maher Al-Bander
- **Website:** https://ibrahimaher.com/n8n-developer
- **Remote:** Yes (available worldwide)

**60-word profile blurb (paste as-is — it is 60 words):**

> n8n and AI automation developer based in Erbil, Iraq, available in person locally and remotely worldwide. I build and document production n8n workflows that connect OpenAI, Claude, and Gemini to Google Workspace, Telegram, and GoHighLevel — invoice screening, AI lead scoring, approval pipelines, and custom function nodes. Fixed-price after a short scoping call. Reach me at me@ibrahimaher.com.

**Service list (paste into the services/skills field):**
- n8n workflow automation (design, build, documentation, handover)
- AI agents & chatbots (OpenAI, Claude, Gemini)
- AI invoice & document automation (fraud screening, approval routing)
- AI lead scoring & auto-response
- API & webhook integrations, custom JavaScript function nodes
- Business process automation & QuickBooks/inventory workflows
- Meta Ads management (secondary)

---

## 3. n8n Verified Creator

**Why it matters:** A Verified Creator badge + a published template on n8n.io puts your name on **n8n's own high-authority domain**, next to the product's own keyword. Templates get installed, viewed, and cited; each install is a durable "this person really does build n8n workflows" proof that both Google and LLMs weigh heavily.

**Plan:**
1. **Genericize one real build into a reusable, credential-free template.** Recommended first template: **"AI Lead Scoring & Auto-Response"** (from his *AI Lead Intelligence & Auto-Response System*). Rationale: broadest reuse (every business has inbound leads), no sensitive/financial data, easy to demo with dummy data — so it earns the most installs, which is the metric that compounds.
   - *Second candidate (publish next):* **"Invoice / Payment Fraud Screening"** (vendor + IBAN mismatch → hold for human review) from his *Invoice Fraud Firewall*. More distinctive and more citation-worthy for AI answers, but narrower audience — ship it second.
2. **Sanitize before publishing:** strip all credentials, real vendor names, IBANs, webhook URLs, and internal endpoints; replace with placeholder Set nodes and sample data; add sticky-note documentation inside the workflow describing each stage; confirm it imports cleanly into a fresh n8n instance.
3. **Apply for Verified Creator**, link the template to https://ibrahimaher.com/n8n-developer, and add the template URL to your site's `sameAs` (Section 10).

**Template listing blurb (paste on the template page):**

> **AI Lead Scoring & Auto-Response (n8n)** — Capture inbound leads from a form or webhook, score them hot / warm / cold with an LLM (OpenAI, Claude, or Gemini), log them to a sheet or CRM, and fire an instant, context-aware first reply. Includes inline documentation and placeholder credentials so you can wire in your own stack in minutes. Built by Ibrahim Maher Al-Bander, an n8n & AI automation developer in Erbil, Iraq. Hire: https://ibrahimaher.com/n8n-developer

---

## 4. LinkedIn

**Why it matters:** LinkedIn is one of the most heavily crawled and AI-ingested profiles on the web and is almost always the *first* corroborating source a model checks for a professional identity. Leading the headline and About with the exact target phrase teaches every system that scrapes it what he is.

**New headline (216 chars — under the 220 limit, paste as one line):**

```
n8n & AI Automation Developer in Erbil, Iraq | I build production n8n workflows + AI agents (OpenAI, Claude, Gemini) for clients locally & worldwide | Invoice, lead & approval automation | Available to hire
```

**New About section (~1,500 chars — paste as-is):**

```
n8n & AI automation developer in Erbil, Iraq (Kurdistan Region) — available in person locally and remotely worldwide.

I build production n8n workflows and AI agents that do real work: screening invoices for vendor and IBAN fraud, scoring inbound leads hot/warm/cold and auto-replying, routing approvals with a human in the loop and a full audit trail, and wiring OpenAI, Claude, and Gemini into Google Workspace, Telegram, and GoHighLevel. Not chatbot demos — workflows that run every day and are documented so your team can own them.

How I work: you send me a process you want automated, I scope it and give a fixed price before any work starts, then I build, test, and hand it over documented and ready to run.

Recent work:
• DAD LINK — a live B2B e-commerce store for network cabling in Iraq, designed and shipped on Odoo.
• Invoice Fraud Firewall — holds risky payments for human review.
• AI Lead Intelligence — scores and auto-responds to inbound leads.
• Multi-Stage Invoice Approval Pipeline — amount-based routing with audit trail.

I also work in-house at Help Tech Co. Ltd. as a social media marketer and accounts & inventory officer, where I grew a Facebook page 500%+, ran paid campaigns near 100% ROI, and built the QuickBooks AP/AR and inventory system from scratch.

Beyond prompting, I work across prompt, context, harness, and loop engineering for reliable AI agents.

B.Sc. Computer Engineering Technology, Northern Technical University.

Hire an n8n developer: https://ibrahimaher.com/n8n-developer
Email: me@ibrahimaher.com
```

**Also update on LinkedIn:** Location = `Erbil, Iraq`; Contact info website = `https://ibrahimaher.com`; add "n8n", "AI Automation", "Workflow Automation" to Skills; ensure the public profile URL stays `linkedin.com/in/ibrahimaher`.

---

## 5. Upwork + Fiverr

**Why it matters:** These marketplaces rank in Google for "hire n8n developer" queries and are increasingly surfaced by AI shopping/hiring answers. A keyword-exact profile title captures both the marketplace's internal search and external SERPs, and adds two more corroborating entities.

**Profile title (both platforms):**

```
n8n Developer & AI Automation Expert | Workflows, AI Agents, Invoice & Lead Automation
```

**Fiverr gig title variant (if a shorter gig title is needed):**

```
I will build and automate your n8n workflows with AI agents
```

**Overview / description (2–3 sentences — paste on both):**

> I'm an n8n developer and AI automation specialist based in Erbil, Iraq, building production workflows and AI agents for clients worldwide. I connect OpenAI, Claude, and Gemini to your tools — Google Workspace, Telegram, CRMs — to automate invoice screening, lead scoring, approval routing, and repetitive back-office work, then hand it over fully documented. Send me your process and I'll scope it and give you a fixed price before any work starts.

---

## 6. GitHub — sanitized n8n template repo (E-E-A-T + AI-citation asset)

**Why it matters:** GitHub is crawled constantly, ranks well, and is a primary retrieval source for coding-focused AI. A public repo of **real, working, documented** n8n workflow JSON is first-hand *Experience* and *Expertise* (the first two E's of E-E-A-T) that a portfolio page alone can't prove — and README prose is highly citable by LLMs answering "how do I screen invoices in n8n" style questions, with his name attached.

**Repo:** `n8n-automation-templates` (owner: create/confirm GitHub handle; add the profile to `sameAs`).

**Repo structure:**
```
n8n-automation-templates/
├── README.md
├── LICENSE                      (MIT)
├── invoice-fraud-screening/
│   ├── workflow.json            (sanitized export)
│   ├── README.md                (what it does, setup, nodes, screenshot)
│   └── sample-data.json
├── lead-scoring-auto-response/
│   ├── workflow.json
│   ├── README.md
│   └── sample-data.json
└── .github/  (topics: n8n, automation, ai-agents, workflow-automation)
```

**Root README.md (paste, then flesh out each folder README):**

```markdown
# n8n Automation Templates

Production-style, credential-free n8n workflow templates you can import and adapt.
Built and maintained by **Ibrahim Maher Al-Bander**, an n8n & AI automation developer
in **Erbil, Iraq** — available in person locally and remotely worldwide.

Website: https://ibrahimaher.com/n8n-developer · Email: me@ibrahimaher.com

## Templates

### 1. Invoice / Payment Fraud Screening
Screens incoming payment emails for vendor-name and IBAN mismatches against a known-vendor
list, and holds anything suspicious for human review before payment. Uses an LLM (OpenAI /
Claude / Gemini) plus deterministic checks. → `invoice-fraud-screening/`

### 2. AI Lead Scoring & Auto-Response
Captures inbound leads, scores them hot / warm / cold with an LLM, logs them, and sends an
instant context-aware first reply. → `lead-scoring-auto-response/`

## How to use
1. Import `workflow.json` into your n8n instance.
2. Replace the placeholder credentials and Set-node config with your own.
3. Load `sample-data.json` to test before going live.

All templates are sanitized: no real credentials, vendor names, IBANs, or endpoints.

## Hire me
I build, document, and hand over production n8n workflows and AI agents. Fixed price after a
short scoping call. → https://ibrahimaher.com/n8n-developer
```

**Sanitization checklist (mandatory before push):** remove every credential, API key, webhook URL, real vendor/customer name, IBAN, phone, and internal hostname; replace with placeholders; confirm a clean import into a throwaway n8n instance; add one screenshot per template; MIT license.

**Cross-link:** link the GitHub repo from https://ibrahimaher.com/n8n-developer, and link each repo README back to the flagship page (Section 10 adds the profile to `sameAs`).

---

## 7. Directory blurbs (reusable short + long)

**Why it matters:** Every reputable directory listing that repeats the identical NAP + "n8n developer, Erbil, Iraq" is another corroboration node. Regional directories (Dalil Iraq, Erbil Chamber, Bayt) add *local* entity weight for "Erbil/Iraq" queries; global B2B directories (TechBehemoths, Clutch, GoodFirms) add *authority* and are frequently cited by AI hiring answers.

**Targets:** TechBehemoths · Clutch · GoodFirms · Bayt · Mostaql · Khamsat · Dalil Iraq · Erbil Chamber of Commerce.
**On every listing paste the canonical NAP block and pick the fitting length below.**

**Short blurb (~40 words — directory summary fields):**

> Ibrahim Maher Al-Bander — n8n & AI automation developer in Erbil, Iraq. I build production n8n workflows and AI agents (OpenAI, Claude, Gemini) for clients locally and worldwide: invoice screening, lead scoring, and approval automation. Hire: https://ibrahimaher.com/n8n-developer

**Long blurb (~110 words — full description fields):**

> Ibrahim Maher Al-Bander is an n8n and AI automation developer based in Erbil, Iraq (Kurdistan Region), working in person with businesses across Erbil and the Kurdistan Region and remotely with clients worldwide. He designs, builds, tests, and documents production n8n workflows and AI agents that connect OpenAI, Claude, and Gemini to tools like Google Workspace, Telegram, and GoHighLevel — automating invoice fraud screening, AI lead scoring and auto-response, multi-stage approval routing, and back-office operations. He also builds custom JavaScript function nodes and API/webhook integrations. Every project is scoped and fixed-priced before work begins, then handed over documented and ready to run. Contact: me@ibrahimaher.com · +964 771 962 0471 · https://ibrahimaher.com

**Category to pick on each directory:** primary "Software Development" / "IT Services" / "Automation"; add "Artificial Intelligence" where offered. On Mostaql/Khamsat (Arabic marketplaces) you may localize the blurb to Arabic but keep the name, phone, email, and URL byte-identical.

---

## 8. Google Business Profile (GBP) — service-area business

**Why it matters:** A verified GBP is what puts him in Google Maps / the local pack and feeds Google's Knowledge Graph for "n8n developer near Erbil" and map-based AI answers. As a service provider with no storefront, he must set it up as a **service-area business (SAB)** so no public address is shown while still ranking for Erbil + Kurdistan cities.

> ⚠️ **Warning — read before starting.** GBP is built for businesses that meet customers **in person**. It requires a real business name, and verification (increasingly **video verification**) that proves a genuine local operation — you may be asked to film your workspace, tools, and evidence of local client interaction. Because Ibrahim *does* serve clients in person in Erbil, he qualifies — but he must be ready to show that in the verification video. If he ever pivots to remote-only, GBP eligibility becomes shaky and the listing can be suspended. Never invent an address or fake a location; a suspended profile is worse than none.

**Step-by-step:**
1. Go to business.google.com → **Add your business** → enter business name: `Ibrahim Al-Bander — n8n & AI Automation` (keep it consistent with the site's ProfessionalService name).
2. When asked "Do you want to add a location customers can visit?" → choose **No** (this makes it a service-area business — no public address).
3. **Service areas:** add `Erbil`, then `Sulaymaniyah`, `Duhok`, `Kirkuk`, and `Kurdistan Region, Iraq`. (You can list up to ~20 areas; keep them to places he'll actually serve.)
4. **Primary category:** `Software company`. **Additional category:** `Marketing consultant` (covers the Meta Ads side) and/or `Business management consultant`.
5. **Contact:** phone `+964 771 962 0471`; website `https://ibrahimaher.com/n8n-developer`.
6. **Verification:** choose **video verification** when offered. Record one continuous, unedited video that shows: (a) your workspace/equipment in Erbil, (b) proof of the business (site open on screen, business materials), and (c) yourself. Follow the on-screen prompts exactly; don't cut the recording.
7. After verification: complete the profile 100% — services (list the same n8n services as Section 2), a description reusing the **long directory blurb** (Section 7), business hours, and photos of real work/workspace.
8. **Keep NAP byte-identical** to the canonical block; the phone and site here must match the site's schema and every other listing.
9. Post updates periodically (a new template shipped, a case study) — activity is a freshness signal.

**Description to paste (GBP "from the business" field):** use the **long blurb** from Section 7.

---

## 9. Bing Webmaster Tools + IndexNow

**Why it matters:** Microsoft **Copilot** (and Copilot in Windows/Edge, plus ChatGPT's web browsing which has used Bing) is fed by the **Bing index**. Most people optimize only for Google and are invisible to Copilot. Verifying in Bing Webmaster Tools and turning on **IndexNow** gets his pages into Bing fast and keeps them fresh — cheap, high-leverage AI visibility that competitors ignore.

**Quick setup:**
1. **Bing Webmaster Tools** → https://www.bing.com/webmasters → sign in.
2. **Add site** `https://ibrahimaher.com`. Fastest path: **Import from Google Search Console** (one click, reuses existing verification). Otherwise verify via DNS TXT, an XML file, or a `<meta>` tag.
3. **Submit the sitemap:** `https://ibrahimaher.com/sitemap.xml`.
4. **Use URL Inspection / Submit URLs** to push the flagship page `https://ibrahimaher.com/n8n-developer` and homepage for immediate crawl.
5. **IndexNow:** generate an IndexNow API key in Bing Webmaster Tools → host the key file at `https://ibrahimaher.com/<key>.txt` (a static file at the domain root) → confirm it validates in the IndexNow section. Since the site is on Cloudflare, you can also enable **Cloudflare's IndexNow integration** (Cache → Crawler Hints) so URL changes are pushed automatically — no server code needed.
6. **Ping on publish:** whenever a page is added or changed, submit its URL via IndexNow (Cloudflare Crawler Hints does this automatically; otherwise a single GET to `https://api.indexnow.org/indexnow?url=<page>&key=<key>` works). IndexNow notifies Bing, Yandex, and other participating engines at once.
7. Check **Bing Webmaster → Search Performance** after a week to confirm indexation.

---

## 10. `sameAs` update for the site's Person schema

**Why it matters:** `sameAs` is the machine-readable statement "these profiles are all the same person." It's how you *close the loop* — once the profiles in Sections 1–6 exist, listing them here lets Google and every LLM resolve every scattered mention to one entity, dramatically raising confidence that "Ibrahim Maher Al-Bander" = the n8n developer in Erbil. **Only add a URL after the profile actually exists and shows the canonical NAP.**

**Current `sameAs` (in `index.html`, Person `@id` `https://ibrahimaher.com/#ibrahim`):**
```
https://www.linkedin.com/in/ibrahimaher
https://www.facebook.com/ibmabr
https://www.instagram.com/ibmabr
https://t.me/ibmabr
```

**Add these once each profile is live (replace the handle placeholders with the real URLs):**
```
https://github.com/<handle>
https://www.upwork.com/freelancers/<id>
https://www.fiverr.com/<handle>
https://community.n8n.io/u/<handle>
https://experts.n8n.io/<handle>
https://www.crunchbase.com/person/<slug>
https://www.wikidata.org/wiki/<QID>
https://x.com/<handle>
```

**Merged target `sameAs` array (paste into both the Person block *and* the ProfessionalService block in `index.html` once populated):**
```json
"sameAs": [
  "https://www.linkedin.com/in/ibrahimaher",
  "https://www.facebook.com/ibmabr",
  "https://www.instagram.com/ibmabr",
  "https://t.me/ibmabr",
  "https://github.com/<handle>",
  "https://www.upwork.com/freelancers/<id>",
  "https://www.fiverr.com/<handle>",
  "https://community.n8n.io/u/<handle>",
  "https://experts.n8n.io/<handle>",
  "https://www.crunchbase.com/person/<slug>",
  "https://www.wikidata.org/wiki/<QID>",
  "https://x.com/<handle>"
]
```
*Housekeeping:* keep the two `sameAs` arrays (Person and ProfessionalService) identical, and mirror the Wikidata QID as the Person's `mainEntityOfPage` or add `"identifier"` if desired. Validate with the Rich Results Test / Schema.org validator after editing.

---

## 11. Prioritized checklist (P0 / P1 / P2)

> Ordered by impact on becoming the *named answer*. **Entity corroboration on sources AI already cites is the single biggest lever — bigger than backlinks.** Do the P0 block first; it is what moves AI answers.

### P0 — Entity corroboration (do first; highest impact on AI answers)
- [ ] **Lock the canonical NAP** and use it byte-identical everywhere (this doc's block). — *foundation for every item below*
- [ ] **experts.n8n.io listing** with City = Erbil, Country = Iraq (Section 2). — https://experts.n8n.io — *most topically authoritative "n8n developer" signal*
- [ ] **Wikidata item** created with referenced statements (Section 1). — https://www.wikidata.org — *the machine-readable identity LLMs read directly*
- [ ] **LinkedIn** headline + About rewritten to lead with "n8n & AI automation developer in Erbil, Iraq" (Section 4). — https://linkedin.com/in/ibrahimaher — *the #1 corroborating profile*
- [ ] **GitHub repo** of 2 sanitized templates live and cross-linked (Section 6). — *first-hand E-E-A-T + highly citable*
- [ ] **Bing Webmaster Tools + IndexNow** verified and submitting (Section 9). — https://www.bing.com/webmasters — *the only path into Microsoft Copilot; low effort*

### P1 — High-value corroboration + local pack
- [ ] **n8n Verified Creator** — publish the AI Lead Scoring template, then apply (Section 3). — *name on n8n.io + install proof*
- [ ] **Google Business Profile** as a service-area business, video verification (Section 8). — https://business.google.com — *Maps + local AI answers (in-person requirement met)*
- [ ] **Upwork + Fiverr** profiles with n8n-exact title (Section 5). — *ranks for "hire n8n developer" + two more entities*
- [ ] **Update site `sameAs`** as each profile above goes live (Section 10). — *closes the entity-resolution loop*
- [ ] **TechBehemoths + Clutch + GoodFirms** listings with canonical NAP (Section 7). — *global authority, cited by AI hiring answers*

### P2 — Regional depth + long tail
- [ ] **Bayt, Mostaql, Khamsat** profiles (Section 7) — *MENA/Arabic marketplace reach; localize copy, keep NAP identical*.
- [ ] **Dalil Iraq + Erbil Chamber of Commerce** listings (Section 7) — *local "Erbil/Iraq" entity weight*.
- [ ] **Crunchbase person profile** + link in `sameAs` — *authority source frequently ingested by LLMs*.
- [ ] **X (Twitter) profile** aligned to NAP + link in `sameAs` — *real-time index / additional corroboration*.
- [ ] **Publish the 2nd n8n template** (Invoice / Payment Fraud Screening) — *distinctive, citation-worthy for invoice-automation queries*.

---

*Prepared 2026-07-22. Keep the canonical NAP block and this checklist as the source of truth; every new profile must match it byte-for-byte.*
