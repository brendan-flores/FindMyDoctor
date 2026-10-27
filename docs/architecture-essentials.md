# FindMyDoctor — Architecture Essentials

## 1. Purpose

This document contains the non-negotiable architectural and development rules for FindMyDoctor.

It must be used together with:

```text
PRD.md
ARCHITECTURE.md
```

AI coding agents and developers must follow these rules when creating or modifying the project.

---

# 2. Core Architecture

Always use:

```text
Mobile App
    ↓
Backend API
    ↓
PostgreSQL
```

AI:

```text
Backend
    ↓
External AI Provider
```

### Absolute Rule

The mobile app must never connect directly to PostgreSQL.

---

# 3. User Roles

Supported roles:

```text
PATIENT
DOCTOR
SECRETARY
ADMIN
SUPERADMIN
```

Do not invent roles without changing the project requirements.

### Clinic and Consultation Operations Boundary

Clinic and consultation operations belong to doctors and authorized secretaries. Doctors alone may create, edit, or delete weekly working hours. Secretaries may view weekly working hours and may manage exceptions, break periods, and daily capacity only for their assigned doctor. `ADMIN` and `SUPERADMIN` roles are limited to platform, account, and approval oversight and must not receive permissions to manage schedules, availability, break periods, daily capacity, reservations, queues, payment verification, or consultation records.

---

# 4. Communication Rules

These are hard requirements:

```text
Patient ↔ Secretary = YES
Patient ↔ AI        = YES
Patient ↔ Doctor    = NO
```

The patient must never receive a direct doctor-chat feature.

Do not create:

```text
Doctor Chat Screen
Doctor Chat API
Doctor Conversation Table
Patient Doctor Messaging Service
```

---

# 5. Secretary Chat Rules

Patient-secretary chat may be used for:

- Appointment questions.
- Schedule questions.
- Queue-related questions.
- Reservation assistance.

The backend must verify:

```text
Authenticated User
        ↓
Valid Conversation
        ↓
Authorized Participant
        ↓
Send / Read Message
```

Patients cannot access another patient's conversation.

Secretaries cannot access unrelated conversations without authorization.

### Conversation Access and Sharing

- A patient may access only their own conversations and only for a doctor with whom they have a matching `patient_doctor_associations` record; conversation creation must verify both the patient's association with the doctor and the requested secretary's assignment to that doctor (`secretaries.doctor_id`).
- A secretary accesses conversations only for patients associated with their assigned doctor; secretaries assigned to the same doctor share access to the same patient conversations and message history, reusing existing conversation and message records without per-secretary duplicate histories.
- These access rules apply consistently to conversation listing, creation, retrieval, message retrieval, sending, and read-status updates. Unauthorized access must not return data.

### Unread Counts, Previews, and Read Status

- Unread counts use `messages.read_at` and exclude messages sent by the current user.
- Conversation-list results include the unread count and a latest-message preview consistent with the most recent saved message.
- `PATCH /api/v1/conversations/:id/read` marks incoming messages as read only for authorized callers.

### Patient-Info Sheet Endpoint

- `GET /api/v1/conversations/:id/appointment-summary` is a read-only secretary endpoint. It returns only the appointment fields the patient-info sheet needs (appointment date, status, reason for visit, queue number plus the patient's basic contact details), applies the same role-based access rules as the conversation (SECRETARY role, assigned-doctor scope, doctor association), and exposes no appointment mutations.

### Chat Notifications and Push Delivery

- After a message is saved: patient-sent → `NEW_PATIENT_MESSAGE` to the secretaries assigned to the conversation's doctor; secretary-sent → `NEW_SECRETARY_MESSAGE` to the patient. Recipients only, never the sender; titles, bodies, and push payloads are generic and never contain message content.
- `POST /api/v1/notifications/device-tokens` and `DELETE /api/v1/notifications/device-tokens/:id` let an authenticated user register and remove only their own device tokens (stored in the `device_tokens` table, one active owner per token).
- FCM/APNs delivery runs after a message is saved and targets only the intended recipients; provider credentials remain on the backend and are never exposed to the mobile application.

### Shared Mobile Application Access

- The mobile application is shared by patients and secretaries; it uses the same backend authentication endpoint and credentials as the web dashboards, with no separate app or credential system.
- `User.role` from `POST /api/v1/auth/login` is the single source of truth for routing: patients reach the existing patient home, secretaries reach the chat-first secretary home.
- Removing an account's access on the backend must also deny its mobile access; the mobile client never decides authorization on its own, and unauthorized access must not return data.
- Secretary mobile access is limited to the conversation list, the shared conversation thread, the read-only patient-info sheet, and a minimal Notifications/Profile/Settings/Logout menu; queue, payment, walk-in, and schedule management stay on the web dashboard.
- Logout clears the session and removes or invalidates the registered device token.

---

# 6. AI Chatbot Rules

The AI chatbot is for:

> **General medical information and health education.**

The AI is not a doctor.

It must not:

```text
Diagnose
Prescribe
Change medication
Replace professional advice
Make medical decisions
Claim to be a physician
```

Potentially urgent situations should encourage professional or emergency care.

---

# 7. AI Security

The AI API key must remain on the backend.

Correct:

```text
Mobile → Backend → AI Provider
```

Incorrect:

```text
Mobile → AI Provider
```

Do not expose:

```text
AI_API_KEY
DATABASE_URL
AUTH_SECRET
```

to the mobile application.

---

# 8. AI Data Minimization

Do not automatically send complete patient records to the AI provider.

Avoid unnecessary transmission of:

```text
Full Medical History
Full Prescription History
Unrelated Appointments
Other Patient Data
Credentials
Secrets
Database Data
```

Send only necessary information.

---

# 9. Consultation Duration

The default estimated consultation duration is:

```text
30 minutes
```

Do not replace this default unless the requirements are explicitly changed.

---

# 10. Daily Capacity Rules

Capacity must consider:

```text
Doctor Availability
Operating Hours
Break Periods
Consultation Duration
Configured Daily Maximum
```

Calculation:

```text
Available Consultation Time
÷ Consultation Duration
=
Calculated Capacity
```

Final capacity:

```text
MIN(Calculated Capacity, Configured Capacity)
```

when a lower configured capacity exists.

---

# 11. Capacity Applies to Both Sources

These are equal:

```text
Online Registration
Walk-in Registration
```

Both consume one unit of the daily capacity.

Do not create separate capacity pools.

Correct:

```text
Online + Walk-in = One Daily Capacity
```

---

# 12. Full Capacity Rule

When:

```text
Registered Patients >= Final Capacity
```

the date becomes:

```text
FULL
```

The system must reject:

- New regular online reservations.
- New walk-in registrations.

Do not depend only on the mobile UI to display the Full state.

---

# 13. Unified Queue Rule

Online and walk-in patients must use one unified daily queue.

```text
ONLINE
   \
    → UNIFIED QUEUE
   /
WALK-IN
```

Do not create separate online and walk-in queues.

---

# 14. Queue Priority Rule

Queue priority is determined by successful registration time.

Registration source does not affect priority.

Example:

```text
09:01 Online  → #1
09:04 Walk-in → #2
09:08 Online  → #3
```

Never automatically prioritize:

```text
Online > Walk-in
```

or:

```text
Walk-in > Online
```

---

# 15. Queue Number Rule

Queue numbers must be sequential and concurrency-safe.

Never generate queue numbers using:

```text
Frontend counters
Client-side timestamps
Local mobile state
```

The backend/database is responsible for queue assignment.

---

# 16. Queue Status Rules

Use controlled states:

```text
WAITING
CALLED
NOT_PRESENT
SKIPPED
IN_CHECKUP
COMPLETED
CANCELLED
NO_SHOW
```

Important:

> Skipping a patient must not automatically delete the queue record.

---

# 17. Secretary Queue Controls

The secretary must be able to perform:

```text
Next Patient
Start Checkup
Skip / Not Present
Complete Checkup
```

Queue status transitions must be handled by the backend.

Do not implement critical queue logic only in the mobile UI.

---

# 18. Reservation and Payment Rule

Payment and reservation are separate.

A regular consultation reservation must succeed without advance payment.

Do not reject a reservation because:

```text
Patient has no funds
Patient chooses to pay later
Patient has not uploaded a receipt
```

---

# 19. GCash Rules

The MVP does not use a GCash payment API.

Use:

```text
Static GCash QR
```

Patient flow:

```text
View QR
 ↓
Pay using GCash
 ↓
Upload Receipt
 ↓
Pending Verification
 ↓
Secretary Review
 ↓
Paid / Rejected
```

Receipt upload does not automatically mean the payment is valid.

---

# 20. Payment Status Rules

Use:

```text
UNPAID
PENDING_VERIFICATION
PAID
REJECTED
```

Only authorized secretaries should verify GCash receipts during the MVP.

---

# 21. Additional Charge Rules

The secretary may add applicable charges.

Calculation:

```text
Consultation Fee
+
Additional Charges
=
Total Amount Due
```

Charges may include:

- Medicine.
- Additional services.
- Other applicable fees.

---

# 22. Walk-in Registration Rules

The secretary controls walk-in registration.

Workflow:

```text
Find Patient
 ↓
Existing?
 ├── Yes → Use Account
 └── No → Create Account
 ↓
Select Doctor
 ↓
Check Capacity
 ↓
Register
 ↓
Assign Queue
```

Walk-in registration must use the same capacity and queue logic as online reservation.

---

# 23. Walk-in Account Rules

If the patient has no account:

1. Collect email.
2. Email becomes username/login identifier.
3. Generate random temporary password.
4. Mark account as `must_change_password`.
5. Provide credentials through the designated process.
6. Require password change during first login (current password field not required).
7. Block normal application access until the password is changed.
8. After successful password change, show onboarding screens before accessing the application.

---

# 24. Temporary Password Security

Temporary passwords must:

- Be random.
- Contain letters and numbers.
- Be securely hashed.
- Not remain stored in plaintext.
- Require a first-login password change.

Do not expose temporary passwords through logs.

---

# 25. Medical History Rules

Every completed consultation must remain associated with the correct patient account.

Correct:

```text
Patient Account
 ↓
Appointment
 ↓
Visit
 ↓
Medical History
 ↓
Prescription
```

Do not create disconnected temporary medical records for walk-in patients.

---

# 26. Patient Data Rules

Treat the following as sensitive:

```text
Medical History
Allergies
Medications
Visit Notes
Prescriptions
Payment Records
GCash Receipts
Secretary Messages
AI Medical Conversations
```

Do not expose these through public endpoints.

---

# 27. Appointment Integrity

The backend must verify:

```text
Valid Doctor
+
Valid Schedule
+
Available Capacity
+
Available Consultation
+
No Conflict
+
Doctor-Specific Patient Record
```

before creating a reservation.

### Doctor-Specific Patient Record Check

Before confirming an appointment, the system must verify whether the patient has an existing record with the selected doctor (such as a previous appointment or completed consultation). If no record exists with that specific doctor, the system must prompt the patient to provide required details through the backend API before proceeding with reservation. The mobile application must never connect directly to PostgreSQL for record checks or updates.

**Patient Details Access:**
- Doctors access patient details through `/doctor/patients/` for patient management and `/doctor/appointments/:id` for appointment context
- Secretaries access patient details through `/secretary/walk-ins/` for registration, `/secretary/patients/` for lookup, and `/secretary/queue/` for queue context
- All patient detail operations must go through the backend API; web dashboards must not connect directly to PostgreSQL

---

# 28. Double-Booking Rule

Double booking is unacceptable.

Use:

- Server-side validation.
- Transactions.
- PostgreSQL constraints.
- Appropriate concurrency controls.

Never trust frontend availability alone.

---

# 29. Concurrency Rule

Protect these operations against simultaneous requests:

```text
Appointment Creation
Queue Number Assignment
Capacity Consumption
Walk-in Registration
```

The system must prevent:

```text
Capacity Overflow
Duplicate Queue Number
Double Booking
```

---

# 30. Database Rules

PostgreSQL is the source of truth for persistent data.

Use:

- Foreign keys.
- Constraints.
- Indexes.
- Transactions.
- Migrations.

Do not bypass database integrity requirements.

---

# 31. Required Database Concepts

The architecture should support:

```text
users (including SUPERADMIN role)
patients
doctors (with approval_status: PENDING, ACTIVE, REJECTED, two_factor_enabled: boolean)
secretaries (with two_factor_enabled: boolean)

doctor_schedules
doctor_unavailability
daily_capacities

appointments
queue_entries

visits
prescriptions
prescription_items

payments
payment_charges

conversations
messages

ai_conversations
ai_messages

waitlists
notifications
device_tokens (for push notification delivery)

pending_doctor_signups (for OTP staging)
pending_patient_signups (for OTP staging)
login_otp_challenges (for login OTP challenge state)
```

**Database Migrations:**
- `001_initial_schema.sql` - Core database schema
- `005_doctor_self_registration.sql` - Doctor self-registration fields
- `006_doctor_signup_otp_flow.sql` - Doctor OTP staging table
- `007_doctor_approval_states.sql` - Doctor approval workflow
- `008_patient_signup_otp_flow.sql` - Patient OTP staging table
- `026_add_pending_patient_signup_details.sql` - Adds `middle_name`, `date_of_birth`, `sex`, `phone` and `address` to the patient OTP staging table so sign-up patient details are persisted on verification
- `013_add_two_factor_settings.sql` - Adds `two_factor_enabled` column to `doctors` and `secretaries` tables
- `014_add_login_otp_challenges.sql` - Creates `login_otp_challenges` table for server-side OTP challenge state
- `015_enforce_secretary_doctor_relationship.sql` - Enforces required foreign key and non-null assignment for `secretaries.doctor_id`
- `016_doctor_profile_fields.sql` - Adds extended doctor profile fields: contact_number, professional_photo_url, years_of_experience, areas_of_expertise (comma-separated text), consultation_type, languages_spoken (comma-separated text), profile_completion_status, profile_submitted_at
- `017_modify_pending_doctor_signup_for_basic_flow.sql` - Adds contact_number field to pending_doctor_signups for basic registration flow (professional fields remain in table for compatibility)
- `028_add_device_tokens.sql` - Creates the `device_tokens` table associating FCM/APNs push tokens with their owning user (one active owner per token, unique on provider+token)
- `029_add_gcash_qr_url.sql` - Adds `gcash_qr_url` column to `doctors` table for storing doctor-specific GCash QR code URLs
- `033_add_gcash_qr_updated_at.sql` - Adds `doctors.gcash_qr_updated_at` for the QR upload timestamp shown in secretary settings (cleared on QR deletion); `doctors.updated_at` cannot serve this role because profile/photo edits also bump it. Applied via `npm run migrate:gcash-qr-updated-at`.
- `022_add_trusted_browsers.sql` - Creates the `trusted_browsers` table for trusted-device sessions (hashed tokens, device info, 30-day expiry, revocation timestamps)
- `032_add_session_version.sql` - Adds `users.session_version` for account-wide refresh-token revocation on password change/reset, deactivation, and "Sign out of all devices"

---

# 32. Web Application Authentication

The web application provides role-specific dashboards for doctors, secretaries, and administrators with dedicated authentication flows.

### Route Structure

```text
FiDo Web
├── Admin
│   └── `/admin/login` → `/admin/dashboard`
├── Doctor
│   └── `/doctor-login` → `/doctor/dashboard`
├── Secretary
│   └── `/secretary-login` → `/secretary/dashboard`
└── Doctor Sign-Up (Self-Registration)
    └── `/doctor-signup` → Supabase email OTP → PostgreSQL account → `/doctor-profile` → Complete profile → Submit for approval
```

### Authentication Rules

**Root Route (`/`):**
- Unauthenticated users redirect to `/doctor-login` (default login)
- Authenticated users redirect to their role-specific dashboard

**Admin Authentication:**
- Dedicated login at `/admin/login`
- Admin-only UI with no Doctor/Secretary selector
- Sends expected role `ADMIN`; the backend accepts ADMIN and the existing SUPERADMIN role for this portal and checks before creating or sending an OTP challenge
- Doctor and Secretary accounts are rejected with a generic invalid-credentials/account-role error before OTP
- Successful login redirects to `/admin/dashboard`
- Non-Admin login attempts are denied

**Doctor Authentication:**
- Dedicated login at `/doctor-login`
- Doctor-only UI with no role selector
- Sends expected role `DOCTOR`; the backend checks the assigned role before creating or sending an OTP challenge
- Admin, SuperAdmin, and Secretary accounts are rejected with a generic invalid-credentials/account-role error before OTP
- Successful login redirects to `/doctor/dashboard`
- Non-Doctor login attempts are denied

**Secretary Authentication:**
- Dedicated login at `/secretary-login`
- Secretary-only UI with no role selector
- Sends expected role `SECRETARY`; the backend checks the assigned role before creating or sending an OTP challenge
- Admin, SuperAdmin, and Doctor accounts are rejected with a generic invalid-credentials/account-role error before OTP
- Successful login redirects to `/secretary/dashboard`
- Non-Secretary login attempts are denied

### Doctor Sign-Up (Self-Registration)

The doctor sign-up page at `/doctor-signup` creates a doctor account:

- Reached from the Doctor login page at `/doctor-login` through the "Create an Account" link.
- **Step 1 - Basic Registration:** Collects only basic information (first name, middle name optional, last name, email, contact number, password, confirm password).
- Uses the standard client pattern: the page calls the backend REST API and never touches PostgreSQL or Supabase directly.
- Step 1 - `POST /api/v1/auth/otp/send` validates the form (required fields, email format, password length, password/confirm-password match, first and last name) and checks that the email is not already registered.
- The validated payload - with the password already hashed using bcrypt - is staged server-side in the `pending_doctor_signups` table (added by migration `006_doctor_signup_otp_flow.sql`, modified by migration `017_modify_pending_doctor_signup_for_basic_flow.sql`, 15-minute expiry). No `users` or `doctors` row is created at this step.
- Supabase is then used only to email the 6-digit OTP to the doctor's address.
- **Step 2 - OTP Verification:** `POST /api/v1/auth/otp/verify` verifies the OTP with Supabase and, only when verification succeeds, creates the `users` record (`role = DOCTOR`, `email_verified = true`) and the `doctors` profile with `profile_completion_status = 'INCOMPLETE'` atomically in one PostgreSQL transaction, then deletes the staged row.
- The password is hashed with bcrypt and `must_change_password` is false because the doctor chooses their own password.
- Basic information (first_name, middle_name, last_name, contact_number) is stored in the doctors table.
- Professional information fields (specialty, credentials, PRC license number, hospital/clinic, etc.) are NOT collected at this stage.
- Registered doctors are created with `approval_status = 'PENDING'` and `profile_completion_status = 'INCOMPLETE'`, so they must complete their professional profile and wait for administrator approval before accessing the system.
- After successful OTP verification, the backend returns an access token which is stored in localStorage using the existing authentication mechanism.
- The doctor is automatically redirected to `/doctor-profile` to complete their professional profile.
- Duplicate email returns `409`. A successful verification returns an access token and redirects to profile completion.
- PostgreSQL is the single source of truth for doctor accounts, credentials and profile data. Supabase never stores the doctor's application account - it only sends and verifies the email OTP.

### Doctor Profile Completion

After successful OTP verification, doctors must complete their professional profile:

- **Profile Update Endpoint:** `PUT /api/v1/doctors/me/profile` (requires Doctor authentication)
  - Accepts professional profile fields: professional_photo_url, specialty, credentials, prc_license_number, practice_name, years_of_experience, areas_of_expertise, biography, consultation_fee, consultation_type, languages_spoken
  - Validates PRC license number format (7 digits) and uniqueness
  - Automatically updates `profile_completion_status` to 'COMPLETE' when all required fields are present
  - Allows partial updates (field-by-field or multiple fields at once)

- **Profile Submission Endpoint:** `POST /api/v1/doctors/me/profile/submit` (requires Doctor authentication)
  - Validates required fields before submission: first name, last name, verified email, contact number, specialty, credentials, PRC license number, hospital/clinic
  - Sets `profile_completion_status = 'SUBMITTED'` and `profile_submitted_at` to current timestamp
  - Keeps `approval_status = 'PENDING'` (does not approve the doctor)
  - Returns message directing doctor to wait for admin approval

### Doctor Approval Workflow

After a doctor completes self-registration, email OTP verification, and profile submission:

- The doctor account is created with `approval_status = 'PENDING'` and `profile_completion_status = 'INCOMPLETE'`.
- The doctor must complete their professional profile and submit it for review.
- After profile submission, `profile_completion_status` becomes 'SUBMITTED' but `approval_status` remains 'PENDING'.
- The doctor cannot log in or access the Doctor Dashboard while in PENDING status.
- Administrators can view pending doctors through the Admin Doctors page at `/admin/doctors`.
- Administrators can review complete doctor information and either:
  - Approve the doctor: Sets `approval_status = 'ACTIVE'` and `is_approved = true`, allowing the doctor to log in and access the Doctor Dashboard.
  - Reject the doctor: Sets `approval_status = 'REJECTED'` and `is_approved = false`, and sets `rejection_reason` with the admin's explanation.
- Only users with `role = ADMIN` can approve or reject doctor accounts.
- The public doctor search (`GET /api/v1/doctors`) only returns doctors with `approval_status = 'ACTIVE'`.
- Login attempts by PENDING doctors are blocked with appropriate error messages.
- The backend API includes endpoints for doctor approval: `PATCH /api/v1/admin/doctors/:id/approve` and `PATCH /api/v1/admin/doctors/:id/reject`.

### Doctor Rejection and Resubmission Workflow

When a doctor is rejected:

- The doctor's `approval_status` is set to 'REJECTED' and `rejection_reason` contains the admin's explanation.
- REJECTED doctors may authenticate specifically to correct and resubmit their application (they are not active/patient-visible).
- The rejected doctor can log in and is routed to `/doctor-profile` to view the rejection reason and correct their profile.
- The doctor can view their rejection reason via `GET /api/v1/doctors/me` which returns `approval_status` and `rejection_reason`.
- The rejected doctor can edit their professional profile fields and schedule via the existing profile update and schedule management endpoints.
- The rejected doctor can resubmit their profile via `POST /api/v1/doctors/me/profile/submit`.
- On successful resubmission:
  - `approval_status` is restored to 'PENDING'
  - `is_approved` remains false
  - `profile_completion_status` is set to 'SUBMITTED'
  - `profile_submitted_at` is updated to current timestamp
  - `rejection_reason` is cleared
- After resubmission, the doctor must wait for admin approval again.
- Admins cannot directly approve a REJECTED doctor; the doctor must resubmit first (which restores PENDING status).
- The admin approval endpoint `PATCH /api/v1/admin/doctors/:id/approve` explicitly rejects approving doctors with `approval_status = 'REJECTED'`.
- The web Doctor profile page at `/doctor-profile` handles the REJECTED state by:
  - Displaying a rejection banner with the rejection reason
  - Allowing profile editing even when `profile_completion_status === 'SUBMITTED'`
  - Allowing resubmission with a success message indicating the application is pending admin review
  - Reloading the profile after successful resubmission to reflect the updated status
- The web Doctor login page routes authenticated Doctors based on approval_status:
  - ACTIVE → `/doctor/dashboard`
  - REJECTED → `/doctor-profile`
  - PENDING → blocked by backend (should not reach frontend login routing)

`POST /api/v1/auth/register/doctor` remains available for Administrator-provisioned doctor accounts, but the self-registration page no longer uses it.

Administrator provisioning under Admin Account Provisioning remains available for accounts created on a doctor's behalf.

### Patient Registration with OTP

Patients can register accounts through email OTP verification:

**Registration Flow:**
```text
Patient Registration Form
        ↓
Collect Information (first/middle/last name, date of birth, sex, mobile number, address, email, username, password)
        ↓
Validate Email and Username Availability (409 Conflict stops the flow; nothing staged, no OTP sent)
        ↓
Send OTP via Supabase
        ↓
Patient Enters OTP
        ↓
Verify OTP with Supabase
        ↓
Create Patient Account and Patient Profile in PostgreSQL
        ↓
Patient Can Login
```

**Registration Requirements:**
- Names are captured as separate `firstName`, `middleName` (optional) and `lastName`; the legacy `fullName` field is still accepted and split into first/last name for backward compatibility
- Required patient details: date of birth (valid date), sex (one of `MALE`, `FEMALE`, `OTHER`, `NOT_SPECIFIED`), mobile number (maximum 20 characters), and address
- Emergency contact details, medical history, allergies, and current medications are not collected during patient sign-up
- Every patient field captured at sign-up is staged in `pending_patient_signups` and written to the `patients` table in the same PostgreSQL transaction that creates the account after OTP verification

**OTP Verification Requirements:**
- 6-digit OTP code sent to patient's email
- OTP expires after a defined time period
- Patient can request OTP resend after timer expires
- Account creation only occurs after successful OTP verification
- PostgreSQL is the single source of truth for patient data
- Supabase is used only for OTP delivery and verification

**Backend API Endpoints:**
- `POST /api/v1/auth/patient/otp/send` - Validate the sign-up form, stage it and send the OTP to the patient email; a taken email or username returns `409 Conflict` and no OTP is sent
- `POST /api/v1/auth/patient/otp/verify` - Verify OTP and create patient account
- `POST /api/v1/auth/patient/otp/resend` - Resend OTP for existing staged signup

**Security Requirements:**
- Password hashed with bcrypt before storage
- Email verified through OTP before account activation
- Temporary patient data staged during OTP process
- Single PostgreSQL transaction for account creation after OTP verification
- Email and username uniqueness are checked up-front in `/send` - after the email existence check and before the sign-up is staged or any OTP is sent - so a taken username is reported on the sign-up form instead of after OTP verification; both checks are repeated inside the account-creation transaction in `/verify`, which returns `409 Conflict` with `Email is already registered` or `Username already taken` (the `users` unique constraints are the final backstop against concurrent sign-ups)
- 15-minute expiration for staged sign-up data
- Automatic cleanup of expired staged sign-ups

**Backend Implementation:**
- Service: `patientOtpService.ts` handles Supabase OTP operations
- Router: `patientOtp.ts` provides API endpoints
- Database: `pending_patient_signups` table stages registration data (including the detailed patient fields)
- Migration: `008_patient_signup_otp_flow.sql` creates staging table; `026_add_pending_patient_signup_details.sql` adds `middle_name`, `date_of_birth`, `sex`, `phone` and `address` to the staging table

**Mobile Implementation:**
- Page: `otp_verification_page.dart` provides 6-digit OTP input interface
- Page: `successful_registration_page.dart` displays registration success message
- Page: `onboarding_page.dart` provides 3-screen onboarding flow (Find doctor, Manage health, Book appointments)
- API Service: `api_service.dart` includes patient OTP methods and token management
- Integration: `signup_page.dart` calls backend to send OTP and navigate to verification; a `409 Conflict` from `/send` is shown on the form (using the backend message, e.g. `Username already taken`) and the user stays on the form, so an unavailable username never reaches OTP verification
- Features: Auto-focus, paste support, resend timer, error handling
- Flow: OTP verification → Successful registration → Onboarding → Home dashboard (authenticated)
- Authentication: After successful OTP verification, user is automatically authenticated and can access the app directly
- Onboarding: Only displayed for newly created accounts after registration, not for returning users

**Key Differences from Doctor Registration:**
- Patient accounts do not require admin approval
- Patients can access the system immediately after successful OTP verification
- Patient registration uses the same Supabase OTP infrastructure as doctor registration
- Both patient and doctor registration maintain PostgreSQL as the single source of truth

### Role-Based Protection

- `/admin/*` routes - Allow only ADMIN users
- `/doctor/*` routes - Allow only DOCTOR users
- `/secretary/*` routes - Allow only SECRETARY users
- All role verification uses backend-returned role, not frontend selector
- Cross-role access is blocked and credentials are cleared on mismatch

### Doctor–Secretary Data Isolation

- A Secretary's required `doctor_id` foreign key stores their permanent Doctor assignment.
- Doctor-created Secretary records use the Doctor ID resolved from the authenticated Doctor account.
- The Doctor Secretary list endpoint `GET /api/v1/doctors/secretaries` filters by that authenticated user's Doctor profile; it must never return a global Secretary list to Doctors.
- Secretary password/profile setup does not modify the stored Doctor assignment.
- App data is accessed through the backend PostgreSQL connection, not directly through Supabase; enforce this access boundary in backend authorization and queries.

### Secretary Schedule Management

Secretaries may view weekly working hours but cannot create, edit, or delete them. They may add, edit, and delete exceptions and break periods, and configure capacity, only for their assigned doctor using `secretaries.doctor_id`. Follow the existing secretary capacity ownership check; unauthorized access returns 404.

Use the `/api/v1/secretaries/managed-doctors/...` API convention:

- `GET /schedules` for read-only weekly working hours.
- `GET`, `POST`, `PUT`, and `DELETE` for `/unavailability` and `/break-periods`.

Apply the doctor schedule validation rules: start <= end, breaks must fall within working hours, and breaks must not overlap.

When an exception or break-period change affects dates with active appointments, warn the doctor or secretary with the number of affected appointments and require explicit confirmation before saving. After confirmation, save the change and notify affected patients through the notification module. Do not automatically cancel affected appointments; the secretary handles them through existing cancellation and rescheduling flows.

Do not:
- Allow a Secretary to create, edit, or delete weekly working hours
- Allow a Secretary to manage a schedule, exception, break period, or capacity outside their assigned Doctor
- Return a successful response for unauthorized schedule access; return 404
- Save an appointment-impacting exception or break-period change without explicit confirmation
- Automatically cancel appointments affected by a confirmed schedule change
- Allow ADMIN or SUPERADMIN to manage schedules, availability, breaks, or capacity

### Backend Integration

- Uses existing JWT-based authentication through `/api/v1/auth/login`
- Token stored in localStorage
- Role verification on protected routes
- API client includes Authorization header for authenticated requests

### Admin Account Provisioning

**Initial Admin Account:**
- Created through backend seed script during initial setup
- Seed script is idempotent - running it multiple times will not create duplicate Admin accounts
- Default credentials provided and must be changed immediately after first login
- Password securely hashed using bcrypt before storage

**Additional Admin Accounts:**
- Can only be created by authorized Admin users through Admin dashboard
- Public registration endpoint does not allow Admin role registration
- All Admin accounts use shared `users` table with `role = ADMIN`
- Backend verifies `role = ADMIN` for all Admin API routes

**Security Requirements:**
- Passwords never stored in plaintext
- All passwords hashed using bcrypt with salt rounds
- Admin login verifies backend-returned role before granting access
- Cross-role access blocked through backend verification

**Seed Commands:**
- `npm run seed:admin` - Create initial Admin account only
- `npm run seed` - Run all seed scripts including Admin provisioning

### Secretary Account Creation by Doctors

Doctors can create Secretary accounts through the Doctor Dashboard:

- Endpoint: `POST /api/v1/doctors/secretaries` (requires Doctor authentication)
- Doctor must have `approval_status = 'ACTIVE'` to create secretaries
- Required fields: email, password
- Secretary account is automatically linked to Doctor via `doctor_id` foreign key
- Secretary account is created with `must_change_password = true` (forced password change)
- Secretary account is created with NULL `first_name` and `last_name` (to be completed)
- Secretary account is automatically approved (`is_approved = true`)
- Secretary account is provisioned with Supabase Auth identity (server-side)
- Duplicate email returns `409` conflict error

Do not:
- Allow Doctors to create secretaries without ACTIVE approval status
- Create Secretary accounts without Supabase Auth identity
- Skip `must_change_password` flag for Doctor-created secretaries

### Secretary Profile Completion

Secretaries created by Doctors must complete their profile:

- Secretary profile page at `/secretary/profile` allows viewing and editing profile
- Secretary must provide: first name, last name, contact number
- Profile update endpoint: `PUT /api/v1/secretaries/me` (requires Secretary authentication)
- Secretary cannot access normal dashboard features until profile is completed
- Secretary must change password on first login (enforced by `must_change_password` flag)

Do not:
- Allow Secretary dashboard access without completed profile
- Skip password change enforcement for secretaries with `must_change_password = true`

---

# 33. API Rules

Use:

```text
/api/v1
```

Do not expose database access directly to the mobile app.

All important operations must pass through backend authorization and validation.

**OTP Endpoints:**
- Doctor OTP: `/api/v1/auth/otp/send`, `/api/v1/auth/otp/verify`, `/api/v1/auth/otp/resend`
- Patient OTP: `/api/v1/auth/patient/otp/send`, `/api/v1/auth/patient/otp/verify`, `/api/v1/auth/patient/otp/resend`
- Login OTP: `/api/v1/auth/login` (returns challenge if OTP required), `/api/v1/auth/verify-login-otp`, `/api/v1/auth/resend-login-otp`

---

# 34. Role-Based Login OTP and Two-Factor Authentication

The system implements role-based login OTP with server-side challenge state.

### OTP Requirement Rules

These are non-negotiable role-based OTP requirements:

```text
Admin: OTP ALWAYS mandatory (no setting, no bypass)
SuperAdmin: OTP not required (direct authentication)
Doctor: OTP optional - required only if two_factor_enabled = true
Secretary: OTP optional - required only if two_factor_enabled = true
```

Do not create:
- Admin 2FA settings or toggles (OTP is always mandatory)
- Frontend-only OTP requirement checks (must be enforced by backend)
- OTP bypass mechanisms for Admin/Doctor/Secretary

### Login OTP Flow

The login OTP flow must follow this sequence:

```text
1. User submits credentials to POST /api/v1/auth/login
2. Backend validates credentials
3. Backend checks role-specific OTP requirement
4. If OTP required:
   - Create server-side challenge in login_otp_challenges table
   - Generate opaque challenge token (not a JWT)
   - Send 6-digit OTP via Supabase Auth
   - Return { requiresOtp: true, challengeId: <opaque token> }
5. User enters OTP and submits to POST /api/v1/auth/verify-login-otp
6. Backend verifies OTP with Supabase Auth
7. If valid, consume challenge (mark as used) and issue application JWT
8. User authenticated and redirected to dashboard
```

### Server-Side Challenge State

Use PostgreSQL `login_otp_challenges` table for OTP challenge state:

- Challenge tokens must be hashed before storage (SHA-256)
- Challenges expire after 5 minutes
- Challenges support up to 5 failed attempts
- Challenges are marked as used after successful verification
- Challenges are one-time use only (cannot be reused even if not expired)

Do not:
- Store raw challenge tokens in PostgreSQL
- Use client-side state for OTP challenge tracking
- Allow challenge token reuse

### OTP Resend Rules

When resending OTP:

- Enforce 60-second cooldown between resends (server-side)
- Invalidate all previous unused challenges for the user
- Create new challenge and send new OTP
- Return new challengeId to the user

Do not:
- Allow unlimited resend attempts without cooldown
- Reuse existing challenge tokens when resending
- Skip invalidating previous challenges

### Supabase Auth Identity Provisioning

Admin and Secretary accounts must have Supabase Auth identities for OTP:

- Provision identities during account creation (server-side)
- Use `ensureAdminSupabaseIdentity` for Admin accounts
- Use `ensureSecretarySupabaseIdentity` for Secretary accounts
- Both functions are idempotent and duplicate-safe
- Reconciliation endpoints exist for existing accounts

Do not:
- Create Supabase Auth identities from the frontend
- Skip Supabase identity provisioning for Admin/SuperAdmin
- Allow Admin account creation without Supabase identity

### PostgreSQL as Source of Truth

PostgreSQL is the single source of truth for all application accounts:

- `users` table stores all user accounts
- `doctors` table stores doctor profiles with `two_factor_enabled` column
- `secretaries` table stores secretary profiles with `two_factor_enabled` column
- Supabase Auth is used only for OTP delivery and verification
- Supabase Auth never stores application account data or credentials

Do not:
- Use Supabase Auth as the source of truth for application accounts
- Store application credentials in Supabase Auth
- Allow Supabase to create application accounts (use `shouldCreateUser: false`)

### Two-Factor Authentication Settings

Doctor and Secretary 2FA settings:

- `doctors.two_factor_enabled` column (boolean, default false)
- `secretaries.two_factor_enabled` column (boolean, default false)
- Doctor 2FA toggle: `PUT /api/v1/doctors/me/two-factor`
- Secretary 2FA toggle: `PUT /api/v1/secretaries/me/two-factor`
- Web settings pages: `/doctor/settings` and `/secretary/settings`

Do not:
- Create 2FA settings for Admin/SuperAdmin (OTP is always mandatory)
- Allow frontend to override backend OTP requirement decision
- Skip backend role check when determining OTP requirement

### Device Trust, Trusted Browsers, and Session Lifetime

Session behavior is defined once in `backend/src/modules/auth/sessionPolicy.ts`. The internal `rememberMe` claim/session-policy flag is retained for compatibility but now means an explicit trusted-device session.

**Doctor and Secretary:**
- **Untrusted browser or trust declined:** 7-hour access token, 8-hour refresh token, 8-hour idle timeout, browser-session cookies, no trusted browser, OTP on every login when 2FA is enabled.
- **Trusted device:** 7-day access token, 30-day refresh token/session, persistent cookies, trusted browser for 30 days. OTP is skipped on later logins from that browser when 2FA is enabled; the password is always required.
- Login forms do not include a Remember Me checkbox.
- After full authentication, an untrusted browser is shown a device-trust page with browser/OS details and "Trust this device" / "Do not trust this device". Trusting registers the browser and upgrades the current session; declining keeps the short session.
- The trust decision never bypasses the OTP required for the current login. `verify-login-otp` always issues a short untrusted session and the trust prompt is shown afterwards.
- A valid trusted-device cookie skips OTP and the prompt on later logins.

**Admin and SuperAdmin:**
- OTP is mandatory on every login; no device-trust prompt and no trusted browser.
- 90-minute access token, 2-hour refresh token, 2-hour idle timeout, 8-hour absolute maximum, browser-session cookies.
- Logout clears the Admin/SuperAdmin session.

**Patient:** existing 7-day access / 30-day refresh behavior is unchanged.

**Trusted Browser Storage:**
- High-entropy random tokens stored only as SHA-256 hashes in PostgreSQL `trusted_browsers` (`user_id`, `token_hash`, `device_info`, `expires_at`, `created_at`, `revoked_at`, `last_used_at`).
- Token is sent only in an HttpOnly/Secure/SameSite=lax cookie, rotated each use, and never exposed to JavaScript, localStorage, or response bodies.
- Trust expires after 30 days; new browsers, expired tokens, or cleared cookies require OTP again when 2FA is enabled.

**Trust Endpoints:**
- `GET /api/v1/auth/trusted-browsers/current-device` — current browser/OS details for the trust page.
- `POST /api/v1/auth/trusted-browsers/trust-current` — registers/rotates the device and issues the 30-day persistent session; Doctor/Secretary only.
- `POST /api/v1/auth/revoke-trusted-browser` — declines/revokes the current browser's trust.

**Revocation and Settings:**
- Password change, password reset, account deactivation, and "Sign out of all devices" revoke all trusted browsers and refresh tokens (via `users.session_version`, migration `032_add_session_version.sql`).
- `/doctor/settings` and `/secretary/settings` list trusted browsers (device, created, last used, expiry) with per-browser Revoke and "Sign out of all devices" in an Account section. `GET /api/v1/auth/trusted-browsers` flags the row matching the request's trust cookie with `is_current` (never exposing hashes) so the UI labels it "This browser"; more than five rows show the five most recent with a "View all" toggle. Confirming revocation of the current browser warns that the next sign-in requires a verification code; "Sign out of all devices" confirms "Sign out everywhere? You will need to sign in again on every device." TrustedBrowsersCard takes `confirmDialogs` (default true for the doctor page); `/secretary/settings` passes false so Revoke and "Sign out of all devices" act immediately without dialog confirmations.
- `/secretary/settings` groups cards into "Account" (2FA, Change password, Trusted Browsers) and "Clinic" (Clinic Payment Settings with GCash QR thumbnail, Active/Not uploaded status, last-updated date from `doctors.gcash_qr_updated_at`, and Manage QR Code action) plus an editable Invoice details form for clinic information (clinic name, address, contact number, footer line) used in invoice headers and footers, and a display-only "Coming soon" placeholder for GCash account details; invoice settings are stored in the `invoice_settings` table scoped by doctor, accessed via SECRETARY-only endpoints `GET /api/v1/secretaries/me/invoice-details` and `PUT /api/v1/secretaries/me/invoice-details`.
- Logout ends only the current portal session; trust persists.
- A non-blocking dashboard banner recommends enabling 2FA when it is off; it never blocks access.

**Cookies and Isolation:**
- Role-scoped cookies (`doctor_`, `secretary_`, `admin_`, `patient_`) with path `/`; access/refresh HttpOnly and Secure in production, trusted-browser always HttpOnly.
- A non-sensitive `<prefix>_sessionActive` browser-session hint lets `apiClient` discard a non-persistent session after a browser restart.
- Multiple portal sessions may coexist; middleware treats `/doctors`, `/secretaries`, and `/admin` paths as authoritative, uses `X-Portal-Role` for shared resource paths (for example `/patients/:id`), checks matching cookies with a global fallback, and rejects cross-role use. Shared sub-resources are exempt from the namespace check: `/doctors/:id/availability` accepts PATIENT tokens (the mobile patient booking journey) and DOCTOR tokens, while all doctor-portal-only routes remain guarded by `authorize('DOCTOR')`.
- Only a 400/401 refresh response clears the session; transient rate-limit, server, and network failures leave it intact.
- Safe `GET` reads use a 15-second role-scoped in-memory cache and a bounded 429 retry; mutations are never cached or retried. See "API Rate Limiting, Retries, and Read Caching".
- Device trust never bypasses password, account status, role, or approval checks; failures stay generic.

Do not:
- Store trusted-browser tokens in plaintext, localStorage, or a response body.
- Let device trust bypass account status restrictions or the current login's OTP.
- Implement device trust or trusted browsers for Admin/SuperAdmin.
- Persist an untrusted staff session across browser restarts.

### API Rate Limiting, Retries, and Read Caching

**Backend budgets** (`backend/src/middleware/rateLimit.ts`, mounted in `backend/src/index.ts`):
- General API: `RATE_LIMIT_MAX_REQUESTS` (default 300) per `RATE_LIMIT_WINDOW_MS` (default 60,000 ms) per IP, mounted on `/api/`.
- Sensitive authentication: `AUTH_RATE_LIMIT_MAX_REQUESTS` (default 30) per `AUTH_RATE_LIMIT_WINDOW_MS` (default 900,000 ms) per IP, mounted on `/api/v1` and skipped for non-auth paths. It covers `/auth/login`, `/auth/verify-login-otp`, `/auth/resend-login-otp`, `/auth/otp`, `/auth/patient/otp`, `/auth/register`, and `/auth/change-password`.
- Sensitive routes are counted by both limiters, so the stricter auth budget is the effective one.
- Every `429` includes `Retry-After` (seconds) and the standard error envelope with code `RATE_LIMIT`. `OPTIONS` pre-flight requests are skipped.
- Rate limiting never replaces authentication or authorization; protected routes still validate the token and role on every request.

**Web read reliability** (`web/src/lib/api/apiClient.ts`, `requestPolicy.ts`, `ttlCache.ts`):
- Successful `GET` responses are cached in memory for 15 seconds. Keys include the portal role and endpoint, so two roles can never share an entry.
- The cache stores full response objects only when `success === true`. Authorization still happens on the server for every cache miss.
- The cache is cleared when the token or role changes, on logout/session expiry, and after any successful `POST`/`PUT`/`PATCH`/`DELETE`. A generation counter stops an in-flight request started before a clear from writing stale data afterwards.
- Concurrent identical non-abortable reads share one request (dashboard page plus sidebar on first paint).
- Only `GET` is retried on `429`, up to 3 total attempts, honoring `Retry-After` and otherwise using exponential backoff (500 ms base) plus at most 250 ms jitter, capped at 5 seconds. Mutations are never retried.
- Callers may pass `AbortSignal` to cancel on unmount; aborting returns `errorCode: 'REQUEST_ABORTED'`. Sidebar profile/schedule refreshes triggered by save events use `skipCache: true` so edits appear immediately.
- Client-side list search/filtering is already local; it must not add a network request per keystroke.
- `web/src/lib/api/*.test.ts` covers the retry/backoff policy and the cache with `npm test` (Node's built-in test runner; no new dependency).

**Server-side read caching and query batching:**
- `backend/src/modules/availability/availabilityService.ts` caches availability range results for `AVAILABILITY_CACHE_TTL_MS` (default 20,000 ms), keyed by doctor + start + end. The cache is never used when a `patientId` is present. Successful non-`GET` requests through the doctors, secretaries, appointments, or walk-ins routers call `invalidateAvailabilityCache()`.
- `capacityService.calculateCapacityRange` loads schedules, breaks, exceptions, and appointments in four batched queries rather than four per date.
- The Doctor dashboard runs its independent reads concurrently and reuses already-loaded schedule/break/exception rows via `buildCapacityResult`; the Secretary dashboard also reads concurrently and computes unread messages with one aggregate query; the payments list loads all charges with one `payment_id = ANY(...)` query.

Do not:
- Cache role-scoped or patient-specific data across different users or roles.
- Cache failed responses or serve cached data after a mutation.
- Retry data-changing requests automatically.
- Disable rate limiting to work around dashboard traffic.

### Supabase Storage for Doctor Photos

Doctor professional photos are stored in Supabase Storage, not local filesystem:

**Storage Configuration:**
- Supabase Storage bucket: `doctor-photos` (configurable via `SUPABASE_STORAGE_BUCKET` environment variable)
- Service role key is required for backend photo operations (backend-only, never exposed to frontend)
- Photos served via Supabase public URLs (CDN-backed)
- Legacy `/uploads/` URLs still supported for existing photos (backward compatibility)

**File Validation:**
- PNG files only (validated by magic number signature 0x89 50 4E 47 0D 0A 1A 0A)
- Maximum file size: 4MB
- Server-side MIME type validation
- Client-side validation before upload

**Photo Operations:**
- Upload: `POST /api/v1/doctors/me/photo` - Uploads to Supabase Storage, returns public URL
- Delete: `DELETE /api/v1/doctors/me/photo` - Deletes from Supabase Storage, clears database field
- Replace: Automatically deletes old photo from Supabase Storage or legacy local filesystem

**Security Requirements:**
- Supabase Storage service role key must remain backend-only
- Never expose service role key to mobile or web applications
- Use `backend/src/services/storageService.ts` for all photo operations
- Database stores only the Supabase public URL reference

Do not:
- Expose Supabase Storage service role key to frontend applications
- Store photos in local filesystem for new uploads (use Supabase Storage)
- Skip PNG magic number validation
- Expose sensitive bucket configuration to frontend

---

# 35. Doctor Chat Restriction

Never add generic messaging logic that accidentally allows:

```text
Patient → Doctor
```

Before implementing any messaging feature, verify:

```text
Patient → Secretary = Allowed
Patient → AI = Allowed
Patient → Doctor = Blocked
```

---

# 36. AI Coding Agent Rules

When an AI coding agent changes the project:

### Rule 1

Read the existing architecture before changing it.

### Rule 2

Follow:

```text
PRD.md
ARCHITECTURE.md
ARCHITECTURE-ESSENTIALS.md
```

### Rule 3

Do not invent requirements.

### Rule 4

Do not add patient-doctor chat.

### Rule 5

Do not make payment mandatory for normal reservations.

### Rule 6

Use the same capacity service for online and walk-in registration.

### Rule 7

Use the same queue service for online and walk-in registration.

### Rule 8

Never make online patients automatically higher priority than walk-ins.

### Rule 9

Never mark a GCash receipt as Paid without secretary verification.

### Rule 10

Never expose AI credentials to the mobile app.

### Rule 11

Never treat AI output as a diagnosis.

### Rule 12

Do not send unnecessary patient information to external AI services.

### Rule 13

Protect patient, payment, medical, and conversation data.

### Rule 14

Preserve the walk-in patient's permanent account identity.

### Rule 15

Enforce temporary-password change before normal first-time access.

### Rule 16

**Requirements Documentation Must Stay Updated**

When a requested feature change modifies, replaces, removes, or adds a requirement defined in the project documentation, the AI coding agent must update the relevant .md document(s) as part of the same change.

The implementation and documentation must remain consistent. Do not apply a feature change in the codebase while leaving outdated requirements, workflows, rules, or architecture details in PRD.md, ARCHITECTURE.md, or ARCHITECTURE-ESSENTIALS.md.

Before completing the change, verify that:

- The affected feature is updated in the implementation.
- The relevant requirement or workflow in the .md documentation is updated.
- Any related architecture rule, permission, business rule, or user flow remains consistent.
- No conflicting or outdated documentation remains.

---

# 37. Feature Implementation Checklist

Before completing a feature:

```text
[ ] Requirement exists in PRD
[ ] Correct user role identified
[ ] Correct module identified
[ ] Mobile UI implemented
[ ] Backend API implemented
[ ] Authorization implemented
[ ] Validation implemented
[ ] Business rules implemented
[ ] Database migration created if needed
[ ] Security reviewed
[ ] Error handling implemented
[ ] Tests added
[ ] Existing features checked
```

For queue features:

```text
[ ] Capacity checked
[ ] Queue number generated server-side
[ ] Online/walk-in share queue
[ ] Registration source stored
[ ] Queue status validated
[ ] Concurrency protected
```

For payment features:

```text
[ ] Payment is not required for reservation
[ ] Static GCash QR used
[ ] Receipt uploaded securely
[ ] Status starts Pending Verification
[ ] Secretary verification required
[ ] Additional charges supported
```

For AI features:

```text
[ ] API key remains server-side
[ ] Input validated
[ ] Safety instructions applied
[ ] No definitive diagnosis
[ ] No prescription
[ ] Sensitive data minimized
[ ] AI errors handled
```

For chat:

```text
[ ] Patient ↔ Secretary works
[ ] Unauthorized conversation access blocked
[ ] Patient ↔ Doctor remains blocked
[ ] Patients access only their own conversations for associated doctors
[ ] Secretaries access only assigned-doctor patient conversations (shared same-doctor history, no per-secretary duplicates)
[ ] Unread counts use messages.read_at and exclude the current user's own messages
[ ] Message notifications go only to recipients (NEW_PATIENT_MESSAGE / NEW_SECRETARY_MESSAGE) with generic, content-free payloads
[ ] Device tokens belong to their owning user; only the owner can register or remove them
[ ] Appointment-summary endpoint is read-only, secretary-only, and returns only the fields the patient-info sheet needs
[ ] Shared mobile app routes patients and secretaries from the backend-returned role, never a client-side role selector
[ ] Secretary mobile access excludes queue, payment, walk-in, and schedule screens
[ ] Notification taps open a conversation thread only for the matching role and an authorized conversation
```

---

# 38. Avoid Overengineering

Do not introduce without a documented need:

```text
Microservices
Kubernetes
Kafka
CQRS
Event Sourcing
Multiple Databases
Complex Event Bus
```

Default architecture:

```text
Mobile
 ↓
Modular Backend
 ↓
PostgreSQL
```

---

# 39. Naming Rules

Database:

```text
snake_case
```

Examples:

```text
doctor_id
appointment_date
queue_number
payment_status
created_at
```

API resources:

```text
/doctors
/appointments
/queue
/payments
/conversations
```

Avoid inconsistent endpoint naming.

---

# 40. Error Rules

Use clear error codes:

```text
CAPACITY_FULL
APPOINTMENT_SLOT_UNAVAILABLE
QUEUE_ASSIGNMENT_FAILED
CONVERSATION_ACCESS_DENIED
PAYMENT_VERIFICATION_REQUIRED
AI_SERVICE_UNAVAILABLE
FORBIDDEN
UNAUTHORIZED
```

Never expose:

```text
SQL
Stack Traces
Secrets
API Keys
Sensitive Medical Data
```

---

# 41. Logging Rules

Never log:

```text
Passwords
Temporary Passwords
API Keys
Authentication Tokens
Full Medical Records
Prescription Contents
Full GCash Receipts
Sensitive Chat Contents
```

Log technical events without exposing sensitive information.

---

# 42. Final Golden Rules

```text
1. Mobile never connects directly to PostgreSQL.

2. Backend is the source of truth for business rules.

3. PostgreSQL is the source of truth for persistent data.

4. Default consultation duration is 30 minutes.

5. Capacity considers availability, operating hours, breaks, and consultation duration.

6. Doctor and authorized secretary may configure a lower daily capacity.

7. Online and walk-in patients share one daily capacity.

8. Online and walk-in patients share one unified queue.

9. Queue priority is based on successful registration time.

10. Registration source does not affect queue priority.

11. Regular reservations do not require advance payment.

12. GCash uses a static QR code.

13. Uploaded receipts start as Pending Verification.

14. Secretary verification is required before Paid.

15. Secretary can add additional charges.

16. Walk-in patients can receive generated accounts.

17. Generated temporary passwords require first-login change.

18. Patient medical history must remain linked to the permanent patient account.

19. Secretary manages the daily operational queue.

20. Skipped patients must not automatically disappear from the queue.

21. Patients can chat with secretaries.

22. Patients cannot directly chat with doctors.

23. Patients can use the AI chatbot for general medical information.

24. AI must not diagnose or prescribe.

25. AI credentials must remain server-side.

26. Sensitive patient data must be protected.

27. Capacity, queue, and booking operations must be concurrency-safe.

28. Use database transactions for critical operations.

29. Use migrations for schema changes.

30. Avoid premature overengineering.

31. Follow the PRD before adding features.

32. Follow the architecture before introducing new patterns.

33. When implementing features that modify requirements, update the relevant documentation (.md files) to keep implementation and documentation consistent.

34. Doctor self-registration creates the `users` and `doctors` records in one transaction with `approval_status = 'PENDING'`, requiring administrator approval before the doctor can access the system.
```

---

# 43. Architecture Mental Model

```text
                         PATIENT
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
        APPOINTMENT     SECRETARY       AI CHAT
             │              │              │
             ▼              ▼              ▼
       UNIFIED QUEUE     SECRETARY     AI PROVIDER
             │
             ▼
          DOCTOR
             │
             ▼
       CONSULTATION
             │
       ┌─────┴─────┐
       ▼           ▼
 MEDICAL HISTORY  PRESCRIPTION

              PATIENT ──X── DOCTOR CHAT
```

The core priority is:

**Correctness → Data Integrity → Security → Authorization → Maintainability → Simplicity**
