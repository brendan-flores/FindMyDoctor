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

    // Read the sample data file
    const sampleDataPath = path.join(MIGRATIONS_DIR, '002_sample_data.sql');
    console.log('Reading sample data from:', sampleDataPath);
    
    if (!fs.existsSync(sampleDataPath)) {
      console.warn('Sample data file not found, skipping...');
    } else {
      const sampleDataSQL = fs.readFileSync(sampleDataPath, 'utf8');

      console.log('Executing sample data...');
      await query(sampleDataSQL);
      console.log('Sample data inserted successfully');
    }

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