# FindMyDoctor System State

This document tracks the current state of the FindMyDoctor system, including authentication flows, workflows, database structures, API endpoints, and application behavior.

---

## Current Version

**Version:** 01.02

**Last Updated:** 2026-10-16

---

## Authentication System

### User Roles

The system supports the following user roles:
- **PATIENT** - Mobile app users who book appointments
- **DOCTOR** - Medical professionals who manage schedules and consultations
- **SECRETARY** - Clinic staff who manage daily operations
- **ADMIN** - Platform administrators who manage users and approvals
- **SUPERADMIN** - Platform-level administrators with elevated permissions

### Authentication Flows

#### Patient Registration with OTP
1. Patient submits registration form (full name, email, username, password)
2. Backend validates the payload and stages registration in `pending_patient_signups` table
3. Supabase sends 6-digit OTP to patient's email
4. Patient enters OTP for verification
5. On successful verification, backend creates `users` and `patients` records in PostgreSQL
6. Password is hashed with bcrypt before storage
7. Account is activated with `email_verified = true`
8. Access token is returned to the mobile app

**API Endpoints:**
- `POST /api/v1/auth/patient/otp/send` - Send OTP to patient email
- `POST /api/v1/auth/patient/otp/verify` - Verify OTP and create patient account
- `POST /api/v1/auth/patient/otp/resend` - Resend OTP for existing staged signup

#### Doctor Self-Registration with OTP
1. Doctor submits basic registration form (first name, middle name, last name, email, contact number, password, confirm password)
2. Backend validates the payload and stages registration in `pending_doctor_signups` table
3. Supabase sends 6-digit OTP to doctor's email
4. Doctor enters OTP for verification
5. On successful verification, backend creates `users` record (role = DOCTOR, email_verified = true) and `doctors` profile
6. Password is hashed with bcrypt
7. Doctor account created with `approval_status = 'PENDING'` and `profile_completion_status = 'INCOMPLETE'`
8. Access token is returned and doctor is redirected to profile completion

**API Endpoints:**
- `POST /api/v1/auth/otp/send` - Send OTP for doctor registration
- `POST /api/v1/auth/otp/verify` - Verify OTP and create doctor account

#### Web Application Authentication

**Doctor Login:**
- Route: `/doctor-login`
- Doctor-only UI (no role selector)
- Sends expected role `DOCTOR` to backend
- Backend verifies role before OTP challenge
- Success → `/doctor/dashboard`
- Non-Doctor login attempts are denied

**Secretary Login:**
- Route: `/secretary-login`
- Secretary-only UI (no role selector)
- Sends expected role `SECRETARY` to backend
- Backend verifies role before OTP challenge
- Success → `/secretary/dashboard`
- Non-Secretary login attempts are denied

**Admin Login:**
- Route: `/admin/login`
- Admin-only UI (no Doctor/Secretary selector)
- Sends expected role `ADMIN` to backend
- Backend accepts ADMIN and SUPERADMIN roles
- Doctor and Secretary accounts are rejected before OTP
- Success → `/admin/dashboard`
- Non-Admin login attempts are denied

**Root Route (`/`):**
- Unauthenticated users → `/doctor-login` (default login)
- Authenticated users → Redirect to role-specific dashboard

---

## Doctor Approval Workflow

### Registration Flow
1. Doctor completes basic registration with email OTP verification
2. Account created with `approval_status = 'PENDING'` and `profile_completion_status = 'INCOMPLETE'`
3. Doctor cannot log in or access dashboard while PENDING
4. Doctor is redirected to `/doctor-profile` to complete professional profile

### Profile Completion
1. Doctor fills professional profile fields (specialty, credentials, PRC license number, hospital/clinic, etc.)
2. Profile updated via `PUT /api/v1/doctors/me/profile`
3. Status changes to `profile_completion_status = 'COMPLETE'` when all required fields present
4. Doctor submits profile via `POST /api/v1/doctors/me/profile/submit`
5. Status changes to `profile_completion_status = 'SUBMITTED'`
6. `approval_status` remains `PENDING`
7. Doctor waits for admin approval

### Admin Approval
1. Administrators view pending doctors at `/admin/doctors`
2. Admin reviews complete doctor information
3. Admin can:
   - **Approve:** Sets `approval_status = 'ACTIVE'` and `is_approved = true`
   - **Reject:** Sets `approval_status = 'REJECTED'` and adds `rejection_reason`
4. Only users with `role = ADMIN` can approve or reject
5. Public doctor search only returns doctors with `approval_status = 'ACTIVE'`

### Rejection and Resubmission
1. Rejected doctors may authenticate to correct and resubmit
2. Rejected doctor routed to `/doctor-profile` to view rejection reason
3. Doctor can edit professional profile fields and schedule
4. Doctor resubmits via `POST /api/v1/doctors/me/profile/submit`
5. On resubmission:
   - `approval_status` restored to `PENDING`
   - `is_approved` remains false
   - `profile_completion_status` set to `SUBMITTED`
   - `profile_submitted_at` updated
   - `rejection_reason` cleared
6. Admin cannot directly approve REJECTED doctors; doctor must resubmit first

---

## Two-Factor Authentication (2FA)

### Doctor 2FA
- Doctors can enable/disable 2FA via settings
- Stored in `doctors.two_factor_enabled` field
- Toggle endpoint: `PUT /api/v1/doctors/me/two-factor`

### Secretary 2FA
- Secretaries can enable/disable 2FA via settings
- Stored in `secretaries.two_factor_enabled` field
- Toggle endpoint: `PUT /api/v1/secretaries/me/two-factor`

---

## Secretary-Doctor Assignment

### Database Constraint
- `secretaries.doctor_id` is a foreign key referencing `doctors.id`
- `secretaries.doctor_id` is enforced as NOT NULL (migration 015)
- Every secretary must be assigned to exactly one doctor

### Secretary Account Creation
- Doctors can create secretary accounts via `POST /api/v1/doctors/secretaries`
- Secretary accounts automatically linked to the creating doctor via `doctor_id`
- Secretary accounts created with `must_change_password = true`
- Forced password change on first login

### Secretary Operations
- Secretaries can only access data for their assigned doctor
- Queue management filtered by `secretary.doctor_id`
- Capacity management restricted to assigned doctor
- Walk-in registration requires doctor selection (enforced to be assigned doctor)

---

## Queue Management

### Unified Queue Rule
- Online and walk-in patients use one unified daily queue
- Queue priority determined by successful registration time
- Registration source does not affect priority
- Queue numbers are sequential and concurrency-safe

### Queue Status Transitions
- **WAITING** → **CALLED** (Secretary calls patient)
- **CALLED** → **IN_CHECKUP** (Secretary starts checkup)
- **IN_CHECKUP** → **COMPLETED** (Secretary completes checkup)
- **WAITING/CALLED** → **NOT_PRESENT** (Patient not present)
- **WAITING/CALLED** → **SKIPPED** (Secretary skips patient)
- **SKIPPED** → **IN_CHECKUP** (Secretary can start checkup for skipped patient)
- Any status → **CANCELLED** (Patient cancels)
- Any status → **NO_SHOW** (Patient no-show)

### Queue Management Actions
- **Call Next Patient:** `POST /api/v1/queue/:date/next`
- **Start Checkup:** `POST /api/v1/queue/:id/start-checkup`
- **Complete Checkup:** `POST /api/v1/queue/:id/complete`
- **Skip Patient:** `POST /api/v1/queue/:id/skip`
- **Mark Not Present:** `POST /api/v1/queue/:id/not-present`
- **Update Status:** `PATCH /api/v1/queue/:id/status`

### Queue Reassignment on Cancellation
- When a patient cancels, all patients with higher queue numbers are shifted down
- Example: If #6 cancels, #7 becomes #6, #8 becomes #7
- Implemented with PostgreSQL advisory locks for concurrency safety
- Affected users receive notifications with old and new queue numbers

### Cancelled User Rebooking
- When a cancelled user rebooks on the same day, they receive the last queue number
- They do not retain their original queue number
- Next available queue number is assigned

---

## Capacity Management

### Capacity Calculation
Final capacity = MIN(Calculated Capacity, Configured Capacity)

**Calculated Capacity:**
- Based on doctor availability, operating hours, break periods, consultation duration
- Formula: Available Consultation Time ÷ Consultation Duration

**Configured Capacity:**
- Optional lower maximum set by doctor or secretary
- Overrides calculated capacity when lower

### Capacity Consumption
- Both online registrations and walk-in registrations consume one unit of daily capacity
- When registered patients >= final capacity, date becomes FULL
- System rejects new regular online bookings and walk-in registrations for full dates

### Concurrency Safety
- Capacity checks and increments use FOR UPDATE locks on `daily_capacities` table
- Queue assignment uses PostgreSQL advisory locks
- Prevents capacity overflow and duplicate queue numbers under concurrent requests

---

## Walk-in Registration

### Workflow
1. Secretary searches for patient
2. If found: Use existing account
3. If not found: Create account
   - Collect email (becomes username/login identifier)
   - Generate random temporary password (letters and numbers)
   - Mark account as `must_change_password = true`
   - Provide credentials through designated process
4. Select appropriate doctor (must be assigned doctor)
5. Select appropriate date/schedule
6. Check remaining capacity
7. Register patient
8. Assign queue number
9. Add to unified queue

### Walk-in Account Rules
- Temporary passwords are random, contain letters and numbers
- Passwords are securely hashed with bcrypt
- Password change required on first login
- Account blocked from normal access until password changed
- Walk-in patients use same account for future bookings and history

---

## Database Schema

### Core Tables
- **users** - User accounts with authentication data
- **patients** - Patient profiles
- **doctors** - Doctor profiles with approval status
- **secretaries** - Secretary profiles with doctor assignment
- **doctor_schedules** - Doctor working hours
- **doctor_unavailability** - Doctor exceptions/unavailability
- **doctor_break_periods** - Doctor break periods
- **daily_capacities** - Daily capacity settings
- **appointments** - Patient appointments
- **queue_entries** - Daily queue entries
- **visits** - Consultation records
- **prescriptions** - Digital prescriptions
- **prescription_items** - Prescription medication items
- **payments** - Payment records
- **payment_charges** - Additional charges
- **conversations** - Patient-secretary conversations
- **messages** - Conversation messages
- **ai_conversations** - AI chatbot conversations
- **ai_messages** - AI chatbot messages
- **waitlists** - Waitlist entries
- **notifications** - System notifications
- **pending_doctor_signups** - Staged doctor registrations (OTP flow)
- **pending_patient_signups** - Staged patient registrations (OTP flow)
- **login_otp_challenges** - Server-side OTP challenge state

### Key Migrations
- `001_initial_schema.sql` - Core database schema
- `005_doctor_self_registration.sql` - Doctor self-registration fields
- `006_doctor_signup_otp_flow.sql` - Doctor OTP staging table
- `007_doctor_approval_states.sql` - Doctor approval workflow
- `008_patient_signup_otp_flow.sql` - Patient OTP staging table
- `013_add_two_factor_settings.sql` - 2FA columns for doctors and secretaries
- `014_add_login_otp_challenges.sql` - Login OTP challenge state table
- `015_enforce_secretary_doctor_relationship.sql` - Secretary-doctor foreign key constraint
- `016_allow_multiple_schedules_per_day.sql` - Multiple schedules per day support
- `017_modify_pending_doctor_signup_for_basic_flow.sql` - Basic registration flow

---

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/otp/send` - Send OTP for doctor registration
- `POST /api/v1/auth/otp/verify` - Verify OTP and create doctor account
- `POST /api/v1/auth/patient/otp/send` - Send OTP for patient registration
- `POST /api/v1/auth/patient/otp/verify` - Verify OTP and create patient account
- `POST /api/v1/auth/patient/otp/resend` - Resend OTP for patient registration

### Doctors
- `GET /api/v1/doctors` - Public doctor search
- `GET /api/v1/doctors/me` - Get current doctor profile
- `PUT /api/v1/doctors/me/profile` - Update doctor profile
- `POST /api/v1/doctors/me/profile/submit` - Submit profile for approval
- `POST /api/v1/doctors/me/photo` - Upload professional photo
- `DELETE /api/v1/doctors/me/photo` - Delete professional photo
- `GET /api/v1/doctors/me/schedules` - Get doctor schedules
- `POST /api/v1/doctors/me/schedules` - Create schedule
- `PUT /api/v1/doctors/me/schedules/:id` - Update schedule
- `DELETE /api/v1/doctors/me/schedules/:id` - Delete schedule
- `GET /api/v1/doctors/me/unavailability` - Get unavailability periods
- `POST /api/v1/doctors/me/unavailability` - Create unavailability
- `PUT /api/v1/doctors/me/unavailability/:id` - Update unavailability
- `DELETE /api/v1/doctors/me/unavailability/:id` - Delete unavailability
- `GET /api/v1/doctors/me/break-periods` - Get break periods
- `POST /api/v1/doctors/me/break-periods` - Create break period
- `PUT /api/v1/doctors/me/break-periods/:id` - Update break period
- `DELETE /api/v1/doctors/me/break-periods/:id` - Delete break period
- `GET /api/v1/doctors/me/capacity` - Get capacity for date
- `POST /api/v1/doctors/me/capacity/:date` - Set capacity for date
- `GET /api/v1/doctors/secretaries` - List assigned secretaries
- `POST /api/v1/doctors/secretaries` - Create secretary account
- `PUT /api/v1/doctors/me/two-factor` - Toggle 2FA

### Secretaries
- `GET /api/v1/secretaries/me` - Get current secretary profile
- `PUT /api/v1/secretaries/me` - Update secretary profile
- `PUT /api/v1/secretaries/me/two-factor` - Toggle 2FA
- `GET /api/v1/secretaries/managed-doctors/capacity` - Get managed doctor's capacity
- `PUT /api/v1/secretaries/managed-doctors/capacity` - Update managed doctor's capacity
- `POST /api/v1/secretaries/managed-doctors/capacity/:date` - Set capacity for date

### Queue
- `GET /api/v1/queue/:date` - Get queue for date (filtered by doctor)
- `GET /api/v1/queue/:date/patient/:patientId` - Get patient's queue position
- `POST /api/v1/queue/:date/next` - Call next patient
- `PATCH /api/v1/queue/:id/status` - Update queue status
- `POST /api/v1/queue/:id/start-checkup` - Start checkup
- `POST /api/v1/queue/:id/complete` - Complete checkup
- `POST /api/v1/queue/:id/skip` - Skip patient
- `POST /api/v1/queue/:id/not-present` - Mark as not present

### Admin
- `GET /api/v1/admin/users` - List users
- `POST /api/v1/admin/users` - Create user
- `PATCH /api/v1/admin/users/:id/approve` - Approve user
- `PATCH /api/v1/admin/users/:id/reject` - Reject user
- `GET /api/v1/admin/doctors` - List doctors
- `PATCH /api/v1/admin/doctors/:id/approve` - Approve doctor
- `PATCH /api/v1/admin/doctors/:id/reject` - Reject doctor
- `GET /api/v1/admin/secretaries` - List secretaries

---

## Application Behavior

### Mobile Application (Flutter)
- Patient-only application
- Search and book doctor appointments
- View queue position
- Manage appointments
- Chat with secretaries
- Use AI chatbot for general medical information
- Upload GCash payment receipts
- View consultation history and prescriptions
- Must use REST API for all data operations (no direct PostgreSQL access)

### Web Application (Next.js)
- Doctor dashboard at `/doctor/*`
- Secretary dashboard at `/secretary/*`
- Admin dashboard at `/admin/*`
- Doctor sign-up at `/doctor-signup`
- Role-based authentication and routing
- Must use REST API for all data operations (no direct PostgreSQL access)

### Backend (Node.js/Express)
- Modular monolith architecture
- REST API at `/api/v1`
- PostgreSQL as single source of truth
- Supabase for OTP email delivery and verification only
- Supabase Storage for doctor professional photos
- Server-side validation and authorization
- Role-based access control

---

## Security Rules

### Communication Boundaries
- Patient ↔ Secretary chat: ALLOWED
- Patient ↔ AI Chatbot: ALLOWED
- Patient ↔ Doctor chat: PROHIBITED

### Credential Security
- AI API keys stored on backend only
- Database credentials stored on backend only
- Never exposed to mobile or web applications
- Passwords hashed with bcrypt
- Temporary passwords for walk-in accounts

### Data Privacy
- Sensitive data: Medical history, allergies, medications, visit notes, prescriptions, payment records, GCash receipts, secretary messages, AI conversations
- Protected endpoints with authentication and authorization
- No direct database access from frontend applications

---

## Current Implementation Status

### Completed Features
- Patient registration with OTP verification
- Doctor self-registration with OTP verification
- Doctor profile completion and approval workflow
- Doctor rejection and resubmission workflow
- Two-factor authentication for doctors and secretaries
- Secretary-doctor assignment enforcement
- Doctor schedule management
- Doctor unavailability/exceptions management
- Doctor break period management
- Daily capacity management (doctors and secretaries)
- Appointment booking with queue assignment
- Queue management (web secretary dashboard)
- Queue reassignment on cancellation
- Queue notifications
- Concurrency-safe queue and capacity operations
- Walk-in registration workflow
- Professional photo upload (Supabase Storage)

### In Progress
- Secretary queue management web dashboard (01.02)

### Pending
- Patient-secretary chat system
- AI chatbot integration
- Payment verification workflow
- Prescription management
- Consultation records
- Notification system
- Waitlist management

---

## Known Issues and Limitations

### MVP Scope
- No direct GCash API integration (static QR only)
- No real-time video consultations
- No emergency medical services
- No full hospital management
- No full production EHR functionality
- No insurance claim processing
- No laboratory management
- No pharmacy management

### Architecture Constraints
- Modular monolith (not microservices)
- PostgreSQL only (no multi-database)
- REST API only (no GraphQL)
- Static GCash QR (no payment API)

---

## Environment Configuration

### Backend (.env)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SUPABASE_STORAGE_BUCKET` - Supabase storage bucket name (default: doctor-photos)
- `AI_API_KEY` - AI provider API key (backend only)
- `PORT` - Backend server port (default: 3000)

### Web (.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3000/api/v1)

---

## Technology Stack

### Backend
- Node.js with TypeScript
- Express.js for REST API
- PostgreSQL with pg
- bcrypt for password hashing
- multer for file uploads
- Supabase for OTP and storage

### Mobile
- Flutter with Dart
- REST API integration
- Local state management

### Web
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- REST API integration
- Toast notifications

---

## Development Workflow

### Branching Strategy
- `main` - Production branch
- `dev` - Development branch
- `feature/*` - Feature branches

### Versioning
- Format: `XX.YY` (e.g., 01.02)
- Major version (XX.00): Significant system revisions, breaking changes
- Minor version (00.XX): New features, bug fixes, improvements
- Current version tracked in `/docs/CURRENT_VERSION.md`
- Version history in `/docs/VERSION_HISTORY.md`

### Documentation
- Architecture: `/docs/architecture.md`
- Architecture Essentials: `/docs/architecture-essentials.md`
- Product Requirements: `/docs/prd.md`
- Agent Guidelines: `/AGENTS.md`
- System State: `/SYSTEM_STATE.md` (this file)
- Versioning: `/docs/VERSION.md`

---

## Next Steps

### Immediate Priorities
1. Complete secretary queue management testing
2. Implement patient-secretary chat system
3. Implement AI chatbot integration
4. Implement payment verification workflow
5. Implement prescription management

### Future Enhancements
1. Real-time queue updates (WebSocket)
2. Advanced scheduling features
3. Integration with hospital systems
4. Mobile push notifications
5. Enhanced reporting and analytics
