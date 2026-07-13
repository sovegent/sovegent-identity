export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notarizations (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users(id),
  document_hash TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  label         TEXT,
  proof_json    TEXT NOT NULL,
  anchor_json   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notarizations_owner ON notarizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_notarizations_hash  ON notarizations(document_hash);

CREATE TABLE IF NOT EXISTS attestations (
  id           TEXT PRIMARY KEY,
  issuer_id    TEXT NOT NULL REFERENCES users(id),
  subject_id   TEXT NOT NULL,
  claim_json   TEXT NOT NULL,
  proof_json   TEXT NOT NULL,
  anchor_json  TEXT,
  issued_at    TEXT NOT NULL,
  expires_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attestations_issuer  ON attestations(issuer_id);
CREATE INDEX IF NOT EXISTS idx_attestations_subject ON attestations(subject_id);

CREATE TABLE IF NOT EXISTS nonces (
  nonce      TEXT PRIMARY KEY,
  address    TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);
`;
