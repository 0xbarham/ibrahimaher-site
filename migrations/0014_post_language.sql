-- Posts gain a language, so the Arabic side can have its own writing rather than
-- borrowing the English blog.
--
-- DEFAULT 'en' is what makes this safe to apply to a live table: every existing
-- row becomes English without a backfill, and every existing query keeps its
-- current result set as long as it filters on 'en', which getPublishedPosts now
-- does by default. Nothing had to change at the call sites that were already
-- correct for English.
ALTER TABLE posts ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';
