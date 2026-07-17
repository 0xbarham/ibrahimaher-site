-- Migration 0009: admin credentials in D1, replacing the ADMIN_PASSWORD_HASH secret.
--
-- Why this exists: the admin was LOCKED. isAuthConfigured() requires both
-- SESSION_SECRET and ADMIN_PASSWORD_HASH; only SESSION_SECRET was ever set, so
-- POST /api/auth/login answered every attempt with 500 "Admin auth is not
-- configured". Nobody could log in — including the owner. (It also meant nobody
-- else could, which is the only reason this was safe sitting on a live site.)
--
-- Rather than mint another secret, credentials move into D1 so the owner can
-- create his own account, with a username, on first run — and rotate it later
-- without a redeploy.
--
-- STORAGE FORMAT: `pbkdf2$sha256$<iterations>$<salt-b64url>$<hash-b64url>`
-- Self-describing on purpose: `iterations` travels with the hash, so raising the
-- cost later does not invalidate existing rows, and the leading algorithm tag
-- leaves room to branch on a different KDF without a migration.
--
-- A deliberate upgrade from the old scheme, whose own comment in lib/auth.ts
-- called it out: ADMIN_PASSWORD_HASH was an UNSALTED SHA-256 — a fast hash, cheap
-- to brute-force from a leak, and identical for identical passwords. PBKDF2 with
-- a per-row random salt fixes both.
--
-- SINGLE ADMIN IS ENFORCED IN THE INSERT, NOT HERE. Setup must be one-shot: the
-- endpoint inserts with `WHERE NOT EXISTS (SELECT 1 FROM admin_users)`, atomic in
-- SQLite, so two concurrent setup requests cannot both win — the second changes 0
-- rows. A CHECK(id = 1) would express it here, but it would also permanently
-- block adding a second operator, which is a different decision from "the
-- takeover window is closed".
--
-- UNIQUE on username is what makes a re-run of setup fail closed rather than
-- quietly create a duplicate identity.

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
