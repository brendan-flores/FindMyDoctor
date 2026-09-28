const bcrypt = require('bcryptjs');

// Generate a bcrypt hash for a new password
const password = process.argv[2] || 'YourNewPassword123';

bcrypt.hash(password, 10)
  .then(hash => {
    console.log('Password:', password);
    console.log('Bcrypt Hash:', hash);
    console.log('\nSQL to update password:');
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'adminsisiglovers@gmail.com';`);
  })
  .catch(err => {
    console.error('Error generating hash:', err);
  });
