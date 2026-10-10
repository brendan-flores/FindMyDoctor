# FindMyDoctor — System State

This document contains the current system state for the FindMyDoctor project. It should be updated whenever changes are made that affect the documented system state, including authentication, registration, OTP verification, doctor approval workflows, database structures, API endpoints, application behavior, or architecture.

Current System State (October 2026):

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
- Web Doctor profile page allows doctors to complete their professional profile with 12 fields: professional photo (PNG upload, max 4MB), specialty, credentials, PRC license, hospital/clinic, years of experience, areas of expertise, biography, consultation fee, consultation type, languages spoken, available schedule
- Web Doctor profile page includes schedule management UI using existing schedule APIs (GET/POST/PUT/DELETE `/api/v1/doctors/me/schedules`)
- Web Doctor profile page includes PNG photo upload with client-side validation (PNG only, max 4MB) and server-side validation via `POST /api/v1/doctors/me/photo` endpoint
- Web Doctor profile page includes photo preview after successful upload and ability to remove photo
- Web Doctor profile page supports saving draft profiles and submitting for approval with validation
- Web Doctor profile page explicitly handles REJECTED state: shows rejection banner with reason, allows profile editing, allows resubmission, does not lock form when `profile_completion_status === 'SUBMITTED'` if `approval_status === 'REJECTED'`
- Web Doctor profile page shows submission confirmation modal after successful profile submission with title "Profile Submitted Successfully!", message stating "Your professional profile has been submitted successfully. Once approved, your doctor profile will be displayed to patients in the FindMyDoctor mobile app.", and "Go to Dashboard" button redirecting to `/doctor/dashboard`
- Web Doctor login page routes authenticated Doctors based on approval_status: ACTIVE → `/doctor/dashboard`, REJECTED → `/doctor-profile`
- Active Doctors can view their own personal and professional registration details on the read-only Doctor Portal page at `/doctor/profile` (with slash); it excludes schedule management and uses the authenticated `GET /api/v1/doctors/me` endpoint
- The authenticated `GET /api/v1/doctors/me` endpoint includes the doctor's account email for display on their own profile page
- The `/doctor/profile` page (with slash) features an Edit Profile button that toggles inline edit mode for updating profile information
- Edit Profile feature allows editing of personal information (first name, middle name, last name, contact number) and most professional information (specialty, credentials, hospital/clinic, years of experience, areas of expertise, biography, consultation fee, languages spoken)
- Edit Profile feature uses the same searchable dropdown selectors as registration: SearchableSelect for single-select fields (specialty, credentials, hospital/clinic) and SearchableMultiSelect for multi-select fields (areas of expertise, languages spoken)
- Email address is read-only (requires separate email-change and verification process)
- PRC License Number is read-only (requires dedicated license-update process with admin review)
- Professional photo can be uploaded/replaced in edit mode with PNG-only validation and 4MB size limit via dedicated upload endpoint
- Schedule management is handled entirely through the /doctor/schedule page; the profile page does not display schedule information
- Edit mode includes Save Changes and Cancel buttons; Cancel discards unsaved changes and restores original values
- Backend API PUT /api/v1/doctors/me/profile validates PRC license number format (7 digits) and uniqueness when provided
- Backend API supports dynamic field updates for both personal and professional information fields

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
- Patient registration requires username (minimum 3 characters, alphanumeric + underscores only)
- User login accepts either email or username for authentication
- Users table includes username field (unique) for patient identification
- Patients table does not include phone field (removed in favor of username)
- Backend API endpoints for patient OTP: `/api/v1/auth/patient/otp/send`, `/api/v1/auth/patient/otp/verify`, `/api/v1/auth/patient/otp/resend`
- Backend doctor OTP API accepts only basic fields (`firstName`, `middleName`, `lastName`, `email`, `contactNumber`, `password`) in the signup payload
- Backend API endpoints for doctor OTP: `/api/v1/auth/otp/send`, `/api/v1/auth/otp/verify`, `/api/v1/auth/otp/resend`

## OTP & Authentication
- SuperAdmins log in directly without OTP; regular Admins always require login OTP (no setting, no bypass)
- Doctor accounts require login OTP only if `two_factor_enabled = true` (optional 2FA, must be turned on)
- Secretary accounts require login OTP only if `two_factor_enabled = true` (optional 2FA, must be turned on)
- Role-based login OTP/2FA is implemented with server-side challenge state in PostgreSQL
- Doctor, Secretary, and Admin web login pages submit their expected role; the backend rejects cross-role login attempts before OTP challenge creation or delivery with `Invalid credentials or account role.` Admin login continues to accept SUPERADMIN accounts
- Admin/SuperAdmin login requires mandatory OTP (no setting, no bypass) - enforced by backend role check
- Doctor login requires OTP only if `two_factor_enabled = true` - enforced by backend role check
- Secretary login requires OTP only if `two_factor_enabled = true` - enforced by backend role check
- Login OTP flow: user submits credentials → backend checks role-specific OTP requirement → if required, creates challenge → sends OTP via Supabase → returns opaque challenge token → user submits OTP → backend verifies with Supabase → consumes challenge → issues application JWT
- Login OTP verification endpoint: `POST /api/v1/auth/verify-login-otp` (accepts challengeId and OTP)
- Login OTP resend endpoint: `POST /api/v1/auth/resend-login-otp` (accepts challengeId, enforces 60-second cooldown, invalidates previous challenges)
- Login OTP challenges expire after 5 minutes, support up to 5 failed attempts, and are marked as used after successful verification
- PostgreSQL `login_otp_challenges` table stores server-side OTP challenge state with hashed challenge tokens and remember_me column
- PostgreSQL `doctors` and `secretaries` tables include `two_factor_enabled` column (migration 013_add_two_factor_settings.sql) - optional 2FA, must be turned on by user
- Secretary settings page at `/secretary/settings` provides optional two-factor authentication toggle
- Doctor settings page at `/doctor/settings` provides optional two-factor authentication toggle
- Supabase is used only for OTP email verification and Storage, not for storing application data
- Login OTP uses `shouldCreateUser: false` to prevent Supabase from creating application accounts
- Web application includes shared `OtpVerification` component for login OTP verification (6-digit input, auto-focus, paste support, resend timer)

## Remember Me & Trusted Browser
- Web application authentication for Doctor and Secretary accounts now uses trusted-browser Remember Me functionality
- Doctor and Secretary login forms include Remember Me checkbox that controls trusted-browser registration only
- **Facebook-style Session Persistence:** Sessions persist across browser closes regardless of Remember Me checkbox
- Access tokens always have 7-day expiration (no 15-minute timeout)
- Refresh tokens always have 30-day expiration (no session cookies)
- Users are only logged out when they manually log out or tokens expire
- When Remember Me is unchecked: browser is NOT registered as trusted; OTP is required on every login (if 2FA is enabled); session still persists across browser closes (tokens are long-lived); if browser was previously trusted, trust is revoked
- When Remember Me is checked: browser is registered as trusted for 30 days; subsequent logins from the same trusted browser skip OTP (if 2FA is enabled) but still require password; trusted-browser credential is stored in HttpOnly cookie with 30-day expiration
- Trusted-browser recognition uses cryptographically secure random tokens stored as SHA-256 hashes in PostgreSQL trusted_browsers table; each trusted-browser record includes user_id, token_hash, device_info, expires_at (30 days), created_at, revoked_at, and last_used_at
- Trusted-browser lifetime is 30 days from successful trust registration; this is an absolute limit that does not reset on page refresh or session renewal
- New browser or device always requires OTP (if 2FA is enabled); expired trusted-browser credential requires OTP (if 2FA is enabled); cleared cookies or trusted-browser data requires OTP (if 2FA is enabled)
- Password change or password reset revokes all existing trusted-browser credentials and requires OTP again on next login
- Account suspended, rejected, or otherwise unauthorized denies access according to existing account-status rules; trusted-browser status never overrides account restrictions
- Unchecking Remember Me during login revokes that browser's trust and clears the trusted-browser cookie
- Logout does NOT revoke trusted-browser status (trust persists across logout/login cycles like Facebook)
- Users must manually uncheck Remember Me during login to revoke trust, or revoke via dedicated endpoint
- Token storage uses HttpOnly cookies with Secure flag enabled in production and SameSite=lax policy for security
- Backend generates access tokens with 7-day expiration regardless of Remember Me (Facebook-style)
- Refresh tokens have 30-day expiration regardless of Remember Me (Facebook-style)
- Session expiration on frontend clears authentication cookies, rejects protected API requests, redirects to appropriate login page with message "Your session has expired. Please log in again."
- Logout invalidates server-side session by clearing accessToken, refreshToken, and trustedBrowser cookies
- Admin and SuperAdmin authentication behavior remains unchanged (no Remember Me modification)
- Web apiClient automatically loads token from localStorage on initialization for backward compatibility, but prefers HttpOnly cookies when available
- Backend API endpoints for authentication: `POST /api/v1/auth/login` (with trusted-browser support), `POST /api/v1/auth/verify-login-otp` (with trusted-browser registration), `POST /api/v1/auth/logout` (clears all cookies), `POST /api/v1/auth/revoke-trusted-browser` (revokes current browser trust)
- Database schema includes `trusted_browsers` table (migration 022_add_trusted_browsers.sql) for Remember Me trusted-browser functionality with columns: id, user_id, token_hash (SHA-256), device_info, expires_at (30 days), created_at, revoked_at, last_used_at

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
- Supabase Storage service role key is required for backend photo operations and must not be exposed to frontend applications

## Database Schema
- Database schema includes approval status fields, pending doctor signups staging table (basic fields only), and pending patient signups staging table (with username)
- Database schema includes `middle_name` field in `doctors` and `pending_doctor_signups` tables (migration 010_add_middle_name.sql)
- Database schema includes extended doctor profile fields (migration 016_doctor_profile_fields.sql): contact_number, professional_photo_url, years_of_experience, areas_of_expertise (comma-separated text), consultation_type, languages_spoken (comma-separated text), profile_completion_status, profile_submitted_at
- Migration `017_modify_pending_doctor_signup_for_basic_flow.sql` adds contact_number field to pending_doctor_signups for basic registration flow (professional fields remain in table for compatibility)
- Database migration `016_allow_multiple_schedules_per_day.sql` removes UNIQUE constraint on (doctor_id, day_of_week) to support multiple shift blocks per day (e.g., morning and afternoon shifts)
- Database migration `017_add_doctor_break_periods.sql` adds `doctor_break_periods` table for break period management and adds `is_active` and `updated_at` columns to `doctor_unavailability` table for soft delete support
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
- Availability service (backend/src/modules/availability/availabilityService.ts) calculates available time slots considering: working hours, schedule exceptions, break periods, 30-minute consultation duration, daily capacity, existing reservations, and current date/time
- Availability service detects overlapping appointment intervals (not just exact time matches) to correctly mark slots as booked
- Availability service limits individual slot availability based on remaining daily capacity (slots marked as FULL when capacity exhausted)
- Availability service returns time slots with status: AVAILABLE, BOOKED, BREAK, PAST, or FULL
- Availability service returns date status: AVAILABLE, FULL, UNAVAILABLE, PAST, or NON_WORKING
- Availability service includes break periods as visible but non-selectable slots in the response (not removed from slot list)
- Mobile doctor schedule page at /doctor-schedule displays calendar with visual status indicators and legend for all date states
- Mobile doctor schedule page displays time slots with status-specific visual treatment: available slots are selectable, break slots shown with red tint and "Break" label, booked/past/full slots are non-selectable
- Mobile doctor schedule page confirmation button enables only after selecting both a valid date and a valid time slot
- Backend appointment creation endpoint POST /api/v1/appointments validates: appointment is not in the past, date is AVAILABLE, specific time slot is available (within working hours, not during break, not booked), daily capacity is not exceeded, and no overlapping appointments exist
- Capacity calculation service uses centralized 30-minute consultation duration to calculate maximum appointment slots based on available working time after excluding breaks and schedule exceptions
- Capacity system provides: Calculated Capacity (maximum slots based on available time), Configured Capacity (lower limit set by doctor/secretary), Final Capacity (actual allowed appointments), Remaining Capacity (final capacity minus existing reservations)
- Capacity calculation accounts for: working hours for the day of week, break periods on the specific date, full-day exceptions (unavailability) for the specific date
- Capacity calculation service at backend/src/modules/capacity/capacityService.ts handles time range merging, break period subtraction, and minute-based slot calculation
- Backend capacity endpoints updated to use real calculation: GET /api/v1/doctors/:id/capacity (supports date or date range query params), PUT /api/v1/doctors/:id/capacity (with ownership validation and capacity limit enforcement), POST /api/v1/doctors/:id/capacity/:date (with real calculation and validation)
- Backend adds authenticated doctor capacity endpoints: GET /api/v1/doctors/me/capacity, PUT /api/v1/doctors/me/capacity, POST /api/v1/doctors/me/capacity/:date (registered before parameterized /:id/capacity routes to prevent route shadowing, and returning updated capacity objects on save)
- Backend adds secretary capacity endpoints: GET /api/v1/secretaries/managed-doctors/capacity, PUT /api/v1/secretaries/managed-doctors/capacity, POST /api/v1/secretaries/managed-doctors/capacity/:date
- Backend enforces ownership validation: doctors can only manage their own capacity, secretaries can only manage capacity for doctors they are assigned to
- Backend validates configured capacity cannot exceed calculated capacity on both frontend and backend
- Web doctor schedule page at /doctor/schedule and web secretary capacity page at /secretary/capacity feature a unified 5-metric responsive grid (Calculated, Configured, Final Limit, Registered, Remaining) with fixed-width input controls
- Web secretary capacity page at /secretary/capacity allows secretaries to manage capacity for their assigned doctor with the exact same UI as the doctor schedule page
- Secretary sidebar includes "Capacity" navigation item linking to /secretary/capacity

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
