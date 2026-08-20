// PostgreSQL data layer. Hosted free on Neon (or any Postgres) so the catalogue
// survives restarts - a plain file cannot, because free hosts give you an ephemeral disk.
//
// Queries keep using "?" placeholders and are rewritten to $1..$n here, so the SQL in the
// controllers reads the same as it always did.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const CONNECTION_STRING = process.env.DATABASE_URL;

if (!CONNECTION_STRING) {
  console.error(
    'DATABASE_URL is missing. Create a free Postgres database at https://neon.tech,\n' +
      'then put its connection string in backend/.env as DATABASE_URL=postgresql://...'
  );
  process.exit(1);
}

// Neon, Render and Supabase all require TLS; a local postgres normally does not.
const isLocal = /@(localhost|127\.0\.0\.1)/.test(CONNECTION_STRING);

// TLS is configured below, so drop any sslmode from the URL — pg 8.16+ prints a
// deprecation warning about how it interprets that parameter.
function withoutSslMode(connectionString) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return connectionString;
  }
}

const pool = new Pool({
  connectionString: withoutSslMode(CONNECTION_STRING),
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5, // free Postgres tiers cap connections; the API is not concurrency-hungry
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  // A dropped idle connection is normal on serverless Postgres - the pool reconnects.
  console.error('Postgres pool error:', err.message);
});

/** Rewrites "?" placeholders into Postgres "$n" form. */
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// pg binds JS types directly, but booleans need to become 0/1 for our SMALLINT columns,
// and undefined (common from a JSON body) is not a value pg can send.
function normalize(params) {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

async function all(sql, ...params) {
  const { rows } = await pool.query(toPg(sql), normalize(params));
  return rows;
}

async function get(sql, ...params) {
  const { rows } = await pool.query(toPg(sql), normalize(params));
  return rows[0];
}

/** Returns { changes, rows } - add RETURNING id to an INSERT to read the new id. */
async function run(sql, ...params) {
  const result = await pool.query(toPg(sql), normalize(params));
  return { changes: result.rowCount, rows: result.rows };
}

/**
 * Runs fn inside a transaction on a single connection. fn receives { all, get, run }
 * bound to that connection - use those, not the module-level helpers.
 */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = {
      all: async (sql, ...p) => (await client.query(toPg(sql), normalize(p))).rows,
      get: async (sql, ...p) => (await client.query(toPg(sql), normalize(p))).rows[0],
      run: async (sql, ...p) => {
        const r = await client.query(toPg(sql), normalize(p));
        return { changes: r.rowCount, rows: r.rows };
      },
    };
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Applies db/schema.sql. Every statement is idempotent, so it is safe to re-run. */
async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

/** Fails fast at start-up with a clear message instead of on the first request. */
async function ping() {
  const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
  return rows[0];
}

module.exports = { pool, initSchema, ping, all, get, run, transaction };
