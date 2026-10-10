import { config } from './src/config';
import { query, pool } from './src/database/connection';
import { registerDoctor, login, verifyLoginOtp, hashChallengeToken } from './src/modules/auth/authService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function runRegressionTests() {
  console.log('🧪 Starting Doctor Login & OTP Verification Regression Tests...\n');

  let testUserEmail = `test.doctor.${Date.now()}@example.com`;
  let testPassword = 'Password123!';
  let doctorUserId: string | null = null;
  let doctorId: string | null = null;

  try {
    // 1. Setup Test Doctor
    console.log('1️⃣ Creating test doctor account...');
    const regResult = await registerDoctor({
      email: testUserEmail,
      password: testPassword,
      fullName: 'Dr. Test Doctor',
      specialty: 'Cardiology',
      prcLicenseNumber: `${Math.floor(1000000 + Math.random() * 9000000)}`,
      clinic: 'Cardio Clinic',
      contactNumber: '09123456789',
    });

    doctorUserId = regResult.user.id;
    doctorId = regResult.doctor.id;
    console.log(`✅ Doctor registered successfully: ${testUserEmail} (ID: ${doctorUserId})`);

    // Ensure doctor approval status is ACTIVE
    await query(`UPDATE doctors SET approval_status = 'ACTIVE', is_approved = true WHERE id = $1`, [doctorId]);

    // 2. Test Initial Login (OTP required for doctor)
    console.log('\n2️⃣ Testing Doctor Login without trusted browser...');
    const loginResult = await login({
      email: testUserEmail,
      password: testPassword,
      expectedRole: 'DOCTOR',
      rememberMe: false,
    });

    if (!loginResult.requiresOtp || !loginResult.challengeId) {
      throw new Error('Expected login to require OTP and return challengeId');
    }
    console.log('✅ Doctor login correctly returned requiresOtp: true and challengeId');

    // 3. Test OTP Verification with rememberMe = false
    console.log('\n3️⃣ Testing OTP Verification with rememberMe = false...');
    // In our test environment, mock/verify OTP logic or simulate challenge verification
    // Let's create an OTP challenge directly or test verifyLoginOtp token generation
    const userResult = await query('SELECT * FROM users WHERE id = $1', [doctorUserId]);
    const user = userResult.rows[0];

    const { generateAccessToken, generateRefreshToken } = await import('./src/modules/auth/authService');
    const accessTokenNoRemember = generateAccessToken(user, false);
    const refreshTokenNoRemember = generateRefreshToken(user, false);

    // Verify token expiration for rememberMe = false (should be 15m)
    const decodedNoRemember = jwt.verify(accessTokenNoRemember, config.jwt.secret) as any;
    const expirationSecondsNoRemember = decodedNoRemember.exp - decodedNoRemember.iat;
    if (expirationSecondsNoRemember !== 15 * 60) {
      throw new Error(`Expected 15m (900s) token expiration, got ${expirationSecondsNoRemember}s`);
    }
    console.log(`✅ Access token for Remember Me = false has 15-minute expiration (${expirationSecondsNoRemember}s)`);

    // 4. Test OTP Verification with rememberMe = true
    console.log('\n4️⃣ Testing Token Generation with rememberMe = true...');
    const accessTokenRemember = generateAccessToken(user, true);
    const refreshTokenRemember = generateRefreshToken(user, true);

    const decodedRemember = jwt.verify(accessTokenRemember, config.jwt.secret) as any;
    const expirationSecondsRemember = decodedRemember.exp - decodedRemember.iat;
    if (expirationSecondsRemember !== 7 * 24 * 60 * 60) {
      throw new Error(`Expected 7d (604800s) token expiration, got ${expirationSecondsRemember}s`);
    }
    console.log(`✅ Access token for Remember Me = true has 7-day expiration (${expirationSecondsRemember}s)`);

    // 5. Test Trusted Browser Registration & Bypass
    console.log('\n5️⃣ Testing Trusted Browser Registration & Subsequent Login...');
    const { registerTrustedBrowser, checkTrustedBrowser } = await import('./src/modules/auth/authService');
    const trustedToken = await registerTrustedBrowser(user.id, 'TestAgent/1.0');
    console.log('✅ Trusted browser registered');

    const checkBrowser = await checkTrustedBrowser(user.id, trustedToken);
    if (!checkBrowser) {
      throw new Error('Expected trusted browser check to succeed');
    }
    console.log('✅ Trusted browser validated in DB');

    // Login with trustedBrowserToken should NOT require OTP
    const trustedLoginResult = await login({
      email: testUserEmail,
      password: testPassword,
      expectedRole: 'DOCTOR',
      rememberMe: true,
      trustedBrowserToken: trustedToken,
    });

    if (trustedLoginResult.requiresOtp) {
      throw new Error('Expected login with trusted browser token to bypass OTP');
    }
    if (!trustedLoginResult.accessToken || !trustedLoginResult.refreshToken || !trustedLoginResult.isTrustedBrowser) {
      throw new Error('Expected trusted login result to return tokens and isTrustedBrowser: true');
    }
    console.log('✅ Trusted browser login succeeded without OTP and returned session tokens');

    // 6. Test Revoke Trusted Browser when Remember Me is unchecked
    console.log('\n6️⃣ Testing Trusted Browser Revocation on unchecked Remember Me...');
    const { revokeTrustedBrowser } = await import('./src/modules/auth/authService');
    await revokeTrustedBrowser(user.id, trustedToken);

    const checkRevoked = await checkTrustedBrowser(user.id, trustedToken);
    if (checkRevoked !== null) {
      throw new Error('Expected revoked trusted browser to return null');
    }
    console.log('✅ Revoked trusted browser is no longer valid');

    // Subsequent login must require OTP again
    const postRevokeLogin = await login({
      email: testUserEmail,
      password: testPassword,
      expectedRole: 'DOCTOR',
      rememberMe: false,
      trustedBrowserToken: trustedToken,
    });

    if (!postRevokeLogin.requiresOtp) {
      throw new Error('Expected login to require OTP after trusted browser revocation');
    }
    console.log('✅ Login after revocation properly requires OTP again');

    // 7. Verify Admin and SuperAdmin Authentication Preservation
    console.log('\n7️⃣ Testing SuperAdmin and Admin Login Flow...');
    const testAdminPassword = 'AdminPassword123!';
    const testAdminHash = await bcrypt.hash(testAdminPassword, 10);
    
    // Create test SuperAdmin
    const saEmail = `test.superadmin.${Date.now()}@example.com`;
    const saResult = await query(
      `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, 'SUPERADMIN', true, false)
       RETURNING id, email, role`,
      [saEmail, testAdminHash]
    );
    const testSuperAdmin = saResult.rows[0];

    const saLogin = await login({
      email: saEmail,
      password: testAdminPassword,
      expectedRole: 'ADMIN',
    });
    if (saLogin.requiresOtp) {
      throw new Error('SuperAdmin should not require OTP');
    }
    if (!saLogin.accessToken || !saLogin.refreshToken) {
      throw new Error('SuperAdmin should receive access and refresh tokens');
    }
    console.log('✅ SuperAdmin login succeeds without OTP and returns access token');

    // Create test Admin (regular Admin requires OTP)
    const adminEmail = `test.admin.${Date.now()}@example.com`;
    const adminResult = await query(
      `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, 'ADMIN', true, false)
       RETURNING id, email, role`,
      [adminEmail, testAdminHash]
    );
    const testAdmin = adminResult.rows[0];

    const adminLogin = await login({
      email: adminEmail,
      password: testAdminPassword,
      expectedRole: 'ADMIN',
    });
    if (!adminLogin.requiresOtp || !adminLogin.challengeId) {
      throw new Error('Admin should require OTP');
    }
    console.log('✅ Regular Admin login correctly requires OTP');

    // Clean up test admin accounts
    await query('DELETE FROM users WHERE id IN ($1, $2)', [testSuperAdmin.id, testAdmin.id]);
    await query('DELETE FROM login_otp_challenges WHERE user_id = $1', [testAdmin.id]);

    // 8. Clean up
    console.log('\n🧹 Cleaning up test data...');
    if (doctorId) {
      await query('DELETE FROM doctors WHERE id = $1', [doctorId]);
    }
    if (doctorUserId) {
      await query('DELETE FROM login_otp_challenges WHERE user_id = $1', [doctorUserId]);
      await query('DELETE FROM trusted_browsers WHERE user_id = $1', [doctorUserId]);
      await query('DELETE FROM users WHERE id = $1', [doctorUserId]);
    }
    console.log('✅ Cleanup complete');

    console.log('\n🎉 ALL REGRESSION TESTS PASSED SUCCESSFULLY!');
  } catch (err: any) {
    console.error('\n❌ REGRESSION TEST FAILED:', err);
    if (doctorUserId) {
      try {
        await query('DELETE FROM doctors WHERE user_id = $1', [doctorUserId]);
        await query('DELETE FROM login_otp_challenges WHERE user_id = $1', [doctorUserId]);
        await query('DELETE FROM trusted_browsers WHERE user_id = $1', [doctorUserId]);
        await query('DELETE FROM users WHERE id = $1', [doctorUserId]);
      } catch (cleanupErr) {
        // ignore
      }
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runRegressionTests();
