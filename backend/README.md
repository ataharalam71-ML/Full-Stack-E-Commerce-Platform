# Affiliate site — Backend API

Express + SQLite. Serves the public deal catalogue, the affiliate click redirect, and the
admin CRUD API. See the root `README.md` for setup and the full endpoint table.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload (`node --watch`) |
| `npm start` | Start for production |
| `npm run migrate` | Create/update tables (also runs automatically on boot) |
| `npm run seed` | Create the admin user, default settings and demo deals |
| `npm run reset` | Wipe deals + clicks, then re-seed the demo set |

## Why Postgres (and not a file)

This started on SQLite, which was lovely locally and unusable in production: free hosts give a
service an **ephemeral filesystem**, so the database file — and every deal in it — is deleted
whenever the instance restarts, which for a sleeping free instance is about once a day.

Postgres on Neon's free tier lives outside the instance, so restarts and redeploys cost nothing.
`src/config/db.js` is still the only file that talks to the database: it rewrites `?`
placeholders into `$1..$n`, so the SQL in the controllers reads the same as it always did.

Redis is replaced by `src/config/cache.js` — an in-process TTL map. Listings are cached for
`CACHE_TTL_SECONDS` (default 60) and every write calls `cacheClear()`, so the admin panel never
shows stale data.

## Data model (`db/schema.sql`)

- **users** — admins only. Visitors never register.
- **deals** — the catalogue. `store` is constrained to `amazon | flipkart`;
  `is_active` hides a deal without deleting it; `clicks` is a running counter.
- **clicks** — one row per click-through (deal, time, referrer, user-agent). No personal data,
  no cookies. Cascades on deal delete.
- **settings** — key/value: site name, tagline, contact email, affiliate IDs. Editable from the
  admin panel so changing an affiliate ID needs no redeploy.

## Affiliate link handling (`src/utils/affiliate.js`)

One place decides everything store-specific:

- `validateAffiliateUrl()` — accepts only `http(s)` links to Amazon/Flipkart or to the
  EarnKaro / INRDeals / Cuelinks / BitLi / Wishlink networks. This is what keeps `/go/:id` from
  becoming an open redirect that spammers can use.
- `detectStore()` — infers the store from the host, so the admin form can leave it blank.
- `withAffiliateTag()` — adds your ID (`tag` for Amazon, `affid` for Flipkart, `utm_source` for
  plus a per-deal sub-ID (`ascsubtag` / `affExtParam1`) so store reports show which deal
  drove the sale. It never overwrites a parameter the link already has, and it leaves network
  shortlinks completely alone since their tracking is already baked in.

## Security notes

- Admin routes require a valid JWT with `role: admin`; the login endpoint is rate-limited to
  20 attempts / 15 min, everything else to 600 / 15 min.
- Passwords are bcrypt hashed. `JWT_SECRET` is mandatory — the server refuses to start without it.
- All SQL uses bound parameters. Sort/filter inputs are matched against allow-lists, never
  interpolated.
- Outbound redirects set `X-Robots-Tag: noindex, nofollow`.
- `helmet` sets the usual security headers; CORS is restricted to `CLIENT_ORIGIN`.
