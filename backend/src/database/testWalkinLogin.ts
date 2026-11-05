import { query } from './connection';
import bcrypt from 'bcrypt';

async function testWalkinLogin() {
  try {
    // Test with the most recent walk-in account
    const email = 'gvoarq69164@10timer.com';
    const testPassword = 'TestPassword123!'; // You would need the actual temporary password

    console.log(`Testing login for walk-in account: ${email}\n`);

    // Find user
    const userResult = await query(
      `SELECT * FROM users
       WHERE (email = $1 OR username = $1)
       AND is_active = true`,
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log('User not found or inactive');
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log('User found:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Must Change Password: ${user.must_change_password}`);
    console.log(`  Active: ${user.is_active}`);
    console.log('');

    // Check if we can verify the password hash
    console.log('Password hash (first 50 chars):', user.password_hash.substring(0, 50));
    console.log('');

    // Test with a dummy password to see the error
    try {
      const isValid = await bcrypt.compare(testPassword, user.password_hash);
      console.log(`Password validation test: ${isValid ? 'Valid' : 'Invalid'}`);
    } catch (error) {
      console.log('Password comparison error:', error);
    }

    console.log('\nTo test actual login, you need the temporary password that was generated when the account was created.');
    console.log('The temporary password is only shown once to the secretary during account creation.');

    process.exit(0);
  } catch (error) {
    console.error('Error testing walk-in login:', error);
    process.exit(1);
  }
}

testWalkinLogin();
