// Using require for nodemailer to avoid TypeScript import issues
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

async function testEmailConfiguration() {
  console.log('🔧 Testing Email Configuration...\n');

  console.log('Configuration:');
  console.log(`  Host: ${process.env.EMAIL_HOST}`);
  console.log(`  Port: ${process.env.EMAIL_PORT}`);
  console.log(`  User: ${process.env.EMAIL_USER}`);
  console.log(`  From: ${process.env.EMAIL_FROM}`);
  console.log(`  Frontend URL: ${process.env.FRONTEND_URL}\n`);

  // Check if all required fields are present
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Missing required email configuration in .env file');
    console.error('Please ensure EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASSWORD are set');
    process.exit(1);
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    console.log('🔄 Verifying SMTP connection...');
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('📧 Sending test email...');
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_USER, // Send to yourself for testing
      subject: 'FindMyDoctor - Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0D3B75;">Email Configuration Test</h2>
          <p>Congratulations! Your email configuration is working correctly.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>Host: ${process.env.EMAIL_HOST}</li>
            <li>Port: ${process.env.EMAIL_PORT}</li>
            <li>User: ${process.env.EMAIL_USER}</li>
          </ul>
          <p>This email was sent as a test to verify your nodemailer setup for FindMyDoctor approval/rejection notifications.</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            FindMyDoctor Email Configuration Test
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   To: ${process.env.EMAIL_USER}\n`);

    console.log('🎉 Email configuration is working correctly!');
    console.log('📫 Please check your inbox (and spam folder) for the test email.\n');

  } catch (error: any) {
    console.error('❌ Email configuration test failed:');
    console.error(`   Error: ${error.message}\n`);
    
    if (error.code === 'EAUTH') {
      console.error('💡 Troubleshooting Tips:');
      console.error('   1. Ensure you are using a Gmail App Password, not your regular password');
      console.error('   2. Make sure 2-Step Verification is enabled on your Google account');
      console.error('   3. Generate a new App Password from Google Account → Security → App Passwords');
      console.error('   4. The App Password should be 16 characters (spaces included)\n');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      console.error('💡 Troubleshooting Tips:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify EMAIL_HOST and EMAIL_PORT are correct');
      console.error('   3. Try port 465 instead of 587 (or vice versa)');
      console.error('   4. Check if your firewall is blocking SMTP connections\n');
    }
    
    process.exit(1);
  }
}

testEmailConfiguration();