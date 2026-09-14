import fs from 'fs';
import path from 'path';
import { query } from './connection';

const MIGRATIONS_DIR = path.join(__dirname, '../../database');

export async function runMigrations() {
  console.log('Starting database migrations...');

  try {
    // First, drop and recreate schema to ensure clean state
    console.log('Cleaning up existing schema...');
    await query('DROP SCHEMA IF EXISTS public CASCADE');
    await query('CREATE SCHEMA public');
    console.log('Schema cleaned successfully');

    // Read the initial schema file
    const schemaPath = path.join(MIGRATIONS_DIR, '001_initial_schema.sql');
    console.log('Reading schema from:', schemaPath);
    
    if (!fs.existsSync(schemaPath)) {
      console.error('Schema file not found:', schemaPath);
      throw new Error('Schema file not found');
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing initial schema...');
    await query(schemaSQL);
    console.log('Initial schema created successfully');

    // Skip sample data - using actual data instead
    console.log('Skipping sample data insertion (using actual data)');

    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}