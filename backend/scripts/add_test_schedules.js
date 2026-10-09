require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addTestSchedules() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const doctorId = '28fd7121-7f97-433e-9d14-0ef6a669c3b7';
    
    console.log('Adding test schedules for doctor...');
    
    // Add weekly schedules
    await client.query(`
      INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active) 
      VALUES 
        ($1, 1, '09:00', '17:00', true),
        ($1, 3, '09:00', '17:00', true),
        ($1, 5, '09:00', '17:00', true)
      ON CONFLICT (doctor_id, day_of_week) DO UPDATE SET
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        is_active = true
    `, [doctorId]);
    console.log('✓ Added schedules for Mon, Wed, Fri (9 AM - 5 PM)');
    
    // Add break period for Monday Oct 13
    await client.query(`
      INSERT INTO doctor_break_periods (doctor_id, break_date, start_time, end_time, reason, is_active)
      VALUES ($1, '2026-10-13', '12:00', '13:00', 'Lunch break', true)
      ON CONFLICT (doctor_id, break_date, start_time, end_time) DO NOTHING
    `, [doctorId]);
    console.log('✓ Added break period for 2026-10-13 (12:00 - 13:00)');
    
    // Add unavailability for Wednesday Oct 15
    await client.query(`
      INSERT INTO doctor_unavailability (doctor_id, start_date, end_date, reason, is_active)
      VALUES ($1, '2026-10-15', '2026-10-15', 'Personal leave', true)
      ON CONFLICT DO NOTHING
    `, [doctorId]);
    console.log('✓ Added unavailability for 2026-10-15 (full day)');
    
    // Initialize daily capacities
    await client.query(`
      INSERT INTO daily_capacities (doctor_id, date, consultation_duration_minutes, calculated_capacity, final_capacity, registered_count)
      SELECT 
        $1,
        CURRENT_DATE + (n || ' days')::interval,
        30,
        16,
        16,
        0
      FROM generate_series(0, 29) AS n
      WHERE EXTRACT(DOW FROM (CURRENT_DATE + (n || ' days')::interval)) IN (1, 3, 5)
      ON CONFLICT (doctor_id, date) DO UPDATE SET
        calculated_capacity = EXCLUDED.calculated_capacity,
        final_capacity = EXCLUDED.final_capacity,
        registered_count = EXCLUDED.registered_count
    `, [doctorId]);
    console.log('✓ Initialized daily capacities for next 30 days');
    
    await client.query('COMMIT');
    console.log('\n✓ Test data added successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addTestSchedules();
