import fs from 'fs';
import path from 'path';

function verifyBuild() {
  const distPath = path.join(process.cwd(), 'dist');
  const requiredModules = [
    'services/otpService.js',
    'services/patientOtpService.js',
    'api/otp.js',
    'api/patientOtp.js',
    'api/passwordReset.js',
    'api/auth.js',
    'index.js'
  ];

  const missingModules = [];

  for (const module of requiredModules) {
    const modulePath = path.join(distPath, module);
    if (!fs.existsSync(modulePath)) {
      missingModules.push(module);
    }
  }

  if (missingModules.length > 0) {
    console.error('BUILD VERIFICATION FAILED:');
    console.error('The following required modules are missing from dist/:');
    missingModules.forEach(module => {
      console.error(`  - ${module}`);
    });
    console.error('\nThis will cause runtime errors like "Cannot find module".');
    console.error('Please check the build process and ensure all TypeScript files compile correctly.');
    process.exit(1);
  }

  // Verify that otp.js imports otpService correctly
  const otpJsPath = path.join(distPath, 'api', 'otp.js');
  if (fs.existsSync(otpJsPath)) {
    const otpJsContent = fs.readFileSync(otpJsPath, 'utf8');
    if (!otpJsContent.includes('../services/otpService.js')) {
      console.error('BUILD VERIFICATION FAILED:');
      console.error('api/otp.js does not import services/otpService.js correctly.');
      console.error('Expected import: ../services/otpService.js');
      process.exit(1);
    }
  }

  // Verify health endpoint exists in index.js
  const indexJsPath = path.join(distPath, 'index.js');
  if (fs.existsSync(indexJsPath)) {
    const indexJsContent = fs.readFileSync(indexJsPath, 'utf8');
    if (!indexJsContent.includes('/health/modules')) {
      console.warn('WARNING: /health/modules endpoint not found in index.js');
    }
  }

  console.log('BUILD VERIFICATION PASSED:');
  console.log('All required modules are present in dist/');
  console.log('Import paths are correctly formatted.');
}

verifyBuild();
