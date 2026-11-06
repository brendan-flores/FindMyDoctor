import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config';
import { pool } from './connection';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../../database');

/**
 * Everything below 042 is superseded by consolidated_schema.sql.
 *
 * The historical migrations were written to be run once, by hand, against a
 * schema that was known at the time. Several of them are destructive
 * (004_clear_all_data), insert sample/test data, or add constraints and
 * triggers without idempotency guards. Running them again against an existing
 * database would either fail or damage data.
 *
 * The consolidated migration is a complete, idempotent description of the
 * schema the application expects. Legacy files are therefore recorded as
 * "baselined" (never executed by this runner) and the consolidated migration
 * is applied on top. The files themselves are preserved for history.
 */
const CONSOLIDATED_VERSION = '042';
const CONSOLIDATED_FILENAME = 'consolidated_schema.sql';
const MIGRATIONS_TABLE = 'schema_migrations';

type Migration = {
  version: string;
  filename: string;
  filepath: string;
};

type AppliedMigration = {
  version: string;
  filename: string;
  checksum: string;
  note: string | null;
};

function discoverMigrations(): Migration[] {
  const entries = fs.readdirSync(MIGRATIONS_DIR);
  return entries
    .filter((filename) => /^\d{3}_.+\.sql$/i.test(filename))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => ({
      version: filename.slice(0, 3),
      filename,
      filepath: path.join(MIGRATIONS_DIR, filename),
    }));
}

function checksum(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function ensureMigrationsTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      filename VARCHAR(255) PRIMARY KEY,
      version VARCHAR(16) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER,
      note TEXT
    );
  `);
}

async function loadApplied(client: any): Promise<Map<string, AppliedMigration>> {
  const exists = await client.query(
    `SELECT to_regclass($1) AS present`,
    [`public.${MIGRATIONS_TABLE}`]
  );
  if (!exists.rows[0]?.present) {
    return new Map<string, AppliedMigration>();
  }

  const result = await client.query(
    `SELECT filename, version, checksum, note FROM ${MIGRATIONS_TABLE}`
  );
  const applied = new Map<string, AppliedMigration>();
  for (const row of result.rows) {
    applied.set(row.filename, row);
  }
  return applied;
}

function databaseLabel(): string {
  if (config.database.url) {
    // Never print credentials: show only the database name portion.
    try {
      const parsed = new URL(config.database.url);
      return `${parsed.pathname.replace(/^\//, '') || '(unknown)'} @ ${parsed.hostname}`;
    } catch {
      return '(configured via DATABASE_URL)';
    }
  }
  return `${config.database.name} @ ${config.database.host}:${config.database.port}`;
}

/**
 * Legacy migrations are recorded, never executed. The consolidated migration
 * (042) is a full, idempotent superset of everything that came before it.
 */
async function baselineLegacyMigrations(
  client: any,
  migrations: Migration[],
  applied: Map<string, AppliedMigration>,
  dryRun: boolean
): Promise<string[]> {
  const legacy = migrations.filter((m) => m.version < CONSOLIDATED_VERSION);
  const missing = legacy.filter((m) => !applied.has(m.filename));
  if (missing.length === 0) {
    return [];
  }

  if (dryRun) {
    console.log(
      `[dry-run] Would baseline ${missing.length} legacy migration(s) as already applied.`
    );
    return missing.map((m) => m.filename);
  }

  console.log(
    `Baselining ${missing.length} legacy migration(s) that are superseded by the consolidated schema...`
  );

  for (const migration of missing) {
    const content = fs.readFileSync(migration.filepath, 'utf8');
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (filename, version, checksum, execution_time_ms, note)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (filename) DO NOTHING`,
      [
        migration.filename,
        migration.version,
        checksum(content),
        'Baselined: pre-consolidated schema; superseded by consolidated_schema.sql',
      ]
    );
    console.log(`  baselined ${migration.filename}`);
  }

  console.log('Legacy migrations baselined (files preserved, not executed).');
  return missing.map((m) => m.filename);
}

async function verifyRequiredSchema(client: any) {
  const requiredColumns = [
    { table: 'patients', column: 'middle_name' },
    { table: 'patients', column: 'sex' },
  ];
  const requiredTables = ['patient_doctor_associations', 'waitlists', 'schema_migrations'];

  const problems: string[] = [];

  for (const item of requiredColumns) {
    const result = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
       ) AS present`,
      [item.table, item.column]
    );
    if (!result.rows[0].present) {
      problems.push(`missing column ${item.table}.${item.column}`);
    }
  }

  for (const table of requiredTables) {
    const result = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1 AND table_type = 'BASE TABLE'
       ) AS present`,
      [table]
    );
    if (!result.rows[0].present) {
      problems.push(`missing table ${table}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Schema verification failed after migrations:\n  - ${problems.join('\n  - ')}`
    );
  }
  console.log('Schema verification passed (required columns and tables present).');
}

export async function runMigrations(options: { dryRun?: boolean } = {}) {
  const dryRun = Boolean(options.dryRun);
  const migrations = discoverMigrations();

  console.log('Starting database migrations.');
  console.log(`Target database: ${databaseLabel()} (NODE_ENV=${config.app.env})`);
  console.log(`Migrations directory: ${MIGRATIONS_DIR}`);

  if (migrations.length === 0) {
    throw new Error(`No numbered migration files found in ${MIGRATIONS_DIR}`);
  }
  if (!migrations.some((m) => m.version === CONSOLIDATED_VERSION)) {
    throw new Error(
      `Required consolidated migration (${CONSOLIDATED_VERSION}_*) is missing from ${MIGRATIONS_DIR}`
    );
  }

  const client = await pool.connect();
  let appliedCount = 0;
  let skippedCount = 0;
  let baselinedCount = 0;

  try {
    if (!dryRun) {
      await ensureMigrationsTable(client);
    }
    await client.query('BEGIN');
    const baselinedFilenames: string[] = await baselineLegacyMigrations(
      client,
      migrations,
      await loadApplied(client),
      dryRun
    );
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    baselinedCount = baselinedFilenames.length;

    // Re-read after baselining so the loop sees the newly recorded rows. In a
    // dry run nothing was written, so treat the reported baselines as applied.
    const applied = await loadApplied(client);
    for (const filename of baselinedFilenames) {
      if (!applied.has(filename)) {
        applied.set(filename, {
          filename,
          version: filename.slice(0, 3),
          checksum: checksum(fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8')),
          note: 'baselined',
        });
      }
    }

    for (const migration of migrations) {
      const content = fs.readFileSync(migration.filepath, 'utf8');
      const existing = applied.get(migration.filename);

      if (existing) {
        if (existing.checksum !== checksum(content)) {
          console.warn(
            `WARNING: ${migration.filename} has changed since it was recorded ` +
              `(recorded ${existing.checksum.slice(0, 12)}, current ${checksum(content).slice(0, 12)}). ` +
              'The change will NOT be re-applied automatically.'
          );
        }
        skippedCount += 1;
        continue;
      }

      console.log(`Applying ${migration.filename}...`);
      if (dryRun) {
        console.log(`  [dry-run] ${migration.filename} would be applied`);
        appliedCount += 1;
        continue;
      }

      const startedAt = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(content);
        const duration = Date.now() - startedAt;
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (filename, version, checksum, execution_time_ms, note)
           VALUES ($1, $2, $3, $4, $5)`,
          [migration.filename, migration.version, checksum(content), duration, null]
        );
        await client.query('COMMIT');
        appliedCount += 1;
        console.log(`  applied ${migration.filename} in ${duration}ms`);
      } catch (error: any) {
        await client.query('ROLLBACK');
        console.error(`  FAILED ${migration.filename}: ${error?.message || error}`);
        throw error;
      }
    }

    if (!dryRun) {
      await verifyRequiredSchema(client);
    }
  } finally {
    client.release();
  }

  console.log('');
  console.log('Migration summary:');
  console.log(`  applied:   ${appliedCount}`);
  console.log(`  skipped:   ${skippedCount} (already recorded)`);
  console.log(`  baselined: ${baselinedCount} (legacy, superseded by consolidated schema)`);
  console.log(`  pending:   0`);
  if (dryRun) {
    console.log('Dry run: no changes were written.');
  }
  console.log('Migrations completed successfully.');

  return { appliedCount, skippedCount, baselinedCount };
}

const normalizePath = (p: string) =>
  process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p);

const isDirectExecution =
  process.argv[1] && normalizePath(process.argv[1]) === normalizePath(__filename);

if (isDirectExecution) {
  const dryRun = process.argv.includes('--dry-run');

  if (process.argv.includes('--force')) {
    console.error(
      'Refusing to run with --force: this migration runner never drops the schema or deletes data.\n' +
        'If you truly need to rebuild a database, do it manually on a non-production target.'
    );
    process.exit(2);
  }

  runMigrations({ dryRun })
    .then(() => {
      return pool.end();
    })
    .then(() => {
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Migration process failed:', error);
      try {
        await pool.end();
      } catch {
        /* ignore */
      }
      process.exit(1);
    });
}
