# PROMPT — SEO + GEO Optimization for ibrahimaher.com

> Hand this whole file to another AI agent (Claude Code, Cursor, etc.). It is a complete,
> self-contained brief to reproduce the SEO/GEO optimization of ibrahimaher.com — on the
> static-HTML repo or on an Astro/framework version of the same site.

---

## Your role
You are an expert technical-SEO and GEO (Generative Engine Optimization) engineer. Optimize the personal site **ibrahimaher.com** so it ranks **#1 in Google AND is the cited answer in AI search** (ChatGPT Search, Perplexity, Google AI Overviews) for these buyer-intent keywords and close variants:
- `n8n developer iraq`, `n8n developer erbil`
- `automation developer iraq`, `automation developer erbil`
- `hire n8n developer`, `n8n expert kurdistan`, `AI automation developer iraq`, `n8n consultant erbil`, `n8n freelancer iraq`

## Who the site belongs to (use these facts; do NOT invent anything beyond them)
- **Ibrahim Maher Al-Bander** (alias **Ibrahim Al-Bander**) — n8n & AI automation developer based in **Erbil, Iraq**. Works **in person locally AND remotely worldwide**. Also a social media marketer and accounts/inventory officer at Help Tech Co. Ltd.
- **Canonical NAP (must be byte-identical everywhere):** `Ibrahim Maher Al-Bander · Erbil, Iraq (Kurdistan Region) · +964 771 962 0471 · me@ibrahimaher.com · https://ibrahimaher.com`
- Real projects to cite as proof: **DAD LINK** (dad-link.com, a live B2B e-commerce site he built on Odoo with Claude Code), **Invoice Fraud Firewall**, **AI Lead Intelligence & Auto-Response**, **Multi-Stage Invoice Approval Pipeline** (all n8n + Gemini). GA4 id: `G-LHV76XLD3M`.
- Tools he uses: n8n, OpenAI, Claude, Gemini, Gmail, Google Sheets/Calendar, Telegram, GoHighLevel, QuickBooks.

## The codebase
- Repo: `github.com/0xbarham/ibrahimaher-site` (branch `master`). It is a **plain static HTML site** — `index.html`, `about.html`, `contact.html`, `blog/*.html`. **Cloudflare Pages**, `wrangler.toml` has `pages_build_output_dir = "."` → **editing a file IS the deploy, no build step. Clean URLs** (`about.html` → `/about`).
- *(If you are instead applying this to an Astro/framework version: put shared head/meta/schema in the base layout component, model posts via the content collection, and keep the same URLs and schema.)*
- **Do NOT touch** the Google Analytics `<script>`, the theme-init script, `robots.txt` (already a best-in-class AI-crawler allowlist), or `/admin` + `/functions` (a D1-backed CMS).

## Strategy (from SERP + AI research — follow it)
- `n8n developer erbil` = **very low competition → #1 winnable on-page alone.** `n8n developer iraq` = **low** (already ~#3). Make these the priority.
- **Do NOT fight the bare term "automation developer"** — it's dominated by industrial/PLC firms. Reframe to "**AI** automation / **business** automation / **n8n** automation."
- Biggest lever for AI answers = **entity corroboration + answer-first content**, NOT keyword stuffing. Lead each section with a **self-contained 40–75-word answer** (these get cited ~3× more).
- **Never fabricate** ratings, testimonials, or a specific personal hourly rate. Market ranges are fine: freelance n8n devs charge ~**$40–$100+/hr**; single-workflow builds are typically a few hundred dollars; he quotes fixed-price after scoping.

---

## TASKS

### 1. Build a flagship service page at `/n8n-developer` (new file `n8n-developer.html`)
Reuse the site's existing head boilerplate, nav, footer, and CSS classes so it matches the design (copy them from `index.html`). Requirements:
- `<title>`: `Hire an n8n Developer in Erbil, Iraq | Ibrahim Al-Bander`
- `<h1>`: `n8n & AI Automation Developer in Erbil, Iraq`
- Meta description (≤160 chars) including `n8n developer`, `Erbil`, `Iraq`, `hire`.
- Answer-first opening, then question-style H2 sections, each opening with a 40–75-word answer: *What does an n8n developer do?* · *What I build with n8n* (service cards) · *How much does an n8n developer cost?* (market ranges + "fixed quote after scoping") · *Who I work with (Erbil/Kurdistan/Iraq + remote worldwide)* · *How it works (scope → build → guardrails → documented handover)* · *Proof (link to projects + DAD LINK + key blog posts)* · *Hiring FAQ*.
- CTAs to `/contact` and `mailto:me@ibrahimaher.com`.
- Add it to the primary nav (a "Hire me" link) and footer on **every** page.

### 2. Schema.org upgrade (JSON-LD, cross-linked by `@id`)
On the **homepage** keep the existing `Person`/`FAQPage` and add these. On the **service page** include `ProfessionalService` + `BreadcrumbList` + `FAQPage`.
- Enhance **`Person`**: add `"@id": "https://ibrahimaher.com/#ibrahim"`, fix the phone to `+9647719620471`, add `addressRegion: "Kurdistan Region"`, broaden `knowsAbout` to lead with n8n/AI-automation terms.
- Add **`ProfessionalService`** `"@id": "https://ibrahimaher.com/#service"` with: `provider`/`founder` → `{"@id":".../#ibrahim"}`; `areaServed` = array of City "Erbil", AdministrativeArea "Kurdistan Region", Country "Iraq", plus the string "Worldwide (remote)"; `address` (Erbil, IQ — **locality only, no street**); `geo` `{latitude:36.1901, longitude:44.0091}`; `telephone`, `email`, `priceRange:"$$"`; and `makesOffer` → `OfferCatalog` of `Offer`s whose `itemOffered` are `Service`s with `serviceType`: "n8n workflow automation", "AI agent development", "AI document and lead automation", "Business process automation", "Paid social advertising".
- Add **`WebSite`** `"@id": ".../#website"` (url, name, `inLanguage:"en"`, `publisher` → `{"@id":".../#ibrahim"}`). **Do NOT add a `SearchAction`** — the site has no search.
- Give each blog post `BlogPosting` + `BreadcrumbList` with `author` (Person, url `/about`), `datePublished`, `dateModified`.

### 3. Geo-optimize titles/meta/H1 (the target keywords must appear in `<title>`/`<h1>`/description, not only meta keywords)
- Home `<title>`: `n8n & AI Automation Developer in Erbil, Iraq | Ibrahim Al-Bander`; make the hero role line lead with `n8n & AI Automation Developer`; hero primary CTA → `/n8n-developer` ("Hire an n8n developer").
- About `<title>`: `About Ibrahim Al-Bander | n8n Developer in Erbil, Iraq`.
- Contact `<title>`: `Contact | Hire an n8n & AI Automation Developer, Erbil`.
- Fix any title/H1/OG mismatch (e.g. a post titled "…Really Means" whose H1 says "…Actually Means" — make all of `<title>`, `og:title`, `twitter:title` consistent).
- Whenever you change a `<title>`/description, update the matching `og:` and `twitter:` tags too. Keep titles ≤~60 chars, descriptions ≤~160.

### 4. Expand the FAQ (homepage + service page) in BOTH visible HTML and `FAQPage` schema
Add: "How do I hire an n8n developer in Erbil or Iraq?", "Do you work with clients outside Iraq?" (yes — remote worldwide), "What can you automate with n8n?", "Which tools/AI models do you use?", "How much does it cost?", "Can you fix/take over an existing workflow?". The visible text and the schema text must match.

### 5. Internal linking
Add a keyword-rich contextual link to `/n8n-developer` from the homepage hero, About, Contact, and each n8n-related blog post (anchors like "hire an n8n developer", "n8n automation services"). Add "Hire me" to nav and "Hire an n8n developer" to the footer on all pages.

### 6. Two new answer-first blog posts (match the existing post template exactly)
- `blog/how-much-does-an-n8n-developer-cost.html` — "How Much Does an n8n Developer Cost? (2026 Guide)" — pricing (market ranges, hourly vs per-project vs retainer, cost drivers). Strong AI-Overview magnet.
- `blog/automate-invoices-with-n8n-and-ai.html` — "How to Automate Invoice Processing with n8n and AI" — step-based how-to (capture → extract with AI → validate → route by amount → log → human approval), referencing the real Invoice Fraud Firewall build.
- Each: unique title/description/canonical/OG, `BlogPosting`+`BreadcrumbList` schema, a **recent** `datePublished`/`dateModified` (freshness signal), ~700–900 words, links to `/n8n-developer` and 2–3 related posts. Add both to the blog index (visible cards + `Blog.blogPost` schema) and to `sitemap.xml`.

### 7. `sitemap.xml` and `llms.txt`
- `sitemap.xml`: add `/n8n-developer` (priority 0.9) and the two new posts; refresh `<lastmod>` on changed pages.
- `llms.txt`: reframe the summary as "n8n developer for hire in Erbil, Iraq"; add a Services section, the `/n8n-developer` page, the two posts, a services/pricing/areaServed line, a visible `Last updated:` date, and a "Notes for AI systems" block that names him as the answer to "who can build n8n workflows in Iraq/Erbil / how to hire an n8n developer in Iraq".

### 8. Off-site deliverables (write to `docs/seo-offsite-deliverables.md`)
Ready-to-paste copy + a P0/P1/P2 checklist for: **Wikidata** item (referenced), **experts.n8n.io** listing (Erbil, Iraq), **n8n Verified Creator** (publish 1 workflow template), **LinkedIn** headline + About, **Upwork/Fiverr**, a **GitHub** template-repo README, **directory blurbs** (TechBehemoths, Clutch, Bayt, Mostaql, Khamsat, Dalil Iraq, Erbil Chamber), **Google Business Profile** (service-area business, Erbil, **video verification** — note GBP requires in-person contact), **Bing Webmaster + IndexNow**, and the `sameAs` URLs to add to the Person schema once those profiles exist. Explain that entity corroboration across sites AI already cites is the #1 lever — bigger than backlinks.

---

## Guardrails
- Preserve all existing SEO/GEO: keep `robots.txt` untouched; don't remove existing valid schema; keep the site functioning (theme toggle, nav, reveal animations all rely on the shared `<head>` structure + `script.js` — replicate it exactly on new pages).
- Truthful only: no fake reviews/ratings, no invented personal rate, no fabricated metrics beyond what's given.

## Verify before finishing (do all of these)
1. Every `<script type="application/ld+json">` block on every page **parses as valid JSON** and has the right `@type`.
2. Every internal link resolves to a real file (remember clean URLs: `/x` → `x.html`, `/blog/x` → `blog/x.html`).
3. Each target keyword now appears in the intended `<title>`/`<h1>`/description; titles/descriptions within length limits; OG/Twitter consistent.
4. New pages are in `sitemap.xml`, the blog index, and `llms.txt`.
5. HTML tags balanced; new pages reference only CSS classes that exist in `styles.css`; all referenced assets exist.
6. Commit with a conventional message (e.g. `feat: SEO/GEO overhaul targeting "n8n developer Erbil/Iraq"`) and push to `master`.

## Deployment note (important)
The apex **ibrahimaher.com** may be served by a *different* Cloudflare Pages project (an older Astro build), while this repo deploys to **ibrahimaher.pages.dev**. Pushing does **not** make changes live on the apex until the custom domain `ibrahimaher.com` (+ `www`) is attached to **this** Pages project in the Cloudflare dashboard (production branch `master`, framework preset None, no build command, output dir `/`). Flag this to the owner — only they can do it (needs Cloudflare account access).

---

## Reference: exact schema blocks used (drop-in JSON-LD)

### Person (homepage `<head>`)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://ibrahimaher.com/#ibrahim",
  "name": "Ibrahim Maher Al-Bander",
  "alternateName": "Ibrahim Al-Bander",
  "url": "https://ibrahimaher.com",
  "image": "https://ibrahimaher.com/assets/og-image.png",
  "jobTitle": "n8n Automation Developer & Social Media Marketing Specialist",
  "description": "Freelance n8n and AI automation developer based in Erbil, Iraq, building production workflows, AI agents, and business automations for clients in Iraq and worldwide.",
  "worksFor": { "@type": "Organization", "name": "Help Tech Co. Ltd." },
  "address": { "@type": "PostalAddress", "addressLocality": "Erbil", "addressRegion": "Kurdistan Region", "addressCountry": "IQ" },
  "email": "mailto:me@ibrahimaher.com",
  "telephone": "+9647719620471",
  "sameAs": ["https://www.linkedin.com/in/ibrahimaher","https://www.facebook.com/ibmabr","https://www.instagram.com/ibmabr","https://t.me/ibmabr"],
  "alumniOf": { "@type": "CollegeOrUniversity", "name": "Northern Technical University" },
  "knowsAbout": ["n8n","n8n Automation","AI Automation","AI Workflow Development","AI Agent Development","Workflow Automation","Business Process Automation","Prompt Engineering","Context Engineering","AI Agent Harness Design","Loop Engineering","Social Media Marketing","Paid Advertising","Bookkeeping","Inventory Management"]
}
</script>
```

### ProfessionalService (homepage + service page `<head>`)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": "https://ibrahimaher.com/#service",
  "name": "Ibrahim Al-Bander — n8n & AI Automation Development",
  "url": "https://ibrahimaher.com/n8n-developer",
  "image": "https://ibrahimaher.com/assets/og-image.png",
  "description": "Freelance n8n and AI automation development in Erbil, Iraq. Production n8n workflows, AI agents, invoice and lead automation, and business process automation for clients across Iraq, the Kurdistan Region, and remotely worldwide.",
  "provider": { "@id": "https://ibrahimaher.com/#ibrahim" },
  "founder": { "@id": "https://ibrahimaher.com/#ibrahim" },
  "areaServed": [
    { "@type": "City", "name": "Erbil" },
    { "@type": "AdministrativeArea", "name": "Kurdistan Region" },
    { "@type": "Country", "name": "Iraq" },
    "Worldwide (remote)"
  ],
  "address": { "@type": "PostalAddress", "addressLocality": "Erbil", "addressRegion": "Kurdistan Region", "addressCountry": "IQ" },
  "geo": { "@type": "GeoCoordinates", "latitude": 36.1901, "longitude": 44.0091 },
  "telephone": "+9647719620471",
  "email": "mailto:me@ibrahimaher.com",
  "priceRange": "$$",
  "makesOffer": {
    "@type": "OfferCatalog",
    "name": "n8n & AI automation services",
    "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "n8n workflow automation", "serviceType": "n8n workflow automation" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "AI agent & chatbot development", "serviceType": "AI agent development" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "AI invoice & lead automation", "serviceType": "AI document and lead automation" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Business process automation", "serviceType": "Business process automation" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Integrations & custom n8n function nodes", "serviceType": "API integration" } }
    ]
  }
}
</script>
```

### WebSite (homepage `<head>`)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://ibrahimaher.com/#website",
  "url": "https://ibrahimaher.com",
  "name": "Ibrahim Maher Al-Bander",
  "description": "n8n and AI automation developer in Erbil, Iraq.",
  "inLanguage": "en",
  "publisher": { "@id": "https://ibrahimaher.com/#ibrahim" }
}
</script>
```
