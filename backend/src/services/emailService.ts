// Using require for nodemailer to avoid TypeScript import issues
const nodemailer = require('nodemailer');
import { config } from '../config';

// Email configuration
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: false, // true for 465, false for other ports
  auth: {
    user: config.email.user,
    pass: config.email.password,
  },
});

export async function sendApprovalEmail(doctorEmail: string, doctorName: string): Promise<{ success: boolean; message: string }> {
  try {
    const mailOptions = {
      from: config.email.from,
      to: doctorEmail,
      subject: 'FindMyDoctor — Your Doctor Account Has Been Approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0D3B75;">Congratulations, Dr. ${doctorName}!</h2>
          <p>Your FindMyDoctor doctor account has been successfully verified and approved.</p>
          <p><strong>Account Details:</strong></p>
          <ul>
            <li>Email: ${doctorEmail}</li>
            <li>Status: Active</li>
          </ul>
          <p>You can now sign in to access your Doctor Dashboard using the email address you registered with.</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            If you did not request this approval, please ignore this email.
          </p>
          <p style="color: #666; font-size: 12px;">
            FindMyDoctor Administration
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Approval email sent to ${doctorEmail}`);
    return { success: true, message: 'Approval email sent successfully' };
  } catch (error) {
    console.error('Failed to send approval email:', error);
    return { success: false, message: 'Failed to send approval email' };
  }
}

export async function sendRejectionEmail(doctorEmail: string, doctorName: string, reason?: string): Promise<{ success: boolean; message: string }> {
  try {
    const mailOptions = {
      from: config.email.from,
      to: doctorEmail,
      subject: 'FindMyDoctor — Your Doctor Registration Status',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Doctor Registration Status Update</h2>
          <p>Dear Dr. ${doctorName},</p>
          <p>Your FindMyDoctor doctor registration has been reviewed. Unfortunately, your registration was not approved at this time.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>If you believe this is an error or would like to resubmit your registration, please contact our support team.</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            FindMyDoctor Administration
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Rejection email sent to ${doctorEmail}`);
    return { success: true, message: 'Rejection email sent successfully' };
  } catch (error) {
    console.error('Failed to send rejection email:', error);
    return { success: false, message: 'Failed to send rejection email' };
  }
}