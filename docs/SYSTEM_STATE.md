# FindMyDoctor — System State

This document contains the current system state for the FindMyDoctor project. It should be updated whenever changes are made that affect the documented system state, including authentication, registration, OTP verification, doctor approval workflows, database structures, API endpoints, application behavior, or architecture.

Current System State (October 2026):

## Clinic Date Handling and Timezone
- Clinic date calculations use the configured timezone (Asia/Manila by default) via the TIMEZONE environment variable
- Backend date utility functions (`getClinicDate`, `toClinicDateString`, `getClinicDateTime`) use Intl.DateTimeFormat with the configured timezone to ensure correct clinic dates
- Secretary queue UI uses Intl.DateTimeFormat with Asia/Manila timezone for the initial selected date
- Walk-in registration uses `getClinicDate()` and `getClinicDateTime()` to get the current clinic date and datetime in the configured timezone
- Appointment date processing uses `toClinicDateString()` to extract the date portion in the configured timezone
- This ensures that walk-in registrations and queue listings use the same correct clinic date regardless of server timezone

## Walk-in Registration Legacy Patient Compatibility
- Walk-in registration endpoint `POST /api/v1/walk-ins` preserves backward compatibility for legacy patients with appointment history but no association
- When no association exists, the endpoint checks the appointments table as a fallback for legacy records
- Legacy patients with complete profiles (all required fields populated) can register for walk-ins, and a COMPLETE association is created during registration
- Legacy patients with incomplete profiles are rejected and must complete details via `POST /api/v1/walk-ins/submit-patient-details` first
- Patient details submission endpoint `POST /api/v1/walk-ins/submit-patient-details` allows legacy patients with appointment history but no association to complete details
- Explicit PENDING associations are authoritative and cannot be bypassed by appointment-history fallback
- Patient profile completeness is verified before allowing registration: first name, last name, date of birth, valid sex, mobile number, and non-empty address
- All operations use transactions to ensure consistency between patient records, appointments, queue entries, capacity updates, and patient-doctor associations
- The unique constraint on (patient_id, doctor_id) in patient_doctor_associations prevents duplicate associations with conflict-safe writes

## Walk-in Patient Password Change and Onboarding
- Walk-in patients are created with `must_change_password = true` and a temporary generated password
- During first login, walk-in patients are redirected to the password change page
- Walk-in password change page hides the "Current Password" field (only shows "New Password" and "Confirm New Password")
- Backend `/api/v1/auth/change-password` endpoint accepts optional `currentPassword` parameter
- When `must_change_password` is true, the backend skips current password verification
- After successful password change, walk-in patients view onboarding screens (Find the right doctor, Manage your health, Book appointments easily) before accessing the application
- This onboarding flow aligns walk-in patient experience with regular app registration
- Regular password changes (when `must_change_password` is false) still require current password verification and navigate directly to home without onboarding

## Doctor Registration & Approval Workflow
- Doctor self-registration creates accounts with `approval_status = 'PENDING'` requiring admin approval
- Doctor self-registration uses a two-step flow: basic registration → OTP verification → profile completion → submission for approval
- Basic Doctor registration requires only: first_name, middle_name (optional), last_name, email, contact_number, password
- Doctor self-registration form at `/doctor-signup` includes password visibility toggle and real-time password strength requirements (8+ chars, uppercase, lowercase, number, special character)
- Professional information (specialty, credentials, PRC license number, hospital/clinic, years of experience, areas of expertise, biography, consultation fee, consultation type, languages spoken, professional photo) is collected after OTP verification in the profile completion step
- Doctor accounts are created with `profile_completion_status = 'INCOMPLETE'` after OTP verification
- Doctor profile completion status transitions: INCOMPLETE → COMPLETE (when required fields filled) → SUBMITTED (when doctor submits for review)
- Doctor approval workflow: PENDING → ACTIVE (approved) or REJECTED, with profile_completion_status tracked separately
- Doctor rejection and resubmission workflow: PENDING → REJECTED (with rejection_reason) → Doctor logs in → corrects profile → resubmits → PENDING → Admin approves → ACTIVE
- PENDING Doctors cannot log in while awaiting administrator approval
- REJECTED Doctors may authenticate specifically to correct and resubmit their application (they are not active/patient-visible)
- REJECTED Doctors can view their rejection reason via `GET /api/v1/doctors/me` (returns `approval_status` and `rejection_reason`)
- REJECTED Doctors can edit their profile and resubmit via `POST /api/v1/doctors/me/profile/submit`, which restores `approval_status` to 'PENDING' and clears `rejection_reason`
- REJECTED Doctors are routed to `/doctor-profile` after login to view rejection reason and correct their profile
- Doctor profile submission validates required fields: first name, last name, verified email, contact number, specialty, credentials, PRC license number, hospital/clinic
- Admin approval endpoint `PATCH /api/v1/admin/doctors/:id/approve` explicitly rejects approving doctors with `approval_status = 'REJECTED'` (requires resubmission first)
- Rejected doctors have `approval_status = 'REJECTED'` and `rejection_reason` set; they can correct their profile and resubmit using the existing onboarding flow

## Web Doctor Profile Pages
- Web Doctor signup flow: `/doctor-signup` (basic fields) → OTP verification → `/doctor-profile` (professional fields + schedule) → submit for approval
- Web Doctor signup redirects to `/doctor-profile` after successful OTP verification, not to dashboard
- Web Doctor profile page at `/doctor-profile` (no slash) is the profile completion page used after OTP verification during initial registration
- Web Doctor profile page allows doctors to complete their professional profile with 13 fields: professional photo (PNG upload, max 4MB), specialty, credentials, PRC license, hospital/clinic, room number, years of experience, areas of expertise, biography, consultation fee, consultation type, languages spoken, available schedule
- Web Doctor profile page includes schedule management UI using existing schedule APIs (GET/POST/PUT/DELETE `/api/v1/doctors/me/schedules`)
- Web Doctor profile page includes PNG photo upload with client-side validation (PNG only, max 4MB) and server-side validation via `POST /api/v1/doctors/me/photo` endpoint
- Web Doctor profile page includes photo preview after successful upload and ability to remove photo
- Web Doctor profile page supports saving draft profiles and submitting for approval with validation
- Web Doctor profile page explicitly handles REJECTED state: shows rejection banner with reason, allows profile editing, allows resubmission, does not lock form when `profile_completion_status === 'SUBMITTED'` if `approval_status === 'REJECTED'`
- Web Doctor profile page shows submission confirmation modal after successful profile submission with title "Profile Submitted Successfully!", message stating "Your professional profile has been submitted successfully. Once approved, your doctor profile will be displayed to patients in the FindMyDoctor mobile app.", and "Go to Dashboard" button redirecting to `/doctor/dashboard`
- Web Doctor login stores the session in role-scoped `doctor_token`, `doctor_refreshToken`, and `doctor_user` localStorage keys; the dashboard must read the role-scoped token (with the legacy generic `token` fallback) before checking approval status
- Web Doctor login page routes authenticated Doctors based on approval_status: ACTIVE → `/doctor/dashboard`, REJECTED → `/doctor-profile`
- Active Doctors can view their own personal and professional registration details on the read-only Doctor Portal page at `/doctor/profile` (with slash); it excludes schedule management and uses the authenticated `GET /api/v1/doctors/me` endpoint
- The authenticated `GET /api/v1/doctors/me` endpoint includes the doctor's account email for display on their own profile page
- The `/doctor/profile` page (with slash) features an Edit Profile button that toggles inline edit mode for updating profile information
- Edit Profile feature allows editing of personal information (first name, middle name, last name, contact number) and most professional information (specialty, credentials, hospital/clinic, room number, years of experience, areas of expertise, biography, consultation fee, languages spoken)
- Edit Profile feature uses the same searchable dropdown selectors as registration: SearchableSelect for single-select fields (specialty, credentials, hospital/clinic) and SearchableMultiSelect for multi-select fields (areas of expertise, languages spoken)
- Room Number field is always visible in the Professional Information section regardless of selected hospital/clinic; doctors can add or update their room number at any time
- Email address is read-only (requires separate email-change and verification process)
- PRC License Number is read-only (requires dedicated license-update process with admin review)
- Professional photo can be uploaded/replaced in edit mode with PNG-only validation and 4MB size limit via dedicated upload endpoint
- Schedule management is handled entirely through the /doctor/schedule page; the profile page does not display schedule information
- Edit mode includes Save Changes and Cancel buttons; Cancel discards unsaved changes and restores original values
- Backend API PUT /api/v1/doctors/me/profile validates PRC license number format (7 digits) and uniqueness when provided
- Backend API supports dynamic field updates for both personal and professional information fields including room_number
- Database schema includes `room_number` field in `doctors` table (migration 009_add_room_number.sql) with VARCHAR(50) type for storing room or suite information

## Admin Doctor Review
- Admin Doctor review interface at `/admin/doctors` displays two clearly separated sections: Basic Information (first name, middle name, last name, email, email verified, contact number) and Professional Information (professional photo, specialty, credentials, PRC license number, hospital/clinic, years of experience, areas of expertise, biography, consultation fee, consultation type, languages spoken, available schedule)
- Admin Doctor review interface displays available schedules using existing `doctor_schedules` data via new endpoint `GET /api/v1/admin/doctors/:id/schedules`
- Admin Doctor review interface displays uploaded professional photo if available
- Admin Doctor review interface uses enhanced UI with color-coded sections, better typography, and improved readability
- Admin Doctor rejection interface uses a dedicated modal with textarea for rejection reason instead of browser prompt
- Admin approval endpoint `PATCH /api/v1/admin/doctors/:id/approve` validates critical information before approving: first name, last name, verified email, contact number, specialty, credentials, PRC license number, hospital/clinic must all be present
- Admin Doctor rejection endpoint `PATCH /api/v1/admin/doctors/:id/reject` requires a rejection reason (cannot be empty or null)
- Backend Admin API endpoints `GET /api/v1/admin/doctors` and `GET /api/v1/admin/doctors/:id` return complete doctor profile fields including all professional information, middle name, contact number, profile completion status, and submission timestamp

## Patient Registration & Authentication
- Patient registration uses email OTP verification via Supabase for account creation
- Mobile patient sign-up collects separate first name, middle name (optional), last name, date of birth, sex, mobile number, address, email, username, and password
- Patient registration requires username (minimum 3 characters, alphanumeric + underscores only)
- Patient sex accepts `MALE`, `FEMALE`, `OTHER`, or `NOT_SPECIFIED`; the mobile sign-up form shows user-friendly labels mapped to these backend values
- Mobile sign-up does not collect emergency contact details, medical history, allergies, or current medications
- All patient details captured at sign-up are staged in `pending_patient_signups` and written to the `patients` table when the account is created after OTP verification
- User login accepts either email or username for authentication
- Users table includes username field (unique) for patient identification
- Username is automatically generated from email (part before @) during registration for all user types (patients, doctors, secretaries, admins)
- The patient OTP `/send` endpoint checks email and username availability up-front (after the email existence check, before the sign-up is staged or the OTP is sent) and returns `409 Conflict` with `Email is already registered` or `Username already taken`, so the error is shown on the sign-up form without sending an OTP
- The patient OTP `/verify` endpoint re-checks email and username uniqueness inside the single account-creation transaction and returns `409 Conflict` with a clear `Username already taken` (or `Email already registered`) message instead of a misleading verification error; the `users` unique constraints remain the backstop against concurrent sign-ups
- Patients table includes phone (restored in migration `025_restore_phone_column.sql`), `middle_name`, and `sex` (migration `023_add_patient_required_fields.sql`)
- Backend API endpoints for patient OTP: `/api/v1/auth/patient/otp/send`, `/api/v1/auth/patient/otp/verify`, `/api/v1/auth/patient/otp/resend`
- Backend doctor OTP API accepts only basic fields (`firstName`, `middleName`, `lastName`, `email`, `contactNumber`, `password`) in the signup payload
- Backend API endpoints for doctor OTP: `/api/v1/auth/otp/send`, `/api/v1/auth/otp/verify`, `/api/v1/auth/otp/resend`

## Email or Username Login
- Mobile login page accepts both email and username for authentication
- Login field label shows "Email or Username" with hint "Enter your email or username"
- Validation is conditional: if input contains `@`, email format is validated; if no `@`, username is accepted without email format validation
- Backend `/api/v1/auth/login` endpoint queries both `email` and `username` columns: `WHERE (email = $1 OR username = $1)`
- Username is automatically populated during all registration flows (patients via OTP, doctors, secretaries, admins, walk-ins) by extracting the part before the `@` symbol from the email address
- Username column in `users` table is unique (VARCHAR(50)) with an index for efficient lookups
- All user types (PATIENT, DOCTOR, SECRETARY, ADMIN, SUPERADMIN) have username populated at account creation

## OTP & Authentication
- SuperAdmins log in directly without OTP; regular Admins always require login OTP (no setting, no bypass)
- Doctor accounts require login OTP only if `two_factor_enabled = true` (optional 2FA, must be turned on)
- Secretary accounts require login OTP only if `two_factor_enabled = true` (optional 2FA, must be turned on)
- Role-based login OTP/2FA is implemented with server-side challenge state in PostgreSQL
- Doctor, Secretary, and Admin web login pages submit their expected role; the backend rejects cross-role login attempts before OTP challenge creation or delivery with `Invalid credentials or account role.` Admin login continues to accept SUPERADMIN accounts
- The shared mobile patient/secretary application logs in through the same `/api/v1/auth/login` endpoint and credentials; the mobile login verifies the account as a patient and then as a secretary, and the backend-returned `User.role` determines routing (patients → `/home`, secretaries → `/secretary-home`); the persisted role guides restored sessions and mobile route guards; secretary mobile login with 2FA enabled requires completing the OTP step on the web dashboard
- Admin/SuperAdmin login requires mandatory OTP (no setting, no bypass) - enforced by backend role check
- Doctor login requires OTP only if `two_factor_enabled = true` - enforced by backend role check
- Secretary login requires OTP only if `two_factor_enabled = true` - enforced by backend role check
- Login OTP flow: user submits credentials → backend checks role-specific OTP requirement → if required, creates challenge → sends OTP via Supabase → returns opaque challenge token → user submits OTP → backend verifies with Supabase → consumes challenge → issues application JWT
- Login OTP verification endpoint: `POST /api/v1/auth/verify-login-otp` (accepts challengeId and OTP)
- Login OTP resend endpoint: `POST /api/v1/auth/resend-login-otp` (accepts challengeId, enforces 60-second cooldown, invalidates previous challenges)
- Login OTP challenges expire after 5 minutes, support up to 5 failed attempts, and are marked as used after successful verification
- PostgreSQL `login_otp_challenges` table stores server-side OTP challenge state with hashed challenge tokens and a `remember_me` column retained for schema compatibility (new challenges store `false`; it no longer grants device trust)
- PostgreSQL `doctors` and `secretaries` tables include `two_factor_enabled` column (migration 013_add_two_factor_settings.sql) - optional 2FA, must be turned on by user
- Secretary settings page at `/secretary/settings` groups cards into a labeled "Account" section (optional two-factor authentication toggle, Change password card reusing `POST /api/v1/auth/change-password`, and the Trusted Browsers card) and a "Clinic" section (Clinic Payment Settings with the GCash QR thumbnail, Active/Not uploaded status, and last-updated date from `doctors.gcash_qr_updated_at`, plus display-only "Coming soon" placeholders for Invoice details and GCash account details that have no logic, storage, or endpoints)
- Doctor settings page at `/doctor/settings` provides a single labeled "Account" section containing the optional two-factor authentication toggle (description: "Require a verification code when you sign in from a new or untrusted browser."), a Change password card, and the Trusted Browsers card
- Supabase is used only for OTP email verification and Storage, not for storing application data
- Login OTP uses `shouldCreateUser: false` to prevent Supabase from creating application accounts
- Web application includes shared `OtpVerification` component for login OTP verification (6-digit input, auto-focus, paste support, resend timer)

## Device Trust, Trusted Browsers & Session Lifetime

- Session behavior is centralized in `backend/src/modules/auth/sessionPolicy.ts`; the web client only mirrors the idle/absolute limits. The internal `rememberMe` claim/session-policy flag is retained for compatibility but now represents an explicit trusted-device session.
- Doctor and Secretary login forms no longer include a Remember Me checkbox.
- After a Doctor or Secretary successfully completes authentication (password and, when 2FA is enabled, OTP), an untrusted browser is shown `/doctor/trust-device` or `/secretary/trust-device`. The page displays the detected browser and operating system and offers "Trust this device" and "Do not trust this device".
- **Trust this device:** registers the browser for 30 days, upgrades the current session to the 30-day persistent policy, and skips OTP on later logins from that browser when 2FA is enabled. The password is always required.

## Password Reset via Email OTP

- Users can reset their password through a secure email OTP flow without authentication
- Mobile password reset flow: Login → Forgot Password → enter email → send OTP → Reset Password → enter OTP + new password → reset → back to Login with success message
- Backend API endpoints for password reset: `POST /api/v1/auth/password-reset/request` (send OTP) and `POST /api/v1/auth/password-reset/reset` (verify OTP and update password)
- Password reset request endpoint validates email, checks if user exists in PostgreSQL, and sends OTP via Supabase Auth
- For security, the request endpoint returns a success message even if the email is not registered (does not reveal email existence)
- Password reset request is rate-limited to 3 requests per 10 minutes per email to prevent abuse
- Password reset endpoint validates the 6-digit OTP with Supabase Auth, hashes the new password with bcrypt, updates the PostgreSQL users table, and clears the `must_change_password` flag if present
- Password reset also increments the `session_version` in the users table to invalidate all existing refresh tokens and trusted browser sessions
- Mobile forgot password page (`forgot_password_page.dart`) follows the same design patterns as login and signup pages: background with soft blobs, back button, logo, white form card, custom text fields, primary button, and trust footer
- Mobile reset password page (`reset_password_page.dart`) includes OTP field (6 digits), new password field, confirm password field, password requirements indicators (8+ chars, number, uppercase), resend code button with 60-second cooldown, error banner, and loading state
- OTP service functions `sendPasswordResetOtp()` and `verifyPasswordResetOtp()` in `otpService.ts` use Supabase Auth with `shouldCreateUser: false` to prevent creating Supabase users; PostgreSQL remains the source of truth for application accounts
- Password reset is available to all user roles (PATIENT, DOCTOR, SECRETARY, ADMIN, SUPERADMIN) through the same flow
- **Do not trust this device:** keeps browser-session cookies, 8-hour idle timeout, 7-hour access token, 8-hour refresh token, and no trusted browser. OTP is required on every login when 2FA is enabled, and any stale trust cookie is cleared.
- Trusting a device never bypasses the OTP required for the current login. `POST /api/v1/auth/verify-login-otp` always issues a short untrusted session; only the explicit trust endpoint upgrades it.
- A browser that is already trusted skips OTP and the trust page on later logins.
- **Admin and SuperAdmin:** OTP is mandatory on every login; there is no device-trust prompt and no trusted-browser support. Sessions use browser-session cookies with a 90-minute access token, 2-hour refresh token, 2-hour idle timeout, and an 8-hour absolute maximum. Logout clears the Admin/SuperAdmin session.
- **Patient:** the existing 7-day access / 30-day refresh behavior is unchanged.
- Trusted-browser tokens are high-entropy random values stored only as SHA-256 hashes in the PostgreSQL `trusted_browsers` table (`user_id`, `token_hash`, `device_info`, `expires_at` 30 days, `created_at`, `revoked_at`, `last_used_at`).
- The trusted-browser token is sent only in an HttpOnly/Secure/SameSite=lax cookie, rotated on each successful use, and never returned in a response body, stored in localStorage, or read by JavaScript.
- Trust expires after 30 days; new browsers, expired tokens, or cleared cookies require OTP again when 2FA is enabled.
- Password change, password reset, account deactivation, and "Sign out of all devices" revoke all trusted browsers and refresh tokens for the account. Refresh-token revocation uses `users.session_version` (migration `032_add_session_version.sql`); old refresh tokens fail validation after the version is incremented.
- Logout ends only the current portal session and does not revoke trusted-browser status.
- `/doctor/settings` and `/secretary/settings` include a Trusted Browsers card listing device label, created date, last used date, and expiry (dates in Asia/Manila), with per-browser Revoke and "Sign out of all devices". The row matching the request's trusted-browser cookie is labeled "This browser" via the `is_current` flag from `GET /api/v1/auth/trusted-browsers`. Confirming revocation of the current browser warns that the next sign-in will require a verification code; "Sign out of all devices" confirms "Sign out everywhere? You will need to sign in again on every device." More than five entries show the five most recent plus a "View all" toggle. The doctor settings page groups 2FA, Change password, and Trusted Browsers in one labeled "Account" section; a Change password card calls `POST /api/v1/auth/change-password`, which revokes other trusted browsers and refresh tokens while keeping the current session signed in.
- A non-blocking dashboard banner recommends enabling 2FA when it is disabled; it never blocks access.
- Cookies are role-scoped (`doctor_accessToken`, `doctor_refreshToken`, `doctor_trustedBrowser`, `secretary_*`, `admin_*`, `patient_*`) with path `/`, plus legacy global fallbacks. Access/refresh cookies are HttpOnly and Secure in production; the trusted-browser cookie is always HttpOnly.
- Non-persistent sessions also set a non-sensitive, JavaScript-readable `<prefix>_sessionActive` browser-session hint cookie. `apiClient` uses it to discard localStorage tokens after a browser restart.
- Multiple portal sessions may coexist. Middleware treats role-namespaced paths (`/doctors`, `/secretaries`, `/admin`) as authoritative, uses `X-Portal-Role` for shared resource paths such as `/patients/:id`, `/prescriptions/patients/:id`, and `/visits/patient/:id`, checks the matching role cookies with a global fallback, and rejects cross-role token use. Shared sub-resources are exempt: `/doctors/:id/availability` accepts both PATIENT tokens (the mobile patient booking journey) and DOCTOR tokens; doctor-portal-only routes remain guarded by `authorize('DOCTOR')`.
- Web `apiClient` sends `X-Portal-Role`, retries a request once after a successful refresh, coordinates concurrent refreshes, runs an idle/absolute watchdog, and clears expired sessions with "Your session has expired. Please log in again." Only a 400/401 refresh response clears the session; transient rate-limit, server, and network failures do not.
- Authentication endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/verify-login-otp`, `POST /api/v1/auth/resend-login-otp`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/change-password`, `GET /api/v1/auth/trusted-browsers`, `GET /api/v1/auth/trusted-browsers/current-device`, `POST /api/v1/auth/trusted-browsers/trust-current`, `DELETE /api/v1/auth/trusted-browsers/:id`, `POST /api/v1/auth/trusted-browsers/revoke-all`, and `POST /api/v1/auth/revoke-trusted-browser` (also used for "Do not trust this device").
- `login_otp_challenges` retains `remember_me` for schema compatibility; new challenges store `false` and the client cannot use it to upgrade to trust.
- Device trust never bypasses password, account status, role, or approval checks; failures stay generic and token validation is rate-limited and logged without token values.
- Secretary password change takes precedence over the device-trust prompt; profile completion follows the trust choice. The trust pages bypass the dashboard shell.
- **Deployment note:** migration `032_add_session_version.sql` (`npm run migrate:session-version`) was applied to the configured PostgreSQL database on 2026-10-23, and `users.session_version` was verified as `integer NOT NULL DEFAULT 0`. Migration `033_add_gcash_qr_updated_at.sql` (`npm run migrate:gcash-qr-updated-at`) was also applied on 2026-10-23, adding `doctors.gcash_qr_updated_at` for the secretary settings QR status card. Any other environment must run both idempotent migrations before deploying this behavior. No new migration is required for the device-trust prompt; it reuses `trusted_browsers`.

## Secretary Management
- Each Secretary has a required `doctor_id` relationship to one Doctor; Doctors can list only their own Secretaries via the authenticated backend API
- Doctors can create Secretary accounts via `POST /api/v1/doctors/secretaries` (requires Doctor authentication and ACTIVE approval status)
- Doctors can list their assigned Secretaries via `GET /api/v1/doctors/secretaries` (requires Doctor authentication)
- Secretary accounts created by Doctors have `must_change_password = true` and NULL first_name/last_name (to be completed by Secretary)
- Secretary accounts are automatically linked to the Doctor who created them via `doctor_id` foreign key
- Secretary accounts created by Doctors are automatically approved (`is_approved = true`)
- Secretary accounts are created with Supabase Auth identity to support optional 2FA (server-side provisioning via `ensureSecretarySupabaseIdentity`)
- Secretary must complete profile information (first name, last name, contact number) via `PUT /api/v1/secretaries/me`
- Secretary must change password on first login (enforced by `must_change_password` flag)
- Secretary profile page at `/secretary/profile` allows viewing and editing profile information
- Migration `015_enforce_secretary_doctor_relationship.sql` enforces the required foreign key and non-null assignment for `secretaries.doctor_id`
- Secretary queue page at `/secretary/queue` displays the doctor's room number from the assigned doctor's profile
- Backend `GET /api/v1/secretaries/me` endpoint includes the assigned doctor's `room_number` field
- Secretary queue page shows the practice name, room number (if set), and doctor name in the header location line

## Patient Record Management
- Patient records are managed through the unified `/api/v1/patients` API router with role-based access control
- Patient endpoints: `GET /api/v1/patients/me` (view own profile), `PUT /api/v1/patients/me` (update own profile) - requires PATIENT authentication
- Patient details submission: `POST /api/v1/patients/submit-details` - Patient-only endpoint to submit required details for a specific doctor before first booking
- Doctor-specific patient record check: `GET /api/v1/patients/check-record?doctorId={id}` - checks if authenticated patient has existing record with selected doctor
- Patient record check queries the `patient_doctor_associations` table for any association, respecting the explicit status (PENDING or COMPLETE), with fallback to `appointments` table for backward compatibility with legacy records
- Patient-doctor associations are tracked in the `patient_doctor_associations` table to support persistent records before the first appointment
- Patient-doctor associations have a `details_completion_status` field with values: 'PENDING' (incomplete walk-in account with only email, first name, last name) or 'COMPLETE' (full required details submitted including date of birth, sex, phone, address)
- An explicit PENDING association is authoritative - it cannot be bypassed by appointment-history fallback
- If no existing record exists with the selected doctor, the patient must submit required details via `POST /api/v1/patients/submit-details` before booking
- Patient details are stored in the `patients` table and associated with the authenticated user account via `user_id` foreign key
- Doctor patient access: `GET /api/v1/patients/doctor/:doctorId` - returns all patients who have associations or appointments with the authenticated doctor
- Secretary patient search: `GET /api/v1/patients/search` - allows secretaries to search patients by email, phone, first name, or last name for walk-in registration, restricted to their assigned doctor's patients
- Secretary patient access: `GET /api/v1/patients/:id` - allows secretaries to view patient details only if the patient has associations or appointments with their assigned doctor
- Doctor patient access: `GET /api/v1/patients/:id` - allows doctors to view patient details only if the patient has associations or appointments with them
- Patient profile fields: first_name (required), middle_name (optional), last_name (required), date_of_birth (required), sex (required: MALE, FEMALE, OTHER, NOT_SPECIFIED), phone (required, mobile number), address (required for new submissions via API, historical NULL values preserved in database), emergency_contact_name, emergency_contact_phone, medical_history, allergies, current_medications
- Patient profile updates use server-side validation for required fields (first name, last name, date of birth, sex, phone, address) and optional field formatting
- Mobile number validation: Must contain only digits, spaces, hyphens, plus sign, or parentheses; 1-20 characters
- Date of birth validation: Must be a valid date and cannot be in the future
- Patient-doctor relationship is tracked through the `patient_doctor_associations` table (for persistent records before booking) and the `appointments` table (for actual consultations)
- The patient record check ensures that patients don't need to re-enter details for doctors they've already submitted details for or seen in consultation
- All patient operations require authentication and proper role-based authorization to prevent unauthorized access
- Migration `023_add_patient_required_fields.sql` adds middle_name, sex (with NOT NULL DEFAULT 'NOT_SPECIFIED'), and creates patient_doctor_associations table
- Migration `023_add_patient_required_fields.sql` does NOT make address NOT NULL; it preserves historical NULL addresses for existing patients, but new API submissions validate address as a required field
- Migration `024_add_walk_in_completion_status.sql` adds `details_completion_status` column to patient_doctor_associations to distinguish between pending preliminary accounts and completed patient records
- Migration `024_add_walk_in_completion_status.sql` determines completion status from actual patient data: COMPLETE only when all required details are valid and populated (first name, last name, date of birth, valid sex, mobile number, non-empty address); otherwise PENDING

## Secretary Patient Record Management
- Secretary can update patient records via `PUT /api/v1/patients/:id` (requires SECRETARY authentication, restricted to patients of their assigned doctor)
- Doctor can update patient records via `PUT /api/v1/patients/:id` (requires DOCTOR authentication, restricted to patients they have associations or appointments with)
- Authorization for patient updates uses unambiguous SQL with EXISTS subqueries to verify patient-doctor relationship before allowing updates
- DOCTOR authorization SQL: `WHERE patients.id = $1 AND (EXISTS association with authenticated doctor OR EXISTS appointment with authenticated doctor)`
- SECRETARY authorization SQL: `WHERE patients.id = $1 AND (EXISTS association with secretary's assigned doctor OR EXISTS appointment with secretary's assigned doctor)`
- Authorization subqueries include `patient_id = $1` in each EXISTS clause to prevent bypass attacks
- Unauthorized patient update attempts return unified 404 response (non-disclosing, no information leakage)
- Patient update endpoint requires six required fields on every update: firstName, lastName, dateOfBirth, sex, phone, address
- Optional fields (middleName, emergencyContactName, emergencyContactPhone, medicalHistory, allergies, currentMedications) support explicit clearing via null or empty string
- Optional field presence is tracked using boolean flags derived from request field presence (using 'in' operator), not from validated values
- Date validation order: string type check → exact YYYY-MM-DD syntax validation → calendar date validation (impossible dates like February 30) → year range validation (1900-2100) → future date check (timezone-independent using UTC)
- UUID validation uses existing `uuid` package dependency (v9.0.1) to validate patient ID format before database operations
- Optional field validation uses `unknown` type with narrowing before error message extraction (type-safe error handling)
- TypeScript interface `UpdatePatientRequest` in secretaryApi.ts reflects the required field contract (six required fields, optional fields with null support)
- Web Secretary patient list page at `/secretary/patients` displays patients of the secretary's assigned doctor via `GET /api/v1/patients/search`
- Secretary patient search endpoint allows empty parameters for initial listing (loads all patients of assigned doctor) and filters by email, phone, firstName, or lastName when provided
- All patient search results are server-side filtered to include only patients with associations or appointments to the secretary's assigned doctor
- Web Secretary patient detail/edit page at `/secretary/patients/[id]` allows viewing and editing patient information with edit mode toggle
- Web Secretary patient detail page includes help text below optional fields: "Leave empty to clear this field"
- Web Secretary API client (`secretaryApi.ts`) provides TypeScript interfaces and methods for secretary-specific operations
- Web Secretary walk-ins page at `/secretary/walk-ins` provides direct walk-in registration workflow without mandatory email search
- Direct walk-ins workflow: Single-step form with required patient information (email, first name, middle name optional, last name, date of birth, sex, mobile number, address, appointment date) → Register with queue assignment
- Walk-ins page displays assigned doctor only (no doctor selection dropdown per user decision)
- Walk-ins page does not request medical history, allergies, or current medications on the registration form
- Walk-ins page shows temporary password to secretary after successful registration for patient credential delivery
- Direct walk-in registration endpoint `POST /api/v1/walk-ins/direct-register` handles the entire flow in one transaction
- Direct registration always creates a new account for valid, genuinely new walk-in registrations using email as username/login identifier
- Direct registration generates cryptographically secure random temporary password containing letters and numbers using Node.js crypto module
- Direct registration stores only the appropriate password hash and sets `must_change_password = true`
- Direct registration saves patient details and associates the patient with the secretary's assigned doctor
- Direct registration registers the walk-in in the existing queue and assigns the next available queue number
- Direct registration enforces queue capacity and prevents duplicate queue entries using advisory locks and transactions
- Direct registration enforces email/account uniqueness on the backend and returns clear conflict response if email already exists
- Direct registration uses transaction-safe operations to ensure partial failures do not leave inconsistent records
- Legacy multi-step walk-in workflow (search → create account → submit details → appointment → confirm) remains available through existing endpoints
- All backend patient update operations use transactions and proper parameter mapping to ensure data consistency
- Backend tests verify SQL structure, parameter mapping, validation logic, role rejection, and error responses for PUT /api/v1/patients/:id endpoint and direct walk-in registration

## Secretary Queue Management
- Web Secretary queue management page at `/secretary/queue` displays the daily patient queue for the secretary's assigned doctor
- Queue page shows queue entries with patient name, queue number, status, registration source (ONLINE/WALK_IN), and doctor information
- Queue page includes KPI cards: Total Patients, Waiting, Completed, and Assigned Doctor
- Queue page includes date selector to view queue for different dates
- Queue page includes "Call Next Patient" button to advance the queue by calling the next waiting patient
- Queue entry actions are status-dependent: WAITING (Call, Not Present), CALLED (Start Checkup, Skip), IN_CHECKUP (Complete), SKIPPED/NOT_PRESENT (Re-queue)
- Backend queue API endpoints enforce secretary-to-doctor assignment on all operations
- Backend `GET /api/v1/queue/:date` automatically filters by secretary's assigned doctor for SECRETARY role; DOCTOR and ADMIN can optionally filter by doctorId
- Backend `GET /api/v1/queue/:date` response includes patient_email field for queue display
- Backend `POST /api/v1/queue/:date/next` uses secretary's assigned doctor for SECRETARY role; if secretary provides doctorId, it must match their assignment
- Backend queue status-update endpoints (`PATCH /api/v1/queue/:id/status`, `POST /api/v1/queue/:id/start-checkup`, `POST /api/v1/queue/:id/complete`, `POST /api/v1/queue/:id/skip`, `POST /api/v1/queue/:id/not-present`) enforce secretary-to-doctor assignment via SQL WHERE clauses
- Secretary authorization SQL for queue operations: `WHERE queue_entry.id = $1 AND doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)`
- Doctor authorization SQL for queue operations: `WHERE queue_entry.id = $1 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $2)`
- Unauthorized queue operation attempts return 404 response (non-disclosing, no information leakage)
- Valid queue status values: WAITING, CALLED, NOT_PRESENT, SKIPPED, IN_CHECKUP, COMPLETED, CANCELLED, NO_SHOW
- Status updates automatically set appropriate timestamps: called_at (CALLED), started_at (IN_CHECKUP), completed_at (COMPLETED)
- Queue status transitions are validated on the backend; invalid status values return 400 error
- Direct walk-in registrations via `POST /api/v1/walk-ins/direct-register` create queue entries with registration_source = 'WALK_IN' and are visible in the secretary queue
- Web Secretary API client (`secretaryApi.ts`) provides TypeScript interfaces and methods for queue operations: getQueue, callNextPatient, updateQueueStatus, startCheckup, completeCheckup, skipPatient, markNotPresent
- TypeScript interface `QueueEntry` in secretaryApi.ts includes all queue entry fields including patient_email
- Backend queue tests verify secretary-to-doctor assignment enforcement, status validation, and correct SQL structure

## Doctor Dashboard Patient Records
- Web Doctor Dashboard includes patient management functionality at `/doctor/patients` for viewing, adding, and editing patient records
- Doctor patient list page displays all patients who have associations or appointments with the authenticated doctor via `GET /api/v1/patients/doctor/:doctorId`
- Doctor patient list page includes client-side search by name, email, and phone (server-side authorization is authoritative; client-side filtering is for convenience only)
- Doctor patient list page displays statistics: Total Patients, Active Patients, Filtered Results, Search Active status
- Doctor patient list page includes "Add Patient" button to open a modal for associating existing patients with the doctor
- Doctor patient list page includes visibility icon button to navigate to patient detail page
- Doctor patient addition allows doctors to associate existing patient accounts with their practice
- Doctor patient addition endpoint: `POST /api/v1/patients/associate` (requires DOCTOR authentication)
- Doctor patient addition requires the patient to have an existing user account (created through mobile registration)
- Doctor patient addition cannot create new user accounts directly due to password generation and email verification requirements
- Doctor patient addition validates required fields: email, firstName, lastName, dateOfBirth, sex, phone, address
- Doctor patient addition creates or updates patient record and creates COMPLETE patient-doctor association
- Doctor patient addition prevents duplicate associations via unique constraint on (patient_id, doctor_id)
- Doctor patient addition returns 404 if patient account does not exist with message directing patient to register via mobile app
- Doctor patient addition is authorized using backend-verified doctor identity (doctor derived from authenticated user ID)
- Doctor patient detail page at `/doctor/patients/[id]` displays patient information including demographics, contact information, medical information, emergency contact, and consultation history
- Doctor patient detail page includes edit mode that allows doctors to update patient information (all fields except email, which is read-only)
- Doctor patient edit mode reuses the same validation logic as secretary patient editing (six required fields: firstName, lastName, dateOfBirth, sex, phone, address)
- Doctor patient edit mode enforces client-side validation for required fields before submission
- Doctor patient detail page fetches patient details via `GET /api/v1/patients/:id` with proper authorization
- Doctor patient detail page fetches appointment history via `GET /api/v1/appointments?patientId=X` (DOCTOR-only endpoint with patientId filter)
- Doctor patient detail page fetches prescription history via `GET /api/v1/prescriptions/patients/:id` (DOCTOR-authorized endpoint)
- Doctor patient detail page fetches visit history via `GET /api/v1/visits/patient/:patientId` (DOCTOR-only endpoint with patient-doctor authorization)
- Backend `GET /api/v1/appointments` endpoint now supports optional `patientId` query parameter for DOCTOR role to filter appointments by patient
- Backend patientId filter for appointments is safe because the query already filters by doctor_id (authenticated doctor), preventing cross-patient access
- Backend `GET /api/v1/visits/patient/:patientId` endpoint returns visit history for a specific patient, with doctor authorization enforced via patient-doctor associations or appointments
- Backend visit history endpoint includes appointment_date (when available), doctor name, and clinical vitals (blood pressure, weight, height, temperature)
- Backend visit history orders visits by visit_date DESC (most recent first)
- Backend `PUT /api/v1/patients/:id` endpoint allows doctors to update patient records for patients they have associations or appointments with
- Backend doctor patient update authorization uses EXISTS subqueries to verify patient-doctor relationship (via association or appointment) before allowing updates
- Backend doctor patient update requires all six required fields on every update (firstName, lastName, dateOfBirth, sex, phone, address)
- Backend doctor patient update supports optional fields with explicit clearing (null or empty string) and preserves current values when fields are omitted
- Backend doctor patient update enforces the same validation as secretary updates (date format, sex enum, phone format, etc.)
- Doctors cannot create, view, or edit another doctor's patient records without authorization (server-side enforcement)
- Doctor consultation history includes visits, appointments, and prescriptions
- All authorization is enforced on the backend; client-side filtering is NOT an authorization boundary
- Web API client includes patient methods in `doctorApi.ts`: `getPatients()`, `getPatientById()`, `getPatientPrescriptions()`, `updatePatient()`, `getPatientVisits()`, `associatePatient()`
- TypeScript interfaces for Patient, Prescription, UpdatePatientRequest, AssociatePatientRequest, and Visit are defined in `doctorApi.ts`

## Doctor Dashboard Appointment Details
- Web Doctor Dashboard includes appointment detail page at `/doctor/appointments/[id]` for viewing appointment information
- Doctor appointment detail page displays selected appointment's patient information, appointment details, and prescription history
- Doctor appointment detail page fetches appointment details via `GET /api/v1/appointments/:id` with proper authorization (DOCTOR-only with doctor_id restriction)
- Doctor appointment detail page fetches patient details via `GET /api/v1/patients/:id` with proper authorization
- Doctor appointment detail page fetches patient prescription history via `GET /api/v1/prescriptions/patients/:id` (DOCTOR-authorized endpoint)
- Backend `GET /api/v1/appointments/:id` endpoint enforces doctor_id restriction via SQL WHERE clause: appointment must belong to authenticated doctor
- Backend authorization prevents doctors from accessing another doctor's appointments (returns 404 for unauthorized access)
- Doctor appointment list page at `/doctor/appointments` includes visibility icon button to navigate to appointment detail page
- Doctor appointment detail page includes navigation back to appointment list
- Backend tests verify doctor appointment detail authorization: allow access to own appointments, deny access to other doctors' appointments, enforce doctor_id restriction in SQL query

## Walk-in Registration Security
- Walk-in registration endpoints enforce secretary-to-doctor assignment verification before allowing any operation
- Secretary search endpoint `GET /api/v1/walk-ins/search` is restricted to patients associated with the secretary's assigned doctor only
- Secretary account creation endpoint `POST /api/v1/walk-ins/create-account` requires doctorId and verifies the secretary is assigned to that doctor
- Walk-in account creation creates a PENDING patient-doctor association with only email, first name, and last name; full required details must be submitted later
- Walk-in registration endpoint `POST /api/v1/walk-ins` verifies the secretary is assigned to the requested doctor before creating appointments or queue entries
- Walk-in registration requires the patient to have a COMPLETE patient-doctor association before booking; PENDING associations are rejected with an error message
- Walk-in registration preserves backward compatibility for legacy patients with appointment history but no association: checks appointments table as fallback, verifies profile completeness, and creates COMPLETE association during registration
- Patient-doctor associations are automatically created or updated during walk-in registration within the same transaction as appointment and queue creation
- New endpoint `POST /api/v1/walk-ins/submit-patient-details` allows secretaries to submit complete patient details (first name, middle name, last name, date of birth, sex, phone, address, emergency contacts, medical history, allergies, medications) during walk-in registration
- Patient details submission allows legacy patients with appointment history but no association to complete details, enabling subsequent walk-in registration
- Patient details submission validates that the patient is associated with the secretary's assigned doctor before allowing profile updates (via association or appointment history)
- Patient details submission validates all required fields server-side (first name, last name, date of birth, sex, phone, address) and optional fields (middle name, emergency contacts, medical history, allergies, medications)
- Patient details submission updates the patient-doctor association to COMPLETE status, allowing subsequent bookings
- Patient details submission uses INSERT with ON CONFLICT UPDATE to prevent duplicate associations and safely handle legacy patients
- All walk-in operations use transactions to ensure consistency between patient records, appointments, queue entries, capacity updates, and patient-doctor associations
- Unauthorized secretary requests (secretary not assigned to the requested doctor) are rejected with 403 Forbidden before any database modifications
- Explicit PENDING associations are authoritative and cannot be bypassed by appointment-history fallback
- Migration `023_add_patient_required_fields.sql` adds middle_name, sex (with NOT NULL DEFAULT 'NOT_SPECIFIED'), and creates patient_doctor_associations table
- Migration `023_add_patient_required_fields.sql` does NOT make address NOT NULL; it preserves historical NULL addresses for existing patients, but new API submissions validate address as a required field
- Migration `024_add_walk_in_completion_status.sql` adds `details_completion_status` column to patient_doctor_associations to distinguish between pending preliminary accounts and completed patient records
- Migration `024_add_walk_in_completion_status.sql` determines completion status from actual patient data: COMPLETE only when all required details are valid and populated (first name, last name, date of birth, valid sex, mobile number, non-empty address); otherwise PENDING

## Supabase Integration
- Supabase Storage service (`backend/src/services/storageService.ts`) handles doctor photo operations: upload, delete, replace, and validation
- Supabase Storage bucket name is configurable via `SUPABASE_STORAGE_BUCKET` environment variable (default: `doctor-photos`)
- Supabase Storage service validates PNG files with signature checking, 4MB size limit, and MIME type validation
- Supabase Storage credentials (service role key) remain backend-only and are never exposed to frontend applications
- Professional photo upload stores files in Supabase Storage bucket `doctor-photos` and serves them via Supabase public URLs
- Professional photo field `professional_photo_url` stores the Supabase public URL of the uploaded file
- Legacy `/uploads/` URLs are still supported for existing photos (backward compatibility)
- Backend photo upload uses multer with memory storage, PNG-only file filter, and 4MB size limit
- Backend uploads photos to Supabase Storage bucket `doctor-photos` using service role credentials (backend-only)
- Backend serves uploaded photos via Supabase public URLs (CDN-backed)
- Backend validates PNG files by checking the actual PNG magic number signature (0x89 50 4E 47 0D 0A 1A 0A) before upload
- Backend photo replacement automatically deletes old photos from Supabase Storage or legacy local filesystem
- Backend provides DELETE /api/v1/doctors/me/photo endpoint for authenticated doctors to delete their professional photo
- Photo deletion clears the database field and deletes the file from Supabase Storage or legacy local filesystem
- Photo deletion handles both Supabase URLs and legacy `/uploads/` paths for backward compatibility
- Frontend displays photos using Supabase public URLs (new uploads) or legacy `/uploads/` URLs (existing photos)
- No database migration required for Supabase Storage implementation (doctor photos stored externally, database only stores URL references)
- Backend configuration includes `supabase.storageBucket` field for Supabase Storage bucket name (default: `doctor-photos`)
- Admin account creation via `POST /api/v1/admin/admins` includes Supabase Auth identity provisioning via `ensureAdminSupabaseIdentity` for regular Admins (idempotent, duplicate-safe)
- Secretary account creation via Admin or Doctor includes Supabase Auth identity provisioning via `ensureSecretarySupabaseIdentity` (idempotent, duplicate-safe)
- Admin reconciliation endpoint `POST /api/v1/admin/admins/reconcile-supabase` provisions Supabase identities for existing regular Admin accounts (SUPERADMIN only)
- Secretary reconciliation endpoint `POST /api/v1/admin/secretaries/reconcile-supabase` provisions Supabase identities for existing Secretary accounts (ADMIN or SUPERADMIN)
- Admin seed script creates Admin accounts without immediate Supabase identity provisioning; identities are provisioned on-demand during API calls or via reconciliation endpoint
- PostgreSQL remains the single source of truth for all application account data (users, doctors, secretaries, patients)
- Supabase Auth is used only for OTP delivery and verification, not for storing application accounts or credentials

## Patient Reservation Flow
- Mobile patient app includes a complete reservation flow from date selection to appointment confirmation
- Reservation flow: Doctor Schedule & Date page (`/doctor-schedule`) → patient record check → if no record: Patient Details page (`/patient-details`) → Booking Confirmation page (`/booking-confirmation`) → automatic submission to backend → queue number assignment → display confirmation
- Mobile Doctor Schedule page displays doctor availability via `GET /api/v1/doctors/:doctorId/availability` endpoint and allows patients to select available dates. The endpoint accepts the patient's PATIENT token (shared sub-resource exemption from the portal cross-role check; previously it 401'd valid patient tokens with "Invalid or expired token" because the `/doctors` namespace was forced to the DOCTOR portal)
- When patient confirms a date, the app checks if they have an existing record with the selected doctor via `GET /api/v1/patients/check-record?doctorId={id}`
- If patient has a complete record (hasRecord: true), they proceed directly to booking confirmation
- If patient has no record or incomplete record (hasRecord: false), they are redirected to the Patient Details page to submit required information
- Mobile Patient Details page loads the authenticated patient's profile via `GET /api/v1/patients/me` and pre-fills existing data
- Patient Details page requires: First Name, Last Name, Date of Birth, Sex (MALE, FEMALE, OTHER, NOT_SPECIFIED), Mobile Number, Address; optional: Middle Name
- Email is loaded from the authenticated account and displayed as non-editable
- Patient Details page validates all required fields on the client before submission
- Patient Details page submits details via `POST /api/v1/patients/submit-details` with doctorId, firstName, middleName (optional), lastName, dateOfBirth, sex, phone, address
- After successful details submission, the patient is redirected to Booking Confirmation with all booking state preserved (doctorId, doctorName, specialty, clinic, consultationFee, selectedDate)
- Mobile Booking Confirmation page automatically submits the reservation to `POST /api/v1/appointments` when loaded, passing doctorId, appointmentDate (date-only format: yyyy-MM-dd), and reasonForVisit
- Backend `POST /api/v1/appointments` performs comprehensive server-side validation including: patient authentication, doctor approval status, date validity, availability check (working hours, breaks, exceptions/unavailability), capacity check, conflict detection (same date only), patient record check, queue number assignment, and notification creation
- Backend validation rechecks all scheduling constraints at submission time to prevent race conditions and double-booking
- Patients are assigned queue numbers based on first-come-first-served order for the selected date (no specific time slot assignment)
- Mobile patient Appointments page (`/appointments` tab in HomePage) connects to `GET /api/v1/appointments` and displays real appointment records with filters (Upcoming, Completed, Cancelled)
- Mobile patient record workflow tests verify: complete record navigation, missing/incomplete record routing, API error handling, authenticated email display, required field validation, optional middle name, submission success/failure behavior, back navigation state preservation, and loading/submit protection
- Mobile Appointments page removes all hardcoded data and uses dynamic data from backend with loading, empty, and error states
- Web Doctor Appointments page at `/doctor/appointments` connects to `GET /api/v1/appointments` and displays real appointment records for the authenticated doctor with status filters and statistics
- Web Secretary Appointments page at `/secretary/appointments` connects to `GET /api/v1/appointments` and displays real appointment records for the doctor the secretary is assigned to, with status filters and statistics
- Backend `GET /api/v1/appointments` supports role-based filtering: PATIENT returns their own appointments, DOCTOR returns their appointments, SECRETARY returns appointments for their assigned doctor
- Backend appointment creation includes queue number assignment via `queue_entries` table, capacity consumption via `daily_capacities` table, and notification creation
- Queue number assignment is concurrency-safe using `SELECT COALESCE(MAX(queue_number), 0) + 1` pattern
- After successful booking, the appointment is immediately visible on patient, doctor, and secretary Appointments pages without requiring app restart or manual refresh
- Mobile Appointments page uses `didUpdateWidget` to refresh data when returning to the tab
- Supabase Storage service role key is required for backend photo operations and must not be exposed to frontend applications

## Database Schema
- Database schema includes approval status fields, pending doctor signups staging table (basic fields only), and pending patient signups staging table (username plus detailed patient fields: middle_name, date_of_birth, sex, phone, address)
- Migration `026_add_pending_patient_signup_details.sql` adds middle_name, date_of_birth, sex, phone and address to pending_patient_signups so patient details captured during sign-up are persisted on OTP verification
- Database schema includes `middle_name` field in `doctors` and `pending_doctor_signups` tables (migration 010_add_middle_name.sql)
- Database schema includes extended doctor profile fields (migration 016_doctor_profile_fields.sql): contact_number, professional_photo_url, years_of_experience, areas_of_expertise (comma-separated text), consultation_type, languages_spoken (comma-separated text), profile_completion_status, profile_submitted_at
- Migration `017_modify_pending_doctor_signup_for_basic_flow.sql` adds contact_number field to pending_doctor_signups for basic registration flow (professional fields remain in table for compatibility)
- Database migration `016_allow_multiple_schedules_per_day.sql` removes UNIQUE constraint on (doctor_id, day_of_week) to support multiple shift blocks per day (e.g., morning and afternoon shifts)
- Database migration `017_add_doctor_break_periods.sql` adds `doctor_break_periods` table for break period management and adds `is_active` and `updated_at` columns to `doctor_unavailability` table for soft delete support
- Database migration `028_add_device_tokens.sql` adds the `device_tokens` table associating authenticated users' FCM/APNs push tokens with their owning user (unique on provider+token with one active owner per token; re-registration reassigns the token); applied via `npm run migrate:device-tokens`
- Database migration `018_add_daily_capacities.sql` adds `daily_capacities` table for storing calculated and configured daily capacity values
- Doctor registration uses separate first name, middle name (optional), and last name fields instead of a single full name field

## Doctor Schedule Management
- Doctor schedule management feature allows doctors to create, view, edit, deactivate, and reactivate recurring weekly working hours
- Backend API endpoints for doctor schedules: `GET /api/v1/doctors/:id/schedules` (public, active only), `GET /api/v1/doctors/me/schedules` (authenticated, supports includeInactive query param), `POST /api/v1/doctors/me/schedules` (create), `PUT /api/v1/doctors/me/schedules/:id` (update), `PATCH /api/v1/doctors/me/schedules/:id/deactivate` (soft delete), `PATCH /api/v1/doctors/me/schedules/:id/reactivate` (reactivate)
- Doctor schedule validation enforces: start time < end time, no overlapping schedules on the same day, day of week between 0-6, doctors can only access their own schedules
- Doctor schedule operations use permanent deletion via DELETE endpoint (no soft delete/reactivate)
- Web schedule page at `/doctor/schedule` provides full UI for managing working hours with KPI cards, weekly schedule display, and modals for add/edit/deactivate operations
- Web schedule page at `/doctor/schedule` now includes tabbed interface with four tabs: Working Hours, Exceptions, Break Periods, and Capacity
- Web schedule page allows doctors to add, view, edit, and permanently delete date-specific exceptions (doctor leave, clinic closure, full-day unavailability)
- Web schedule page allows doctors to add, view, edit, and permanently delete break periods within working hours (e.g., lunch breaks)
- Past exception and break dates are automatically filtered out from the displayed lists
- Duplicate exception dates are prevented via disabled date picker options

## Doctor Exceptions & Break Periods
- Backend API endpoints for doctor unavailability (exceptions): `GET /api/v1/doctors/me/unavailability` (authenticated, supports includeInactive query param), `POST /api/v1/doctors/me/unavailability` (create), `PUT /api/v1/doctors/me/unavailability/:id` (update), `DELETE /api/v1/doctors/me/unavailability/:id` (permanent delete)
- Backend API endpoints for doctor break periods: `GET /api/v1/doctors/me/break-periods` (authenticated, supports includeInactive, startDate, endDate query params), `POST /api/v1/doctors/me/break-periods` (create), `PUT /api/v1/doctors/me/break-periods/:id` (update), `DELETE /api/v1/doctors/me/break-periods/:id` (permanent delete)
- Doctor unavailability validation enforces: start date <= end date, valid date format, doctors can only access their own exceptions
- Doctor break period validation enforces: start time < end time, valid time format, break must fall completely within working hours for the specific date, no overlapping breaks on the same date, doctors can only access their own breaks
- Active exceptions remove availability for the affected date range; active break periods remove availability for the affected time periods on specific dates
- When a date has a full-day exception, calculated capacity is 0; when no working hours exist for the day, calculated capacity is 0

## Availability & Capacity
- Extended `GET /api/v1/doctors/:id/availability` endpoint to include active unavailability periods (exceptions) and active break periods in the response
- Availability service (backend/src/modules/availability/availabilityService.ts) calculates available dates considering: working hours, schedule exceptions, break periods, 30-minute consultation duration, daily capacity, existing reservations, and current date/time
- Availability service limits date availability based on remaining daily capacity (dates marked as FULL when capacity exhausted)
- Availability service returns date status: AVAILABLE, FULL, UNAVAILABLE, PAST, or NON_WORKING
- Availability service includes break periods information for display purposes
- Mobile doctor schedule page at /doctor-schedule displays calendar with visual status indicators and legend for all date states
- Mobile doctor schedule page confirmation button enables only after selecting a valid date with available capacity
- Backend appointment creation endpoint POST /api/v1/appointments validates: appointment is not in the past, date is AVAILABLE, daily capacity is not exceeded, and no existing appointment on the same date
- Capacity calculation service uses centralized 30-minute consultation duration to calculate maximum appointment slots based on available working time after excluding breaks and schedule exceptions
- Capacity system provides: Calculated Capacity (maximum slots based on available time), Configured Capacity (lower limit set by doctor/secretary), Final Capacity (actual allowed appointments), Remaining Capacity (final capacity minus existing reservations)
- Capacity calculation accounts for: working hours for the day of week, break periods on the specific date, full-day exceptions (unavailability) for the specific date
- Capacity calculation service at backend/src/modules/capacity/capacityService.ts handles time range merging, break period subtraction, and minute-based slot calculation
- Backend capacity endpoints updated to use real calculation: GET /api/v1/doctors/:id/capacity (supports date or date range query params), PUT /api/v1/doctors/:id/capacity (with ownership validation and capacity limit enforcement), POST /api/v1/doctors/:id/capacity/:date (with real calculation and validation)
- Backend adds authenticated doctor capacity endpoints: GET /api/v1/doctors/me/capacity, PUT /api/v1/doctors/me/capacity, POST /api/v1/doctors/me/capacity/:date (registered before parameterized /:id/capacity routes to prevent route shadowing, and returning updated capacity objects on save)
- Backend adds secretary capacity endpoints: GET /api/v1/secretaries/managed-doctors/capacity, PUT /api/v1/secretaries/managed-doctors/capacity, POST /api/v1/secretaries/managed-doctors/capacity/:date (integrated into Secretary Schedule page Capacity tab)
- Backend enforces ownership validation: doctors can only manage their own capacity, secretaries can only manage capacity for doctors they are assigned to
- Backend validates configured capacity cannot exceed calculated capacity on both frontend and backend
- Web doctor schedule page at /doctor/schedule and web secretary schedule page at /secretary/schedule feature a unified 5-metric responsive grid (Calculated, Configured, Final Limit, Registered, Remaining) with fixed-width input controls
- Web secretary schedule page at /secretary/schedule allows secretaries to manage capacity for their assigned doctor in the Capacity tab with the exact same UI as the doctor schedule page
- Secretary sidebar includes "Schedule" navigation item linking to /secretary/schedule; old `/secretary/capacity` route redirects to `/secretary/schedule` for backward compatibility

## Mobile Doctors Page
- Mobile Doctors page main design matches UI prototype from `UI-Prototypes/users-mobile-ui/doctors_page`
- Mobile Doctors page header redesigned with: logo with PH badge, notification icon with red dot indicator, profile picture with green dot indicator
- Mobile Doctors page search bar updated with: sticky positioning, clear button (shows when text entered), filter button with blue dot indicator
- Mobile Doctors page location indicator updated to show: "Metro Manila • Near me (5km)" with near_me icon, and active doctor count with teal color
- Mobile Doctors page specialty chips maintain existing design: icon, name, doctor count, active state with primary color
- Mobile Doctors page Top Verified Doctors section redesigned as horizontal carousel with detailed cards (288px width, 236px height) matching target prototype layout, displaying doctor portrait avatar with green online status dot, name, specialty, star rating with review count, hospital location with apartment icon, availability time slot, and bottom footer with consultation fee and Book Visit button
- Mobile Doctors page Top Verified Doctors section now displays all doctors dynamically from backend (no hardcoded data), using doctor photos from backend when available, fallback to placeholder icon
- Mobile Doctors page hospital cards dynamically populated from backend practice names (no hardcoded hospital data), displaying JCI badge, distance indicator, hospital name, location, and doctor count per hospital
- Mobile Doctors page specialty list dynamically populated from backend specialties, merged with 'All' option
- Mobile Doctors page hospital extraction includes all practice names (not excluding 'Private Practice') to ensure hospitals with that name are displayed
- Mobile Doctors page filtered list view matches UI prototype design with updated header (back button, specialty chip, result count, Change button)
- Mobile Doctors page filtered list view includes horizontal filter chips below search bar: All, Available Today, Hospital names (up to 3), Top Rated
- Mobile Doctors page detailed doctor cards display: doctor avatar, name, specialty, location, rating with review count, consultation fee, availability banner, View Profile button, and Book Visit button
- Mobile Doctors page filter chips track active state correctly: All clears hospital and verified filters, Top Rated enables verified filter, Hospital chips filter by specific hospital
- Mobile Doctors page search functionality works with specialty and hospital filters applied
- Mobile Doctors page result count dynamically updates based on current filters and search query
- Mobile Doctors page "Book Visit" button navigates to /doctor-schedule to select appointment time
- Mobile Doctors page dynamically derives specialties and hospitals from actual registered doctors
- Mobile Doctors page shows hospital cards with hospital name, address, and doctor count derived from database

## Web Application
- Web application provides role-specific dashboards for Doctor, Secretary, and Admin users
- Web application uses toast notifications (auto-dismiss after 2 seconds with close button) for success/error messages instead of inline banners
- Toast component at web/src/components/ui/Toast.tsx provides consistent notification UI across all pages
- Web Doctors page displays real doctor records from database through backend API (no hardcoded data)
- Web application authentication persists across page refreshes (Ctrl+R) via apiClient automatic localStorage token management (legacy)

## Mobile Application
- Mobile application includes OTP verification page for patient registration with full backend integration
- Mobile application authentication persists across hot restarts using SharedPreferences for token storage
- Mobile patient login page UI redesigned with a modern, card-based layout: gradient brand mark with PH badge, elevated login card with rounded corners and subtle shadows, focus-aware email/password fields (icon and border accent plus show/hide password toggle), and a prominent login button with distinct loading, success, and error feedback (inline error banner plus snackbar)
- Mobile login page uses a responsive, keyboard-aware scrollable layout (max content width constrained on larger screens) and subtle decorative background accents; authentication logic, validation rules, API integration, navigation, and session handling are unchanged
- Mobile patient sign-up page UI redesigned to match the login page design: soft gradient background, gradient brand mark with PH badge, elevated white form card with sectioned "Personal Information" and "Account Credentials" groups, focus-aware fields, and a prominent Create Account button with loading and error feedback
- Mobile sign-up collects separate First Name, Middle Name (Optional), and Last Name fields plus date of birth (date picker), sex (dropdown), mobile number, and address; emergency contact details, medical history, allergies, and current medications are excluded
- Mobile patient details are submitted with the sign-up OTP request and persisted to the `patients` table when the account is created after OTP verification
- Mobile sign-up form surfaces the backend's `409 Conflict` message from `/send` (e.g. `Username already taken`) in its inline error banner and snackbar, and stays on the form so no OTP is sent and no navigation to OTP verification occurs for a taken email or username
- Mobile `PrimaryButton` label is now overflow-safe (single line with ellipsis) so long button labels do not overflow on narrow screens or with enlarged system text
- Mobile screens tolerate the zero-sized first layout frame (Android reports a 0x0 viewport before the surface is ready): the login, sign-up, and OTP pages clamp their scrollable `minHeight` and the home page only reserves its empty-state filler when there is real vertical space, so no invalid negative constraints are produced
- Fixing the invalid constraints removes the `Each child must be laid out exactly once.` Scaffold layout crash (a failed body build was replaced by an `ErrorWidget`, leaving the Scaffold's multi-child layout inconsistent) and the frozen loading screen that required a manual refresh or hot restart
- Mobile home page data (specialties, recommended doctors, clinics) loads from `initState` and clears its loading flags on both success and failure; the resulting `setState` calls are guarded with a `mounted` check
- Mobile app startup authentication check always resolves initialization (falling back to the login screen if token/storage reads fail) so the startup progress indicator cannot hang
- Mobile appointment screens parse PostgreSQL `DECIMAL`/`NUMERIC` values (for example `doctors.consultation_fee`, which `pg` returns as a JSON string such as `"500.00"`) through the shared helpers in `mobile/lib/core/utils/json_parsers.dart` (`parseNum`, `parseInt`, `parseString`) instead of casting to `num?`; numeric strings, real numbers, `null`, empty strings, and invalid values all render safely (`₱---` / `N/A` placeholders) and the Appointments page no longer throws `type 'String' is not a subtype of type 'num?'`
- Mobile appointment date/timestamp fields are parsed with `DateTime.tryParse` on a safely parsed string, and payment status/method empty strings are treated as absent so no blank payment badge is rendered
- Mobile patient Profile tab is grouped into labeled Account / Security / Notifications / About / Log Out sections: an account summary card opens the standalone read-only `PatientProfilePage` (route `/patient-profile`), Change password reuses `ChangePasswordPage` and returns to Profile on success, a push-notifications switch reflects a persisted `push_notifications_enabled` preference (default ON), the About section shows the runtime app version (via `package_info_plus`) and a "Privacy notice" row (route `/privacy-notice`, static screen), and Log Out keeps the previous logout behavior with no confirmation dialog
- The mobile push-notifications switch registers this device's token through `POST /api/v1/notifications/device-tokens` when enabled and removes it through `DELETE /api/v1/notifications/device-tokens/:id` when disabled; the preference is stored locally via SharedPreferences, the OS notification permission is requested on first enable with a "open settings" hint when denied, and startup auto-registration for users who never opened the Profile screen still counts the preference (default ON) so nothing silently re-enables after the user turned it off
- Unauthenticated requests for `/patient-profile` or `/privacy-notice` are bounced to the login page by the shared route guard (same handling as other authenticated routes); secretaries are kept on the chat-first home for these routes
- `PushNotificationService` supports a test seam: `registerForCurrentUser()` returns `Future<bool>` (true only when a token was actually registered), added idempotent `disableForCurrentUser()`, the `PushNotificationService.channel` constant is public, and `PushNotificationService.withApiService(apiService)` lets tests inject a stub; `HomePage` accepts an optional `pushNotificationService` for widget tests
- New mobile dependencies: `permission_handler` (OS notification-permission UX; the app has no native push host — bare `MainActivity.kt`, no iOS folder) and `package_info_plus` (runtime app version); the previously committed `pubspec.lock` was corrupt (unparsable) and was regenerated
- Fixed the pre-existing mobile first-frame crash in the chat tab's empty-conversations filler (`MediaQuery.size.height - 300` unguarded on the zero-sized first layout pass, producing `BoxConstraints` with negative minimum height — the regression `test/initial_frame_layout_test.dart` guards against); the filler is now height-guarded like the other zero-frame-safe fillers
- Fixed the blank Secretary Chat tab (no list, no empty state, no spinner whenever the patient had conversations): the 01.20 height guard nested inside the `_conversations.isEmpty` collection-if branch made the trailing `else` bind to the inner guard instead of the outer empty-check, so a non-empty conversation list rendered nothing; the tab body is now a public `ChatTabContent` widget (`home_page.dart`) with explicit early-return branches (loading spinner / height-guarded empty state / card list), covered by `test/chat_tab_content_test.dart`

## Setup Progress Tracker
- Web Doctor Sidebar includes a Setup Progress Tracker component that tracks 4 setup steps: Account Registration & Email Verification, Complete Professional Profile, Admin Approval, and Set Availability & Schedule
- Setup Progress Tracker has a compact trigger button positioned above the "Clinical Workspace" navigation menu in the sidebar, displaying a circular progress indicator with the completed count inside, "Setup Progress" text, and a chevron
- Setup Progress Tracker opens as a floating panel anchored to the left sidebar when the trigger is clicked, extending into the right-hand dashboard content area
- Setup Progress Tracker floating panel has a white background, rounded corners, subtle shadow, and thin border, matching the existing royal-blue, white, and light blue-gray design
- Setup Progress Tracker floating panel includes a close control and has a maximum height with internal scrolling if content exceeds viewport height
- Setup Progress Tracker automatically determines step completion status from backend data: email_verified field for registration, profile_completion_status for profile, approval_status for admin approval, and schedule count for availability
- Setup Progress Tracker also performs client-side validation to check if any profile fields are missing (specialty, credentials, PRC license, practice name, years of experience, areas of expertise, biography, consultation fee, languages spoken, professional photo) before marking the profile step as complete
- Setup Progress Tracker does not include action buttons; it only displays progress status and missing information indicators
- Setup Progress Tracker displays "Professional information incomplete" indicator when any profile field is missing, listing the specific missing fields (Specialty, Credentials, PRC License Number, Hospital/Clinic, Years of Experience, Areas of Expertise, Biography, Consultation Fee, Languages Spoken, Professional Photo)
- Setup Progress Tracker displays schedule setup indicator when schedule is missing but profile is complete
- Setup Progress Tracker closes when clicking outside the panel or clicking the close control
- Setup Progress Tracker does not cause layout shifts when opened or closed; the sidebar navigation remains completely independent
- Setup Progress Tracker automatically hides when all 4 steps are completed (verified email, all profile fields provided, ACTIVE approval status, and at least one schedule configured)
- Setup Progress Tracker component is located at web/src/components/ui/SetupProgressCard.tsx and is integrated into the Doctor Sidebar component (web/src/components/layout/DoctorSidebar.tsx)

## API Endpoints Summary
- Backend API includes comprehensive endpoints for doctors, admin, OTP, appointments, queue, payments, etc.
- Backend API endpoints for doctor profile: `PUT /api/v1/doctors/me/profile` (update profile), `POST /api/v1/doctors/me/profile/submit` (submit for approval), `POST /api/v1/doctors/me/photo` (upload professional photo), `DELETE /api/v1/doctors/me/photo` (delete professional photo)
- Backend API endpoints for doctor schedules: `GET /api/v1/doctors/me/schedules`, `POST /api/v1/doctors/me/schedules`, `PUT /api/v1/doctors/me/schedules/:id`, `DELETE /api/v1/doctors/me/schedules/:id`
- Backend API endpoints for admin doctor review: `GET /api/v1/admin/doctors` (list all doctors with complete profile), `GET /api/v1/admin/doctors/:id` (get doctor details), `GET /api/v1/admin/doctors/:id/schedules` (get doctor schedules), `PATCH /api/v1/admin/doctors/:id/approve` (approve with validation), `PATCH /api/v1/admin/doctors/:id/reject` (reject with required reason)
- Backend doctors API returns all profile fields including `profile_completion_status` and `profile_submitted_at`
- Patient-facing doctor search endpoint `GET /api/v1/doctors` does not expose PRC license number, personal contact number, or email address
- Patient-facing doctor by ID endpoint `GET /api/v1/doctors/:id` does not expose PRC license number, personal contact number, or email address

## Patient-Secretary Messaging and Push Notifications
- Conversations router mounted at `/api/v1/conversations`; `GET /conversations` lists conversations for the authenticated patient or secretary with patient details, doctor/practice names, an unread count computed from `messages.read_at` (excluding the caller's own sent messages), and a latest-message preview consistent with the newest saved message
- Conversation access rules: a patient accesses only their own conversations and only for doctors with a matching `patient_doctor_associations` record; a secretary accesses only conversations for patients associated with their assigned doctor via `secretaries.doctor_id`; access is enforced consistently on listing, creation, retrieval, message retrieval, sending, and read-status updates; DOCTOR/ADMIN/SUPERADMIN roles receive no conversation access
- `POST /conversations` creates or reuses the patient's single conversation per doctor (reporting `Conversation already exists` when reused); secretaries assigned to the same doctor share the same conversation and message history without per-secretary duplicates; creation verifies the patient's doctor association and the requested secretary's assignment to the doctor
- `GET /conversations/:id` and `GET /conversations/:id/messages` return data only for authorized callers (otherwise 404/403 `CONVERSATION_ACCESS_DENIED`); `POST /conversations/:id/messages` saves the message, updates the conversation timestamp, and rejects empty messages
- After a message is saved, notifications are sent only to recipients, never the sender: patient-sent → `NEW_PATIENT_MESSAGE` to the secretaries assigned to the conversation's doctor; secretary-sent → `NEW_SECRETARY_MESSAGE` to the patient; titles, bodies, and push payloads are generic and never contain message content
- Push delivery service at `backend/src/services/pushService.ts` supports FCM (HTTP v1 with service-account credentials, legacy server-key fallback) and APNs token-based delivery over HTTP/2; push is best-effort after a message save, targets only intended recipients' registered device tokens, unregisters invalid tokens, and skips delivery when credentials are unconfigured; all provider credentials remain backend-only environment configuration (never exposed to mobile/web)
- Device-token endpoints under the notifications prefix: `POST /api/v1/notifications/device-tokens` registers a token for the authenticated user (upsert reassigns the token to the latest owner) and `DELETE /api/v1/notifications/device-tokens/:id` removes only the owner's token (404 otherwise)
- `PATCH /conversations/:id/read` marks incoming messages (`read_at IS NULL`, others' messages) as read only for authorized callers
- The mobile patient conversation thread loads the full message history and scrolls to the latest message when opened; after sending, it refreshes the history and scrolls to the new latest message, while background polling does not interrupt the patient's scroll position
- On the mobile patient home page, conversation names and latest-message previews are bolded while the conversation has unread messages
- `GET /api/v1/conversations/:id/appointment-summary` is a read-only, SECRETARY-only patient-info sheet endpoint enforcing conversation access rules; returns only appointment fields the interface needs (date, status, reason for visit, queue number) plus the patient's name/DOB/phone/email and doctor/practice names; exposes no appointment mutations
- The shared patient/secretary mobile application supports secretary login with the same username/password as the secretary web dashboard, routes secretaries to `/secretary-home` (conversation list with patient information, last-message previews, and unread counts) and patients to the existing tabbed patient home, and reuses the same conversation, message, read-status, unread-count, and last-message-preview records as the web chat
- Secretary mobile users can open the shared conversation thread, titled with the patient's name, view patient message histories, send and receive messages, mark conversations read on open, and view the read-only patient-info sheet; the secretary mobile menu contains only Notifications, Profile, Settings, and Logout
- Secretaries cannot access queue management, payment verification, walk-in registration, or schedule management screens in the mobile application; all appointment management remains on the secretary web dashboard
- The mobile application registers its push device token after successful authentication and removes or invalidates it during logout; `NEW_PATIENT_MESSAGE` (secretaries) and `NEW_SECRETARY_MESSAGE` (patients) notification taps open the correct conversation thread only after the authenticated user's authorization to that conversation is verified; notification titles, bodies, and push previews remain generic and never contain message content

## Secretary Web Chat
- Secretary web page at `/secretary/conversations` replaced the placeholder with a functional three-column chat: conversation list (patient details, unread badges/counts, latest-message previews), message thread with distinct sender/recipient styling and read/delivered indicators, and a message composer with Enter-to-send and disable-while-sending
- Right column renders a read-only patient-info sheet from the appointment-summary endpoint (patient contact block, appointment status/date/queue number/reason, clinic block); backend errors are surfaced with the existing red banner pattern on the list, thread, and info columns
- `web/src/lib/api/secretaryApi.ts` adds `Conversation`, `ConversationMessage`, `AppointmentSummary` types and the `conversationApi` client (list, get, messages, send, mark-as-read, appointment summary) using relative paths against the existing API base URL, which already includes `/api/v1`
- The web chat uses the backend and database as the single source of truth with no separate conversation or message storage; the thread auto-refreshes on a 10-second interval while open, and unread badges refresh alongside it
- `SecretarySidebar` adds an unread badge on the Conversations nav item (polls the conversation list every 30 seconds) without changing the existing sidebar layout

## Secretary Schedule Management
- Secretary Portal navigation updated: "Capacity" replaced with "Schedule" linking to `/secretary/schedule`
- Doctor Portal navigation updated: "My Profile" label changed to "Profile"
- Redirect from `/secretary/capacity` to `/secretary/schedule` for backward compatibility
- Secretary Schedule page at `/secretary/schedule` provides four tabs: Working Hours (read-only), Exceptions (add/edit/delete), Break Periods (add/edit/delete), and Capacity
- Working Hours tab displays the assigned doctor's weekly working hours with no write controls for secretaries
- Exceptions tab allows secretaries to add, edit, and delete date-specific exceptions for their assigned doctor
- Break Periods tab allows secretaries to add, edit, and delete break periods for their assigned doctor
- Capacity tab preserves the existing Secretary Capacity page behavior and UI
- Backend secretary schedule endpoints: `GET /api/v1/secretaries/managed-doctors/schedules` (read-only), `GET/POST/PUT/DELETE /api/v1/secretaries/managed-doctors/unavailability`, `GET/POST/PUT/DELETE /api/v1/secretaries/managed-doctors/break-periods`
- Secretary schedule endpoints use ownership check: `SELECT doctor_id FROM secretaries WHERE user_id = $1` to derive the target doctor from the authenticated secretary
- Unauthorized access to another doctor's records returns 404 (non-disclosing, no information leakage)
- Secretary schedule endpoints are SECRETARY-only; other roles receive 403 Forbidden
- Weekly working hours remain doctor-only to create, edit, and delete; secretaries have read-only access
- Schedule validation for exceptions: start date <= end date, valid date format
- Schedule validation for break periods: start time < end time, valid time format (HH:MM)
- Backend tests verify secretary schedule access is restricted to assigned doctor, ownership enforcement, and validation rules
