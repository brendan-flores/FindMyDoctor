import fs from 'fs';
import path from 'path';
import { query } from './connection';

const MIGRATIONS_DIR = path.join(__dirname, '../../database');

export async function runMigrations(force = false) {
  console.log('Starting database migrations...');

  try {
    // Only drop schema if force flag is provided (for development/testing)
    if (force) {
      console.log('⚠️  Force mode enabled - dropping existing schema...');
      await query('DROP SCHEMA IF EXISTS public CASCADE');
      await query('CREATE SCHEMA public');
      console.log('Schema cleaned successfully');
    } else {
      // Check if schema already exists
      const schemaCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
        );
      `);
      
      if (schemaCheck.rows[0].exists) {
        console.log('⚠️  Schema already exists. Use force=true to reset.');
        console.log('Skipping schema creation to preserve existing data.');
        return;
      }
    }

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
  const force = process.argv.includes('--force');
  if (force) {
    console.log('⚠️  WARNING: Force mode enabled - this will drop existing schema!');
  }
  
  runMigrations(force)
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}