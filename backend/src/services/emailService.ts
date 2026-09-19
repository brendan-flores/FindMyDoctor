import { config } from '../config';

/**
 * Call the existing Supabase Edge Function to send doctor confirmation emails
 * 
 * This function calls the deployed Supabase Edge Function "send-doctor-confirmation-email"
 * which handles both approval and rejection emails using Resend.
 * 
 * @param doctorEmail - Doctor's email address
 * @param doctorName - Doctor's full name
 * @param status - Either "approved" or "rejected"
 * @param reason - Optional rejection reason (only used when status is "rejected")
 */
async function callSupabaseEdgeFunction(
  doctorEmail: string,
  doctorName: string,
  status: 'approved' | 'rejected',
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!config.supabase.url || !config.supabase.functionSecret) {
      console.error('Supabase Edge Function not configured: missing SUPABASE_URL or FUNCTION_SECRET');
      return { success: false, message: 'Email service not configured' };
    }

    const edgeFunctionUrl = `${config.supabase.url}/functions/v1/send-doctor-confirmation-email`;
    
    const payload: any = {
      to: doctorEmail,
      doctorName: doctorName,
      status: status,
    };

    if (status === 'rejected' && reason) {
      payload.reason = reason;
    }

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-function-secret': config.supabase.functionSecret,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase Edge Function error:', response.status, errorText);
      return { success: false, message: 'Failed to send email via Edge Function' };
    }

    console.log(`✅ Email sent via Supabase Edge Function to ${doctorEmail} (status: ${status})`);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error calling Supabase Edge Function:', error);
    return { success: false, message: 'Failed to send email' };
  }
}

export async function sendApprovalEmail(doctorEmail: string, doctorName: string): Promise<{ success: boolean; message: string }> {
  return callSupabaseEdgeFunction(doctorEmail, doctorName, 'approved');
}

export async function sendRejectionEmail(doctorEmail: string, doctorName: string, reason?: string): Promise<{ success: boolean; message: string }> {
  return callSupabaseEdgeFunction(doctorEmail, doctorName, 'rejected', reason);
}