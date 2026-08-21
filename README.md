# DealDost — Affiliate Marketing Website (Amazon · Flipkart · Meesho)

A complete, working affiliate/deals website. You publish product deals, visitors click
**Buy on Amazon / Flipkart / Meesho**, and every click is tagged with your affiliate ID and
counted — so you earn commission and can see which deals actually work.

You **add and remove items yourself** from a built-in admin panel — by hand, or by letting the
**AI finder** search the stores and propose deals you approve one by one. No coding needed
after setup.

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
| Adding items with AI *(optional)* | **Groq** — searches the stores and proposes deals you approve (Claude also supported) | Free, no card |
| Amazon commission | Amazon Associates India | Free to join |
| Flipkart commission | Flipkart Affiliate, or EarnKaro | Free to join |
| Meesho commission | Meesho partner programme, or EarnKaro / INRDeals | Free to join |

No Docker, no Redis, no payment gateway, no paid API keys. Even the **AI finder**
(Admin → ✨ AI finder), which searches the stores and proposes deals for you to approve, runs
on Groq's free tier — no credit card. Leave its API key blank and the tab simply stays off.

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

### Let the AI find items for you (AI finder)

The **✨ AI finder** tab does the searching for you. Pick a category, type what you want
(`t shirt`, `running shoes under 2000`, `boAt earbuds`), choose which stores to search, and
press **Find products**. It runs real web searches against Amazon, Flipkart and Meesho and
comes back with a grid of suggestions.

**Nothing goes on your site until you say so.** Every suggestion is a card you either
approve or throw away:

- **Approve / ✓ Approved** — tick the ones you want. Approved cards light up; the rest stay
  greyed out.
- **Edit** — fix the title, price, MRP, category, image or description before it goes live.
- **Remove** — bin a suggestion you do not want.
- **Open the real product page ↗** — check the link actually works before approving. Worth
  doing for anything marked *low confidence*.
- **Add N to my site** — publishes only the approved ones.

Each card is labelled so you can judge it at a glance:

| Label | Meaning |
|---|---|
| `high confidence` | It saw this exact product page and its price |
| `medium confidence` | Page confirmed, the price may have moved since |
| `low confidence` | Unsure about the link or the price — open it before approving |
| `already on site` | You already have a deal pointing at this product. Starts unticked |

It also tells you how many results it **threw away before you saw them** and why — search
pages, links to sites you cannot earn from, duplicates, missing prices. Expand that line if
a search comes back thinner than you expected.

**Switching it on (Render + GitHub — no local files to edit).** The finder needs one API
key. You have two choices:

| | Free tier | Cost | Quality |
|---|---|---|---|
| **Groq** *(recommended)* | Yes — no credit card | Free | Good |
| **Claude** | No | ~a few cents per search | Better |

**Get a free Groq key (2 minutes):**

1. Go to **https://console.groq.com** and sign in with Google or GitHub. No card is asked for.
2. Open **API Keys** → **Create API Key**, name it `dealdost`, and **copy it now** — Groq
   shows it once. It starts with `gsk_`.

**Add it to Render:**

1. Render dashboard → your **dealdost** service → **Environment** in the left sidebar.
2. **Add Environment Variable**:
   - Key: `GROQ_API_KEY`
   - Value: paste the `gsk_...` key
3. **Save changes**. Render redeploys by itself — about a minute. When it goes live, reload
   your site, sign in, and **Admin → ✨ AI finder** is ready.

That is the whole job. Your key lives only in Render's environment settings — it is never in
your GitHub repo, and you never touch `.env` on your PC. `.env` is in `.gitignore` and stays
that way; that file is only for running the site locally.

> **Never paste an API key into a file you commit.** If a key ever lands in a commit, treat
> it as public: delete it in the Groq console, create a new one, and update Render. Rotating
> a key is free and takes a minute.

**To use Claude instead**, add `ANTHROPIC_API_KEY` in the same place instead of
`GROQ_API_KEY`. If you set both, Groq wins because it is free — add `AI_PROVIDER=anthropic`
to override that.

**Pushing this update to GitHub.** From the project folder:

```powershell
cd "C:\Users\ataha\Desktop\ecommerce-app"
git add .
git commit -m "Add the AI finder (Groq or Claude)"
git push
```

If Render is connected to your GitHub repo it deploys the push automatically. You can add
`GROQ_API_KEY` before or after pushing — until the key is there, the tab just explains how
to add it.

**Worth knowing:**

- Prices and stock change constantly. The finder records the price it saw; check anything
  that matters before publishing, and re-check your catalogue periodically.
- Links are only accepted if they point at an actual product page on a store you can earn
  from — the same check `/go/:id` enforces. A made-up link cannot reach your site.
- If no product image was found, a placeholder is used. Paste a real image URL in **Edit**
  for a better-looking card.
- Searches are capped at 20 per 10 minutes. On Groq's free tier the underlying limits are
  about 30 requests/minute and 250 searches/day — generous for adding deals by hand, and
  you are told plainly if you hit them.
- Groq works by searching first (`groq/compound`) and then formatting what it found
  (`openai/gpt-oss-120b`). The formatting step has no web access at all, so it cannot
  invent a product — it can only reshape what the search actually returned.

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
| GET | `/api/admin/ai/status` | Which AI provider is active, or which key to add |
| POST | `/api/admin/ai/suggest` | **Suggest** deals to approve — body `{ "query", "category", "stores", "count" }`. Read-only: writes nothing |
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
