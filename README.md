# DealDost — Affiliate Marketing Website (Amazon · Flipkart · Meesho)

A complete, working affiliate/deals website. You publish product deals, visitors click
**Buy on Amazon / Flipkart / Meesho**, and every click is tagged with your affiliate ID and
counted — so you earn commission and can see which deals actually work.

You **add and remove items yourself** from a built-in admin panel — by hand, or by searching
the stores from inside the panel and pressing **Add** on the results you want. No coding
needed after setup, and no AI or API keys anywhere.

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
| Database | **Postgres** on Neon's free tier (0.5 GB, no card) — survives restarts and redeploys | Free |
| Cache | In-process TTL cache (replaces Redis) | Free |
| API | Node.js + Express | Free |
| Frontend | React + Vite | Free |
| Admin auth | JWT + bcrypt | Free |
| Product images | Any image URL (the store's own product image, or `picsum.photos` placeholders) | Free |
| Frontend hosting | Vercel or Netlify free tier (config files included) | Free |
| API hosting | Render / Railway free tier, or your own PC | Free |
| Finding items to add | Built-in finder — searches the stores and reads product pages | Free, no signup |
| Amazon commission | Amazon Associates India | Free to join |
| Flipkart commission | Flipkart Affiliate, or EarnKaro | Free to join |
| Meesho commission | Meesho partner programme, or EarnKaro / INRDeals | Free to join |

No Docker, no Redis, no payment gateway, no API keys, no AI. **Find products**
(Admin → 🔍 Find products) searches the stores and reads their product pages directly, so
there is nothing to sign up for and nothing to configure.

---

## 1. Run it locally (Windows PowerShell)

You only need **Node.js 24 or newer** (https://nodejs.org). Check with `node -v`.

### Start the API

You need a free Postgres database first — about two minutes:

1. Sign up at **https://neon.tech** (GitHub login, no card)
2. Create a project (region Singapore for India)
3. Copy the connection string: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`
4. Put it in `backend/.env` as `DATABASE_URL=...`

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

### Find items without typing them (Find products)

The **🔍 Find products** tab does the typing for you. There is no AI and no API key
anywhere in it — it reads the stores' own pages and shows you what it found. It has two
modes, and both end in the same review grid where you press **Add** or **Remove** on each
card.

#### Mode 1 — Search the stores

Pick a category, type plain keywords (`cotton t shirt`), choose the stores, press
**Search**. Results appear as cards with the real title, price, MRP, discount, brand,
rating and image taken straight from the store's listing.

Which stores this works with is not up to us — each store decides whether it answers a
server:

| Store | Search from the server | Why |
|---|---|---|
| **Flipkart** | ✅ Works | Serves the full listing as HTML |
| **Amazon** | ⚠️ Sometimes | Often answers with a bot check and a note asking automated users to use their API instead |
| **Meesho** | ❌ No | Blocks servers outright, and renders results in the browser |

A store that will not answer is reported on its own row — *"Meesho: blocks server-side
search — use Paste links instead"* — so you are never left guessing whether your keywords
were bad. The other stores still return normally.

#### Mode 2 — Paste links (works everywhere)

This is the reliable one, and it covers every store including Amazon and Meesho.

1. Click the store link under the results (**Amazon ↗ · Flipkart ↗ · Meesho ↗**) — or just
   search the store in your own browser as usual.
2. Copy the links of the products you want.
3. Switch to **Paste links**, paste them one per line, press **Read links**.

The server opens each product page and reads the product data the store publishes in it —
the same structured data Google reads to show prices in search results. Title, price, MRP,
brand, rating and image come back filled in. Up to 25 links at a time.

This works because a *product* page is the page a store wants machines to read; a *search*
page is not.

#### Mode 3 — One-click add (the bookmarklet)

This is the answer to Amazon and Meesho, and it works on **all three** stores.

They refuse to serve their pages to a server, so the server can never read them. Your
browser, though, is already showing you the page. The bookmarklet runs there and reads the
product you are looking at — no request from this site to the store at all, so there is
nothing to block.

**Install it once:**

1. Admin → 🔍 Find products → **One-click add**.
2. Show your bookmarks bar (**Ctrl+Shift+B**).
3. Drag the blue **+ Add to DealDost** button onto the bar. (Dragging installs it —
   clicking it on this page just shows a reminder.)

**Then, to add anything:**

1. Browse Amazon, Flipkart or Meesho normally and open a product page.
2. Click **+ Add to DealDost** in your bookmarks bar.
3. It reads the title, price, MRP, image, rating and brand, and queues the product.
4. Repeat on as many products as you like — they collect in one tab, and the tab counter
   shows how many are waiting.
5. Come back to **One-click add**, check the cards, press **Add**.

It reads a page three ways, best first: the store's own structured product data, then
store-specific fields (Amazon's title/price/MRP/image elements, Meesho's rendered price),
then generic page tags. If a page defeats all three it says so rather than guessing.

Amazon links are cleaned up to a plain `amazon.in/dp/ASIN`, so all the tracking rubbish in
the address bar is stripped before it reaches your catalogue.

Everything the bookmarklet sends is re-checked on the server exactly like a search result —
being sent by your own browser does not make it trusted. In particular the **store is
decided by the link**, never by what the bookmarklet claims, because a link filed under the
wrong store gets the wrong affiliate tag and earns you nothing.

#### The review grid

Every card, from either mode, gives you:

- **Add / ✓ Added** — tick what you want. Added cards light up; the rest stay greyed out.
- **Edit** — fix the title, price, MRP, category, image or description before publishing.
- **Remove** — bin a result you do not want.
- **Open the product page ↗** — check the link before publishing.
- **Add N to my site** — publishes only the ticked ones.

Cards are labelled `already on site` (and start unticked) when a deal already points at
that product, so you cannot publish the same thing twice. Anything thrown away before you
saw it is listed under **"N results thrown away"** with the reason — a category page
instead of a product, a link to a site you cannot earn from, a duplicate, a missing price.

Prices and MRPs are checked for sanity: an MRP below the selling price is dropped, and a
discount too large to be plausible is flagged for you to confirm.

#### Still prefer typing it in?

The **Deals** tab's form is unchanged and always available — paste a link, fill in the
fields, done. The finder is a shortcut, not a replacement.

#### Worth knowing

- **Prices change constantly.** The finder records what the page said at that moment.
  Re-check anything important before publishing, and refresh your catalogue periodically.
- **On Render, expect Amazon to be blocked more often than on your own PC.** Stores treat
  datacenter addresses more suspiciously than home connections. Paste links is unaffected.
- **This reads public product pages; it is not an official data feed.** The stores' terms
  discourage automated access, and Amazon's block message points automated users at their
  Product Advertising API. If you get PA-API access (an approved Associates account with
  qualifying sales), that is the sanctioned way to get Amazon search results in-app — ask
  and it can be wired in as another source.
- The finder is deliberately unhurried: pages are cached for ten minutes, requests to the
  same store are spaced out, and searches are capped at 60 per ten minutes.
- Store layouts change. If one store suddenly returns nothing while others work, its
  parser needs updating — the per-store row will tell you which one.

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

**Why the database is not a file:** Render's free instances have an ephemeral filesystem —
*"without a persistent disk, any changes you make to a service's local files are lost every time
the service redeploys or restarts"* — and persistent disks are paid-only. A free instance also
sleeps after ~15 minutes idle and wakes into a fresh container, so a file-based database loses
every deal roughly daily. Neon Postgres lives outside the instance, so nothing is lost.

Free instances still sleep, which only means the first visit after idle takes ~40s. A free uptime
pinger (cron-job.org) hitting `/health` every 10 minutes avoids that.

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
├── schema.sql      users, deals, clicks, settings (PostgreSQL)
└── seed.js         admin user + default settings + 12 demo deals
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
| GET | `/api/admin/finder/status` | Which stores can be searched from the server |
| POST | `/api/admin/finder/search` | **Search** the stores — body `{ "query", "category", "stores", "limit" }`. Read-only |
| POST | `/api/admin/finder/resolve` | **Read** pasted product links — body `{ "urls", "category" }`. Read-only |
| POST | `/api/admin/finder/import` | **Accept** products read by the bookmarklet — body `{ "items", "category" }`. Vetted like any other source. Read-only |
| GET | `/api/admin/stats` | Dashboard + click analytics |
| GET/PUT | `/api/admin/settings` | Site name, tagline, affiliate IDs |

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `DATABASE_URL is missing` | Add your Neon connection string to `backend/.env` |
| `Could not reach Postgres` | Check the string is complete and ends with `?sslmode=require` |
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
