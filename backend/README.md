# FindMyDoctor Backend

FindMyDoctor REST API - Healthcare appointment management system serving both Flutter mobile and Next.js web applications.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Architecture**: Modular Monolith
- **Database**: PostgreSQL
- **Authentication**: JWT tokens with optional two-factor authentication
- **External Services**: Supabase (OTP delivery, photo storage), OpenAI (AI chatbot)
- **Timezone**: Asia/Manila (UTC+8)

## Features

- **User Authentication**: JWT-based auth with role-based access control
- **Patient Registration**: Email OTP verification with staged signup flow
- **Doctor Self-Registration**: OTP-verified registration with profile completion and approval workflow
- **Two-Factor Authentication**: Optional 2FA for doctors and secretaries with trusted browser management
- **Remember Me**: Persistent sessions for doctors and secretaries
- **Appointment Management**: Atomic booking with capacity enforcement and duplicate booking prevention
- **Unified Queue System**: Combined queue for online and walk-in patients with sequential numbering
- **Concurrency-Safe Queue Assignment**: PostgreSQL advisory locks prevent duplicate queue numbers under concurrent requests
- **Queue Reassignment**: Automatic queue number updates when appointments are cancelled with patient notifications
- **Queue Change Notifications**: Patients receive notifications when their queue number changes
- **Patient Information Validation**: Doctor-specific information check before booking
- **Week-Only Scheduling**: Patients see only the current week's availability (role-based filtering)
- **Queue Position Display**: Returns configured capacity for "You are patient #X out of Y" display
- **Patient-Secretary Chat**: Secure messaging (no direct patient-doctor chat)
- **AI Chatbot Integration**: Backend-proxied AI assistant for medical information
- **Payment Processing**: GCash receipt upload with manual secretary verification
- **Medical Records**: Visit tracking and digital prescriptions
- **Professional Photo Upload**: PNG-only doctor photos stored in Supabase Storage
- **Admin Dashboard**: User, doctor, secretary, and approval management

## User Roles

- **PATIENT**: Book appointments, manage queue, chat with secretary, use AI chatbot
- **DOCTOR**: Manage schedule/capacity, appointments, patient information, visits, prescriptions
- **SECRETARY**: Walk-ins, queue management, patient chat, payment verification
- **ADMIN**: Users, doctors, secretaries, clinics, approvals

## Project Structure

```
backend/
├── src/
│   ├── api/              # Express routers
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── doctors.ts
│   │   ├── appointments.ts
│   │   ├── walk-ins.ts
│   │   ├── queue.ts
│   │   ├── conversations.ts
│   │   ├── ai-chat.ts
│   │   ├── payments.ts
│   │   ├── visits.ts
│   │   ├── prescriptions.ts
│   │   ├── notifications.ts
│   │   └── admin.ts
│   ├── modules/          # Business logic
│   │   ├── auth/
│   │   │   ├── authService.ts
│   │   │   ├── otpService.ts
│   │   │   └── patientOtpService.ts
│   │   ├── capacity/
│   │   │   └── capacityService.ts
│   │   └── availability/
│   │       └── availabilityService.ts
│   ├── middleware/       # Auth, error handling
│   │   ├── auth.ts
│   │   └── errorHandler.ts
│   ├── services/         # External service integrations
│   │   ├── storageService.ts
│   │   └── aiService.ts
│   ├── config/           # App configuration
│   │   └── index.ts
│   ├── database/         # Database connection
│   │   ├── connection.ts
│   │   └── migrate.ts
│   ├── utils/            # Helpers
│   │   └── response.ts
│   └── index.ts          # App entry point
├── database/             # SQL migrations
│   ├── 001_initial_schema.sql
│   ├── 002_sample_data.sql
│   ├── 003_remove_clinics.sql
│   ├── 005_doctor_self_registration.sql
│   ├── 006_doctor_signup_otp_flow.sql
│   ├── 007_doctor_approval_states.sql
│   ├── 008_patient_signup_otp_flow.sql
│   ├── 013_add_two_factor_settings.sql
│   ├── 014_add_login_otp_challenges.sql
│   ├── 015_enforce_secretary_doctor_relationship.sql
│   ├── 016_doctor_profile_fields.sql
│   ├── 017_modify_pending_doctor_signup_for_basic_flow.sql
│   ├── 024_add_walk_in_completion_status.sql
│   └── 025_restore_phone_column.sql
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

1. **Install dependencies**:
```bash
cd backend
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up PostgreSQL database**:
```bash
# Create database
createdb findmydoctor

# Run migrations
npm run migrate
```

## Development

1. **Start development server**:
```bash
npm run dev
```

2. **API will be available at**: `http://localhost:3000`

3. **API base path**: `/api/v1`

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login with optional OTP (if 2FA enabled)
- `POST /api/v1/auth/otp/send` - Send OTP for patient registration
- `POST /api/v1/auth/otp/verify` - Verify OTP and create patient account
- `POST /api/v1/auth/otp/resend` - Resend OTP for patient registration
- `POST /api/v1/auth/register/doctor` - Register a doctor account (self-registration, PENDING approval)
- `POST /api/v1/auth/otp/send` - Send OTP for doctor registration
- `POST /api/v1/auth/otp/verify` - Verify OTP and create doctor account (INCOMPLETE profile)
- `POST /api/v1/auth/login/otp/send` - Send OTP for login (2FA)
- `POST /api/v1/auth/login/otp/verify` - Verify login OTP (2FA)
- `POST /api/v1/auth/change-password` - Change password

### Users
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update current user profile

### Doctors
- `GET /api/v1/doctors` - Search doctors (public, ACTIVE status only)
- `GET /api/v1/doctors/:id` - Get doctor details
- `GET /api/v1/doctors/me` - Get authenticated doctor profile
- `PUT /api/v1/doctors/me/profile` - Update doctor professional profile
- `POST /api/v1/doctors/me/profile/submit` - Submit profile for admin approval
- `POST /api/v1/doctors/me/photo` - Upload professional photo (PNG only, max 4MB)
- `DELETE /api/v1/doctors/me/photo` - Delete professional photo
- `GET /api/v1/doctors/:id/schedules` - Get doctor schedules
- `POST /api/v1/doctors/:id/schedules` - Add schedule
- `PUT /api/v1/doctors/:id/schedules/:id` - Update schedule
- `DELETE /api/v1/doctors/:id/schedules/:id` - Delete schedule
- `GET /api/v1/doctors/:id/availability` - Get availability (role-based: patients see current week only)
- `GET /api/v1/doctors/:id/capacity` - Get capacity configuration
- `PUT /api/v1/doctors/:id/capacity` - Update capacity
- `POST /api/v1/doctors/:id/capacity/:date` - Set capacity for date
- `POST /api/v1/doctors/secretaries` - Create secretary account (doctor-only)

### Clinics
- `GET /api/v1/clinics` - Get all clinics
- `GET /api/v1/clinic/:id` - Get clinic details
- `GET /api/v1/clinics/:id/location` - Get clinic location
- `PATCH /api/v1/clinics/:id/location` - Update clinic location (admin)

### Appointments
- `GET /api/v1/appointments` - Get appointments for current user
- `POST /api/v1/appointments` - Book appointment (atomic transaction, returns queueNumber and totalPatients)
- `GET /api/v1/appointments/:id` - Get appointment details
- `PATCH /api/v1/appointments/:id/cancel` - Cancel appointment (with queue reassignment and notifications)
- `PATCH /api/v1/appointments/:id/reschedule` - Reschedule appointment

### Queue
- `GET /api/v1/queue/:date` - Get queue for date
- `GET /api/v1/queue/:date/patient/:patientId` - Get patient's queue position
- `POST /api/v1/queue/:date/next` - Call next patient
- `PATCH /api/v1/queue/:id/status` - Update queue status
- `POST /api/v1/queue/:id/start-checkup` - Start checkup
- `POST /api/v1/queue/:id/complete` - Complete checkup
- `POST /api/v1/queue/:id/skip` - Skip patient
- `POST /api/v1/queue/:id/not-present` - Mark as not present

### Walk-ins
- `GET /api/v1/walk-ins/search` - Search for patient by email
- `POST /api/v1/walk-ins/create-account` - Create account for walk-in patient
- `POST /api/v1/walk-ins` - Register walk-in patient (atomic transaction, returns queueNumber and totalPatients)

### Conversations (Patient ↔ Secretary only)
- `GET /api/v1/conversations` - Get conversations
- `POST /api/v1/conversations` - Create conversation
- `GET /api/v1/conversations/:id` - Get conversation details
- `GET /api/v1/conversations/:id/messages` - Get messages
- `POST /api/v1/conversations/:id/messages` - Send message
- `PATCH /api/v1/conversations/:id/read` - Mark as read

### AI Chat
- `POST /api/v1/ai/chat` - Send message to AI chatbot
- `GET /api/v1/ai/conversations` - Get AI conversations
- `GET /api/v1/ai/conversations/:id` - Get AI conversation details
- `GET /api/v1/ai/conversations/:id/messages` - Get AI messages

### Payments
- `GET /api/v1/payments/:appointmentId` - Get payment details
- `POST /api/v1/payments/:appointmentId/receipt` - Upload GCash receipt
- `PATCH /api/v1/payments/:id/verify` - Verify payment (secretary)
- `PATCH /api/v1/payments/:id/reject` - Reject payment (secretary)
- `POST /api/v1/payments/:id/charges` - Add additional charge (secretary)

### Visits
- `POST /api/v1/visits` - Create visit record
- `GET /api/v1/visits/:id` - Get visit details
- `PUT /api/v1/visits/:id` - Update visit

### Prescriptions
- `POST /api/v1/prescriptions` - Create prescription
- `GET /api/v1/prescriptions/:id` - Get prescription details
- `GET /api/v1/prescriptions/patients/:id` - Get patient's prescriptions

### Notifications
- `GET /api/v1/notifications` - Get notifications
- `PATCH /api/v1/notifications/:id/read` - Mark as read

### Admin
- `GET /api/v1/admin/users` - Get all users
- `POST /api/v1/admin/doctors` - Create doctor
- `PATCH /api/v1/admin/doctors/:id/approve` - Approve doctor
- `PATCH /api/v1/admin/doctors/:id/reject` - Reject doctor
- `GET /api/v1/admin/secretaries` - Get all secretaries
- `POST /api/v1/admin/secretaries` - Create secretary
- `PATCH /api/v1/admin/secretaries/:id/approve` - Approve secretary
- `PATCH /api/v1/admin/secretaries/:id/reject` - Reject secretary

## API Response Format

**Success:**
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful."
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

## Error Codes

- `VALIDATION_ERROR` - Invalid input data
- `UNAUTHORIZED` - Authentication required or invalid
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource conflict (e.g., duplicate)
- `CAPACITY_FULL` - No available slots
- `APPOINTMENT_SLOT_UNAVAILABLE` - Slot not available
- `QUEUE_ASSIGNMENT_FAILED` - Queue assignment failed
- `CONVERSATION_ACCESS_DENIED` - Access to conversation denied
- `PAYMENT_VERIFICATION_REQUIRED` - Payment verification required
- `PAYMENT_ALREADY_VERIFIED` - Payment already verified
- `INVALID_PAYMENT_RECEIPT` - Invalid payment receipt
- `AI_SERVICE_UNAVAILABLE` - AI service unavailable
- `AI_RESPONSE_ERROR` - AI response error
- `INVALID_APPOINTMENT_STATUS` - Invalid appointment status
- `SERVER_ERROR` - Server error
- `MUST_CHANGE_PASSWORD` - Password change required
- `INVALID_CREDENTIALS` - Invalid credentials
- `EMAIL_ALREADY_EXISTS` - Email already registered

## Security Features

- **JWT Authentication**: All protected routes require valid JWT token
- **Role-Based Access Control**: Enforced on every protected route
- **No Patient-Doctor Chat**: Strictly enforced in conversations table and authorization
- **AI API Key Security**: Stored in environment variables, never exposed to client
- **Password Hashing**: Using bcryptjs for secure password storage
- **Rate Limiting**: Protection against API abuse
- **Helmet**: Security headers for Express
- **CORS**: Configured for specific origins

## Business Logic

### Atomic Appointment Booking
Appointment booking uses database transactions to ensure:
1. Doctor exists and is approved
2. Schedule exists for the date
3. Capacity is available (using PostgreSQL advisory lock for concurrency safety)
4. No duplicate booking exists for same patient/doctor/date
5. Appointment is created
6. Queue entry is created with sequential queue number
7. Daily registration count is incremented
8. Notification is created
9. Response includes queueNumber and totalPatients (configured capacity)

If any step fails, the entire transaction is rolled back.

### Unified Queue System
- Both online and walk-in patients use the same queue per doctor/date
- Queue numbers are assigned sequentially based on registration time
- Queue priority is determined by registration time, not source
- Queue numbers are concurrency-safe using PostgreSQL advisory locks
- Queue reassignment on cancellation: higher active queue numbers shift down by one
- Patients receive notifications when their queue number changes

### Capacity Calculation
```
Final Capacity = MIN(calculated_capacity, configured_capacity)
calculated_capacity = available_working_minutes / consultation_duration_minutes
Default consultation duration = 30 minutes
```

If no capacity row exists, the system calculates capacity from doctor's working hours for that day.

### Role-Based Schedule Visibility
- Patients see only the current week (Sunday to Saturday) of availability
- Doctors and secretaries see full date range for capacity management
- Filtering is enforced on the backend for security

### Patient Record Validation
- Before booking, the system checks if the patient has an existing record with the selected doctor
- If no record exists, the patient must provide required personal details
- If a record exists with that doctor, the patient can proceed directly to booking
- Records with other doctors do not count as having a record with the selected doctor

### Doctor Registration Workflow
1. Patient enters email → OTP sent to email
2. Patient verifies OTP → Account created with INCOMPLETE profile status
3. Patient completes profile (personal info, credentials, clinic, schedule, photo)
4. Patient submits profile → Status changes to PENDING approval
5. Admin reviews → Status changes to ACTIVE or REJECTED
6. Professional photos are PNG-only, max 4MB, stored in Supabase Storage

### Two-Factor Authentication
- Optional 2FA for doctors and secretaries
- Remember Me: Persistent sessions for 30 days on trusted browsers
- Login OTP: 6-digit code sent via email
- Trusted browser management: Add/remove trusted devices

### Payment Separation
- Appointments can be created without payment
- GCash receipt upload is optional
- Receipts start as `PENDING_VERIFICATION`
- Only secretaries can verify/reject payments
- Payment status: `UNPAID` → `PENDING_VERIFICATION` → `PAID`/`REJECTED`

## Database Schema

The backend uses the PostgreSQL schema defined in the `/database/` directory with sequential migrations (selected migrations shown):

- `001_initial_schema.sql` - Base schema with users, patients, doctors, appointments, queue, visits, prescriptions, payments, conversations, notifications
- `002_sample_data.sql` - Sample data for testing
- `003_remove_clinics.sql` - Removed clinics table (now part of doctor profile)
- `005_doctor_self_registration.sql` - Added doctor self-registration support
- `006_doctor_signup_otp_flow.sql` - Added OTP verification for doctor signup
- `007_doctor_approval_states.sql` - Added doctor approval workflow states
- `008_patient_signup_otp_flow.sql` - Added OTP verification for patient signup
- `013_add_two_factor_settings.sql` - Added 2FA settings and trusted browsers
- `014_add_login_otp_challenges.sql` - Added login OTP challenge table
- `015_enforce_secretary_doctor_relationship.sql` - Added doctor_id to secretaries
- `016_doctor_profile_fields.sql` - Added extended doctor profile fields
- `017_modify_pending_doctor_signup_for_basic_flow.sql` - Simplified doctor signup flow
- `024_add_walk_in_completion_status.sql` - Added completion status to patient_doctor_associations for walk-in workflow
- `025_restore_phone_column.sql` - Restores phone column to patients table (required for patient-details and profile-completion workflows)

Key tables:
- `users` - Base user accounts with authentication
- `patients` - Patient profiles
- `doctors` - Doctor profiles with approval states (PENDING, ACTIVE, REJECTED)
- `secretaries` - Secretary profiles linked to doctors
- `doctor_schedules` - Doctor availability (working hours)
- `daily_capacities` - Daily capacity limits
- `appointments` - Patient reservations with queue numbers
- `queue_entries` - Unified queue for online and walk-in patients
- `visits` - Completed consultations
- `prescriptions` - Digital prescriptions
- `payments` - Payment records with verification status
- `conversations` - Patient-secretary chat (no doctor chat)
- `messages` - Chat messages
- `ai_conversations` - AI chat conversations
- `ai_messages` - AI chat messages
- `notifications` - System notifications (including QUEUE_UPDATED)
- `two_factor_settings` - 2FA configuration for doctors/secretaries
- `login_otp_challenges` - Login OTP tracking
- `doctor_signup_otp_challenges` - Doctor signup OTP tracking
- `patient_signup_otp_challenges` - Patient signup OTP tracking

## Environment Variables

Required variables in `.env`:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/findmydoctor
DB_HOST=localhost
DB_PORT=5432
DB_NAME=findmydoctor
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Application
NODE_ENV=development
PORT=3000
API_VERSION=v1
TIMEZONE=Asia/Manila

# AI
AI_API_KEY=your_ai_provider_api_key
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-3.5-turbo

# Supabase (OTP delivery, photo storage)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_BUCKET_NAME=doctor-photos

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:8080
```

## Development Notes

### Running Migrations
```bash
npm run migrate
```

Additional migrations are applied individually:

```bash
npm run migrate:remove-clinics       # 003_remove_clinics.sql
npm run migrate:doctor-registration  # 005_doctor_self_registration.sql
```

**Important Migration Note:**
Migration `025_restore_phone_column.sql` restores the `phone` column to the `patients` table. This column is required by the patient-details and profile-completion workflows. If your existing database is missing the `phone` column, you must apply migration 025 before migration 024_add_walk_in_completion_status.sql to avoid errors during the update logic that references `p.phone`. Fresh databases created from migration 001 already include the column.

### Building for Production
```bash
npm run build
npm start
```

### Testing the API
Use tools like Postman, curl, or Insomnia to test the API endpoints.

Example login request:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@example.com","password":"password123"}'
```

## Important Rules

1. **Mobile → Backend → PostgreSQL**: Never expose PostgreSQL directly to mobile apps
2. **No Patient-Doctor Chat**: Strictly enforced in database schema and authorization
3. **AI API Key Security**: Never exposed to client applications
4. **Supabase Security**: Service role key only on backend, anon key for client uploads
5. **Payment ≠ Reservation**: Appointments can be created without payment
6. **Unified Queue**: Online and walk-in patients share the same queue per doctor/date
7. **Queue Priority**: Based on registration time only, not source
8. **Concurrency-Safe Queue Numbers**: Generated using PostgreSQL advisory locks
9. **Queue Reassignment**: Cancellation triggers sequential reassignment with notifications
10. **Skip ≠ Delete**: Skipped patients remain in database with SKIPPED status
11. **Manual Payment Verification**: Secretary must approve GCash receipts
12. **AI Informational Only**: AI never diagnoses or prescribes
13. **Walk-in Account Permanence**: Walk-in patients get permanent accounts
14. **Secure Temporary Passwords**: Hashed and never logged
15. **OTP Security**: OTP codes are one-time use and expire after 15 minutes
16. **Doctor Photo Upload**: PNG-only, max 4MB, stored in Supabase Storage
17. **Doctor Approval Workflow**: PENDING → ACTIVE/REJECTED, requires admin approval
18. **Role-Based Schedule Visibility**: Patients see current week only, full view for doctors/secretaries
19. **Patient Record Validation**: Doctor-specific record check before booking
20. **Two-Factor Authentication**: Optional for doctors/secretaries with trusted browser management

## Future Enhancements

- File upload middleware for GCash receipts and prescription PDFs
- Walk-in registration endpoints
- Waitlist management endpoints
- More comprehensive error handling
- Unit tests and integration tests
- Docker containerization
- API documentation (Swagger/OpenAPI)