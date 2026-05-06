import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME ?? 'smart_mandi',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD,
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations(): Promise<void> {
  await client.connect();

  try {
    // Create migration tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    const appliedVersions = new Set(applied.map((r: { version: string }) => r.version));

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');

      if (appliedVersions.has(version)) {
        console.log(`✓ Already applied: ${version}`);
        continue;
      }

      console.log(`Applying migration: ${version}`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.log(`✓ Applied: ${version}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`✗ Failed: ${version}`, error);
        process.exit(1);
      }
    }

    console.log('All migrations complete.');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
