require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addSampleQueueData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Adding sample queue data...');

    // Check if we have the specific doctor
    const doctorResult = await client.query(
      `SELECT id, first_name, last_name FROM doctors WHERE first_name ILIKE 'Roch' AND last_name ILIKE 'Balberona' AND approval_status = 'ACTIVE' LIMIT 1`
    );

    if (doctorResult.rows.length === 0) {
      console.log('Doctor "Roch Ahron Balberona" not found with exact match. Listing available doctors...');
      const allDoctors = await client.query(
        `SELECT id, first_name, last_name, approval_status FROM doctors LIMIT 10`
      );
      console.log('Available doctors:');
      allDoctors.rows.forEach(d => {
        console.log(`  - Dr. ${d.first_name} ${d.last_name} (${d.approval_status})`);
      });
      console.log('\nSelecting first doctor with "Roch" and "Balberona" in name...');
      
      const rochDoctorResult = await client.query(
        `SELECT id, first_name, last_name FROM doctors WHERE first_name ILIKE '%Roch%' AND last_name ILIKE '%Balberona%' AND approval_status = 'ACTIVE' LIMIT 1`
      );
      
      if (rochDoctorResult.rows.length === 0) {
        console.log('Dr. Roch Ahron Balberona not found. Using first active doctor instead.');
        const activeDoctorResult = await client.query(
          `SELECT id, first_name, last_name FROM doctors WHERE approval_status = 'ACTIVE' LIMIT 1`
        );
        
        if (activeDoctorResult.rows.length === 0) {
          console.error('No active doctor found. Please create a doctor account first.');
          await client.query('ROLLBACK');
          process.exit(1);
        }
        
        doctor = activeDoctorResult.rows[0];
      } else {
        doctor = rochDoctorResult.rows[0];
        console.log(`Found: Dr. ${doctor.first_name} ${doctor.last_name}`);
      }
    } else {
      doctor = doctorResult.rows[0];
    }
    
    console.log(`Using doctor: Dr. ${doctor.first_name} ${doctor.last_name}`);

    // Check if the secretary "Christel Jean Canumay" exists and is assigned to this doctor
    const secretaryResult = await client.query(
      `SELECT s.id, s.first_name, s.last_name, s.doctor_id, d.first_name as doctor_first_name, d.last_name as doctor_last_name
       FROM secretaries s
       JOIN doctors d ON s.doctor_id = d.id
       WHERE s.first_name ILIKE 'Christel' AND s.last_name ILIKE 'Canumay' AND s.is_approved = true
       LIMIT 1`
    );

    if (secretaryResult.rows.length > 0) {
      const secretary = secretaryResult.rows[0];
      console.log(`Found secretary: ${secretary.first_name} ${secretary.last_name}`);
      console.log(`Assigned to: Dr. ${secretary.doctor_first_name} ${secretary.doctor_last_name}`);
      
      if (secretary.doctor_id !== doctor.id) {
        console.log(`Note: Secretary is assigned to a different doctor. Queue will be created for Dr. ${doctor.first_name} ${doctor.last_name} anyway.`);
      }
    } else {
      console.log('Secretary "Christel Jean Canumay" not found or not approved. Queue will be created for the selected doctor.');
    }

    // Create test users for patients
    const testPatients = [
      { email: 'marcus.vance@example.com', firstName: 'Marcus', lastName: 'Vance' },
      { email: 'sarah.jenkins@example.com', firstName: 'Sarah', lastName: 'Jenkins' },
      { email: 'robert.davis@example.com', firstName: 'Robert', lastName: 'Davis' },
      { email: 'clara.higgins@example.com', firstName: 'Clara', lastName: 'Higgins' },
      { email: 'david.reynolds@example.com', firstName: 'David', lastName: 'Reynolds' },
    ];

    const patientIds = [];

    for (const patient of testPatients) {
      // Check if user exists
      let userResult = await client.query(
        `SELECT id FROM users WHERE email = $1`,
        [patient.email]
      );

      let userId;
      if (userResult.rows.length === 0) {
        // Create user
        const passwordHash = await bcrypt.hash('password123', 10);
        const newUserResult = await client.query(
          `INSERT INTO users (email, password_hash, role, is_active, must_change_password, email_verified)
           VALUES ($1, $2, 'PATIENT', true, false, true)
           RETURNING id`,
          [patient.email, passwordHash]
        );
        userId = newUserResult.rows[0].id;
        console.log(`Created user: ${patient.email}`);
      } else {
        userId = userResult.rows[0].id;
        console.log(`Using existing user: ${patient.email}`);
      }

      // Check if patient profile exists
      let patientResult = await client.query(
        `SELECT id FROM patients WHERE user_id = $1`,
        [userId]
      );

      let patientId;
      if (patientResult.rows.length === 0) {
        // Create patient profile
        const newPatientResult = await client.query(
          `INSERT INTO patients (user_id, first_name, last_name, date_of_birth)
           VALUES ($1, $2, $3, '1990-01-01')
           RETURNING id`,
          [userId, patient.firstName, patient.lastName]
        );
        patientId = newPatientResult.rows[0].id;
        console.log(`Created patient: ${patient.firstName} ${patient.lastName}`);
      } else {
        patientId = patientResult.rows[0].id;
        console.log(`Using existing patient: ${patient.firstName} ${patient.lastName}`);
      }

      patientIds.push(patientId);
    }

    // Delete existing queue entries for today
    await client.query(`DELETE FROM queue_entries WHERE queue_date = CURRENT_DATE`);
    console.log('Cleared existing queue entries for today');

    // Create queue entries with different statuses
    const queueEntries = [
      { queueNumber: 1, status: 'IN_CHECKUP', source: 'ONLINE', patientIndex: 0 },
      { queueNumber: 2, status: 'CALLED', source: 'WALK_IN', patientIndex: 1 },
      { queueNumber: 3, status: 'WAITING', source: 'ONLINE', patientIndex: 2 },
      { queueNumber: 4, status: 'WAITING', source: 'WALK_IN', patientIndex: 3 },
      { queueNumber: 5, status: 'WAITING', source: 'ONLINE', patientIndex: 4 },
    ];

    for (const entry of queueEntries) {
      const patientId = patientIds[entry.patientIndex];
      const createdMinutesAgo = entry.queueNumber * 10;
      
      await client.query(
        `INSERT INTO queue_entries (queue_date, queue_number, status, registration_source, patient_id, doctor_id, created_at, updated_at)
         VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, CURRENT_TIMESTAMP - INTERVAL '${createdMinutesAgo} minutes', CURRENT_TIMESTAMP)`,
        [entry.queueNumber, entry.status, entry.source, patientId, doctor.id]
      );

      // Update timestamps based on status
      if (entry.status === 'IN_CHECKUP') {
        await client.query(
          `UPDATE queue_entries SET started_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes' WHERE queue_number = $1`,
          [entry.queueNumber]
        );
      } else if (entry.status === 'CALLED') {
        await client.query(
          `UPDATE queue_entries SET called_at = CURRENT_TIMESTAMP - INTERVAL '15 minutes' WHERE queue_number = $1`,
          [entry.queueNumber]
        );
      }

      console.log(`Created queue entry Q-${entry.queueNumber}: ${entry.status} (${entry.source})`);
    }

    await client.query('COMMIT');
    
    console.log('\n✅ Sample queue data added successfully!');
    console.log(`Total queue entries: ${queueEntries.length}`);
    console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
    console.log(`Doctor: Dr. ${doctor.first_name} ${doctor.last_name}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addSampleQueueData();
