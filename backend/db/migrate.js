// Creates/updates the Postgres tables. Safe to re-run.
// Run with: npm run migrate
require('dotenv').config();
const { initSchema, ping, pool } = require('../src/config/db');

(async () => {
  try {
    const info = await ping();
    await initSchema();
    console.log(`Schema applied to Postgres database "${info.db}"`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
