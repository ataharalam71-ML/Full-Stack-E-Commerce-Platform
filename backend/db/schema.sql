-- DealDost - Affiliate Marketing Site Schema (PostgreSQL)
-- Applied automatically on server start; also runnable with: npm run migrate
--
-- Booleans are stored as SMALLINT 0/1 rather than BOOLEAN so that counting them
-- (SUM(is_active)) stays straightforward across the dashboard queries.

-- ===== ADMIN USERS =====
-- Only admins log in. Visitors never need an account on an affiliate site.
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== DEALS (the affiliate products) =====
CREATE TABLE IF NOT EXISTS deals (
    id            SERIAL PRIMARY KEY,
    title         TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    description   TEXT,
    store         TEXT NOT NULL CHECK (store IN ('amazon', 'flipkart', 'meesho')),
    affiliate_url TEXT NOT NULL,
    image_url     TEXT,
    category      TEXT NOT NULL DEFAULT 'Other',
    brand         TEXT,
    price         DOUBLE PRECISION NOT NULL DEFAULT 0,
    mrp           DOUBLE PRECISION,
    rating        DOUBLE PRECISION,
    coupon_code   TEXT,
    is_featured   SMALLINT NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
    is_active     SMALLINT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    clicks        INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_store    ON deals (store);
CREATE INDEX IF NOT EXISTS idx_deals_category ON deals (category);
CREATE INDEX IF NOT EXISTS idx_deals_active   ON deals (is_active);
CREATE INDEX IF NOT EXISTS idx_deals_featured ON deals (is_featured);
CREATE INDEX IF NOT EXISTS idx_deals_created  ON deals (created_at DESC);

-- ===== CLICK LOG (earnings analytics) =====
CREATE TABLE IF NOT EXISTS clicks (
    id         SERIAL PRIMARY KEY,
    deal_id    INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    referrer   TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_clicks_deal ON clicks (deal_id);
CREATE INDEX IF NOT EXISTS idx_clicks_time ON clicks (clicked_at DESC);

-- ===== SETTINGS (affiliate IDs, site name - editable from the admin panel) =====
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== keep updated_at fresh =====
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deals_touch ON deals;
CREATE TRIGGER trg_deals_touch
BEFORE UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
