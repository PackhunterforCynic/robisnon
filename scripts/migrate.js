#!/usr/bin/env node
/**
 * Standalone Database Migration Script
 * Usage: DATABASE_URL="postgresql://..." node scripts/migrate.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable is not defined.');
  console.error('Usage: DATABASE_URL="postgresql://user:pass@host:5432/db" node scripts/migrate.js');
  process.exit(1);
}

const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
});

async function run() {
  console.log('🔄 Connecting to PostgreSQL database...');
  const client = await pool.connect();
  try {
    const schemaPath = path.join(__dirname, '..', 'api', 'lib', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📦 Executing schema migrations...');
    await client.query(sql);

    console.log('✅ All database tables, indexes, and initial settings successfully created!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

