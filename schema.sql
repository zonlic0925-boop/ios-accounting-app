-- Shared ledger schema for Cloudflare D1 (replaces KV single-key JSON storage).
-- Row-level upsert with stable merge keys removes the KV failure modes:
-- concurrent whole-key overwrite, 60s eventual consistency, and the
-- 1000 writes/day quota ceiling. Merge scope is per-room via the composite key.

CREATE TABLE IF NOT EXISTS room (
  room_id    TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '恋爱共享账本',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_tx (
  room_id    TEXT NOT NULL,
  remote_id  TEXT NOT NULL,
  payload    TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (room_id, remote_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_tx_room ON ledger_tx(room_id, updated_at);
