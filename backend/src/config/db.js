// SQLite via Node's built-in `node:sqlite` module — no database server, no native
// build step, no paid service. The whole database is one file (db/affiliate.db).
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DB_FILE
  ? path.resolve(process.env.DB_FILE)
  : path.join(__dirname, '..', '..', 'db', 'affiliate.db');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON');

/** Applies db/schema.sql. Every statement is IF NOT EXISTS, so it is safe to re-run. */
function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
  db.exec(sql);
}

// node:sqlite only binds null | number | bigint | string | Uint8Array, so booleans and
// undefined (both common when they come straight off a JSON body) are normalised here.
function normalize(params) {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

// Rows come back with a null prototype; spread them so they behave like plain objects.
const plain = (row) => (row ? { ...row } : row);

function all(sql, ...params) {
  return db.prepare(sql).all(...normalize(params)).map(plain);
}

function get(sql, ...params) {
  return plain(db.prepare(sql).get(...normalize(params)));
}

function run(sql, ...params) {
  return db.prepare(sql).run(...normalize(params));
}

/** Runs fn inside a transaction, rolling back if it throws. */
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { db, DB_FILE, initSchema, all, get, run, transaction };
