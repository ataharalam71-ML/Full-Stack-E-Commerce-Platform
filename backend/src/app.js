const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const dealRoutes = require('./routes/deal.routes');
const adminRoutes = require('./routes/admin.routes');
const { siteInfo, sitemap, robots } = require('./controllers/site.controller');
const { clickThrough } = require('./controllers/deal.controller');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); // correct client IPs behind Render/Railway/Vercel proxies

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Product images are hosted by Amazon and Flipkart, not by us.
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", 'https:'],
      },
    },
  })
);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Login is the only brute-forceable endpoint, so it gets a tighter bucket.
app.use(
  '/api/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false })
);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/site', siteInfo);

// Outbound affiliate click: /go/12 -> logs the click -> 302 to the store with your tag.
app.get('/go/:id', clickThrough);
app.get('/sitemap.xml', sitemap);
app.get('/robots.txt', robots); // registered before express.static so it wins

// ── Single-origin mode ────────────────────────────────────────────────────────
// If the frontend has been built, serve it from this same server. One URL, one port,
// no CORS — which is what makes `cloudflared tunnel` or a single Render service work.
// Build it with VITE_API_URL=/api so the page calls this server back.
const DIST_DIR = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.join(__dirname, '..', '..', 'frontend', 'dist');

if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR, { maxAge: '1h', index: false }));

  // Any non-API path falls through to the SPA so /deal/... and /admin survive a refresh.
  app.get(/^\/(?!api\/|go\/|health$|sitemap\.xml$).*/, (req, res) =>
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  );
  console.log(`Serving the built frontend from ${DIST_DIR}`);
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
