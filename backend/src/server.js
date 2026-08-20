require('dotenv').config();

const app = require('./app');
const { initSchema, ping } = require('./config/db');
const { ensureAdmin, ensureDefaultSettings } = require('./utils/bootstrap');

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

async function start() {
  try {
    const info = await ping();
    console.log(`Connected to Postgres database "${info.db}"`);
  } catch (err) {
    console.error('Could not reach Postgres:', err.message);
    console.error('Check DATABASE_URL in your environment (see .env.example).');
    process.exit(1);
  }

  // Tables, admin account and settings are created if missing on every boot, so a fresh
  // deploy needs no shell access. Deals are never auto-created — they are your data.
  await initSchema();
  await ensureAdmin({ quiet: true });
  await ensureDefaultSettings({ quiet: true });

  app.listen(PORT, () => {
    console.log(`Affiliate site API running on http://localhost:${PORT}`);
  });
}

start();
