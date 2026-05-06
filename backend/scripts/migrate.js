/**
 * Migration runner — executes all pending SQL migrations in order.
 * Usage: node scripts/migrate.js
 *        node scripts/migrate.js --rollback   (not yet implemented)
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ         NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(client) {
  const res = await client.query('SELECT filename FROM _migrations ORDER BY id');
  return new Set(res.rows.map((r) => r.filename));
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ applied  ${file}`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ failed   ${file}:`, err.message);
        process.exit(1);
      }
    }

    if (count === 0) console.log('  All migrations already applied.');
    else console.log(`\n  ${count} migration(s) applied.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
