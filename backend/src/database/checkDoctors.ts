import { query } from './connection';

/**
 * Script to check for doctors in the database
 */

async function checkDoctors() {
  try {
    console.log('🔍 Checking for doctors in database...\n');

    // Count total doctors
    const countResult = await query('SELECT COUNT(*) as count FROM doctors');
    console.log(`Total doctors: ${countResult.rows[0].count}\n`);

    // Get all doctors with basic info
    const doctorsResult = await query(`
      SELECT
        d.id,
        d.first_name,
        d.last_name,
        d.specialty,
        d.approval_status,
        d.is_approved,
        d.practice_name,
        u.email
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      ORDER BY d.last_name
    `);

    if (doctorsResult.rows.length === 0) {
      console.log('❌ No doctors found in database');
    } else {
      console.log(`✅ Found ${doctorsResult.rows.length} doctor(s):\n`);
      doctorsResult.rows.forEach((doctor, index) => {
        console.log(`${index + 1}. ${doctor.first_name} ${doctor.last_name}`);
        console.log(`   Email: ${doctor.email}`);
        console.log(`   Specialty: ${doctor.specialty || 'Not set'}`);
        console.log(`   Practice: ${doctor.practice_name || 'Not set'}`);
        console.log(`   Status: ${doctor.approval_status} (Approved: ${doctor.is_approved})`);
        console.log('');
      });
    }

    // Check for unique specialties
    const specialtiesResult = await query(`
      SELECT DISTINCT specialty
      FROM doctors
      WHERE specialty IS NOT NULL AND specialty != ''
      ORDER BY specialty
    `);

    console.log(`📋 Unique specialties: ${specialtiesResult.rows.length}`);
    specialtiesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.specialty}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('💥 Error checking doctors:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  checkDoctors();
}

export { checkDoctors };
