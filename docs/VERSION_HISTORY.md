# FindMyDoctor Version History

This document contains the complete version history for the FindMyDoctor application.

---

### 01.12 (October 19, 2026)

**Purpose:** Implement the secretary–patient chat feature across the backend and the secretary web application, with role-based conversation access, read-status unread counts, chat notifications with FCM/APNs push delivery, device-token management, and a read-only appointment-summary endpoint

**Significant Features:**
- Secretary Web Dashboard chat at `/secretary/conversations` replaces the placeholder with a functional three-column interface: conversation list (patient details, unread badges/counts, latest-message previews), message thread with distinct sender/recipient styling, and a composer; the sidebar adds an unread badge on the Conversations item without changing its layout
- Read-only appointment-summary endpoint `GET /api/v1/conversations/:id/appointment-summary` backs the secretary chat patient-info sheet (secretary-only, assigned-doctor scope, doctor-association access rules; appointment fields only, no mutations)
- Device-token management: `POST /api/v1/notifications/device-tokens` and `DELETE /api/v1/notifications/device-tokens/:id` let an authenticated user register and remove only their own push tokens (`device_tokens` table, migration `028_add_device_tokens.sql`, applied via `npm run migrate:device-tokens`)
- Push delivery integrated after a message is saved via `backend/src/services/pushService.ts` (FCM HTTP v1 with legacy server-key fallback, APNs token-based over HTTP/2); provider credentials remain backend-only and delivery is best-effort, targeting only intended recipients

**Improvements:**
- Backend: `GET /conversations` returns unread counts computed from `messages.read_at` excluding the caller's own messages, plus a latest-message preview consistent with the newest saved message, for both patient and secretary listings
- Backend: `POST /conversations` reuses the patient's single conversation per doctor (no per-secretary duplicate histories); secretaries assigned to the same doctor (`secretaries.doctor_id`) share the same message history
- Backend: role-based access enforced consistently across listing, creation, retrieval, message retrieval, sending, and read-status updates (patient: own conversations for doctors with `patient_doctor_associations` records; secretary: patients associated with the assigned doctor)
- Backend: after a message is saved, recipients receive generic notifications with titles and bodies that never contain message content: patient-sent → `NEW_PATIENT_MESSAGE` to the assigned secretaries; secretary-sent → `NEW_SECRETARY_MESSAGE` to the patient; recipients only, never the sender
- Backend: added `conversationService` (`backend/src/modules/conversations/conversationService.ts`) centralizing authorized-conversation access checks and recipient notifications; added push backend configuration (`FCM_*`, `APNS_*`) in `backend/src/config/index.ts`
- Web: `secretaryApi.ts` adds `conversationApi` (list, get, messages, send, mark-as-read, appointment summary) and `Conversation`/`ConversationMessage`/`AppointmentSummary` types using relative API paths against the existing base URL

**Bug Fixes:**
- Fixed patient conversation unread counts including the patient's own sent messages

**Removed/Modified Functionality:**
- `POST /conversations` no longer requires both `secretaryId` and `doctorId`; it now requires `doctorId` (with optional `secretaryId`) and validates the patient's doctor association plus the secretary's doctor assignment; responses are enriched with secretary/doctor names
- `PATCH /conversations/:id/read` and message retrieval now enforce conversation authorization (previously unauthenticated-body verification only); unauthorized attempts return `403 CONVERSATION_ACCESS_DENIED` or `404`
- Direct patient–doctor chat remains prohibited; no patient↔doctor messaging endpoints were added
- Secretary mobile chat is planned follow-up work and is not implemented

**Architecture:**
- Backend: modified `/backend/src/api/conversations.ts`, `/backend/src/api/notifications.ts`, `/backend/src/config/index.ts`; added `/backend/src/modules/conversations/conversationService.ts`, `/backend/src/services/pushService.ts`
- Database: added `/backend/database/028_add_device_tokens.sql` and `/backend/src/database/applyDeviceTokens.ts` (`device_tokens` table, indexes, provider+token uniqueness)
- Web: modified `/web/src/app/secretary/conversations/page.tsx`, `/web/src/lib/api/secretaryApi.ts`, `/web/src/components/layout/SecretarySidebar.tsx`
- Mobile: unchanged; existing patient conversation list/messages/send responses remain compatible

**Testing:**
- Backend: added `src/api/conversations.test.ts` (16 tests) covering role-based listing, secretary doctor-scope, association-gated creation, conversation reuse, unauthorized message/read access denial, recipient notifications with generic push payloads (never the sender), read-status updates, and device-token register/remove ownership
- Backend: conversations test suite 16/16 passed; `tsc --noEmit` clean
- Web: `next build` succeeded (40 routes including `/secretary/conversations`); `tsc --noEmit` clean; lint shows only pre-existing errors in unrelated pages

**Documentation:**
- Updated `docs/prd.md` (section 16 Secretary–Patient Chat, section 24 Notifications, FR-031, FR-039, Secretary Web Dashboard scope) and `docs/architecture.md` (communication module, chat architecture, secretary chat and device-token endpoints, notification module, database tables)
- Updated `docs/architecture-essentials.md` (Secretary Chat Rules access/sharing/unread/patient-info sheet/push rules, database tables and migration list, chat implementation checklist)
- Updated `docs/SYSTEM_STATE.md` (Database Schema, Patient-Secretary Messaging and Push Notifications, Secretary Web Chat)
- Updated CURRENT_VERSION.md to 01.12 and added this VERSION_HISTORY.md entry

---

### 01.11 (October 18, 2026)

**Purpose:** Replace FindMyDoctor branding logos across mobile and web applications and implement platform-aware API base URL configuration

**Significant Features:**
- Replaced FindMyDoctor logo across mobile application with new branding
- Replaced FindMyDoctor logo across web application with new branding
- Implemented sticky logo headers across mobile app pages for consistent branding visibility

**Improvements:**
- Mobile: Added sticky logo headers to maintain branding visibility while scrolling through pages
- Web: Improved logo sizing in web portal sidebars for better visual consistency
- Backend: Added platform-aware base URL configuration for cross-platform API connectivity
- Backend: Configured uploads rewrite to use dynamic API base URL for proper file serving across platforms

**Bug Fixes:**
- Fixed API connectivity issues across different platforms by implementing dynamic base URL resolution
- Fixed logo sizing inconsistencies in web portal sidebars

**Removed/Modified Functionality:**
- No authentication, registration, OTP, appointment booking, doctor search, queue logic, or business rules were changed; only branding and platform connectivity were updated

**Architecture:**
- Mobile: Modified `/mobile/lib/` (logo assets and page layouts for sticky headers)
- Web: Modified `/web/src/` (logo assets and sidebar components)
- Backend: Modified `/backend/src/` (base URL configuration and uploads rewrite)

**Testing:**
- Verified logo rendering across mobile and web applications
- Verified API connectivity with platform-aware base URL configuration
- Verified file upload/download functionality with dynamic URL rewriting

**Documentation:**
- Updated CURRENT_VERSION.md to 01.11
- Added VERSION_HISTORY.md entry for 01.11

---

### 01.10 (October 18, 2026)

**Purpose:** Report a taken username on the patient sign-up form before any OTP is sent, instead of only after OTP verification

**Significant Features:**
- Patient sign-up now verifies username availability up-front: `POST /api/v1/auth/patient/otp/send` returns `409 Conflict` with `Username already taken` before the sign-up is staged or any OTP is emailed

**Improvements:**
- Backend: The patient OTP `/send` endpoint checks username uniqueness after the existing email existence check and before OTP staging and sending (validation order: email existence check → username uniqueness check → OTP staging and sending)
- Mobile: The sign-up form surfaces the `/send` `409 Conflict` message verbatim (e.g. `Username already taken`, `Email is already registered`) in its inline error banner and snackbar and keeps the user on the form, so a taken username no longer forces the patient to restart registration
- Mobile: `SignUpPage` accepts an optional injected `ApiService` (test seam), matching the existing `AppointmentsPage` pattern; the default behavior is unchanged

**Bug Fixes:**
- Fixed the mobile sign-up form reporting every `409 Conflict` as "Email already exists. Please use a different email.", which mislabelled a taken username

**Removed/Modified Functionality:**
- The username uniqueness check remains in the `/verify` endpoint as the safety net for concurrent registration attempts; no OTP verification flow, Supabase integration, database schema, or architecture was changed

**Architecture:**
- Backend: Modified `/backend/src/api/patientOtp.ts`
- Mobile: Modified `/mobile/lib/features/auth/presentation/signup_page.dart`
- Database: No schema changes; the `users` username unique constraint is unchanged and remains the final backstop

**Testing:**
- Backend: Added `Patient OTP /send - up-front email and username checks` tests (taken username → `409 Username already taken` with no OTP sent and nothing staged; taken email → `409 Email is already registered` with no OTP sent; the email is checked before the username; available email + username → sign-up staged and OTP sent)
- Backend: Live verification against the running API and PostgreSQL confirmed fresh email + taken username → `409 Username already taken`; taken email → `409 Email is already registered`; both taken → `409 Email is already registered`
- Mobile: Added widget tests driving `SignUpPage` through the real `ApiService` with a mock HTTP client (taken username → backend message shown on the form, no navigation to OTP verification, exactly one request; available username → navigates to OTP verification, exactly one request)
- Backend: Full suite 251 passed with 4 pre-existing failures (`src/utils/date.test.ts` timezone, `src/api/auth.test.ts` change-password); `tsc --noEmit` clean. Mobile: 109 passed with 2 pre-existing failures (`password_change_enforcement_test.dart` mock signature, `widget_test.dart` counter smoke test); `flutter analyze` unchanged from baseline
- Not verified: live mobile-device submission of the sign-up form (covered by widget tests against the real `ApiService` and by live API calls instead)

**Documentation:**
- Updated `docs/prd.md` (FR-001-A flow, `/send` endpoint, security requirements, mobile implementation) and `docs/SYSTEM_STATE.md` (Patient Registration & Authentication, Mobile Application) to document the up-front email/username check and the sign-up form error handling
- Updated CURRENT_VERSION.md to 01.10
- Added VERSION_HISTORY.md entry for 01.10

---

### 01.09 (October 18, 2026)

**Purpose:** Fix the mobile layout crash (`Each child must be laid out exactly once.`) and the stuck data-loading state on app launch

**Significant Features:**
- None (bug fix release)

**Improvements:**
- Mobile: The home page no longer derives a negative `SizedBox` height from the viewport (`MediaQuery.size.height - 200` / `- 350`); the empty-state filler is only reserved when there is positive vertical space
- Mobile: The login, sign-up, and OTP pages clamp their scrollable `minHeight` to zero instead of subtracting from a possibly zero height, and the OTP box sizing clamps to zero
- Mobile: The home page clears its loading flags on both success and failure and guards its post-`await` `setState` calls with a `mounted` check
- Mobile: App startup authentication check now always completes initialization (falling back to the login screen if token/storage reads fail) so the startup progress indicator cannot hang
- Mobile: Removed the redundant `AppointmentsPage.didUpdateWidget` refetch that could trigger duplicate appointments API calls on parent rebuilds

**Bug Fixes:**
- Fixed the crash `Each child must be laid out exactly once.`: on Android the first frame is laid out against a 0x0 viewport, which produced an invalid negative constraint, failed the body build, replaced it with an `ErrorWidget`, and left the Scaffold's multi-child layout inconsistent
- Fixed the app getting stuck on loading data (until a manual refresh or hot restart) caused by the corrupted first frame

**Removed/Modified Functionality:**
- No authentication, registration, OTP, appointment booking, doctor search, or queue logic was changed; only layout guards and async state handling were adjusted

**Architecture:**
- Mobile: Modified `/mobile/lib/features/home/presentation/home_page.dart`, `/mobile/lib/features/auth/presentation/login_page.dart`, `/mobile/lib/features/auth/presentation/signup_page.dart`, `/mobile/lib/features/auth/presentation/otp_verification_page.dart`, `/mobile/lib/features/appointments/presentation/appointments_page.dart`, `/mobile/lib/app/app.dart`

**Testing:**
- Mobile: New `initial_frame_layout_test.dart` drives the zero-sized -> real viewport transition for the login, sign-up, and home pages and asserts the invalid-constraint and multi-child-layout errors no longer occur
- Mobile: Full suite passes (107 passed); the 2 pre-existing failures (`password_change_enforcement_test.dart` mock signature, `widget_test.dart` counter smoke test) are unchanged and unrelated

**Documentation:**
- Updated `docs/SYSTEM_STATE.md` (Mobile Application) to document the first-frame layout guards, loading-state handling, and startup initialization resilience
- Updated CURRENT_VERSION.md to 01.09
- Added VERSION_HISTORY.md entry for 01.09

---

### 01.08 (October 17, 2026)

**Purpose:** Fix the patient OTP `/verify` endpoint so a taken username returns a clear conflict error instead of a misleading verification failure

**Significant Features:**
- The patient OTP `/verify` endpoint now checks username uniqueness inside the account-creation transaction, mirroring the existing email uniqueness check
- A taken username returns `409 Conflict` with the message `Username already taken`

**Improvements:**
- Backend: A `users.username` unique violation (PostgreSQL `23505`) raised by a concurrent sign-up is mapped to the same clear `Username already taken` conflict message instead of a raw database error
- Backend: No account is created when the email or username is already in use; the transaction is rolled back

**Removed/Modified Functionality:**
- None. OTP sending/verification, the email uniqueness check, resend, staged sign-up handling, and account-creation behavior are unchanged

**Architecture:**
- Backend: Modified `/backend/src/api/patientOtp.ts` (added an in-transaction username uniqueness check and clearer conflict mapping)

**Testing:**
- Backend: New `patientOtp.test.ts` covers the username conflict, the email conflict, the unique-violation race, invalid-OTP handling, and the happy path

**Documentation:**
- Updated `docs/prd.md` (FR-001-A), `docs/architecture.md`, `docs/architecture-essentials.md`, and `docs/SYSTEM_STATE.md` to document in-transaction email/username uniqueness enforcement
- Updated CURRENT_VERSION.md to 01.08
- Added VERSION_HISTORY.md entry for 01.08

---

### 01.07 (October 17, 2026)

**Purpose:** Redesign the mobile OTP verification page to match the redesigned login and sign-up pages

**Significant Features:**
- Mobile OTP verification page rebuilt to share the login/sign-up visual identity (soft gradient background, gradient brand mark with PH badge, elevated white card, prominent CTA)

**Improvements:**
- Mobile UI: OTP page now shows the destination email in a tinted chip and the six code boxes are responsive, evenly spaced, and size themselves to fit any screen width
- Mobile UI: OTP boxes have distinct empty, filled, focused (primary border with a soft shadow), and error (red border/fill) states with smooth animated transitions
- Mobile UI: Added a "Paste" affordance that reuses the existing clipboard-paste logic
- Mobile UI: Verify button matches the shared CTA treatment (colored shadow, loading spinner); the resend action is a rounded outlined button and the countdown is a muted pill with a clock icon
- Mobile UI: Inline animated error banner added (consistent with login/sign-up) alongside the existing error snackbar
- Mobile UI: Back button rendered as the shared circular affordance and only shown when the page is pushed; keyboard-aware scrolling added

**UI/UX Changes:**
- Mobile OTP verification page visually aligned with the redesigned login and sign-up pages; responsive across 320x568 up to 768x1024 with keyboard-aware scrolling and no overflow

**Removed/Modified Functionality:**
- No OTP verification logic, API integration, validation, resend functionality, countdown behavior, error handling, or navigation was changed

**Architecture:**
- Mobile: Modified `/mobile/lib/features/auth/presentation/otp_verification_page.dart` (UI only)

**Testing:**
- Mobile: New `otp_verification_page_test.dart` verifies structure, empty-code validation, error clearing on input, countdown-to-resend transition, and no overflow across five screen sizes
- Pre-existing unrelated test failures (`password_change_enforcement_test.dart` mock override compile error, `widget_test.dart` counter smoke test) remain unchanged

**Documentation:**
- Updated CURRENT_VERSION.md to 01.07
- Added VERSION_HISTORY.md entry for 01.07

---

### 01.06 (October 17, 2026)

**Purpose:** Redesign the mobile patient sign-up page to match the login UI and collect complete patient information during registration

**Significant Features:**
- Mobile patient sign-up page redesigned to share the login page's visual identity (soft gradient background, gradient brand mark with PH badge, elevated white card, sectioned form, prominent CTA)
- Patient sign-up now collects full patient information: separate first name, middle name (optional), last name, date of birth, sex, mobile number, and address (in addition to email, username, password, and confirm password)
- Backend patient OTP registration flow extended to stage and persist the complete patient profile

**Improvements:**
- Mobile UI: Sign-up form grouped into "Personal Information" and "Account Credentials" sections with subtle section headers
- Mobile UI: Separate First Name (required), Middle Name (Optional), and Last Name (required) fields replace the single Full Name field
- Mobile UI: Date of Birth uses a date picker (read-only field) and Sex uses a dropdown with user-friendly labels (Male, Female, Other, Prefer not to say) mapped to backend values
- Mobile UI: Inline animated error banner added alongside the existing error snackbar; loading disables fields and prevents duplicate submissions
- Mobile core: `CustomTextField` gained optional `readOnly` and `onTap` parameters (backward compatible) to support the date picker field
- Mobile core: `PrimaryButton` label is now overflow-safe (single line with ellipsis) for narrow screens and enlarged system text
- Backend: Patient OTP sign-up payload now accepts `firstName`, `middleName`, `lastName`, `dateOfBirth`, `sex`, `phone` and `address` (validated against the same rules as `patients.ts`); legacy `fullName` is still accepted and split for backward compatibility
- Backend: `POST /auth/patient/otp/verify` now writes all captured patient details to the `patients` table in the same transaction that creates the account

**UI/UX Changes:**
- Mobile patient sign-up page visually aligned with the redesigned login page; responsive across 320x568 up to 768x1024 with keyboard-aware scrolling and no overflow
- Mobile UI: Sex dropdown refined to match the design system — field now mirrors `CustomTextField` (rounded outline, filled surface, error/focus borders, focus shadow, animated chevron) and the expanded options menu uses a rounded elevated surface with comfortable item height, a highlighted selected row with a check mark, and tinted pressed/focus feedback

**Removed/Modified Functionality:**
- The mobile sign-up form no longer collects a single "Full Name" field (replaced by separate name components)
- No authentication, OTP sequence, navigation, or session-handling behavior was removed or changed

**Database Changes:**
- Migration `026_add_pending_patient_signup_details.sql` adds `middle_name`, `date_of_birth`, `sex` (NOT NULL default 'NOT_SPECIFIED' with CHECK constraint), `phone` and `address` to `pending_patient_signups` (idempotent)

**Architecture:**
- Mobile: Modified `/mobile/lib/features/auth/presentation/signup_page.dart`
- Mobile: Modified `/mobile/lib/core/services/api_service.dart` (`sendPatientOtp` signature), `/mobile/lib/core/widgets/custom_text_field.dart`, `/mobile/lib/core/widgets/primary_button.dart`
- Backend: Modified `/backend/src/api/patientOtp.ts`; added `/backend/database/026_add_pending_patient_signup_details.sql` and `/backend/src/database/applyPendingPatientSignupDetails.ts`
- Backend: Added npm script `migrate:pending-patient-signup-details`

**Testing:**
- Mobile: New `signup_page_test.dart` verifies separate name fields, required patient fields, excluded fields, validation messages, password mismatch, and no overflow across five screen sizes
- Mobile: Existing login navigation and API login tests remain green (25/25 total in the run including the new sign-up tests)
- Backend: `tsc --noEmit` passes; migration applied to the database
- Pre-existing unrelated test failure (`password_change_enforcement_test.dart` mock override compile error) remains unchanged

**Documentation:**
- Updated CURRENT_VERSION.md to 01.06
- Added VERSION_HISTORY.md entry for 01.06
- Updated prd.md (FR-001-A), architecture.md (§6.1), architecture-essentials.md (Patient Registration with OTP), and SYSTEM_STATE.md (Patient Registration, Database Schema, Mobile Application)

---

### 01.05 (October 17, 2026)

**Purpose:** Modernize the mobile patient login page UI for a polished, production-ready experience

**Significant Features:**
- Redesigned mobile login page with a modern, card-based layout and improved visual hierarchy

**Improvements:**
- Mobile UI: Login page now uses a soft decorative gradient background with subtle accent blobs and a centered, width-constrained responsive layout
- Mobile UI: Compact gradient brand mark with PH badge and a cleaner "Welcome Back" header
- Mobile UI: Login form presented in an elevated white card with rounded corners (24px) and subtle shadow
- Mobile UI: Login button is more prominent with a colored shadow and distinct loading (spinner), success (teal "Signed In" state), and error feedback
- Mobile UI: Added an animated inline error banner in addition to the existing error snackbar
- Mobile UI: Back button on the login page is only shown when the page is pushed onto the navigation stack (not when it is the root route)
- Mobile UI: Added a security trust footer and refined the sign-up row
- Mobile core: `CustomTextField` enhanced with focus-aware border/icon accent styling, a subtle focus shadow, and optional `borderRadius`, `textInputAction`, and `autofillHints` parameters (backward compatible)

**UI/UX Changes:**
- Mobile patient login page visually redesigned; email/password fields, password show/hide toggle, input borders, icons, and spacing modernized
- Responsive layout verified across 320x568 up to 768x1024 with keyboard-aware scrolling and no overflow

**Removed/Modified Functionality:**
- None. Authentication logic, API integration, validation rules, navigation, and session handling are unchanged

**Architecture:**
- Mobile: Modified `/mobile/lib/features/auth/presentation/login_page.dart` - UI/layout redesign only
- Mobile: Modified `/mobile/lib/core/widgets/custom_text_field.dart` - additive, backward-compatible styling and input options

**Testing:**
- Mobile widget tests: Existing login navigation and API login tests all pass (14/14)
- Verified no layout overflow across multiple mobile and tablet screen sizes
- Pre-existing unrelated test failures (password-change mock override and default counter smoke test) remain unchanged

**Documentation:**
- Updated CURRENT_VERSION.md to 01.05
- Added VERSION_HISTORY.md entry for 01.05
- Updated SYSTEM_STATE.md Mobile Application section with the login page UI redesign

---

### 01.04

**Purpose:** Walk-in Patient Password Change and Onboarding Flow

**Significant Features:**
- Walk-in first login password change: Removed "current password" field requirement for walk-in patients during first login
- Walk-in onboarding flow: Walk-in patients now see onboarding screens after successful password change, aligning with regular app registration experience
- Enhanced password change UX: Different password change flows for walk-in first login vs. regular password changes

**Improvements:**
- Backend API: Modified `/api/v1/auth/change-password` endpoint to make `currentPassword` optional when `must_change_password` is true
- Backend service: Updated `changePassword` function to skip current password verification for walk-in first login (when `mustChangePassword` parameter is true)
- Mobile UI: Change password page now hides "Current Password" field when `must_change_password` flag is true
- Mobile navigation: Walk-in patients are automatically navigated to onboarding screens after successful password change
- Mobile API service: Updated to handle optional `currentPassword` parameter, omitting it from request body when null

**UI/UX Changes:**
- Walk-in first login: Only "New Password" and "Confirm New Password" fields shown
- Regular password change: All three fields shown (Current, New, Confirm)
- Walk-in onboarding: Three onboarding screens shown after password change (Find the right doctor, Manage your health, Book appointments easily)
- Page description updated: Shows different text based on whether it's a required change or regular change

**Testing:**
- Backend tests: Added 2 new tests for walk-in password change flow (with and without current password verification)
- Mobile widget tests: Added 2 new tests for walk-in first login behavior (field hiding and onboarding navigation)
- Mobile API tests: Added 2 new tests for optional currentPassword parameter handling
- All existing tests updated to support the new password change flow
- All tests passing (backend: 19 tests, mobile: 25 tests)

**Architecture:**
- Backend: Modified `/backend/src/api/auth.ts` - Updated change-password endpoint validation logic
- Backend: Modified `/backend/src/modules/auth/authService.ts` - Enhanced changePassword with mustChangePassword parameter
- Mobile: Modified `/mobile/lib/features/auth/presentation/change_password_page.dart` - Added conditional field rendering and onboarding navigation
- Mobile: Modified `/mobile/lib/core/services/api_service.dart` - Updated changePassword to accept optional currentPassword
- Mobile: Updated test files to cover new walk-in password change flow

**Documentation:**
- Updated CURRENT_VERSION.md to 01.04
- Added VERSION_HISTORY.md entry for 01.04
- Updated AGENTS.md to automate version updates (removed user approval requirement)

---

### 01.03

**Purpose:** Secretary Schedule Management

**Significant Features:**
- Secretary Schedule page: Implemented complete schedule management interface for secretaries at `/secretary/schedule`
- Four-tab interface: Working Hours (read-only), Exceptions (add/edit/delete), Break Periods (add/edit/delete), Capacity
- Navigation updates: Doctor sidebar "My Profile" renamed to "Profile"; Secretary sidebar "Capacity" replaced with "Schedule"
- Backward compatibility: Redirect from `/secretary/capacity` to `/secretary/schedule` for existing bookmarks

**Backend API Endpoints:**
- GET `/api/v1/secretaries/managed-doctors/schedules` - Read-only access to assigned doctor's weekly working hours
- GET `/api/v1/secretaries/managed-doctors/unavailability` - List date-specific exceptions
- POST `/api/v1/secretaries/managed-doctors/unavailability` - Create exception
- PUT `/api/v1/secretaries/managed-doctors/unavailability/:id` - Update exception
- DELETE `/api/v1/secretaries/managed-doctors/unavailability/:id` - Delete exception
- GET `/api/v1/secretaries/managed-doctors/break-periods` - List break periods
- POST `/api/v1/secretaries/managed-doctors/break-periods` - Create break period
- PUT `/api/v1/secretaries/managed-doctors/break-periods/:id` - Update break period
- DELETE `/api/v1/secretaries/managed-doctors/break-periods/:id` - Delete break period

**Security & Authorization:**
- Ownership enforcement: All secretary schedule endpoints derive doctor_id from authenticated secretary's `secretaries.doctor_id`
- Non-disclosing 404: Requests for records outside assigned doctor's scope return 404 without revealing existence
- Role-based access: Endpoints restricted to SECRETARY role only; other roles receive 403 Forbidden
- Read-only working hours: Secretaries can view but not modify weekly working hours (doctor-only feature)

**Validation:**
- Exception validation: Start date must be <= end date, valid date format required
- Break period validation: Start time must be < end time, valid HH:MM time format required
- Transaction support: Exception and break period modifications use database transactions for data integrity

**Testing:**
- Comprehensive test suite: Added `backend/src/api/secretaries.test.ts` with 23 tests covering:
  - Schedule read access restricted to assigned doctor
  - Exception CRUD operations with ownership enforcement
  - Break period CRUD operations with ownership enforcement
  - Role-based authorization (SECRETARY-only)
  - Validation rules enforcement
  - 404 responses for out-of-scope records
- All new tests passing
- Backend test suite: 234 tests passing (3 pre-existing timezone test failures unrelated to this work)

**Architecture:**
- Web: Created Secretary Schedule page at `/web/src/app/secretary/schedule/page.tsx`
- Web: Created redirect page at `/web/src/app/secretary/capacity/page.tsx`
- Web: Updated Doctor sidebar in `/web/src/components/layout/DoctorSidebar.tsx`
- Web: Updated Secretary sidebar in `/web/src/components/layout/SecretarySidebar.tsx`
- Backend: Enhanced `/backend/src/api/secretaries.ts` with schedule management endpoints
- Backend: Added getClient import for transaction support
- Documentation: Updated `docs/SYSTEM_STATE.md` to reflect implemented changes

**Documentation:**
- Updated CURRENT_VERSION.md to 01.03
- Added VERSION_HISTORY.md entry for 01.03
- Updated SYSTEM_STATE.md to remove planned changes and document implemented Secretary Schedule functionality

---

### 01.02

**Purpose:** Secretary queue management web dashboard (Completed)

**Significant Features:**
- Secretary queue management page: Implemented complete daily queue management interface for secretaries at `/secretary/queue`
- Date filtering: Added date picker to view queue for specific dates
- Doctor assignment enforcement: Queue automatically filtered to show only patients for the secretary's assigned doctor
- Unified queue display: Shows both online and walk-in patients in a single unified queue with queue numbers
- Queue status management: Implemented status-based actions (Call Next, Start Checkup, Complete, Skip, Not Present)
- Registration source display: Shows whether each patient registered online or as a walk-in

**Improvements:**
- Queue status color coding: Visual indicators for different queue statuses (Waiting, Called, In Checkup, Completed, Not Present, Skipped, Cancelled, No Show)
- Action button state management: Buttons dynamically appear based on current queue status
- Loading and empty states: Proper loading indicators and empty state messages
- Toast notifications: Success and error feedback for all queue actions
- Responsive date picker: Custom date picker component for selecting queue dates

**Architecture:**
- Web: Added complete queue management page at `/web/src/app/secretary/queue/page.tsx`
- Web: Connected to existing backend queue API endpoints (`/api/v1/queue`)
- Web: Integrated with existing apiClient for authenticated API calls
- Web: Reused existing Toast component for notifications
- Web: Followed established web component patterns from doctor schedule page

**Documentation:**
- Updated CURRENT_VERSION.md to 01.02
- Added VERSION_HISTORY.md entry for 01.02

---

### 01.01

**Purpose:** Queue management improvements and navigation fixes (Completed)

**Significant Features:**
- Queue reassignment on appointment cancellation: When a patient cancels their appointment, all patients with higher queue numbers are automatically shifted down (e.g., if #6 cancels, #7 becomes #6, #8 becomes #7)
- Queue change notifications: Affected users receive notifications when their queue numbers are updated, including their old and new queue numbers
- Cancelled user rebooking behavior: When a cancelled user rebooks on the same day, they receive the last queue number (next available) instead of retaining their original queue number

**Improvements:**
- Concurrency-safe queue assignment: Implemented PostgreSQL advisory locks for both online appointments and walk-ins to prevent duplicate queue numbers under concurrent requests
- Atomic capacity checks: Added FOR UPDATE locks on daily_capacities table to ensure capacity checks and increments are atomic
- Navigation fix: Fixed "View in Appointments" button to navigate to the existing appointments tab within the home page instead of opening a separate page without navigation
- Duplicate booking prevention: System already prevents users from booking multiple appointments with the same doctor on the same date (excluding CANCELLED and NO_SHOW statuses)

**Bug Fixes:**
- Fixed navigation issue where clicking "View in Appointments" from booking confirmation opened a page without the bottom navigation bar
- Removed duplicate /appointments route that was conflicting with the existing tab-based navigation

**Architecture:**
- Backend: Enhanced appointment cancellation endpoint with advisory lock-based queue reassignment
- Backend: Enhanced appointment booking endpoint with advisory lock-based queue assignment
- Backend: Enhanced walk-in registration endpoint with advisory lock-based queue assignment
- Mobile: Updated home page to accept initialTab parameter for direct tab navigation
- Mobile: Updated booking confirmation page to navigate to home page with appointments tab selected

**Documentation:**
- Created separate VERSION_HISTORY.md file for easier access to version history
- Updated VERSION.md to reference VERSION_HISTORY.md for history details

---

### 01.00 (Initial Release)

**Purpose:** Initial recorded system version

**Significant Features:**
- Established system-wide version tracking for the web application, mobile application, and backend API
- Implemented core patient, doctor, secretary, and admin user roles
- Established authentication system with email/username login
- Implemented OTP-based verification for patient registration
- Established doctor profile completion and approval workflow
- Implemented appointment reservation system with queue management
- Implemented doctor availability and capacity management
- Established role-based access control across all applications

**Architecture:**
- Modular monolith backend with REST API
- Flutter mobile application for patients
- Next.js web application for doctors, secretaries, and admins
- PostgreSQL as the single source of truth
- Supabase Auth for OTP delivery and verification only
- Supabase Storage for doctor professional photos

**Documentation:**
- Established versioning rules and workflow
- Created comprehensive architecture documentation
- Established system state tracking in SYSTEM_STATE.md
- Created AGENTS.md for AI agent guidelines
