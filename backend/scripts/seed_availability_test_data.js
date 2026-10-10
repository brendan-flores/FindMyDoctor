const { query } = require('../dist/database/connection');

async function seedAvailabilityTestData() {
  console.log('Seeding availability test data...\n');

  try {
    // Check if we have any doctors
    const doctorsResult = await query('SELECT id, first_name, last_name FROM doctors LIMIT 1');
    
    if (doctorsResult.rows.length === 0) {
      console.log('✗ No doctors found. Please create a doctor first.');
      return;
    }

    const doctor = doctorsResult.rows[0];
    console.log(`✓ Using doctor: ${doctor.first_name} ${doctor.last_name} (ID: ${doctor.id})`);

    // Clear existing test data for this doctor
    await query('DELETE FROM doctor_schedules WHERE doctor_id = $1', [doctor.id]);
    await query('DELETE FROM doctor_break_periods WHERE doctor_id = $1', [doctor.id]);
    await query('DELETE FROM doctor_unavailability WHERE doctor_id = $1', [doctor.id]);
    await query('DELETE FROM daily_capacities WHERE doctor_id = $1', [doctor.id]);
    console.log('✓ Cleared existing test data');

    // Add weekly schedules (Monday, Wednesday, Friday: 9 AM - 5 PM)
    const schedules = [
      { day: 1, start: '09:00', end: '17:00' }, // Monday
      { day: 3, start: '09:00', end: '17:00' }, // Wednesday
      { day: 5, start: '09:00', end: '17:00' }, // Friday
    ];

    for (const schedule of schedules) {
      await query(
        'INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active) VALUES ($1, $2, $3, $4, true)',
        [doctor.id, schedule.day, schedule.start, schedule.end]
      );
    }
    console.log('✓ Added weekly schedules (Mon, Wed, Fri: 9 AM - 5 PM)');

    // Add a break period for today
    const today = new Date().toISOString().split('T')[0];
    await query(
      'INSERT INTO doctor_break_periods (doctor_id, break_date, start_time, end_time, reason, is_active) VALUES ($1, $2, $3, $4, $5, true)',
      [doctor.id, today, '12:00', '13:00', 'Lunch break']
    );
    console.log(`✓ Added break period for ${today} (12:00 - 13:00)`);

    // Add a full-day unavailability for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await query(
      'INSERT INTO doctor_unavailability (doctor_id, start_date, end_date, reason, is_active) VALUES ($1, $2, $3, $4, true)',
      [doctor.id, tomorrowStr, tomorrowStr, 'Personal leave']
    );
    console.log(`✓ Added unavailability for ${tomorrowStr} (full day)`);

    // Initialize daily capacities for the next 30 days
    const capacityInserts = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      
      // Only add capacity for working days (Mon, Wed, Fri)
      if ([1, 3, 5].includes(dayOfWeek)) {
        // 8 hours = 480 minutes, 30 min per slot = 16 slots
        capacityInserts.push(
          query(
            'INSERT INTO daily_capacities (doctor_id, date, consultation_duration_minutes, calculated_capacity, final_capacity, registered_count) VALUES ($1, $2, 30, 16, 16, 0)',
            [doctor.id, dateStr]
          )
        );
      }
    }
    
    await Promise.all(capacityInserts);
    console.log('✓ Initialized daily capacities for next 30 days');

    console.log('\n✓ Test data seeded successfully!');
    console.log('\nYou can now test the availability endpoint:');
    console.log('  node test_availability.js');

  } catch (error) {
    console.error('✗ Error seeding test data:', error);
  } finally {
    process.exit(0);
  }
}

seedAvailabilityTestData();
