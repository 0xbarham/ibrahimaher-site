---
name: ship-daily
description: End-of-day publishing routine for ibrahimaher.com. Use when the user says "ship it", "publish today's work", "end of day", "let's wrap up", "put this on the site", "what have we not published", or asks what is live versus what is not. Captures screenshots, writes copy in the site's own voice with no em dashes, fact-checks technical claims against source, publishes to the live D1 database, verifies over HTTP, then deploys and commits only if needed. Also use for a stale-site check when nothing new was built.
metadata:
  version: 2.0.0
  site: https://ibrahimaher.com
  repo: C:\Users\Ibrahim\projects\ibrahimaher
---

# Ship daily

Everything runs from the site repo:

```
cd C:\Users\Ibrahim\projects\ibrahimaher
```

Twelve steps. Do not skip 0, 5, 8 or 9. Steps 5 and 8 are the two that have
actually caught real problems.

## The stack, in the four facts that change decisions

1. **Every public page is SSR from Cloudflare D1 on the request.** A row written
   to `projects` or `posts` is live on the next page load. No build, no deploy,
   no staging pause. Treat `--live` accordingly.
2. **Images in R2 need no deploy either.** They are served at `/media/<key>` at
   runtime. Images under `public/assets/**` are build-time and **do** need one,
   which is why this routine never puts new images there.
3. **`src/**` and `public/**` need a deploy.** That is the only reason step 10
   exists. Content does not.
4. **The featured project renders no image.** `src/pages/index.astro` builds it
   from `featured_logo`, title and body only, by design. Read the template
   before capturing anything for it.

---

## 0. Preflight

```bash
npm run ship:doctor
```

Blocks on real problems. If it reports schema drift between `ship/lib/d1.mjs`
and `src/lib/schema.ts`, fix that first: it means the site and this tooling
disagree about what is writable, and a publish will fail halfway through. That
check has already found one live bug.

If a work source is unreachable, say so out loud. The E: volume has dropped out
mid-session before, and a harvest that finds nothing because the drive vanished
looks exactly like a day with no output.

**First run in a fresh clone:** see `references/first-run.md` before anything
else.

## 1. What is live, and what is not

```bash
npm run ship:status
```

Read it properly, not a summary. Three sections matter:

- **NOT PUBLISHED**, with the next action per item. The work list.
- **DRIFT**, where the ledger claims something is published and no row backs it.
  Always investigate. Never "fix" it by editing the ledger.
- **IS THE SITE ALIVE**: staleness, missing images, missing alt text.

## 2. What did we build today

```bash
npm run ship:harvest -- --since <YYYY-MM-DD>
```

Dry by default. It proposes; you and the user decide.

`git log` alone is not enough and the tool does not rely on it. Most of a day's
output is uncommitted, so harvest reads commits, `git status` porcelain and an
mtime walk, and merges them.

**Anything matching a confidential path is auto-skipped**, and this is
load-bearing. The first real run returned, as its six largest clusters, outreach
directories holding named prospects, their email addresses and research notes on
their businesses. To a file-counting heuristic those look exactly like a finished
project. Never override that classification unless the user says so explicitly,
in this conversation, about that specific folder.

## 3. Decide what ships

Per candidate, ask:

1. Is this a *thing*, or a day of edits to an existing thing?
2. Is any part of it someone else's to disclose? A client's workflow, a
   prospect's name, an internal rate card, a credential in a screenshot.
3. Is there a reader who would find it interesting? "We refactored the config"
   is real work and a bad portfolio entry.

Then record the survivors and promote them:

```bash
npm run ship:harvest -- --since <date> --write
```

Set a real title in `ship/ledger.json` and move `idea` to `queued`.

## 4. Write the copy

**Read `ship/style.md` before writing a word.** Every time, not once.

```bash
npm run ship:draft -- --id <ledger-id>              # project
npm run ship:draft -- --id <ledger-id> --kind post  # blog post
```

The rules broken most often:

- **No em dashes, no en dashes.** Hard rule. Comma, full stop, or brackets.
- Open at the fact, not the throat-clearing.
- Vary sentence length. Uniform rhythm is the loudest tell after the em dash.
- First person. It is a personal site.
- Include a number. A build described without numbers reads as a claim.
- Say what was hard. Nobody inventing a project would include the hard part.

A project body is four paragraphs: the problem in the reader's terms, what it
does mechanically, the genuinely hard part, the outcome with a number.

A post opens with a **direct answer paragraph before any heading**, then
question-shaped H2s each answered in their first sentence. That is the site's
existing shape and it is what makes a post citable by AI search.

```bash
npm run ship:lint -- --id <ledger-id>
```

Errors block. Warnings are advisory and usually right. Never pass `--force`
without telling the user which warning you are overriding, and why.

## 5. Fact-check every technical claim against source

**Do not skip this. It has already caught a wrong post.**

A write-up describes a system. Check the claims against **the artifact itself**,
not against a README, a submission form, or a sticky note, all of which go stale
the moment the system changes.

- Reading about an n8n workflow? Open the exported JSON and grep the model IDs,
  endpoints and node types.
- Reading about site behaviour? Open the template, not the docs.
- The user's screenshot and the user's export disagreeing is a finding, not a
  nuisance. Surface it and ask which is current.

Once caught: a post whose screenshot shows one provider and whose prose claims
another contradicts itself on the same page. The fix that worked was separating
the roles from the wiring, and saying plainly which version a reader can import
versus which one is running.

## 6. Capture and ingest images

**Before capturing, confirm the template renders the column you are filling.**
Setting `image` on the featured project is invisible: that panel renders no
screenshot by design.

```bash
npm run ship:capture -- --id <ledger-id> --url <url>
```

For anything behind a login, a workflow canvas, or a phone screen: capture it
however you can, including by asking the user, and drop the file into
`ship/inbox/<ledger-id>/`. `ship:ingest` does not care where it came from.

**Look at every image before ingesting.** Check for API keys, customer names,
phone numbers, email addresses and open browser tabs.

**Aspect ratio is not optional.** The hero slot is 1200x630 landscape. A
628x1280 phone screenshot dropped in there renders absurdly tall. Compose
portrait frames into one landscape figure first.

Full guidance, including the composition recipe: `references/images.md`.

```bash
npm run ship:ingest -- --id <ledger-id> --alt "what is actually in the frame"
```

Alt text is required and is not the title again. Describe the frame.

## 7. Publish

Dry run first, always. It prints the exact SQL:

```bash
npm run ship:publish -- --id <ledger-id>
```

**Ask the user before the live write.** Publishing to a public website can be
indexed, cached and shared within seconds.

```bash
npm run ship:publish -- --id <ledger-id> --status published --live
```

To change a few columns on a row that already has good copy, use `patch`, not
`publish`. `publish` rebuilds a row from a draft and converts markdown to HTML,
which would reformat stored prose nobody asked to touch:

```bash
npm run ship:patch -- --table projects --row 6 --set image=/media/... --live
```

## 8. Verify over HTTP, never by screenshot

```bash
npm run ship:verify
```

Fetches the real public URL and checks the text is on the page and every image
returns 200. The database agreeing with itself is not evidence.

**A screenshot is not proof.** Headless captures of this site have shown blank
frames for content that was demonstrably live, because of lazy loading and
scroll-driven reveals. When the two disagree, `curl` the HTML and believe that.

For a new post also confirm it entered the four places that matter:

```bash
curl -s https://ibrahimaher.com/blog/<slug> | grep -o 'property="og:image" content="[^"]*"'
curl -s https://ibrahimaher.com/blog/ | grep -c "<slug>"
curl -s https://ibrahimaher.com/sitemap.xml | grep -c "<slug>"
curl -s https://ibrahimaher.com/rss.xml | grep -c "<slug>"
```

## 9. Match existing conventions before inventing one

Before choosing a value for any field, look at what the other rows do:

```bash
npx wrangler d1 execute ibrahimaher-content --remote --json \
  --command "SELECT slug, og_image FROM posts WHERE og_image != '' LIMIT 6;"
```

That query settled the share-image question on evidence: 19 of 20 posts use a
relative `/assets/og/<slug>.png`, so the twentieth should too.

## 10. Deploy, only if the change needs it

Content does not. `src/**` and `public/**` do.

```bash
npm run build
npx wrangler deploy
```

The build regenerates every post's OG card from D1, so a post published earlier
picks up its themed card here. Check the asset upload count in the output: a
small number is correct, a large one means something unintended changed.

Then re-check the key routes: `/`, `/blog`, `/ar/`, `/admin/login`,
`/sitemap.xml`, `/rss.xml`.

## 11. Commit

Only when the user asks. But **do raise it** if a deploy has shipped code that
exists only in the working tree, because the live Worker then has no source of
truth in git.

Split by concern rather than by session. This repo writes commit messages that
explain the reasoning and end on a verification line, and uses no attribution
trailer. See `references/publishing.md`.

## 12. Close the day

```bash
npm run ship:status
```

Tell the user, in plain sentences: what went live with URLs, what is still
queued and what each item waits on, and whether the site now reads as alive.
Finish with a copy-pasteable prompt for the next session.

---

## Things that will bite

**A live row is live in seconds.** No build, no deploy, no staging.

**`ship:publish` refuses on style warnings** when publishing live. Deliberate.

**A slug is permanent.** Changing a published post's slug breaks every existing
link unless a row is added to the `redirects` table.

**Never edit `ship/ledger.json` to silence a DRIFT report.** Drift means the site
and the record disagree, and the record is the one more likely to be wrong.

**Hidden is not deleted.** `hidden = 1` keeps a project editable in the admin and
invisible publicly. Prefer it to a delete.

**Arabic is written, not translated.** Do not machine-translate an English post
and publish it as `lang: ar`. Note also that every post lives at `/blog/<slug>`
regardless of language; there is no `/ar/blog/<slug>` route, only an Arabic
index.

**Entities in titles are correct.** Several D1 columns hold HTML source and a
`decode()` helper handles them. `&amp;` in the served HTML renders as `&`. Do
not "fix" it.

---

## The commands

| Command | Does |
|---|---|
| `npm run ship:doctor` | preflight: credentials, schema drift, ledger sanity |
| `npm run ship:status` | what is live, what is not, what is stale |
| `npm run ship:harvest` | scan the work repos for what was built |
| `npm run ship:draft` | scaffold a draft |
| `npm run ship:lint` | house style check |
| `npm run ship:capture` | screenshot a URL, light and dark |
| `npm run ship:ingest` | normalise, upload to R2, index in `media` |
| `npm run ship:publish` | write a whole row (dry unless `--live`) |
| `npm run ship:patch` | change named columns on one existing row |
| `npm run ship:verify` | fetch the public URL and confirm it renders |
| `npm run ship:adopt` | bring an existing live row into the ledger |

## References

- `references/first-run.md`: seeding the ledger in a fresh clone
- `references/images.md`: capture, aspect ratios, composing, leak checks
- `references/publishing.md`: deploy rules, OG conventions, commit style

This file is subject to its own rules. Run
`npm run ship:lint -- --file <path>` over it after editing.
