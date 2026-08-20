# Publishing, deploying, committing

## What needs a deploy, and what does not

| Change | Live when |
|---|---|
| `projects` or `posts` row | next request |
| R2 image at `/media/<key>` | immediately |
| `settings` row | within 30s, the in-isolate cache TTL |
| `src/**` | after `npm run build && wrangler deploy` |
| `public/**`, including `llms.txt` and `robots.txt` | after a deploy |
| Generated OG cards under `public/assets/og/` | after a deploy |

Every public page is SSR and reads D1 on the request, which is the whole reason
this routine can publish daily without touching the build. It is also why a
mistake is public in seconds.

A useful consequence: **scheduled posts need no cron.** `status = 'scheduled'`
with a `publish_at` in the past is evaluated by the same SSR read on every
request, so a post goes live on the first request after its timestamp.

## `publish` versus `patch`

`publish` owns a whole row and rebuilds it from a draft, converting `body_md` to
HTML on the way.

`patch` changes only the columns you name.

Use `patch` whenever the row already holds good copy and you are changing
something else, such as an image path or a share card. Routing that through
`publish` would round-trip stored HTML out to markdown and back, silently
reformatting prose nobody asked to touch.

Both are dry by default, both enforce the column allowlist, both style-check any
prose value, and both read the row back afterwards rather than trusting the
write.

## Deploying

```bash
npm run build
npx wrangler deploy
```

`build` runs `scripts/gen-og.mjs` first, which reads published posts **from live
D1** and renders a themed card per post. A post published earlier in the session
gets its card here.

Read the deploy output. The asset upload line is the check:

```
Found 2 new or modified static assets to upload
+ /llms.txt
+ /assets/og/arabic-english-social-posts-n8n.png
```

Two files for a content session is right. A large number means something
unintended changed, most often a dependency bump rewriting hashed bundles.

Confirm the bindings printed at the end are still `SESSION`, `DB`, `MEDIA` and
`ASSETS`. Then curl the key routes: `/`, `/blog`, `/ar/`, `/admin/login`,
`/sitemap.xml`, `/rss.xml`.

Verify a code change actually shipped rather than assuming it. Find the built
chunk and assert the change is in it, for example after the `posts.lang` fix:

```bash
grep -rl "Sets text direction" dist/server/chunks/
```

## Rollback

`wrangler.jsonc` uses **zone routes**, not Custom Domains, and the v1 Pages
project still holds the custom domains as a silent fallback. Deleting the two
routes reverts the entire site to v1 within a minute. That is the rollback, and
it is why Pages is deliberately left attached rather than tidied up.

## Committing

Only when the user asks. But **raise it** if a deploy has shipped code that
exists only in the working tree: the live Worker then has no source of truth in
git, and this machine has a volume with a history of dropping out.

Check for drift after deploying and committing:

```bash
git diff HEAD --stat -- src public
```

Empty means what is committed is exactly what the Worker serves.

### This repo's conventions

- `type(scope): lowercase description`, no trailing full stop. Types in the
  history: `feat`, `fix`, `docs`, `chore`, `copy`, `perf`.
- **No attribution trailer.** Zero of the last thirty commits carry
  `Co-Authored-By`. Do not add one.
- The body explains the reasoning, not the diff. It names the decision, what was
  rejected and why, and any bug found along the way.
- It ends on a verification line: what was checked, and the numbers.
- Sectioned with underlines when the change has more than one part.

### Splitting

Split by concern, not by session. A session that fixes a bug, adds tooling and
corrects content is three commits, because each is independently revertable and
independently interesting.

### Before staging

Scan anything new for secrets, and check what git will actually pick up:

```bash
grep -rniE "password|secret|api[_-]?key|token|bearer|[0-9a-f]{32,}" <newdir>/
git add -An <newdir>/
```

`ship/inbox/` is ignored wholesale. Draft JSON files are tracked, because a draft
is the authored source of a published piece; only the generated `PREVIEW-*.md`
renderings are ignored.

## Checking a live post landed everywhere

```bash
S=<slug>
curl -s https://ibrahimaher.com/blog/$S | grep -o 'property="og:image" content="[^"]*"'
curl -s https://ibrahimaher.com/blog/ | grep -c "$S"
curl -s https://ibrahimaher.com/sitemap.xml | grep -c "$S"
curl -s https://ibrahimaher.com/rss.xml | grep -c "$S"
```

The sitemap and RSS are both built from D1, so a published post enters them with
no deploy. If it is missing from either, it is not actually published: check
`status` and `publish_at`.
