# First run in a fresh clone

Do this once. After it, `ship:status` tells the truth and its untracked list
becomes a real signal.

## The problem it solves

Everything on the site predates the tooling, so on a first run `ship:status`
reports the entire site as untracked: every project, every post. That is correct
and it is useless noise, and noise in the one report you rely on is how the
report stops being read.

Adopting a row records that it is live and accounted for. Once the backlog is
adopted, anything appearing in the untracked list was published outside the
routine, which is genuinely worth knowing.

## Seed it

```bash
npm run ship:adopt -- --table projects --all
npm run ship:adopt -- --table posts --all
```

This reads D1 and writes only `ship/ledger.json`. It never writes to the
database. Expect one ledger item per live row.

Adoption records reality rather than intent, so:

- a normal visible row becomes `published`
- a `hidden` project or a `draft` post becomes `captured`, because
  live-but-invisible is not published, and the routine should ask about it again

## Then confirm

```bash
npm run ship:doctor
npm run ship:status
```

`doctor` should be all clear. `status` should show an empty or near-empty
untracked list.

## What "all clear" is worth

The doctor's schema-drift check compares the writable-column allowlist in
`ship/lib/d1.mjs` against `TABLE_COLUMNS` in `src/lib/schema.ts`. That mirror
exists because `schema.ts` transitively imports `cloudflare:workers`, a
specifier only the Workers runtime resolves, so plain node cannot import it.

On its very first run the check failed, and correctly: `posts.lang` had been
added by migration 0014 and never added to `schema.ts`, so the admin silently
could not set a post's language. Treat a drift failure as a real finding about
the site, not as tooling noise.

## Adopting one row later

When something gets published by hand, outside the routine:

```bash
npm run ship:adopt -- --table posts --row 21 --id some-slug
```

## Gotcha

Titles in this database contain HTML entities, because several columns hold HTML
source lifted from the old static markup. `adopt` decodes them before slugifying,
so a title containing `&amp;` does not produce a ledger id with `amp` wedged into
the middle of it. If you write your own tooling against these columns, do the
same.
