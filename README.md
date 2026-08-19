# DealDost — Affiliate Marketing Website (Amazon · Flipkart · Meesho)

A complete, working affiliate/deals website. You publish product deals, visitors click
**Buy on Amazon / Flipkart / Meesho**, and every click is tagged with your affiliate ID and
counted — so you earn commission and can see which deals actually work.

You **add and remove items yourself** from a built-in admin panel. No coding needed after setup.

```
Visitor clicks "Buy on Amazon"
   → your API logs the click                     (/go/12)
   → adds your affiliate tag                     (?tag=yourname-21&ascsubtag=deal-12)
   → 302 redirects to Amazon
   → Amazon pays you commission on the sale
```

- `backend/` — Node.js + Express API, SQLite database, JWT admin auth, click tracking
- `frontend/` — React (Vite) storefront + admin dashboard

---

## Everything here is free

| Need | What this project uses | Cost |
|---|---|---|
| Database | **SQLite** via Node's built-in `node:sqlite` — one file, no server, no install | Free |
| Cache | In-process TTL cache (replaces Redis) | Free |
| API | Node.js + Express | Free |
| Frontend | React + Vite | Free |
| Admin auth | JWT + bcrypt | Free |
| Product images | Any image URL (the store's own product image, or `picsum.photos` placeholders) | Free |
| Frontend hosting | Vercel or Netlify free tier (config files included) | Free |
| API hosting | Render / Railway free tier, or your own PC | Free |
| Amazon commission | Amazon Associates India | Free to join |
| Flipkart commission | Flipkart Affiliate, or EarnKaro | Free to join |
| Meesho commission | Meesho partner programme, or EarnKaro / INRDeals | Free to join |

No Docker, no Postgres, no Redis, no payment gateway, no paid API keys.

---

## 1. Run it locally (Windows PowerShell)

You only need **Node.js 24 or newer** (https://nodejs.org). Check with `node -v`.

### Start the API

```powershell
cd "C:\Users\ataha\Desktop\ecommerce-app\backend"
copy .env.example .env      # skip if .env already exists
npm install
npm run seed                # creates the admin login + 12 demo deals
npm run dev
```

Leave it running. You should see `Affiliate site API running on http://localhost:5000`.

The seed prints your admin login — by default `admin@dealdost.com` / `Admin@123`
(change these in `backend/.env` before seeding if you like).

### Start the website (second PowerShell window)

```powershell
cd "C:\Users\ataha\Desktop\ecommerce-app\frontend"
copy .env.example .env      # skip if .env already exists
npm install
npm run dev
```

Open **http://localhost:3000**

| Page | What it is |
|---|---|
| `/` | Storefront — hero, top picks, store filters, category filter, sort, search, pagination |
| `/deal/:slug` | Single deal page with the big buy button and related deals |
| `/login` | Admin sign in |
| `/admin` | Add / edit / remove deals, bulk import, analytics, settings |
| `/about`, `/contact`, `/affiliate-disclosure`, `/privacy` | Pages the affiliate programmes require |

To stop either server: `Ctrl+C` in its window.

---

## 2. Adding and removing items (the admin panel)

Sign in at **http://localhost:3000/login**, then open the **Admin** tab.

### Add an item

**Deals** tab → left-hand form:

| Field | Required | Notes |
|---|---|---|
| Product title | yes | What visitors see and search on |
| Affiliate link | yes | Paste the product URL from Amazon / Flipkart / Meesho. The store is detected automatically and your affiliate ID is attached at click time — you do **not** need to build a tagged link yourself |
| Store | no | Only needed if the link is a shortlink the detector can't read |
| Category | no | Free text with suggestions from your existing categories; defaults to `Other` |
| Deal price / MRP | price yes | If MRP is higher, the `% OFF` badge and "you save" line appear automatically |
| Brand, Rating, Coupon code | no | Shown on the card and detail page |
| Image URL | no | Right-click the product photo on the store page → *Copy image address* |
| Why it is a good deal | no | Short description on the deal page |
| Feature in top picks | no | Puts it in the homepage strip |
| Visible on the site | no | Untick to save it as a draft |

Click **Add deal** — it is live on the homepage immediately.

### Remove an item

Three ways, all in the **Deals** tab table:

1. **Delete** on a row → confirm → gone permanently (its click history goes too).
2. **Tick several rows** → *Delete N selected* → one confirm removes them all.
3. **Hide** instead of deleting → the deal disappears from the site but stays in your admin
   list, so you can bring it back with **Show** when the price is good again.

### Other things in the table

- **Edit** loads that deal into the form; the button becomes *Save changes*.
- **Feature / Unfeature** toggles the homepage strip.
- **test link ↗** opens the exact tagged URL a visitor would get — use it to confirm your
  affiliate ID is being attached.
- Search box, store filter, status filter (live / hidden / featured) and sorting, so a large
  catalogue stays manageable.

### Bulk import and backup

**Bulk import** tab: paste a JSON array to add up to 200 deals at once. Only `title`,
`affiliate_url` and `price` are required. Bad rows are listed back to you with the reason; the
good rows still get added. Click **Load example** to see the format.

**Export backup (JSON)** downloads your whole catalogue in exactly the format the importer
accepts — keep this file. It is your restore path (see hosting note below).

### Analytics

**Analytics** tab: clicks today / 7 days / 30 days / all time, clicks by store, by category,
the last 14 days, and your top-clicked deals. Clicks are what this site can measure —
actual commission and orders are always confirmed in the Amazon/Flipkart/Meesho dashboards.

---

## 3. Getting your affiliate IDs (all free to join)

The site works before you are approved — links just earn nothing until you paste your IDs in.

### Amazon Associates (India)

1. Sign up at https://affiliate-program.amazon.in with your site URL.
2. After approval, find your **tracking ID** — it looks like `yourname-21`.
3. Admin → **Settings** → *Amazon Associates tag* → paste → Save.

Amazon requires the affiliate disclosure that is already at `/affiliate-disclosure`, plus a
working About and Contact page — all included.

### Flipkart

1. Sign up at https://affiliate.flipkart.com
2. Copy your **affiliate/tracking ID**.
3. Admin → **Settings** → *Flipkart affiliate ID* → paste → Save. It is added as `affid`.

### Meesho

Meesho has no open affiliate API. Either use links from your Meesho partner dashboard, or use
a free network below. The *Meesho / network source ID* setting only adds `utm_source` for your
own reporting.

### Easier alternative: free affiliate networks

If direct approval is slow (common for new sites), join **EarnKaro**, **INRDeals** or
**Cuelinks** — free, no company registration, and they cover Amazon, Flipkart *and* Meesho.
Generate a link there and paste it in as the affiliate link. The site accepts those hosts and
leaves their tracking untouched.

> Only links to the three stores or those networks are accepted. That is deliberate — it stops
> your `/go/:id` redirect from being abused to bounce visitors to a random site.

---

## 4. Putting it online (free)

The API can serve the built website itself, so you get **one URL, one port, no CORS**. Build
the frontend once and the API picks it up automatically from `frontend/dist`:

```powershell
cd "C:\Users\ataha\Desktop\ecommerce-app"
npm run build        # builds the site with VITE_API_URL=/api
npm start            # serves site + API together on http://localhost:5000
```

### Option A — share it in 5 minutes (temporary URL, your PC stays on)

With `npm start` running, open a second window and start a free Cloudflare quick tunnel
(install once: `winget install Cloudflare.cloudflared` — no account needed):

```powershell
cloudflared tunnel --url http://localhost:5000
```

It prints a public `https://something.trycloudflare.com` address that anyone can open. Set
`SITE_URL` in `backend/.env` to that address and restart the API so `sitemap.xml` is correct.

Good for showing someone the site or testing on your phone. The URL changes every run and dies
when you close the window, so it is not a home for a real site.

### Option B — permanent free hosting, one service

Push to GitHub, then on **Render** → *New → Blueprint* → pick the repo. `render.yaml` in the
repo root fills in everything; you only type the values it asks for:

| Setting | Value |
|---|---|
| Root directory | *(blank — repo root)* |
| Build command | `npm run deploy:build` |
| Start command | `npm start` |
| Env vars you enter | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SITE_URL` (your Render URL), affiliate IDs |
| `JWT_SECRET` | generated by Render automatically |

One service serves both the site and the API. **No shell needed:** the first boot creates the
tables, your admin account (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`) and the default settings —
which also means the site heals itself if the host wipes the disk. Railway and Fly.io work the
same way with the same build/start commands.

The catalogue is *not* recreated automatically, on purpose — restore it from your JSON backup
via Admin → Bulk import so a redeploy can never overwrite real deals with demo data.

### Option C — split hosting (frontend on a CDN)

Slightly faster page loads, two things to manage. Set `VITE_API_URL` to the API's full URL in
the frontend host's dashboard (a real env var overrides `.env.production`), and set
`CLIENT_ORIGIN` to the frontend URL in the API's environment.

### Frontend → Vercel or Netlify

Push this repo to GitHub, then:

- **Vercel**: New Project → import the repo → set **Root Directory** to `frontend` → add env var
  `VITE_API_URL = https://your-api-host/api` → Deploy. (`frontend/vercel.json` handles SPA routing.)
- **Netlify**: New site from Git → **Base directory** `frontend`, build `npm run build`, publish
  `dist` → add the same env var. (`frontend/netlify.toml` is included.)

### Backend → Render (free web service)

- Root directory `backend`, build `npm install`, start `npm start`
- Environment variables: `JWT_SECRET` (a long random string), `CLIENT_ORIGIN` (your frontend URL),
  `SITE_URL` (your frontend URL), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and your affiliate IDs
- After the first deploy, run `npm run seed` once (Render → Shell) to create the admin user

**Important free-tier caveat:** the SQLite file lives on the host's disk. Free plans usually give
you a disk that is **wiped on every redeploy**, and free instances sleep when idle (first request
after sleep is slow). So:

- Use **Export backup (JSON)** before a redeploy, and **Bulk import** to restore. Two minutes.
- Or attach a persistent disk (Render's costs money) and point `DB_FILE` at it.
- Or self-host: any always-on machine — an old laptop, a Raspberry Pi, or an always-free cloud VM
  — gives you a permanent disk for free. Set `DB_FILE` to a path on it.

### After deploying, update these

- `frontend/index.html` — `<title>`, meta description and `<link rel="canonical">`
- `frontend/public/robots.txt` — the `Sitemap:` line should point at `https://your-api-host/sitemap.xml`
- Admin → Settings — site name, tagline, contact email
- Submit `https://your-api-host/sitemap.xml` in Google Search Console (free); it lists every
  live deal automatically

---

## 5. How the pieces fit together

Root scripts: `npm run setup` (install both), `npm run seed`, `npm run build`, `npm start`
(site + API on one port), `npm run dev:api`, `npm run dev:web`.

```
frontend/src
├── pages/          Home, DealDetail, Login, Admin, InfoPages
├── components/     Navbar, Footer, DealCard, ProtectedRoute
│   └── admin/      DealForm, DealTable, BulkImport, Analytics, SettingsPanel
├── context/        AuthContext (admin session), SiteContext (branding + stores)
├── api.js          axios instance, JWT header, goUrl() helper
└── format.js       ₹ formatting, dates

backend/src
├── controllers/    deal (public), admin (CRUD/stats/settings), auth, site (sitemap)
├── routes/         /api/deals, /api/admin, /api/auth
├── middleware/     requireAuth / requireAdmin, error handler
├── config/         db.js (SQLite), cache.js (in-memory TTL)
└── utils/          affiliate.js (stores, link validation, tagging), slug.js, jwt.js

backend/db
├── schema.sql      users, deals, clicks, settings
├── seed.js         admin user + default settings + 12 demo deals
└── affiliate.db    your data (created on first run — back it up)
```

### API reference

Public:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/deals` | List live deals. `q, store, category, brand, minPrice, maxPrice, featured, sort, page, limit` |
| GET | `/api/deals/filters` | Categories, brands, store counts, price range |
| GET | `/api/deals/:idOrSlug` | One deal + related |
| GET | `/api/site` | Site name/tagline + store list |
| GET | `/go/:id` | Log click → redirect to store with your tag |
| GET | `/sitemap.xml` | SEO sitemap of all live deals |
| GET | `/health` | Uptime check |

Admin (send `Authorization: Bearer <token>` from `POST /api/auth/login`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/deals` | All deals incl. hidden, with the tagged URL |
| POST | `/api/admin/deals` | **Add** a deal |
| PUT | `/api/admin/deals/:id` | Edit a deal |
| DELETE | `/api/admin/deals/:id` | **Remove** one deal |
| DELETE | `/api/admin/deals` | Remove many — body `{ "ids": [1,2,3] }` |
| PATCH | `/api/admin/deals/:id/toggle` | Body `{ "field": "is_active" }` or `"is_featured"` |
| POST | `/api/admin/deals/bulk` | Import an array of deals |
| GET | `/api/admin/deals/export` | Download the catalogue as JSON |
| GET | `/api/admin/stats` | Dashboard + click analytics |
| GET/PUT | `/api/admin/settings` | Site name, tagline, affiliate IDs |

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `node:sqlite` not found | Node is too old. Install Node 24+ and check `node -v` |
| Website shows no deals / network error | Is the API window still running on port 5000? Does `frontend/.env` have the right `VITE_API_URL`? |
| Login fails | Locally: `npm run seed` in `backend/` prints the email/password it created. Deployed: the account comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the host's env vars |
| "Links from … are not allowed" | Only Amazon/Flipkart/Meesho or EarnKaro/INRDeals/Cuelinks links are accepted. Use the store's real product URL |
| Buy button goes to the store but with no tag | Paste your affiliate ID in Admin → Settings, then check the row's **test link ↗** |
| Deal changes don't show on the homepage | Listings are cached for 60s; writes clear the cache, so just reload |
| Port 5000 or 3000 already in use | Change `PORT` in `backend/.env`, or the `server.port` in `frontend/vite.config.js` |
| Want to start over | `npm run reset` in `backend/` (wipes deals, re-adds the demo set) |

## 7. Legal basics for an affiliate site

Already built in, but keep them true: the affiliate disclosure page, the disclosure line under
every buy button, `rel="nofollow sponsored"` on outbound links, `Disallow: /go/` in robots.txt,
and no claim to sell anything yourself. Don't state a price as guaranteed — always let the store
be the source of truth, which is why every deal page says so.
