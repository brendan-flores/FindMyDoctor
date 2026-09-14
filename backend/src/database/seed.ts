import { seedAdmin } from './seedAdmin';

/**
 * Main seed script
 * This script seeds the database with initial data
 */

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Seed initial Admin account
    await seedAdmin();

    console.log('🎉 Database seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Database seed failed:', error);
    process.exit(1);
  }
}

// Run seed if executed directly
if (require.main === module) {
  seed();
}
