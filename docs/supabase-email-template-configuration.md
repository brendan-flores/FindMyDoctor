# Supabase Email Template Configuration for OTP Flows

## Overview

The FindMyDoctor application uses Supabase Auth for OTP delivery across three different authentication flows:

1. **Login OTP** - Used for regular Admin, Doctor, and Secretary login verification (SuperAdmins log in without OTP)
2. **Doctor Signup OTP** - Used for doctor self-registration verification
3. **Patient Signup OTP** - Used for patient registration verification

Each flow requires different email content. The application now sends flow context via `user_metadata.auth_flow` to allow Supabase email templates to conditionally render appropriate content.

## Flow Identifiers

The application passes the following non-sensitive flow identifiers in the `data` field of `signInWithOtp()`:

| Flow | `auth_flow` value | Purpose |
|------|-------------------|---------|
| Login | `login` | Admin/Doctor/Secretary login verification |
| Doctor Signup | `doctor_signup` | Doctor self-registration verification |
| Patient Signup | `patient_signup` | Patient registration verification |

## Required Supabase Email Template Updates

To correctly distinguish between login and signup OTP emails, update the **Magic Link / OTP email template** in your Supabase project.

### Accessing Email Templates

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select **Magic Link / OTP** template

### Recommended Email Template Content

Use the following template with conditional logic based on `{{ .Data.auth_flow }}`:

```html
{{ if eq .Data.auth_flow "login" }}
<h2>FindMyDoctor Login Verification Code</h2>

<p>We received a sign-in request for your FindMyDoctor account.</p>

<p>Your verification code:</p>
<p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">{{ .Token }}</p>

<p>Enter this code in FindMyDoctor to complete your login.</p>

<p>If you did not attempt to sign in, you can safely ignore this email.</p>
{{ else if eq .Data.auth_flow "doctor_signup" }}
<h2>Thank you for signing up as a doctor on FindMyDoctor!</h2>

<p>Your verification code:</p>
<p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">{{ .Token }}</p>

<p>Enter this code in FindMyDoctor to complete your doctor registration.</p>
{{ else if eq .Data.auth_flow "patient_signup" }}
<h2>FindMyDoctor Patient Registration</h2>

<p>Your verification code:</p>
<p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">{{ .Token }}</p>

<p>Enter this code in FindMyDoctor to complete your patient registration.</p>
{{ else }}
<h2>FindMyDoctor Verification Code</h2>

<p>Your verification code:</p>
<p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">{{ .Token }}</p>

<p>Enter this code in FindMyDoctor to complete your verification.</p>
{{ end }}
```

### Email Subject

Update the email subject to:

```
{{ if eq .Data.auth_flow "login" }}FindMyDoctor Login Verification Code{{ else if eq .Data.auth_flow "doctor_signup" }}FindMyDoctor Doctor Registration{{ else if eq .Data.auth_flow "patient_signup" }}FindMyDoctor Patient Registration{{ else }}FindMyDoctor Verification Code{{ end }}
```

## Implementation Notes

### Security Considerations

- **No secrets in metadata**: The `auth_flow` identifier is non-sensitive and does not contain passwords, JWTs, challenge tokens, or service-role keys
- **OTP remains secure**: The actual OTP code is still only exposed via `{{ .Token }}` as intended by Supabase
- **Flow context only**: Only the flow type is sent to distinguish email wording

### Application Code Changes

The following backend services have been updated to include flow context:

1. `backend/src/services/otpService.ts`
   - `sendLoginOtp()` - includes `auth_flow: 'login'`
   - `sendDoctorSignupOtp()` - includes `auth_flow: 'doctor_signup'`

2. `backend/src/services/patientOtpService.ts`
   - `sendPatientSignupOtp()` - includes `auth_flow: 'patient_signup'`

### Backward Compatibility

If the Supabase email template is not updated with the conditional logic, all OTP emails will use the default template content. The application will continue to function, but login emails will not have the correct login-specific wording.

## Testing After Template Update

After updating the Supabase email template:

1. **Test Login OTP** - Trigger a regular Admin/Doctor/Secretary login and verify the email says "Login Verification Code"
2. **Test Doctor Signup OTP** - Trigger a doctor signup and verify the email says "Doctor Registration"
3. **Test Patient Signup OTP** - Trigger a patient signup and verify the email says "Patient Registration"
4. **Verify OTP Code** - Confirm the 6-digit code is displayed via `{{ .Token }}` in all emails
5. **Verify No Secrets** - Confirm no passwords, JWTs, or tokens appear in email metadata

## Troubleshooting

### Emails Still Show Old Content

If emails still show the old content after updating the template:

1. Clear Supabase cache by restarting the auth service (if self-hosted)
2. Wait a few minutes for Supabase to propagate template changes
3. Verify the template syntax is valid Golang HTML template syntax
4. Check Supabase logs for template rendering errors

### Conditional Logic Not Working

If the conditional logic doesn't render correctly:

1. Verify the exact key name is `auth_flow` (case-sensitive)
2. Ensure the Golang template syntax is correct: `{{ if eq .Data.auth_flow "login" }}`
3. Check that the template editor saved the changes successfully
4. Test with a new OTP request (cached emails may use old templates)
