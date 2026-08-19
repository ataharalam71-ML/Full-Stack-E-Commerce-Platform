require('dotenv').config();

const app = require('./app');
const { initSchema, DB_FILE } = require('./config/db');
const { ensureAdmin, ensureDefaultSettings } = require('./utils/bootstrap');

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

// Schema + admin + settings are created on every boot if they are missing. That makes the
// first deploy work with no shell access, and survives a host wiping the disk on redeploy.
initSchema();
console.log(`SQLite database ready at ${DB_FILE}`);
ensureAdmin({ quiet: true });
ensureDefaultSettings({ quiet: true });

app.listen(PORT, () => {
  console.log(`Affiliate site API running on http://localhost:${PORT}`);
});
