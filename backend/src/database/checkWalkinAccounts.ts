import { query } from './connection';

async function checkWalkinAccounts() {
  try {
    console.log('Checking for walk-in patient accounts...\n');

    const result = await query(
      `SELECT u.id, u.email, u.username, u.role, u.must_change_password, u.is_active, u.created_at,
              p.first_name, p.last_name
       FROM users u
       LEFT JOIN patients p ON u.id = p.user_id
       WHERE u.role = 'PATIENT' AND u.must_change_password = true
       ORDER BY u.created_at DESC
       LIMIT 10`
    );

    console.log(`Found ${result.rows.length} walk-in accounts requiring password change:\n`);

    if (result.rows.length === 0) {
      console.log('No walk-in accounts found with must_change_password = true');
    } else {
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. Email: ${row.email}`);
        console.log(`   Username: ${row.username}`);
        console.log(`   Name: ${row.first_name} ${row.last_name}`);
        console.log(`   Active: ${row.is_active}`);
        console.log(`   Created: ${row.created_at}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error checking walk-in accounts:', error);
    process.exit(1);
  }
}

checkWalkinAccounts();
