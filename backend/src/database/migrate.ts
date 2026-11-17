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
 * consolidated_schema.sql is the bootstrap, not a normal incremental migration.
 *
 * The historical migrations were written to be run once, by hand, against a
 * schema that was known at the time. Several of them are destructive
 * (004_clear_all_data), insert sample/test data, or add constraints and
 * triggers without idempotency guards. Running them again against an existing
 * database would either fail or damage data.
 *
 * The consolidated migration is a complete, idempotent description of the
 * schema the application expects through 048_consultation_workspace.sql. It
 * must be applied FIRST so that a fresh, empty database gains the base tables
 * that the incremental files alter. Files 001-041 are therefore recorded as
 * "baselined" (never executed by this runner). Files 042-048 are recorded as
 * "covered" by the bootstrap, because their end state is already part of
 * consolidated_schema.sql and replaying them is not safe (for example,
 * 045_billing_fk_reconcile.sql renames columns that the bootstrap already
 * created with their final names).
 *
 * Files themselves are preserved for history, and future migrations (049+)
 * continue to run normally after the bootstrap.
 */
const CONSOLIDATED_VERSION = '042';
const COVERED_THROUGH_VERSION = '048';
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
  const numberedMigrations = entries
    .filter((filename) => /^\d{3}_.+\.sql$/i.test(filename))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => ({
      version: filename.slice(0, 3),
      filename,
      filepath: path.join(MIGRATIONS_DIR, filename),
    }));

  // Add consolidated_schema.sql as a special migration (no numeric prefix)
  const consolidatedFilename = 'consolidated_schema.sql';
  const consolidatedPath = path.join(MIGRATIONS_DIR, consolidatedFilename);
  if (fs.existsSync(consolidatedPath)) {
    numberedMigrations.push({
      version: CONSOLIDATED_VERSION, // Use '042' as the version for tracking
      filename: consolidatedFilename,
      filepath: consolidatedPath,
    });
  }

  return numberedMigrations;
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
 * Applies one migration file inside its own transaction and records it.
 */
async function applyMigrationFile(client: any, migration: Migration): Promise<number> {
  const content = fs.readFileSync(migration.filepath, 'utf8');
  const startedAt = Date.now();

  await client.query('BEGIN');
  try {
    await client.query(content);
    const duration = Date.now() - startedAt;
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (filename, version, checksum, execution_time_ms, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [migration.filename, migration.version, checksum(content), duration, null]
    );
    await client.query('COMMIT');
    return duration;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * Records files that must never be executed by this runner because
 * consolidated_schema.sql already describes their end state:
 *   - legacy 001-041: destructive / sample-data / non-idempotent
 *   - covered 042-048: folded into the bootstrap itself
 */
async function recordSupersededMigrations(
  client: any,
  migrations: Migration[],
  applied: Map<string, AppliedMigration>,
  dryRun: boolean
): Promise<{ legacy: string[]; covered: string[] }> {
  const superseded = migrations.filter((m) => m.filename !== CONSOLIDATED_FILENAME);

  const legacy = superseded.filter((m) => m.version < CONSOLIDATED_VERSION);
  const covered = superseded.filter(
    (m) => m.version >= CONSOLIDATED_VERSION && m.version <= COVERED_THROUGH_VERSION
  );

  const missingLegacy = legacy.filter((m) => !applied.has(m.filename));
  const missingCovered = covered.filter((m) => !applied.has(m.filename));

  if (dryRun) {
    if (missingLegacy.length > 0) {
      console.log(
        `[dry-run] Would baseline ${missingLegacy.length} legacy migration(s) (001-041).`
      );
    }
    if (missingCovered.length > 0) {
      console.log(
        `[dry-run] Would record ${missingCovered.length} migration(s) 042-048 as covered by the bootstrap.`
      );
    }
    return {
      legacy: missingLegacy.map((m) => m.filename),
      covered: missingCovered.map((m) => m.filename),
    };
  }

  if (missingLegacy.length > 0) {
    console.log(
      `Baselining ${missingLegacy.length} legacy migration(s) (001-041, superseded by the consolidated schema)...`
    );
  }
  if (missingCovered.length > 0) {
    console.log(
      `Recording ${missingCovered.length} migration(s) 042-048 as covered by the consolidated bootstrap...`
    );
  }

  await client.query('BEGIN');
  try {
    for (const migration of missingLegacy) {
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

    for (const migration of missingCovered) {
      const content = fs.readFileSync(migration.filepath, 'utf8');
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename, version, checksum, execution_time_ms, note)
         VALUES ($1, $2, $3, 0, $4)
         ON CONFLICT (filename) DO NOTHING`,
        [
          migration.filename,
          migration.version,
          checksum(content),
          'Covered by consolidated_schema.sql bootstrap; file preserved for history',
        ]
      );
      console.log(`  covered  ${migration.filename}`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return {
    legacy: missingLegacy.map((m) => m.filename),
    covered: missingCovered.map((m) => m.filename),
  };
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

  const consolidated = migrations.find((m) => m.filename === CONSOLIDATED_FILENAME);
  if (!consolidated) {
    throw new Error(
      `Required consolidated bootstrap (${CONSOLIDATED_FILENAME}) is missing from ${MIGRATIONS_DIR}`
    );
  }

  const client = await pool.connect();
  let appliedCount = 0;
  let skippedCount = 0;
  let baselinedCount = 0;
  let coveredCount = 0;

  try {
    if (!dryRun) {
      await ensureMigrationsTable(client);
    }
    let applied = await loadApplied(client);

    // Keep an in-memory view for dry runs, where nothing is written.
    const recorded = new Set(applied.keys());

    // 1. Bootstrap first. On an existing database this is a no-op thanks to
    //    the idempotent guards in the consolidated file.
    if (!recorded.has(CONSOLIDATED_FILENAME)) {
      console.log(`Applying ${CONSOLIDATED_FILENAME} (bootstrap)...`);
      if (dryRun) {
        console.log(`  [dry-run] ${CONSOLIDATED_FILENAME} would be applied`);
        recorded.add(CONSOLIDATED_FILENAME);
      } else {
        const duration = await applyMigrationFile(client, consolidated);
        recorded.add(CONSOLIDATED_FILENAME);
        console.log(`  applied ${CONSOLIDATED_FILENAME} in ${duration}ms`);
        // Reload so checksum comparison and skip counts use persisted rows.
        applied = await loadApplied(client);
      }
      appliedCount += 1;
    } else {
      console.log(`Skipping ${CONSOLIDATED_FILENAME} (already recorded).`);
      skippedCount += 1;
    }

    // 2. Record 001-041 as baselined and 042-048 as covered by the bootstrap.
    //    Neither group is ever executed.
    const superseded = await recordSupersededMigrations(client, migrations, applied, dryRun);
    baselinedCount = superseded.legacy.length;
    coveredCount = superseded.covered.length;
    for (const filename of [...superseded.legacy, ...superseded.covered]) {
      recorded.add(filename);
    }

    // 3. Apply anything not covered by the bootstrap (future migrations).
    for (const migration of migrations) {
      if (migration.filename === CONSOLIDATED_FILENAME) {
        continue;
      }

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

      if (recorded.has(migration.filename)) {
        // Baselined or covered earlier in this run; never executed.
        continue;
      }

      console.log(`Applying ${migration.filename}...`);
      if (dryRun) {
        console.log(`  [dry-run] ${migration.filename} would be applied`);
        recorded.add(migration.filename);
        appliedCount += 1;
        continue;
      }

      try {
        const duration = await applyMigrationFile(client, migration);
        recorded.add(migration.filename);
        appliedCount += 1;
        console.log(`  applied ${migration.filename} in ${duration}ms`);
      } catch (error: any) {
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
  console.log(`  baselined: ${baselinedCount} (legacy 001-041, superseded by consolidated schema)`);
  console.log(`  covered:   ${coveredCount} (042-048, folded into consolidated schema)`);
  console.log(`  pending:   0`);
  if (dryRun) {
    console.log('Dry run: no changes were written.');
  }
  console.log('Migrations completed successfully.');

  return { appliedCount, skippedCount, baselinedCount, coveredCount };
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
