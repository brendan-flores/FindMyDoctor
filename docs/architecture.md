# FindMyDoctor — System Architecture

## 1. Architecture Overview

FindMyDoctor is a mobile-first doctor appointment, daily queue-management, patient communication, payment-recording, prescription, and AI-assisted healthcare information system.

The architecture consists of:

```text
┌────────────────────────────────────────────┐
│              Mobile Application            │
│                                            │
│ Patient UI                                 │
│ Doctor UI                                  │
│ Secretary UI                               │
│ Admin UI                                   │
│ AI Chat UI                                 │
└─────────────────────┬──────────────────────┘
                      │
                      │ HTTPS / JSON
                      ▼
┌────────────────────────────────────────────┐
│              Backend API                   │
│                                            │
│ Authentication                             │
│ Authorization                              │
│ Users                                      │
│ Doctors                                    │
│ Secretaries                                │
│ Scheduling                                 │
│ Capacity                                   │
│ Appointments                               │
│ Queue                                      │
│ Patients                                   │
│ Visits                                     │
│ Prescriptions                              │
│ Payments                                   │
│ Conversations                              │
│ Messages                                   │
│ AI Chat                                    │
│ Notifications                              │
│ Administration                             │
└─────────────────────┬──────────────────────┘
                      │
                      │ SQL
                      ▼
┌────────────────────────────────────────────┐
│                 PostgreSQL                 │
│                                            │
│ Users                                      │
│ Patients                                   │
│ Doctors                                    │
│ Secretaries                                │
│ Schedules                                  │
│ Capacity                                   │
│ Appointments                               │
│ Queue Entries                              │
│ Visits                                     │
│ Prescriptions                              │
│ Payments                                   │
│ Payment Charges                            │
│ Conversations                              │
│ Messages                                   │
│ AI Conversations                           │
│ AI Messages                                │
│ Notifications                              │
└────────────────────────────────────────────┘

                      │
          ┌───────────┴────────────┐
          ▼                        ▼
   External AI Provider       Supabase Storage
                                  │
                                  ▼
                         Doctor Professional Photos
```

The mobile application must never connect directly to PostgreSQL.

---

# 2. Architectural Goals

The architecture should:

1. Support a mobile-first application.
2. Use PostgreSQL as the primary database.
3. Use a modular monolithic backend.
4. Centralize appointment and queue business rules.
5. Prevent double booking and capacity overflow.
6. Combine online and walk-in patients into one queue.
7. Support patient-secretary messaging.
8. Support AI chatbot integration.
9. Keep AI access server-side.
10. Protect patient, payment, medical, and communication data.
11. Keep the system simple enough for an educational project.

---

# 3. Architectural Style

Use a **modular monolith**.

```text
Mobile
  ↓
REST API
  ↓
Modular Backend
  ↓
PostgreSQL
```

The backend modules should remain logically separate without introducing microservices.

---

# 4. Application Layers

```text
API / Presentation
        ↓
Application / Services
        ↓
Domain / Business Rules
        ↓
Data Access
        ↓
PostgreSQL
```

### API Layer

Handles:

- HTTP routes.
- Authentication.
- Request validation.
- Authorization.
- Response formatting.

### Application Layer

Handles:

- Booking.
- Capacity.
- Queue.
- Walk-in registration.
- Payment workflows.
- Messaging.
- AI workflows.
- Patient information validation.

### Domain Layer

Handles rules such as:

- Capacity.
- Queue numbering.
- Appointment conflicts.
- Payment states.
- Communication permissions.

### Data Access Layer

Handles:

- PostgreSQL queries.
- Transactions.
- Persistence.
- Repositories.

---

# 5. Mobile Application Architecture

Recommended:

```text
mobile/
├── app/
├── features/
│   ├── auth/
│   ├── doctors/
│   ├── appointments/
│   ├── schedules/
│   ├── queue/
│   ├── capacity/
│   ├── patients/
│   ├── prescriptions/
│   ├── payments/
│   ├── conversations/
│   ├── secretary/
│   │   ├── models/            # Read-only patient appointment-summary model
│   │   └── presentation/      # Secretary home list + patient-info sheet
│   ├── secretary-chat/
│   ├── ai-chat/
│   ├── waitlist/
│   ├── notifications/
│   └── profile/
├── components/
├── services/
├── api/
├── state/
├── hooks/
├── utils/
├── types/
└── assets/
```

The mobile application is shared by patients and secretaries. The `auth` feature performs the shared login and exposes role-based redirects; the `conversations` feature holds the shared conversation thread reused by both roles; the `secretary` feature adds the secretary conversation list, the read-only patient-info sheet, and the minimal secretary menu. The `core/services/push_notification_service.dart` bridge registers the device token with the backend after authentication, removes it on logout, and opens authorized conversation threads from `NEW_PATIENT_MESSAGE` / `NEW_SECRETARY_MESSAGE` notification taps.

---

# 5.1. Web Application Architecture

Recommended:

```text
web/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Root redirect based on auth status
│   │   ├── auth/              # Authentication routes
│   │   │   └── login/         # Shared Doctor/Secretary login with role selector
│   │   ├── admin/             # Admin dashboard namespace
│   │   │   ├── login/         # Admin-only login
│   │   │   ├── dashboard/     # Admin dashboard
│   │   │   ├── users/
│   │   │   ├── doctors/
│   │   │   └── secretaries/
│   │   ├── doctor/            # Doctor dashboard namespace
│   │   │   ├── dashboard/     # Doctor dashboard
│   │   │   ├── appointments/
│   │   │   ├── schedule/      # Working Hours, Exceptions, Break Periods, Capacity
│   │   │   ├── patients/
│   │   │   ├── secretaries/
│   │   │   ├── prescriptions/
│   │   │   ├── profile/
│   │   │   └── settings/      # Doctor settings (2FA toggle)
│   │   └── secretary/         # Secretary dashboard namespace
│   │       ├── dashboard/     # Secretary dashboard
│   │       ├── queue/
│   │       ├── walk-ins/
│   │       ├── patients/
│   │       ├── appointments/
│   │       ├── schedule/      # Working Hours, Exceptions, Break Periods, Capacity
│   │       ├── payments/
│   │       ├── conversations/
│   │       ├── profile/       # Secretary profile (view/edit)
│   │       └── settings/      # Secretary settings (2FA toggle)
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/
│   │   └── dashboard/
│   └── lib/
│       ├── api/
│       ├── auth/
│       └── utils/
└── public/
```

The web application uses Next.js 14 with App Router, TypeScript, and Tailwind CSS.

## Web Authentication and Routing

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
    └── `/doctor-signup` → Basic form → Supabase email OTP → PostgreSQL Doctor account (PENDING + INCOMPLETE) → `/doctor-profile` → Complete professional profile → Submit for approval → PENDING / Awaiting Admin Review
```

### Authentication Flow

**Root (`/`):**
- Unauthenticated users → `/doctor-login` (default login)
- Authenticated users → Redirect to role-specific dashboard

**Admin Authentication:**
- Dedicated login at `/admin/login`
- Admin-only UI (no Doctor/Secretary selector)
- Sends the expected ADMIN role to the backend; the backend accepts ADMIN and the existing SUPERADMIN role for this portal and checks before OTP challenge creation or delivery
- Doctor and Secretary accounts are rejected with a generic invalid-credentials/account-role error before OTP
- Success → `/admin/dashboard`
- Non-Admin login → Access denied

**Doctor Authentication:**
- Dedicated login at `/doctor-login`
- Doctor-only UI (no role selector)
- Sends the expected DOCTOR role to the backend; the backend verifies it before OTP challenge creation or delivery
- Admin, SuperAdmin, and Secretary accounts are rejected with a generic invalid-credentials/account-role error before OTP
- Success → `/doctor/dashboard`
- Non-Doctor login → Access denied

**Secretary Authentication:**
- Dedicated login at `/secretary-login`
- Secretary-only UI (no role selector)
- Sends the expected SECRETARY role to the backend; the backend verifies it before OTP challenge creation or delivery
- Admin, SuperAdmin, and Doctor accounts are rejected with a generic invalid-credentials/account-role error before OTP
- Success → `/secretary/dashboard`
- Non-Secretary login → Access denied

### Doctor Sign-Up (Self-Registration)

The doctor sign-up page at `/doctor-signup` creates a doctor account through a two-step flow:

- Linked from the Doctor login page at `/doctor-login`.
- **Step 1 - Basic Registration:** Collects only basic information (first name, middle name optional, last name, email, contact number, password, confirm password).
- Submits the basic form to `POST /api/v1/auth/otp/send` (public, no token required).
- The backend validates the payload (required fields, email format, password length, password/confirm-password match, first and last name), then stages the sign-up - including the bcrypt-hashed password - in the `pending_doctor_signups` table added by migration `006_doctor_signup_otp_flow.sql` (modified by migration `017_modify_pending_doctor_signup_for_basic_flow.sql`). No account is created at this step.
- Supabase is then used only to email the 6-digit OTP to the doctor's address.
- **Step 2 - OTP Verification:** The doctor enters the OTP and the page calls `POST /api/v1/auth/otp/verify`. Only after Supabase confirms the OTP does the backend create the `users` record (`role = DOCTOR`, `email_verified = true`) and the `doctors` record with `profile_completion_status = 'INCOMPLETE'` inside a single transaction on one pooled client, rolling back on any failure and then clearing the staged row.
- The password is hashed with bcrypt and `must_change_password` is false because the doctor chooses their own password.
- Basic information (first_name, middle_name, last_name, contact_number) is stored in the doctors table.
- Professional information fields (specialty, credentials, PRC license number, hospital/clinic, etc.) are NOT collected at this stage.
- Registered doctors are created with `approval_status = 'PENDING'`, `is_approved = false`, and `profile_completion_status = 'INCOMPLETE'`, so they must complete their professional profile and wait for administrator approval before accessing the system.
- After successful OTP verification, the backend returns an access token which is stored in localStorage using the existing authentication mechanism.
- The doctor is automatically redirected to `/doctor-profile` to complete their professional profile.
- Duplicate email returns `409`; a successful verification returns an access token and redirects to profile completion.
- PostgreSQL is the single source of truth for doctor accounts, credentials and profile data. Supabase stores no application account or profile data.

### Doctor Profile Completion

After successful OTP verification, doctors must complete their professional profile at `/doctor-profile`:

- **Profile Page:** `/doctor-profile` allows doctors to complete their professional profile with 12 fields:
  - Professional Photo (PNG upload, max 4MB, client and server validation)
  - Specialty (required for submission)
  - Credentials (required for submission, multi-select)
  - PRC License Number (required for submission, 7 digits)
  - Hospital/Clinic (required for submission, searchable dropdown)
  - Years of Experience
  - Areas of Expertise (comma-separated)
  - Short Biography
  - Consultation Fee
  - Consultation Type (In-Person, Online, Both)
  - Languages Spoken (comma-separated)
  - Available Schedule (using existing schedule APIs)

- **Schedule Management:** The backend provides GET/POST/PUT/DELETE schedule APIs; the current profile UI uses GET/POST/DELETE:
  - `GET /api/v1/doctors/me/schedules` - List current schedules
  - `POST /api/v1/doctors/me/schedules` - Add new schedule
  - `PUT /api/v1/doctors/me/schedules/:id` - Update existing schedule (backend provides, UI does not currently expose)
  - `DELETE /api/v1/doctors/me/schedules/:id` - Delete schedule

- **Profile Update Endpoint:** `PUT /api/v1/doctors/me/profile` (requires Doctor authentication)
  - Accepts professional profile fields: professional_photo_url, specialty, credentials, prc_license_number, practice_name, years_of_experience, areas_of_expertise, biography, consultation_fee, consultation_type, languages_spoken
  - Validates PRC license number format (7 digits) and uniqueness
  - Automatically updates `profile_completion_status` to 'COMPLETE' when all required fields are present
  - Allows partial updates (field-by-field or multiple fields at once)
  - Supports draft saving without requiring all fields

- **Professional Photo Upload Endpoint:** `POST /api/v1/doctors/me/photo` (requires Doctor authentication)
  - Accepts PNG files only via multipart/form-data
  - Validates file size: maximum 4MB
  - Validates MIME type server-side: only image/png allowed
  - Validates actual PNG file signature (magic number 0x89 50 4E 47 0D 0A 1A 0A) after upload to prevent renamed non-PNG files
  - Uploads file to Supabase Storage bucket `doctor-photos` using service role credentials (backend-only)
  - Supabase Storage bucket name is configurable via `SUPABASE_STORAGE_BUCKET` environment variable (default: `doctor-photos`)
  - Updates `professional_photo_url` field with Supabase public URL
  - Returns the photo URL for client preview
  - Photo replacement automatically deletes old photos from Supabase Storage or legacy local filesystem
  - Cleans up uploaded file on error or if PNG validation fails

- **Professional Photo Deletion Endpoint:** `DELETE /api/v1/doctors/me/photo` (requires Doctor authentication)
  - Uses authenticated doctor's user ID to identify the doctor
  - Clears the `professional_photo_url` field in the database
  - Deletes the corresponding file from Supabase Storage if it exists
  - Handles legacy `/uploads/` paths for backward compatibility
  - Uses path resolution to prevent directory traversal attacks
  - Safely ignores missing files
  - Returns success/error response in the project's standard format

- **Profile Submission Endpoint:** `POST /api/v1/doctors/me/profile/submit` (requires Doctor authentication)
  - Validates required fields before submission: first name, last name, verified email, contact number, specialty, credentials, PRC license number, hospital/clinic
  - Sets `profile_completion_status = 'SUBMITTED'` and `profile_submitted_at` to current timestamp
  - Keeps `approval_status = 'PENDING'` (does not approve the doctor)
  - Returns message directing doctor to wait for admin approval
  - Shows a confirmation modal with title "Profile Submitted Successfully!" after successful submission
  - Modal states that the profile will be displayed to patients after approval and includes "Go to Dashboard" button that redirects to `/doctor/dashboard`

- **Profile Completion Status Transitions:**
  - `INCOMPLETE` - Initial state after OTP verification, professional information not yet collected
  - `COMPLETE` - Required professional fields filled, ready for submission
  - `SUBMITTED` - Profile submitted for admin review, awaiting approval decision

- **Professional Photo Upload:** Supports PNG files up to 4MB. Files are stored in Supabase Storage bucket `doctor-photos` and served via Supabase public URLs. Client-side validation ensures PNG format and 4MB limit before upload. Server-side validation confirms MIME type, file size, and PNG magic number signature. Photo preview is displayed after successful upload. Legacy `/uploads/` URLs are still supported for existing photos (backward compatibility).

### Doctor Approval Workflow

After a doctor completes self-registration, email OTP verification, and profile submission:

- The doctor account is created with `approval_status = 'PENDING'`, `is_approved = false`, and `profile_completion_status = 'INCOMPLETE'`.
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

Administrator-provisioned doctor and secretary accounts remain supported and now hash passwords with bcrypt as well.

### Secretary Account Creation by Doctors

Doctors can create Secretary accounts through the Doctor Dashboard:

- Doctors must have `approval_status = 'ACTIVE'` to create secretaries
- Endpoint: `POST /api/v1/doctors/secretaries` (requires Doctor authentication)
- Required fields: email, password
- The Secretary account is automatically linked to the Doctor via `doctor_id` foreign key
- Secretary accounts are created with `must_change_password = true` (forced password change on first login)
- Secretary accounts are created with NULL `first_name` and `last_name` (to be completed by Secretary)
- Secretary accounts are automatically approved (`is_approved = true`)
- Secretary accounts are provisioned with Supabase Auth identity via `ensureSecretarySupabaseIdentity` (server-side, idempotent, duplicate-safe)
- Duplicate email returns `409` conflict error
- PostgreSQL is the single source of truth for Secretary account data. Supabase Auth is used only for OTP delivery if 2FA is enabled.

### Secretary Profile Completion

Secretaries created by Doctors must complete their profile before normal operation:

- Secretary profile page at `/secretary/profile` allows viewing and editing profile information
- Secretary must provide: first name, last name, contact number
- Profile update endpoint: `PUT /api/v1/secretaries/me` (requires Secretary authentication)
- Secretary cannot access normal dashboard features until profile is completed
- Secretary must change password on first login (enforced by `must_change_password` flag)

### Role-Based Login OTP and Two-Factor Authentication

The system implements role-based login OTP with optional two-factor authentication:

**OTP Requirement Rules:**
- Admin: OTP is ALWAYS mandatory (no setting, no bypass) - enforced by backend role check
- SuperAdmin: OTP is not required; SuperAdmins authenticate directly
- Doctor: OTP is optional - required only if `doctors.two_factor_enabled = true`
- Secretary: OTP is optional - required only if `secretaries.two_factor_enabled = true`

**Login OTP Flow:**
1. User submits email and password to `POST /api/v1/auth/login`
2. Backend validates credentials and checks role-specific OTP requirement
3. If OTP is required:
   - Backend creates server-side challenge in `login_otp_challenges` table
   - Backend generates opaque challenge token (not a JWT)
   - Backend sends 6-digit OTP via Supabase Auth to user's email
   - Backend returns `{ requiresOtp: true, challengeId: <opaque token> }`
4. User enters OTP and submits to `POST /api/v1/auth/verify-login-otp` with challengeId and OTP
5. Backend verifies OTP with Supabase Auth
6. If valid, backend consumes challenge (marks as used) and issues application JWT
7. User is authenticated and redirected to role-specific dashboard

**OTP Resend Flow:**
- Endpoint: `POST /api/v1/auth/resend-login-otp` (accepts challengeId)
- Server-side enforces 60-second cooldown between resends
- When resending, backend invalidates all previous unused challenges for the user
- New challenge is created and new OTP is sent
- Returns new challengeId for the user to use

**Server-Side Challenge State:**
- `login_otp_challenges` table stores OTP challenge state in PostgreSQL
- Challenge tokens are hashed before storage (SHA-256)
- Challenges expire after 5 minutes
- Challenges support up to 5 failed attempts
- Challenges are marked as used after successful verification
- Challenges are one-time use only (cannot be reused even if not expired)

**Two-Factor Authentication Settings:**
- Doctor 2FA toggle: `PUT /api/v1/doctors/me/two-factor` (accepts `twoFactorEnabled: boolean`)
- Secretary 2FA toggle: `PUT /api/v1/secretaries/me/two-factor` (accepts `twoFactorEnabled: boolean`)
- Web settings pages: `/doctor/settings` and `/secretary/settings` provide UI for toggling 2FA
- Default state: 2FA is disabled for all Doctors and Secretaries (opt-in)
- Admin: No setting exists - OTP is always mandatory
- SuperAdmin: No setting exists - OTP is not required

**Supabase Auth Identity Provisioning:**
- Regular Admin accounts are provisioned with Supabase Auth identity during creation via `ensureAdminSupabaseIdentity`
- Secretary accounts are provisioned with Supabase Auth identity during creation via `ensureSecretarySupabaseIdentity`
- Both functions are idempotent and duplicate-safe
- Reconciliation endpoints exist for provisioning identities for existing accounts:
  - `POST /api/v1/admin/admins/reconcile-supabase` (SUPERADMIN only, for regular Admins)
  - `POST /api/v1/admin/secretaries/reconcile-supabase` (ADMIN or SUPERADMIN)
- Supabase Auth is used only for OTP delivery and verification, not for storing application accounts
- PostgreSQL remains the single source of truth for all application account data

**Security Requirements:**
- PostgreSQL is the single source of truth for application accounts (users, doctors, secretaries, patients)
- Supabase Auth never stores application account data or credentials
- Login OTP uses `shouldCreateUser: false` to prevent Supabase from creating application accounts
- Challenge tokens are opaque and server-side hashed to prevent token guessing
- OTP verification consumes the challenge atomically to prevent replay attacks
- Backend enforces OTP requirement based on role, not frontend configuration

### Device Trust, Trusted Browsers, and Session Lifetime

The backend enforces a single session policy in `backend/src/modules/auth/sessionPolicy.ts`; the frontend mirrors it for idle/absolute expiry but never decides token lifetimes itself. The internal `rememberMe` claim/session-policy flag is retained for backward compatibility, but it now represents an explicit trusted-device session rather than a login-form checkbox.

**Session Policies:**
- Doctor/Secretary, untrusted browser or trust declined: 7-hour access token, 8-hour refresh token, 8-hour idle timeout, browser-session cookies, no trusted browser.
- Doctor/Secretary, trusted device: 7-day access token, 30-day refresh token, 30-day absolute/idle cap, persistent cookies, trusted browser allowed.
- Admin/SuperAdmin: 90-minute access token, 2-hour refresh token, 2-hour idle timeout, 8-hour absolute maximum, browser-session cookies, OTP mandatory, no trusted browser.
- Patient: existing 7-day access / 30-day refresh policy is unchanged.

**Device Trust Behavior:**
- Doctor and Secretary login forms do not include a Remember Me checkbox.
- The trusted-device cookie is the source of truth. A valid cookie skips OTP and the trust prompt, and issues the 30-day persistent policy immediately.
- A new/untrusted browser completes password and OTP (when 2FA is enabled) first, then receives a short, non-persistent session and `requiresTrustPrompt: true`.
- `POST /auth/trusted-browsers/trust-current` registers/rotates the trusted browser and reissues the current session with the 30-day persistent policy. `POST /auth/revoke-trusted-browser` is used for "Do not trust" and clears any stale trust cookie.
- The trust decision is never available before full authentication: `verify-login-otp` always issues a short untrusted session and never auto-registers trust. Trusting the device cannot bypass the OTP required for the current login.
- A legacy client-supplied `rememberMe` field is ignored by the login route.
- The OTP challenge still stores `remember_me` for schema compatibility, but new challenges store `false` and the value no longer grants trust.

**Trusted Browser Recognition:**
- Tokens are high-entropy random values stored only as SHA-256 hashes in the PostgreSQL `trusted_browsers` table.
- Each record includes `user_id`, `token_hash`, `device_info`, `expires_at` (30 days), `created_at`, `revoked_at`, and `last_used_at`.
- The token is sent only in an HttpOnly/Secure/SameSite=lax `trustedBrowser` cookie. It is rotated on each successful use, never returned in a JSON body, and never read by JavaScript or stored in localStorage.
- Trust expires after 30 days. A new browser, expired token, or cleared cookies require OTP again when 2FA is enabled.
- Trusted-browser status never overrides password, account status, role, or approval checks; failures return a generic error.

**Revocation:**
- Password change, password reset, account deactivation, and "Sign out of all devices" revoke all trusted browsers and refresh tokens for the account.
- Revocation of refresh tokens uses `users.session_version` (migration `032_add_session_version.sql`); the value is incremented and embedded in refresh tokens, so old refresh tokens fail validation.
- Logout ends only the current portal session and does not revoke trusted-browser status.

**Settings:**
- `TrustedBrowsersCard` on `/doctor/settings` and `/secretary/settings` lists device label, created date, last used date, and expiry, with per-browser Revoke and "Sign out of all devices".
- `TwoFactorBanner` on the Doctor/Secretary dashboard recommends enabling 2FA when it is disabled; it is non-blocking and never prevents access.

**Cookie and Session Isolation:**
- Cookies are role-scoped: `doctor_accessToken`, `doctor_refreshToken`, `doctor_trustedBrowser`, `secretary_*`, `admin_*`, `patient_*`, plus legacy global fallbacks.
- All cookies use path `/`. Access/refresh cookies are HttpOnly and Secure in production; the trusted-browser cookie is always HttpOnly.
- A non-sensitive `<prefix>_sessionActive` browser-session hint cookie (JavaScript-readable, no credentials) is set for non-persistent sessions so `apiClient` can discard localStorage tokens after a browser restart.
- Multiple portal sessions may coexist. Middleware treats role-namespaced paths (`/doctors`, `/secretaries`, `/admin`) as authoritative, uses `X-Portal-Role` for shared resource paths such as `/patients/:id`, `/prescriptions/patients/:id`, and `/visits/patient/:id`, checks the matching role cookies with a global fallback, and rejects cross-role token use. Shared sub-resources are exempt from the namespace check: `/doctors/:id/availability` accepts both PATIENT tokens (the mobile patient booking journey) and DOCTOR tokens; doctor-portal-only routes remain guarded by `authorize('DOCTOR')`.
- The web `apiClient` sends `X-Portal-Role`, retries once after a successful refresh, coordinates concurrent refreshes, runs an idle/absolute watchdog, and clears expired sessions with "Your session has expired. Please log in again." Only a 400/401 refresh response clears the session; transient rate-limit, server, and network failures do not. Safe `GET` reads are also cached for 15 seconds per role and retried on `429` with bounded backoff; mutations are never cached or retried (see "API Rate Limiting, Retries, and Read Caching").

**Trusted Browser API Endpoints:**
- `POST /api/v1/auth/login` — recognizes a valid trusted-device cookie, returns `isTrustedBrowser`/`requiresTrustPrompt` and session metadata, and does not set session cookies until OTP succeeds when OTP is required.
- `POST /api/v1/auth/verify-login-otp` — always issues a short, untrusted staff session and returns `requiresTrustPrompt: true`; it never registers trust.
- `GET /api/v1/auth/trusted-browsers/current-device` — returns the current request's User-Agent and capture timestamp for the trust page; no token or secret is returned.
- `POST /api/v1/auth/trusted-browsers/trust-current` — registers/rotates the current browser, issues a 30-day persistent token pair, and sets the trusted-device cookie. Restricted to Doctor/Secretary and rejected while a password change is required.
- `POST /api/v1/auth/refresh` — refreshes role-scoped tokens within the policy window.
- `POST /api/v1/auth/logout` — clears only the current portal's session cookies; trust is retained.
- `GET /api/v1/auth/trusted-browsers` — lists the account's trusted browsers.
- `DELETE /api/v1/auth/trusted-browsers/:id` — revokes one trusted browser.
- `POST /api/v1/auth/trusted-browsers/revoke-all` — "Sign out of all devices": revokes all trusted browsers and refresh tokens.
- `POST /api/v1/auth/revoke-trusted-browser` — revokes the current browser's trust; used by "Do not trust this device" and kept for backward compatibility.
- `POST /api/v1/auth/change-password` — revokes trust/refresh tokens and issues a fresh session for the current portal.

**Database Schema:**
- `trusted_browsers` table (migration `022_add_trusted_browsers.sql`) stores trusted-browser credentials: id, user_id, token_hash (SHA-256), device_info, expires_at (30 days), created_at, revoked_at, last_used_at.
- `login_otp_challenges` includes `remember_me` for backward-compatible schema; new challenges store `false` and it no longer grants trust.
- `users.session_version` (migration `032_add_session_version.sql`) enables account-wide refresh-token revocation.

**Web Application Integration:**
- Doctor, Secretary, and Admin login pages use role-scoped session metadata returned by the backend.
- After login, untrusted Doctor/Secretary browsers are routed to `/doctor/trust-device` or `/secretary/trust-device`. These pages use the shared `DeviceTrustCard`, bypass the dashboard shell, and call the trust or decline endpoints.
- Secretary password change takes precedence over the trust prompt; profile completion follows the trust choice.
- The trusted-browser cookie is never read with `document.cookie`.
- Admin login has no device-trust prompt and shows a mandatory-OTP/short-session security notice.

### Role-Based Route Protection

- Admin layout (`/admin/*`) - Allows only ADMIN users
- Doctor layout (`/doctor/*`) - Allows only DOCTOR users
- Secretary layout (`/secretary/*`) - Allows only SECRETARY users
- All role verification uses backend-returned role, not frontend selector
- Cross-role access is blocked and cleared credentials on mismatch

### Doctor–Secretary Relationship

- `secretaries.doctor_id` is a required foreign key to `doctors.id`; one Doctor may have multiple Secretaries, and each Secretary belongs to one Doctor.
- `POST /api/v1/doctors/secretaries` derives `doctor_id` from the authenticated Doctor rather than client input.
- `GET /api/v1/doctors/secretaries` is Doctor-only and filters by the Doctor associated with the authenticated user.
- Secretary password changes and profile completion update only the authenticated Secretary account/profile and preserve its Doctor assignment.
- PostgreSQL access is performed by the backend API (Supabase is used for OTP only), so Doctor-level data access is enforced by authenticated, Doctor-scoped backend queries rather than Supabase RLS.
- Migration `015_enforce_secretary_doctor_relationship.sql` enforces the required foreign key and non-null assignment. It backfills only unambiguous assignments from persisted conversations and stops for manual resolution of remaining unassigned records.

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

## Mobile Authentication and Routing

The mobile application is shared by patients and secretaries and reuses the same backend authentication endpoint and credentials as the web dashboards.

- Login is performed through `POST /api/v1/auth/login`; the backend-returned `User.role` is the single source of truth, and the role is persisted with the session so restored sessions route to the correct home.
- Patients are routed to the existing patient home with Home, Doctors, Appointments, and Chat tabs.
- Secretaries are routed to the chat-first secretary home at `/secretary-home`. The mobile route guards redirect unauthenticated users to login, enforce the mandatory password-change requirement, and prevent secretaries from opening patient-only routes.
- Secretaries cannot access queue, payment, walk-in, or schedule management through mobile navigation; appointment management remains on the secretary web dashboard.
- Logout clears the session and removes or invalidates the registered push device token.

---

# 6. Patient Navigation

```text
Home
 ├── Search Doctors
 ├── Doctor Profile
 └── Availability

Reservations
 ├── Upcoming
 ├── Past
 └── Details

Queue
 └── Current Queue Information

Chat
 └── Secretary Conversations

AI Assistant

Waitlist

Payments

Prescriptions

Notifications

Profile
```

There is no direct doctor-chat screen.

---

# 6.1. Patient Registration with OTP

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

**Database Migrations for Login OTP and 2FA:**
- `013_add_two_factor_settings.sql` - Adds `two_factor_enabled` column to `doctors` and `secretaries` tables for optional 2FA
- `014_add_login_otp_challenges.sql` - Creates `login_otp_challenges` table for server-side OTP challenge state with hashed challenge tokens
- `016_doctor_profile_fields.sql` - Adds extended doctor profile fields: contact_number, professional_photo_url, years_of_experience, areas_of_expertise (comma-separated text), consultation_type, languages_spoken (comma-separated text), profile_completion_status, profile_submitted_at
- `022_add_trusted_browsers.sql` - Creates the `trusted_browsers` table for trusted-device sessions (hashed tokens, device info, 30-day expiry, revocation timestamps)
- `032_add_session_version.sql` - Adds `users.session_version` for account-wide refresh-token revocation on password change/reset, deactivation, and "Sign out of all devices"

**Mobile Implementation:**
- Page: `otp_verification_page.dart` provides 6-digit OTP input interface
- Page: `successful_registration_page.dart` displays registration success message
- Page: `onboarding_page.dart` provides 3-screen onboarding flow (Find doctor, Manage health, Book appointments)
- API Service: `api_service.dart` includes patient OTP methods and token management
- Integration: `signup_page.dart` calls backend to send OTP and navigate to verification; a `409 Conflict` from `/send` is shown on the form (using the backend message, e.g. `Username already taken`) and the user stays on the form, so an unavailable username never reaches OTP verification
- Features: Auto-focus, paste support, resend timer, error handling
- Flow: OTP verification → Successful registration → Onboarding → Home dashboard (authenticated)
- Authentication: After successful OTP verification, user is automatically authenticated and can access the app directly
- Onboarding: Only displayed for newly created accounts after registration, not for returning users (tracked via SharedPreferences)

---

# 7. Doctor Navigation

```text
Dashboard

Appointments
 ├── Today
 ├── Upcoming
 └── History

Schedule
 ├── Working Hours
 ├── Exceptions
 ├── Break Periods
 └── Capacity

Patients

Secretary

Prescriptions

Profile

Settings
```

---

# 8. Secretary Navigation

```text
Dashboard

Daily Queue

Walk-ins

Patients

Appointments

Schedule

Conversations

Payments

Profile

Settings
```

The Secretary Schedule page is at `/secretary/schedule`, replacing `/secretary/capacity`; its tabs are Working Hours (read-only), Exceptions, Break Periods, and Capacity. The secretary is the primary operational user for daily queue and payment verification.

### Secretary Mobile Navigation

The shared mobile application exposes a chat-first secretary experience only:

```text
Conversation List (`/secretary-home`)
 └── Conversation Thread (shared) → Read-only Patient-Info Sheet

Menu
 ├── Notifications
 ├── Profile
 ├── Settings
 └── Logout
```

The shared conversation thread is titled with the patient's name when opened from the secretary side. Queue management, walk-in registration, payment verification, and schedule management are not available in the mobile application; secretaries use the web dashboard for those operations.

---

# 9. Admin Navigation

```text
Dashboard

Users

Doctors

Secretaries

Profile
```

Administrators are limited to platform and account oversight. They do not manage clinic schedules, availability, break periods, daily capacity, reservations, queues, payment verification, or consultation records. Those operational workflows belong to doctors and authorized secretaries.

---

# 10. Backend Modules

Recommended backend modules:

```text
auth
users
patients
doctors
secretaries
schedules
capacity
appointments
queue
visits
prescriptions
payments
conversations
messages
ai-chat
waitlists
notifications
admin
```

---

# 11. Scheduling Module

The schedule module manages:

- Working days.
- Working hours.
- Operating hours.
- Break periods.
- Appointment duration.
- Unavailable periods.
- Doctor availability.

Doctors may create, edit, and delete weekly working hours. Authorized secretaries may view, but not create, edit, or delete, their assigned doctor's weekly working hours; they may add, edit, and delete the assigned doctor's exceptions and break periods. Schedule writes are restricted to the authenticated doctor's own records or the secretary's assigned doctor (`secretaries.doctor_id`); unauthorized access returns 404. Validate start <= end, require breaks to fall within working hours, and prevent overlapping breaks.

Before saving an exception or break-period change that affects dates with active appointments, warn the doctor or secretary with the number of affected appointments and require explicit confirmation. After confirmation, save the change and notify affected patients through the notification module. Do not automatically cancel affected appointments; the secretary handles them through the existing cancellation and rescheduling flows.

The default consultation duration is:

**30 minutes**

---

# 12. Capacity Module

The capacity module determines the maximum number of patients that can be registered for a particular date.

### Capacity Inputs

```text
Doctor Availability
Operating Hours
Break Periods
Consultation Duration
Configured Daily Maximum
```

### Capacity Calculation

```text
Available Consultation Time
        ÷
Consultation Duration
        =
Calculated Capacity
```

Example:

```text
8 hours ÷ 30 minutes = 16 patients
```

### Final Capacity

If the doctor or an authorized secretary has configured a lower maximum for the date:

```text
Final Capacity = MIN(Calculated Capacity, Configured Capacity)
```

If there is no configured lower limit, the calculated capacity can be used. A secretary may configure capacity only for their assigned doctor.

---

# 13. Capacity Data Model

Recommended table:

```text
daily_capacities
----------------
id
doctor_id
date
consultation_duration
calculated_capacity
configured_capacity
final_capacity
created_at
updated_at
```

The final capacity is the value enforced by the booking and walk-in registration services.

---

# 14. Capacity and Queue

Capacity applies to the entire daily patient queue.

Both registration types consume the same capacity:

```text
Online Registration
        │
        ├────────────┐
        │            │
        ▼            ▼
                 Daily Capacity
        ▲            ▲
        │            │
Walk-in Registration
```

One successfully registered patient consumes one capacity unit.

---

# 15. Appointment Module

Responsibilities:

- Create reservations (date-only, no specific time slot).
- View appointments.
- Cancel appointments.
- Reschedule appointments.
- Update appointment states.
- Prevent booking conflicts (same date only).
- Validate doctor-specific patient record before reservation.

Payment is intentionally separate from basic reservation creation.

Patients select a date for their appointment (no specific time slot). Queue numbers are assigned based on first-come-first-served order for the selected date.

### Doctor-Specific Patient Record Validation

Before confirming an appointment, the system must validate whether the patient has an existing record with the selected doctor.

**Backend API Endpoints:**
- `GET /api/v1/patients/check-record?doctorId={id}` - Patient-only endpoint to check if they have an existing record with the selected doctor
- `POST /api/v1/patients/submit-details` - Patient-only endpoint to submit required details for a specific doctor before first booking
- `GET /api/v1/patients/me` - Patient-only endpoint to view their own profile
- `PUT /api/v1/patients/me` - Patient-only endpoint to update their own profile (requires authentication)
- `GET /api/v1/patients/doctor/:doctorId` - Doctor-only endpoint to list all patients who have associations or appointments with them
- `GET /api/v1/patients/search` - Secretary-only endpoint to search patients by email, phone, or name for walk-in registration (restricted to assigned doctor's patients)
- `GET /api/v1/patients/:id` - Doctor and Secretary endpoint to view specific patient details (with role-based authorization)

**Record Check Workflow:**
1. Mobile application calls `GET /api/v1/patients/check-record?doctorId={id}` before appointment confirmation
2. Backend queries the `patient_doctor_associations` table to check if the authenticated patient has a persistent association with the selected doctor
3. If no association exists, backend checks the `appointments` table as a fallback for backward compatibility
4. If an existing record is found, backend returns `{ hasRecord: true }` and the patient can proceed directly with booking
5. If no existing record is found, backend returns `{ hasRecord: false }` and the patient must provide required details
6. Mobile application displays form to collect required personal details (first name, middle name, last name, date of birth, sex, mobile number, address, and optional fields)
7. Patient submits form through `POST /api/v1/patients/submit-details` to update their profile and create a persistent doctor association
8. Backend validates all required fields, updates the `patients` table, and creates an entry in `patient_doctor_associations` table
9. After successful save, patient continues with appointment booking
10. Appointment is associated with the patient's existing account (no duplicate accounts created)

**Important Distinction:**
- The check is specific to the selected doctor
- Having an account or a record with another doctor does not automatically count as having an existing record with the selected doctor
- The backend performs a doctor-specific lookup in the `patient_doctor_associations` table (primary) and `appointments` table (fallback)
- Patient-doctor relationship is tracked through the `patient_doctor_associations` table (for persistent records before booking) and the `appointments` table (for actual consultations)
- The `patient_doctor_associations` table has a unique constraint on (patient_id, doctor_id) to prevent duplicate associations

**Patient Details UI Pages:**
- Doctor Dashboard: `/doctor/patients/` - View all patients, search, add/edit patient details
- Doctor Dashboard: `/doctor/appointments/:id` - View patient details within appointment context
- Secretary Dashboard: `/secretary/walk-ins/` - Save patient details during walk-in registration
- Secretary Dashboard: `/secretary/patients/` - View and search patient details (restricted to assigned doctor's patients)
- Secretary Dashboard: `/secretary/queue/` - View patient details in queue context

The mobile application must never connect directly to PostgreSQL. All record checks and updates must go through the backend REST API.

---

# 16. Reservation Model

A regular reservation does not require payment.

A successful reservation results in:

```text
Appointment (date-only)
    +
Queue Entry
    +
Capacity Consumption
```

Patients select a date for their appointment. Queue numbers are assigned sequentially based on the time of registration for that date. The secretary manages the actual order of patient service.

Optional:

```text
Payment
```

Payment does not determine whether the reservation is successfully created.

---

# 17. Unified Queue Module

The queue module is a core domain service.

Responsibilities:

- Create queue entries.
- Assign queue numbers.
- Retrieve daily queue.
- Determine next patient.
- Call patients.
- Skip patients.
- Update queue status.
- Preserve queue history.

Both online and walk-in registrations use the same queue service.

---

# 18. Queue Data Model

Recommended table:

```text
queue_entries
-------------
id
patient_id
doctor_id
appointment_id
queue_date
queue_number
registration_source
status
created_at
called_at
started_at
completed_at
updated_at
```

### Registration Source

```text
ONLINE
WALK_IN
```

### Status

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

---

# 19. Queue Number Generation

Queue numbers must be sequential within the applicable daily queue.

Ordering is based on successful queue registration time.

Example:

```text
10:01 Online  → Queue 1
10:04 Walk-in → Queue 2
10:05 Online  → Queue 3
```

The registration source must not affect queue priority.

The queue-number assignment must be concurrency-safe.

---

# 20. Queue State Flow

```text
WAITING
   ↓
CALLED
   ├──► IN_CHECKUP
   │       ↓
   │    COMPLETED
   │
   └──► NOT_PRESENT / SKIPPED
```

A skipped patient remains in the database and can be managed later.

---

# 21. Secretary Queue Service

The secretary queue service provides:

```text
Next Patient
Start Checkup
Skip / Not Present
Complete Checkup
```

The mobile interface should call backend actions rather than implementing queue state transitions locally.

---

# 22. Walk-in Registration Module

Walk-in registration is a secretary-controlled workflow.

```text
Secretary
   ↓
Search Patient
   ↓
Existing Account?
 ├── Yes
 │    ↓
 │ Use Existing Account
 │
 └── No
      ↓
   Create Patient
      ↓
   Generate Temporary Password
      ↓
   Require First-Login Password Change
   ↓
Select Doctor / Date
   ↓
Check Capacity
   ↓
Create Appointment/Registration
   ↓
Create Queue Entry
   ↓
Update Capacity
```

Walk-in registration must use the same capacity and queue services as online reservation.

---

# 23. Walk-in Account Architecture

New walk-in accounts require:

```text
email
username = email
temporary_password
must_change_password = true
```

The temporary password must be securely hashed.

The plaintext temporary password should not be retained after the authorized credential-delivery process.

The backend must block normal application access until:

```text
must_change_password = false
```

---

# 24. Medical History Association

Walk-in and online patients must use the same patient identity model.

Correct flow:

```text
Patient
   ↓
Appointment
   ↓
Queue Entry
   ↓
Visit
   ↓
Medical History
   ↓
Prescription
```

A walk-in patient must not receive a disconnected temporary medical record.

---

# 25. Secretary–Patient Communication Module

The communication module supports:

```text
Patient ↔ Secretary
```

It does not support:

```text
Patient ↔ Doctor
```

### Conversation Scope and Sharing

- Each patient has a single conversation per doctor. Creating a conversation reuses the existing conversation and message records for that patient–doctor pair; per-secretary duplicate histories are never created.
- All secretaries assigned to the same doctor (`secretaries.doctor_id`) share access to the relevant patient conversations and write to the same message history.

### Role-Based Access

- A patient may access only their own conversations and only for a doctor with whom they have a matching `patient_doctor_associations` record.
- A secretary may access conversations only for patients associated with their assigned doctor.
- Access checks are enforced consistently on conversation listing, creation, retrieval, message retrieval, sending, and read-status updates.

Recommended tables:

```text
conversations
messages
```

---

# 26. Conversation Data Model

```text
conversations
-------------
id
patient_id
secretary_id
doctor_id
status
created_at
updated_at
```

The model stores the conversation's doctor (`doctor_id`) so role-based access can scope secretaries to their assigned doctor (`secretaries.doctor_id`) and scope patients to doctors with a matching `patient_doctor_associations` record. There is no dedicated patient-doctor conversation channel in this model; `doctor_id` identifies the practice the conversation belongs to, not a chat participant.

Recommended statuses:

```text
OPEN
CLOSED
ARCHIVED
```

---

# 27. Message Data Model

```text
messages
--------
id
conversation_id
sender_user_id
message
sent_at
read_at
```

The backend must verify that the sender is an authorized participant.

Read status is tracked by `read_at`. Unread counts are computed from `read_at` and exclude messages sent by the current user. Conversation-list results include this unread count together with a latest-message preview that is consistent with the most recently saved message.

---

# 28. Chat Architecture

```text
Patient Mobile / Secretary Web
        ↓
POST /conversations/:id/messages
      ↓
Backend
      ↓
Authenticate
      ↓
Verify Conversation Access
      ↓
Validate Message
      ↓
Save Message
      ↓
Notify Recipients (never the sender)
      ↓
FCM / APNs push to registered devices
```

The same authorization model applies when the secretary replies. Notification titles, bodies, and push payloads are generic and never contain message content:

- Patient-sent message → `NEW_PATIENT_MESSAGE` to the secretaries assigned to the conversation's doctor.
- Secretary-sent message → `NEW_SECRETARY_MESSAGE` to the patient.

Push delivery targets only the intended recipients' device tokens stored in the `device_tokens` table; FCM/APNs credentials are configurable on the backend only.

The Secretary web chat replaces the placeholder page with a functional three-column interface (conversation list, message thread with distinct sender/recipient styling, composer) and adds an unread badge to the sidebar. It calls the same conversations API through the existing web API client, with the backend and PostgreSQL as the single source of truth — no separate conversation or message storage is added.

The shared mobile application adds a secretary chat-first home (`/secretary-home`) with a conversation list (patient information, last-message previews, unread counts), the same conversation thread used by patients, a read-only patient-info sheet, and a minimal Notifications/Profile/Settings/Logout menu. Both the secretary web chat and the secretary mobile chat read and write the same `conversations` and `messages` records, so read status, unread counts, and last-message previews stay synchronized. A chat notification tap opens the conversation thread only when the authenticated user's role matches the notification type and the backend confirms access to the conversation.

---

# 29. Doctor Chat Restriction

The architecture must not provide direct patient-doctor messaging.

Do not create:

```text
doctor-chat endpoints
doctor conversation tables
patient-doctor chat screens
```

Generic conversation code must explicitly enforce this restriction.

---

# 30. Payment Module

Payment is separate from reservation.

Supported initial methods:

```text
CASH
GCASH
```

The system does not require advance payment for regular reservations.

---

# 31. GCash Architecture

The project does not integrate directly with the GCash API.

Use a static/default GCash QR.

```text
Patient
   ↓
View GCash QR
   ↓
Pay using GCash externally
   ↓
Upload Receipt
   ↓
Receipt Storage
   ↓
Payment = PENDING_VERIFICATION
   ↓
Secretary Reviews
   ↓
PAID / REJECTED
```

Receipt upload does not automatically mean payment is valid.

---

# 32. Payment Data Model

Recommended:

```text
payments
--------
id
patient_id
appointment_id
payment_method
consultation_amount
total_additional_charges
total_amount
status
receipt_url
verified_by
verified_at
created_at
updated_at
```

Statuses:

```text
UNPAID
PENDING_VERIFICATION
PAID
REJECTED
```

---

# 33. Additional Charges Data Model

Recommended:

```text
payment_charges
---------------
id
payment_id
description
amount
created_by
created_at
```

Calculation:

```text
Consultation Fee
      +
Additional Charges
      =
Total Amount Due
```

---

# 34. Payment Verification

Only authorized secretaries should verify uploaded GCash receipts during the MVP workflow.

Flow:

```text
Upload Receipt
      ↓
PENDING_VERIFICATION
      ↓
Secretary Review
      ├── Valid → PAID
      └── Invalid → REJECTED
```

---

# 35. Receipt Storage

Receipts should use secure file storage.

```text
Mobile
  ↓
Receipt Upload API
  ↓
Secure File Storage
  ↓
Receipt Reference
  ↓
PostgreSQL
```

The receipt must not be publicly accessible.

---

# 36. AI Chatbot Module

AI is integrated through the backend.

```text
Patient
   ↓
Mobile AI Chat
   ↓
Backend
   ↓
Authentication
   ↓
Input Validation
   ↓
Safety Processing
   ↓
External AI Provider
   ↓
Response Processing
   ↓
Patient
```

The mobile application should not expose the AI provider's credentials.

---

# 37. AI Conversation Data

Recommended tables:

```text
ai_conversations
----------------
id
patient_id
created_at
updated_at

ai_messages
-----------
id
conversation_id
role
content
created_at
```

Roles may include:

```text
USER
ASSISTANT
SYSTEM
```

---

# 38. AI Safety Architecture

The AI is an informational assistant.

It must not:

- Diagnose.
- Prescribe.
- Change prescriptions.
- Replace professional medical advice.
- Make medical decisions.
- Claim to be a physician.

Potentially urgent cases should result in appropriate advice to seek professional or emergency assistance.

---

# 39. AI Data Minimization

Do not automatically send the entire patient record to the AI provider.

Do not send unless necessary:

- Full medical history.
- Complete prescription history.
- Unrelated appointments.
- Other patients' records.
- Authentication credentials.
- Database credentials.

Only necessary information should be used for the current conversation.

---

# 40. Doctor Module

Responsibilities:

- Profile.
- Specialty.
- Credentials.
- Biography.
- Consultation fee.
- Approval status.
- Availability.
- Capacity.

---

# 41. Patient Module

Responsibilities:

- Account.
- Medical history.
- Allergies.
- Medications.
- Emergency contact.
- Appointment history.
- Consultation history.

---

# 42. Visit Module

Recommended:

```text
visits
------
id
appointment_id
patient_id
doctor_id
visit_date
reason_for_visit
notes
created_at
updated_at
```

Completed consultations should be associated with the patient account.

---

# 43. Prescription Module

Recommended:

```text
prescriptions
-------------
id
visit_id
patient_id
doctor_id
prescription_date
pdf_url
notes
created_at
updated_at
```

```text
prescription_items
------------------
id
prescription_id
medication_name
dosage
frequency
duration
instructions
```

---

# 44. Notification Module

Notifications may be generated when:

- Reservation is created.
- Queue information changes.
- A patient sends a chat message (NEW_PATIENT_MESSAGE, to the secretaries of the conversation's doctor).
- A secretary sends a chat message (NEW_SECRETARY_MESSAGE, to the patient).
- Payment is verified.
- Prescription is created.
- Appointment changes.
- A confirmed exception or break-period change affects dates with active appointments.
- Waitlist status changes.

Chat notifications are sent only to recipients (never the sender) with generic titles, bodies, and push payloads that never include message content, and are additionally delivered as FCM/APNs pushes to the recipient's registered device tokens when push credentials are configured.

---

# 45. API Architecture

Base:

```text
/api/v1
```

### Capacity

```text
GET  /doctors/:id/capacity
PUT  /doctors/:id/capacity
POST /doctors/:id/capacity/:date

GET  /secretaries/managed-doctors/capacity
PUT  /secretaries/managed-doctors/capacity
POST /secretaries/managed-doctors/capacity/:date
```

### Secretary Schedule

```text
GET    /secretaries/managed-doctors/schedules

GET    /secretaries/managed-doctors/unavailability
POST   /secretaries/managed-doctors/unavailability
PUT    /secretaries/managed-doctors/unavailability/:id
DELETE /secretaries/managed-doctors/unavailability/:id

GET    /secretaries/managed-doctors/break-periods
POST   /secretaries/managed-doctors/break-periods
PUT    /secretaries/managed-doctors/break-periods/:id
DELETE /secretaries/managed-doctors/break-periods/:id
```

Secretary schedule endpoints use the `secretaries.doctor_id` ownership check. Weekly schedules are read-only for secretaries. Exception and break-period writes that affect active appointments require the warning and explicit confirmation before saving.

### Queue

```text
GET   /queue/:date
GET   /queue/:date/patient/:patientId
POST  /queue/:date/next
PATCH /queue/:id/status
```

### Walk-in

```text
POST /walk-ins
GET  /walk-ins/search
POST /walk-ins/create-account
```

### Secretary Chat

```text
GET  /conversations
POST /conversations
GET  /conversations/:id
GET  /conversations/:id/messages
POST /conversations/:id/messages
PATCH /conversations/:id/read
GET  /conversations/:id/appointment-summary (secretary-only, read-only patient-info sheet)
```

### Device Tokens and Push Delivery

```text
POST   /notifications/device-tokens       (register a device token for the authenticated user)
DELETE /notifications/device-tokens/:id   (remove one of the user's own tokens)
```

Device tokens are stored in the `device_tokens` table, associated with their owning user, and can be registered or removed only by that user. After a chat message is saved, FCM/APNs delivery targets only the intended recipients.

### AI

```text
POST /ai/chat
GET  /ai/conversations
GET  /ai/conversations/:id
GET  /ai/conversations/:id/messages
```

### Payments

```text
GET   /payments/:appointmentId
POST  /payments/:appointmentId/receipt
PATCH /payments/:id/verify
PATCH /payments/:id/reject
POST  /payments/:id/charges
```

---

# 46. Reservation Transaction

Online reservation should be atomic.

```text
BEGIN TRANSACTION

Validate Doctor
Validate Schedule
Check Capacity
Check Slot Conflict
Create Appointment
Create Queue Entry
Assign Queue Number
Update Daily Registration Count
Create Notification

COMMIT
```

If any required step fails, roll back the transaction.

---

# 47. Walk-in Transaction

```text
BEGIN TRANSACTION

Find/Create Patient
Validate Doctor
Validate Schedule
Check Capacity
Create Appointment/Registration
Create Queue Entry
Assign Queue Number
Update Daily Registration Count

COMMIT
```

---

# 48. Concurrency Protection

Capacity and queue registration are concurrency-sensitive.

The backend must prevent:

- Capacity overflow.
- Duplicate queue numbers.
- Double booking.
- Race conditions between online booking and walk-in registration.

Use PostgreSQL transactions, constraints, and appropriate locking/isolation.

---

# 49. Database Relationships

```text
USER
 ├── PATIENT
 ├── DOCTOR
 ├── SECRETARY
 └── ADMIN

PATIENT
 ├── APPOINTMENTS
 ├── QUEUE ENTRIES
 ├── VISITS
 ├── PRESCRIPTIONS
 ├── PAYMENTS
 ├── CONVERSATIONS
 └── AI CONVERSATIONS

DOCTOR
 ├── SCHEDULES
 ├── CAPACITY
 ├── APPOINTMENTS
 ├── VISITS
 └── PRESCRIPTIONS

CONVERSATION
 └── MESSAGES

AI_CONVERSATION
 └── AI_MESSAGES

PAYMENT
 └── PAYMENT_CHARGES

APPOINTMENT
 └── VISIT
      └── PRESCRIPTION
```

---

# 50. Recommended Database Tables

```text
users
patients
doctors (with approval_status field)
secretaries

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
device_tokens (for FCM/APNs push delivery)

pending_doctor_signups (for OTP staging)
pending_patient_signups (for OTP staging)

pending_doctor_signups (for OTP staging)
```

---

# 50. Security Architecture

```text
Mobile
  ↓
HTTPS
  ↓
Authentication
  ↓
Role Authorization
  ↓
Resource Ownership
  ↓
Business Validation
  ↓
Database
```

The backend must enforce every permission.

---

# 53. Communication Authorization

| User | Target | Permission |
|---|---|---|
| Patient | Secretary | Allowed |
| Secretary | Patient | Allowed |
| Patient | AI | Allowed |
| Patient | Doctor | Denied |
| Doctor | Patient | Direct chat denied |

The backend must enforce this matrix.

---

# 54. Patient Data Security

Sensitive data includes:

- Medical history.
- Allergies.
- Medications.
- Visit notes.
- Prescriptions.
- Payment records.
- GCash receipts.
- Secretary conversations.
- AI medical conversations.

Only authorized users should access these records.

---

# 55. Timezone

The initial deployment target is:

```text
Asia/Manila
```

Date/time handling must be consistent across:

- Appointments.
- Queue entries.
- Schedules.
- Messages.
- Notifications.
- Payments.

---

# 56. API Response Format

Success:

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful."
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "CAPACITY_FULL",
    "message": "The selected date has reached its maximum patient capacity."
  }
}
```

---

# 57. Error Codes

Possible errors:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT

CAPACITY_FULL
APPOINTMENT_SLOT_UNAVAILABLE
QUEUE_ASSIGNMENT_FAILED

CONVERSATION_ACCESS_DENIED

PAYMENT_VERIFICATION_REQUIRED
PAYMENT_ALREADY_VERIFIED
INVALID_PAYMENT_RECEIPT

AI_SERVICE_UNAVAILABLE
AI_RESPONSE_ERROR

INVALID_APPOINTMENT_STATUS
SERVER_ERROR
```

---

# 58. Repository Structure

```text
findmydoctor/
│
├── mobile/
│   ├── app/
│   ├── features/
│   │   ├── auth/
│   │   ├── doctors/
│   │   ├── appointments/
│   │   ├── schedules/
│   │   ├── queue/
│   │   ├── capacity/
│   │   ├── patients/
│   │   ├── prescriptions/
│   │   ├── payments/
│   │   ├── secretary-chat/
│   │   ├── ai-chat/
│   │   ├── waitlist/
│   │   └── notifications/
│   ├── components/
│   ├── services/
│   ├── api/
│   └── types/

├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── patients/
│   │   │   ├── doctors/
│   │   │   ├── secretaries/
│   │   │   ├── schedules/
│   │   │   ├── capacity/
│   │   │   ├── appointments/
│   │   │   ├── queue/
│   │   │   ├── visits/
│   │   │   ├── prescriptions/
│   │   │   ├── payments/
│   │   │   ├── conversations/
│   │   │   ├── messages/
│   │   │   ├── ai-chat/
│   │   │   ├── waitlists/
│   │   │   ├── notifications/
│   │   │   └── admin/
│   │   ├── middleware/
│   │   ├── config/
│   │   ├── database/
│   │   └── utils/
│   └── tests/

├── web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── doctor/
│   │   │   ├── secretary/
│   │   │   └── admin/
│   │   ├── components/
│   │   └── lib/
│   └── public/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema/
│
├── docs/
│
├── PRD.md
├── ARCHITECTURE.md
└── ARCHITECTURE-ESSENTIALS.md
```

---

# 59. Technology Stack

## Frontend Applications

### Mobile Application (`/mobile`)
- **Framework**: Flutter
- **Language**: Dart
- **Target Platforms**: iOS, Android, Web (optional)
- **State Management**: To be determined
- **API Communication**: REST API via HTTP/HTTPS

### Web Application (`/web`)
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **UI Library**: React
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui (optional, for complex UI components)
- **API Communication**: REST API via HTTP/HTTPS
- **Purpose**: Doctor, Secretary, and Admin dashboards only

**Styling Recommendation: Tailwind CSS + shadcn/ui Components**

This combination provides:
- Tailwind's utility-first styling for rapid development
- shadcn/ui's pre-built, accessible components for complex UI elements
- Perfect integration with Next.js 14 App Router
- No component library bloat - copy-paste only what you need
- Easy to maintain and customize
- Excellent for healthcare dashboard interfaces

Since Tailwind CSS is already configured, shadcn/ui components can be added as needed for complex UI elements like forms, tables, and modals.

## Backend Application (`/backend`)

### Core Framework
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript or JavaScript (to be determined)
- **Architecture**: Modular Monolith

### API Layer
- **Style**: REST API
- **Base Path**: `/api/v1`
- **Content Type**: JSON
- **Authentication**: JWT tokens (to be implemented)

### Database Layer
- **Database**: PostgreSQL
- **ORM**: To be determined (Prisma, TypeORM, or raw SQL)
- **Migrations**: Database migration system
- **Connection Pooling**: To be configured

### External Services
- **AI Provider**: External AI service (credentials server-side only)
- **File Storage**: Secure file storage for receipts and documents

## Development Tools

### Version Control
- **Git**: Version control system
- **Repository Structure**: Monorepo with three applications

### Code Quality
- **Linting**: ESLint (web), Flutter linter (mobile)
- **Type Checking**: TypeScript (web), Dart analyzer (mobile)
- **Formatting**: Prettier (optional)

### Package Management
- **Web**: npm
- **Mobile**: pub (Flutter)
- **Backend**: npm

## API Rate Limiting, Retries, and Read Caching

Dashboard navigation must not exhaust rate limits or duplicate reads. The behavior is intentionally small and dependency-free.

### Backend Rate Limits

- `backend/src/middleware/rateLimit.ts` exports `createRateLimiter`, `apiLimiter`, and `authLimiter`.
- General API: `RATE_LIMIT_MAX_REQUESTS` (default `300`) per `RATE_LIMIT_WINDOW_MS` (default `60000`) per IP, mounted on `/api/`.
- Sensitive authentication: `AUTH_RATE_LIMIT_MAX_REQUESTS` (default `30`) per `AUTH_RATE_LIMIT_WINDOW_MS` (default `900000`) per IP, mounted on `/api/v1` and skipped for non-auth paths. Covered paths: `/auth/login`, `/auth/verify-login-otp`, `/auth/resend-login-otp`, `/auth/otp`, `/auth/patient/otp`, `/auth/register`, `/auth/change-password`.
- Sensitive routes count against both budgets, so the stricter auth budget applies.
- `429` responses carry `Retry-After` (seconds) and `{ success: false, error: { code: "RATE_LIMIT", message } }`.
- `OPTIONS` requests do not consume either budget.
- Rate limiting is additive to authentication/authorization; protected routes still validate token and role on every request.

### Server Availability Cache

- `backend/src/modules/availability/availabilityService.ts` wraps availability range computation in a `TtlCache` (`backend/src/utils/ttlCache.ts`).
- TTL: `AVAILABILITY_CACHE_TTL_MS` (default `20000`). Key: `availability:<doctorId>:<start>:<end>`.
- The cache is bypassed whenever `patientId` is provided, so patient-specific results are never reused.
- Successful non-`GET` requests through the doctors, secretaries, appointments, and walk-ins routers invalidate the cache.

### Backend Query Batching

- `calculateCapacityRange` fetches schedules, breaks, exceptions, and appointments in four queries total instead of four per date.
- The Doctor dashboard executes its independent reads with `Promise.all` and reuses the loaded schedule/break/exception rows through `buildCapacityResult`.
- The Secretary dashboard reads concurrently and computes unread messages with one aggregate query.
- The payments list loads charges with one `payment_id = ANY($1::uuid[])` query and groups them in memory.

### Web Client

- `web/src/lib/api/requestPolicy.ts` defines the retry policy: only `GET` is retried on `429`, three total attempts, 500 ms base exponential backoff, jitter up to 250 ms, 5 s maximum wait, and `Retry-After` precedence.
- `web/src/lib/api/ttlCache.ts` is an in-memory TTL cache. `apiClient` keys entries as `<role>|<endpoint>` and caches only successful `GET` responses for 15 seconds.
- Concurrent identical non-abortable reads share one in-flight request.
- The cache is cleared on token/role change, logout/session expiry, and after any successful mutation. A cache generation counter prevents requests started before a clear from repopulating stale data.
- `apiClient.get` accepts `{ signal, skipCache, cacheTtlMs }`. Dashboard pages abort on unmount; save-event refreshes use `skipCache`.
- Mutations are never retried and never served from cache. Server authorization still runs on every cache miss.
- Web tests use Node's built-in test runner (`npm test` in `/web`); no new dependency was added.

## Security Considerations

- **HTTPS**: All API communications must use HTTPS
- **CORS**: Proper CORS configuration for web application
- **Authentication**: JWT-based authentication for all applications
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: Encrypted database connections
- **Secret Management**: Environment variables for sensitive data

## Deployment Considerations

- **Backend**: Node.js server hosting
- **Web**: Next.js deployment (Vercel, Netlify, or self-hosted)
- **Mobile**: App stores (Apple App Store, Google Play Store)
- **Database**: Managed PostgreSQL service or self-hosted

## Current Tech Stack Summary

**Frontend:**
- Mobile: Flutter, Dart
- Web: Next.js 14, React, TypeScript

**Styling:**
- Web: Tailwind CSS (configured) + shadcn/ui (optional)

**Backend:**
- Node.js, Express.js (in backend/)

**Database:**
- PostgreSQL

**Architecture:**
- Monorepo with shared REST API serving both mobile and web applications

---

# 60. Testing Architecture

Critical tests should cover:

### Booking

- Valid reservation.
- Reservation without payment.
- Double booking.
- Capacity full.
- Concurrent booking.

### Queue

- Sequential queue numbers.
- Online/walk-in combination.
- Queue status transitions.
- Skip/not-present behavior.
- Capacity updates.

### Walk-in

- Existing account.
- New account.
- Temporary password.
- First-login password change.

### Payments

- Receipt upload.
- Pending verification.
- Secretary verification.
- Rejection.
- Additional charges.
- Total amount.

### Chat

- Patient-secretary communication.
- Conversation ownership.
- Unauthorized conversation access.
- Patient-doctor chat blocked.

### AI

- AI request.
- Authentication.
- AI provider errors.
- Safety behavior.
- Conversation ownership.

---

# 61. Deployment Architecture

```text
                   Internet
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
      Mobile App              Web App
           │                       │
           └───────────┬───────────┘
                       │
                     HTTPS
                       │
                       ▼
                  Backend API
             ┌─────────┼─────────┐
             ▼         ▼         ▼
        PostgreSQL   Storage   AI Provider
             │
             └────── Application Data
```

---

# 62. Environment Configuration

Potential environment values:

```text
# Backend
DATABASE_URL
AUTH_SECRET
AI_API_KEY
STORAGE credentials
PUSH credentials

# Web Application
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_APP_URL
```

Secrets must never be committed to source control.

---

# 63. Architectural Rules Summary

The architecture must always maintain these relationships:

```text
Mobile → Backend → PostgreSQL

Mobile → Backend → AI Provider

Patient ↔ Secretary

Patient ↔ AI

Patient ──X── Doctor
```

Online and walk-in:

```text
Online
  ↓
Unified Queue
  ↑
Walk-in
```

Reservation and payment:

```text
Reservation
   ↓
Successful without payment
   ↓
Optional GCash Payment
```

---

# 64. Final Architecture Principle

The backend is the source of truth for:

- Authentication.
- Authorization.
- Availability.
- Capacity.
- Queue numbers.
- Appointments.
- Payments.
- Communication permissions.
- Medical-record access.
- AI integration.

PostgreSQL is the source of truth for persistent data.

The system should remain a **modular, secure, mobile-first educational prototype** without unnecessary distributed infrastructure.
