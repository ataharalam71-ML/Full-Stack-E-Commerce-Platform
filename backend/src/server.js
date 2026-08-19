require('dotenv').config();

const app = require('./app');
const { initSchema, DB_FILE, get } = require('./config/db');

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

initSchema();
console.log(`SQLite database ready at ${DB_FILE}`);

if (!get('SELECT id FROM users LIMIT 1')) {
  console.warn('No admin user yet — run "npm run seed" to create one.');
}

app.listen(PORT, () => {
  console.log(`Affiliate site API running on http://localhost:${PORT}`);
});
