# Affiliate site — Frontend

React 18 + Vite + React Router. No UI framework — one hand-written stylesheet
(`src/index.css`) with CSS custom properties, so there is nothing to license or update.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built output locally |

`VITE_API_URL` (in `.env`) points at the backend, e.g. `http://localhost:5000/api`.

## Structure

```
src/
├── pages/
│   ├── Home.jsx          Storefront: hero, top picks, filters, search, pagination
│   ├── DealDetail.jsx    One deal + related deals
│   ├── Admin.jsx         Tabs: Deals / Bulk import / Analytics / Settings
│   ├── Login.jsx         Admin sign in
│   └── InfoPages.jsx     About, Contact, Affiliate Disclosure, Privacy
├── components/
│   ├── Navbar.jsx  Footer.jsx  DealCard.jsx  ProtectedRoute.jsx
│   └── admin/      DealForm, DealTable, BulkImport, Analytics, SettingsPanel
├── context/        AuthContext (admin session), SiteContext (branding + stores)
├── api.js          axios + JWT header + goUrl() + errMsg()
└── format.js       ₹ money, compact numbers, dates
```

## Two things worth knowing

**Buy buttons never link to the store directly.** `goUrl(deal.id)` builds
`<API host>/go/:id`, so the backend can count the click and attach your affiliate ID. Every
outbound link carries `target="_blank"` and `rel="nofollow sponsored noopener noreferrer"`,
which the affiliate programmes and Google both expect.

**The URL holds the filter state on the homepage.** `?q=`, `?store=`, `?category=`, `?sort=`
and `?page=` all live in the query string, so search results are shareable, the back button
works, and a category link is just a link.

## Editing the look

All colours, radii and shadows are custom properties at the top of `src/index.css` —
including the store brand colours (`--amazon`, `--flipkart`) used by the buy
buttons and badges. Change them there and the whole site follows.
