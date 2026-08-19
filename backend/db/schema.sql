-- DealDost — Affiliate Marketing Site Schema (SQLite)
-- Applied automatically on server start; also runnable with: npm run migrate

PRAGMA journal_mode = WAL;

-- ===== ADMIN USERS =====
-- Only admins log in. Visitors never need an account on an affiliate site.
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== DEALS (the affiliate products) =====
CREATE TABLE IF NOT EXISTS deals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    description   TEXT,
    store         TEXT NOT NULL CHECK (store IN ('amazon', 'flipkart', 'meesho')),
    affiliate_url TEXT NOT NULL,
    image_url     TEXT,
    category      TEXT NOT NULL DEFAULT 'Other',
    brand         TEXT,
    price         REAL NOT NULL DEFAULT 0,   -- selling price in INR
    mrp           REAL,                      -- list price, used to show % off
    rating        REAL,                      -- 0-5
    coupon_code   TEXT,
    is_featured   INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
    is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    clicks        INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deals_store    ON deals (store);
CREATE INDEX IF NOT EXISTS idx_deals_category ON deals (category);
CREATE INDEX IF NOT EXISTS idx_deals_active   ON deals (is_active);
CREATE INDEX IF NOT EXISTS idx_deals_featured ON deals (is_featured);
CREATE INDEX IF NOT EXISTS idx_deals_created  ON deals (created_at DESC);

-- ===== CLICK LOG (earnings analytics) =====
CREATE TABLE IF NOT EXISTS clicks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id    INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
    referrer   TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_clicks_deal ON clicks (deal_id);
CREATE INDEX IF NOT EXISTS idx_clicks_time ON clicks (clicked_at DESC);

-- ===== SETTINGS (affiliate IDs, site name — editable from the admin panel) =====
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===== keep updated_at fresh =====
CREATE TRIGGER IF NOT EXISTS trg_deals_touch
AFTER UPDATE ON deals
FOR EACH ROW
BEGIN
    UPDATE deals SET updated_at = datetime('now') WHERE id = OLD.id;
END;
