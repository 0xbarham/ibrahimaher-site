-- 0013 — post revisions and scheduled publishing.
--
-- Two gaps this closes, both about not losing or mistiming work:
--
--   1. There was no way back from an edit. `body_md` is the largest and most
--      valuable column in the schema, and a bad paste over it was unrecoverable
--      from the admin — no undo, no history, no backup path short of a D1
--      export. post_revisions snapshots the post *before* each save.
--
--   2. `status` was binary. post_date existed but was decorative: setting a
--      future date on a published post simply published it with a future date
--      on it. Nothing could be queued.

-- ---------------------------------------------------------------- revisions
--
-- Deliberately a snapshot table, not a diff table. Diffs are smaller but need
-- reconstruction logic to restore, and the whole point of this table is to be
-- trustworthy at the moment something has gone wrong. Storage is not the
-- constraint here: sixteen posts of a few KB each, capped at 20 revisions per
-- post (enforced in the API, not here), is a rounding error in D1.
--
-- Only the fields worth reverting are captured. SEO/OG/Twitter columns are
-- excluded on purpose — they are short, rarely the thing you destroy, and
-- including them would widen every row for very little recovery value.
CREATE TABLE IF NOT EXISTS post_revisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  title      TEXT,
  slug       TEXT,
  excerpt    TEXT,
  body_md    TEXT,
  status     TEXT,
  category   TEXT,
  tags_json  TEXT,
  -- ISO-8601 UTC, e.g. '2026-08-10T13:45:02Z'. Stored as TEXT because that is
  -- what every other timestamp in this schema does (posts.created_at,
  -- posts.updated_at), and mixing storage formats for the same concept is how
  -- you end up sorting a date column lexically by accident.
  created_at TEXT NOT NULL,
  -- Free text, set by the editor: 'autosave', 'manual save', 'before restore'.
  -- Not an enum, because the useful thing here is being able to add a new kind
  -- of checkpoint without a migration.
  note       TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Every read of this table is "the history of one post, newest first". The
-- composite index serves that exactly and makes the per-post pruning query
-- (keep the newest 20) an index scan rather than a sort.
CREATE INDEX IF NOT EXISTS idx_post_revisions_post
  ON post_revisions (post_id, created_at DESC);

-- --------------------------------------------------------------- scheduling
--
-- publish_at rather than overloading post_date. post_date is the *displayed*
-- date — the one in the byline and in BlogPosting JSON-LD — and editors
-- legitimately backdate it. Conflating "when this says it was written" with
-- "when this goes live" would make one of those two impossible to express.
--
-- NULL means "not scheduled", which keeps every existing row correct without a
-- backfill.
ALTER TABLE posts ADD COLUMN publish_at TEXT;

-- No cron, no queue, no scheduled Worker.
--
-- The site is SSR on every request, so a scheduled post can simply become
-- visible the first time someone asks for it after its timestamp passes:
-- getPublishedPosts() matches status='published' OR (status='scheduled' AND
-- publish_at <= now). That is why the index below carries status and publish_at
-- together — it is the exact predicate the public blog queries run.
--
-- The tradeoff, stated plainly: a scheduled post goes live on the first request
-- after its time, not at the instant itself. On a site with this traffic that
-- can mean a few minutes of drift. The alternative is a Cron Trigger and a
-- second failure mode to maintain, which is not worth it for a personal blog.
CREATE INDEX IF NOT EXISTS idx_posts_schedule
  ON posts (status, publish_at);
