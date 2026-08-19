// First-run setup shared by `npm run seed` and by server start-up.
//
// Running this on every boot matters for free hosting: those plans give you a disk that is
// wiped on redeploy, and no shell to run scripts in, so the admin account has to be able to
// recreate itself from environment variables.
const bcrypt = require('bcryptjs');
const { get, run } = require('../config/db');
const { setSetting } = require('./affiliate');

/**
 * Creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD if no admin exists yet.
 * Never touches an existing account, so a password you changed later is safe.
 */
function ensureAdmin({ quiet = false } = {}) {
  const email = (process.env.ADMIN_EMAIL || 'admin@dealdost.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const name = process.env.ADMIN_NAME || 'Site Owner';

  if (get('SELECT id FROM users WHERE email = ?', email)) {
    if (!quiet) console.log(`Admin already exists: ${email}`);
    return false;
  }

  run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    name,
    email,
    bcrypt.hashSync(password, 10)
  );

  console.log(`Admin account created: ${email}`);
  if (password === 'Admin@123') {
    console.warn('WARNING: the default password is in use. Change it before the site is public.');
  }
  return true;
}

/** Fills in site branding and affiliate IDs the first time only — admin edits always win. */
function ensureDefaultSettings({ quiet = false } = {}) {
  const defaults = {
    site_name: 'DealDost',
    site_tagline: 'Handpicked deals from Amazon, Flipkart & Meesho',
    contact_email: process.env.ADMIN_EMAIL || '',
    amazon_tag: process.env.AMAZON_TAG || '',
    flipkart_affid: process.env.FLIPKART_AFFID || '',
    meesho_tag: process.env.MEESHO_TAG || '',
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!get('SELECT key FROM settings WHERE key = ?', key)) setSetting(key, value);
  }
  if (!quiet) console.log('Default settings in place');
  return true;
}

module.exports = { ensureAdmin, ensureDefaultSettings };
