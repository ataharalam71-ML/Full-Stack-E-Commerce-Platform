// Creates/updates the SQLite tables. Safe to re-run.
// Run with: npm run migrate
require('dotenv').config();
const { initSchema, DB_FILE } = require('../src/config/db');

try {
  initSchema();
  console.log(`Schema applied to ${DB_FILE}`);
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
}
