-- RETRA API database (Cloudflare D1 / SQLite)

-- One-time sign-in nonces, valid for 10 minutes.
CREATE TABLE IF NOT EXISTS nonces (
  nonce      TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

-- Signed-in sessions. Only a SHA-256 hash of the bearer token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  address    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_address ON sessions (address);

-- Callouts. Each one is bound to one Uniswap v4 position that the poster owned and had open at posting time.
CREATE TABLE IF NOT EXISTS callouts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  address           TEXT    NOT NULL,
  token_id          TEXT    NOT NULL UNIQUE,
  pool_id           TEXT    NOT NULL,
  currency0         TEXT    NOT NULL,
  currency1         TEXT    NOT NULL,
  symbol0           TEXT    NOT NULL,
  symbol1           TEXT    NOT NULL,
  decimals0         INTEGER NOT NULL,
  decimals1         INTEGER NOT NULL,
  fee               INTEGER NOT NULL,
  tick_spacing      INTEGER NOT NULL,
  hooks             TEXT    NOT NULL,
  tick_lower        INTEGER NOT NULL,
  tick_upper        INTEGER NOT NULL,
  tick_at_post      INTEGER,
  liquidity_at_post TEXT    NOT NULL,
  text              TEXT    NOT NULL,
  created_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS callouts_address_time ON callouts (address, created_at);
