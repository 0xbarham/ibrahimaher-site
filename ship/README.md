# ship/

The end-of-day publishing routine for this site.

The routine itself is a Claude Code skill, invoked with `/ship-daily`. This file
covers the parts that belong to the repository rather than to the workflow.

## Where the routine lives

Claude Code loads skills from `%USERPROFILE%\.claude\skills\`, which is in no
repository. `RESTORE-ON-NEW-PC.md` says so plainly, and its only backup is a tar
someone has to remember to make. Losing the machine would take the routine with
it while leaving the commands here intact, which is the wrong half to keep.

So `ship/skill/` is the canonical copy, committed beside the commands it drives,
and the installed copy is a mirror of it. `ship:doctor` diffs the two on every
run, the same way it diffs the column allowlist.

```bash
# install, or reconcile after editing either copy
cp -r ship/skill/. "$USERPROFILE/.claude/skills/ship-daily/"
```

Edit the copy in this repo. The other one is a deployment.

## The nightly task

A local scheduled task, `ship-daily-check`, runs at 22:00 Baghdad every day and
lives at `%USERPROFILE%\.claude\scheduled-tasks\ship-daily-check\SKILL.md`. It
invokes the skill and stops at step 6.

**It never publishes**, and that is the whole design. Every public page is SSR
from D1, so a row is public within seconds with no build and no staging pause.
Publishing is a decision someone makes while looking at the copy, and a task
firing at 22:00 will often fire while nobody is looking. So it runs doctor,
status and a dry harvest, writes drafts if there is something worth drafting,
lints them, and reports what needs a person.

It is deliberately a **local** scheduled task rather than a cloud routine. Cloud
routines run in Anthropic's infrastructure with no access to local files, local
services or local environment variables, and this workflow needs all three: the
repo, the wrangler OAuth token, and Chrome for captures. A cloud routine would
fail every night.

Recreate it with the `create_scheduled_task` tool if the file is ever lost. The
prompt is short and mostly delegates to `ship/skill/SKILL.md`, which is the part
worth version-controlling.

## Why this exists

The site renders every public page from D1 on the request, so content changes
need no build and no deploy. That makes daily publishing genuinely cheap, and
the thing standing in its way was never the writing. It was the ten minutes of
remembering: which of the week's builds is already up, where the screenshot
went, whether the copy still has an em dash in it, whether the row actually
rendered.

These scripts hold that state so nobody has to.

## Layout

```
ship/
  README.md      this file
  style.md       how the site is written. Read before writing copy.
  ledger.json    what we built, and whether it is on the site yet
  shipped.log    append-only record of every live write
  drafts/        one JSON file per piece of copy, pre-publish
  inbox/<id>/    screenshots waiting to be ingested
  bin/           the commands
  lib/           config, D1 access, ledger, style rules
```

`inbox/` is a working directory and is ignored wholesale: once `ship:ingest` has
run, the bytes are in R2 and the row is in `media`, so the local file is a
staging copy of something already stored twice.

Everything else is tracked, including the draft JSON files. A draft is the
authored source of a published piece and the only record of what the copy looked
like before it entered D1. Only the generated `PREVIEW-*.md` renderings are
ignored, because they are a second copy of the JSON sitting next to them.

## The two sources of truth, and why there are two

**D1 is the fact.** It knows what is published, because it is what the site
renders.

**`ledger.json` is the intent.** It knows what was built and deliberately held
back, what is waiting on a screenshot, and what is a client's and will never be
published. D1 cannot represent any of those, and they are most of the
interesting states.

`ship:status` reconciles them and reports where they disagree. That report is
the point. Do not edit the ledger to make it quiet.

## Credentials

Every write goes through `wrangler`, using the OAuth token the account owner
already granted. Nothing here reads the admin password, and no secret is stored
in this directory.

The trade is that these writes bypass the column allowlist in
`src/lib/schema.ts`. `ship/lib/d1.mjs` keeps a mirror of that list and
`ship:doctor` diffs the two on every run, so the two paths cannot quietly
disagree about what is writable.

That check earned itself on the first run: it found `posts.lang` missing from
`src/lib/schema.ts` after migration 0014 added the column, which meant the admin
panel silently could not set a post's language. An Arabic post written in the
admin would have been stored as English, rendered left to right, and listed in
the English blog index.

## Adding a column

1. Write the migration.
2. Add the column to `TABLE_COLUMNS` in `src/lib/schema.ts`.
3. Add a `FieldSpec` for it, or the admin cannot see it.
4. Add it to `WRITABLE` in `ship/lib/d1.mjs`.
5. Run `npm run ship:doctor` and confirm the allowlists still match.

Skipping step 2 or 3 produces a column that exists, holds data, and cannot be
edited by anyone. That is the failure mode this checklist exists to prevent.

## Running from Git Bash on Windows

MSYS rewrites any argument that looks like a Unix absolute path, so
`--set image=/media/x.webp` arrives as `C:/Program Files/Git/media/x.webp`.
`ship:patch` detects and repairs that, and says so. If you hit it somewhere
else, prefix the command with `MSYS_NO_PATHCONV=1`.

## Dependencies

`sharp` and `marked` were already here. `playwright-core` was added for
`ship:capture`; it downloads no browser and drives the Chrome already installed
on the machine. Everything else is node built-ins and `wrangler`.
