# FindMyDoctor Backend

FindMyDoctor REST API - Healthcare appointment management system serving both Flutter mobile and Next.js web applications.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Architecture**: Modular Monolith
- **Database**: PostgreSQL
- **Authentication**: JWT tokens
- **Timezone**: Asia/Manila (UTC+8)

## Features

- **User Authentication**: JWT-based auth with role-based access control
- **Appointment Management**: Atomic booking with capacity enforcement
- **Unified Queue System**: Combined queue for online and walk-in patients
- **Patient-Secretary Chat**: Secure messaging (no direct patient-doctor chat)
- **AI Chatbot Integration**: Backend-proxied AI assistant for medical information
- **Payment Processing**: GCash receipt upload with manual secretary verification
- **Medical Records**: Visit tracking and digital prescriptions
- **Admin Dashboard**: User, doctor, and clinic management

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
│   │   ├── clinics.ts
│   │   ├── appointments.ts
│   │   ├── queue.ts
│   │   ├── conversations.ts
│   │   ├── ai-chat.ts
│   │   ├── payments.ts
│   │   ├── visits.ts
│   │   ├── prescriptions.ts
│   │   ├── notifications.ts
│   │   └── admin.ts
│   ├── modules/          # Business logic
│   │   └── auth/
│   │       └── authService.ts
│   ├── middleware/       # Auth, error handling
│   │   ├── auth.ts
│   │   └── errorHandler.ts
│   ├── config/           # App configuration
│   │   └── index.ts
│   ├── database/         # Database connection
│   │   ├── connection.ts
│   │   └── migrate.ts
│   ├── utils/            # Helpers
│   │   └── response.ts
│   └── index.ts          # App entry point
├── database/             # SQL files
│   ├── 001_initial_schema.sql
│   └── 002_sample_data.sql
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
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/change-password` - Change password

### Users
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update current user profile

### Doctors
- `GET /api/v1/doctors` - Search doctors (public)
- `GET /api/v1/doctors/:id` - Get doctor details
- `GET /api/v1/doctors/:id/schedules` - Get doctor schedules
- `GET /api/v1/doctors/:id/availability` - Get availability
- `GET /api/v1/doctors/:id/capacity` - Get capacity configuration
- `PUT /api/v1/doctors/:id/capacity` - Update capacity
- `POST /api/v1/doctors/:id/capacity/:date` - Set capacity for date

### Clinics
- `GET /api/v1/clinics` - Get all clinics
- `GET /api/v1/clinics/:id` - Get clinic details
- `GET /api/v1/clinics/:id/location` - Get clinic location
- `PATCH /api/v1/clinics/:id/location` - Update clinic location (admin)

### Appointments
- `GET /api/v1/appointments` - Get appointments for current user
- `POST /api/v1/appointments` - Book appointment (atomic transaction)
- `GET /api/v1/appointments/:id` - Get appointment details
- `PATCH /api/v1/appointments/:id/cancel` - Cancel appointment
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
- `POST /api/v1/walk-ins` - Register walk-in patient (atomic transaction)

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
- `POST /api/v1/admin/clinics` - Create clinic
- `PATCH /api/v1/admin/clinics/:id/approve` - Approve clinic
- `GET /api/v1/admin/appointments` - Get all appointments

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
3. Capacity is available
4. No slot conflict exists
5. Appointment is created
6. Queue entry is created with sequential queue number
7. Daily registration count is incremented
8. Notification is created

If any step fails, the entire transaction is rolled back.

### Unified Queue System
- Both online and walk-in patients use the same queue
- Queue numbers are assigned sequentially based on registration time
- Queue priority is determined by registration time, not source
- Queue numbers are concurrency-safe using database constraints

### Capacity Calculation
```
Final Capacity = MIN(calculated_capacity, configured_capacity)
calculated_capacity = available_working_minutes / consultation_duration_minutes
Default consultation duration = 30 minutes
```

### Payment Separation
- Appointments can be created without payment
- GCash receipt upload is optional
- Receipts start as `PENDING_VERIFICATION`
- Only secretaries can verify/reject payments
- Payment status: `UNPAID` → `PENDING_VERIFICATION` → `PAID`/`REJECTED`

## Database Schema

The backend uses the PostgreSQL schema defined in `/database/001_initial_schema.sql` and `/database/002_sample_data.sql`.

Key tables:
- `users` - Base user accounts
- `patients` - Patient profiles
- `doctors` - Doctor profiles
- `secretaries` - Secretary profiles
- `clinics` - Clinic information
- `doctor_schedules` - Doctor availability
- `daily_capacities` - Daily capacity limits
- `appointments` - Patient reservations
- `queue_entries` - Unified queue
- `visits` - Completed consultations
- `prescriptions` - Digital prescriptions
- `payments` - Payment records
- `conversations` - Patient-secretary chat (no doctor chat)
- `messages` - Chat messages
- `ai_conversations` - AI chat conversations
- `ai_messages` - AI chat messages
- `notifications` - System notifications

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
4. **Payment ≠ Reservation**: Appointments can be created without payment
5. **Unified Queue**: Online and walk-in patients share the same queue
6. **Queue Priority**: Based on registration time only, not source
7. **Concurrency-Safe Queue Numbers**: Generated using database transactions
8. **Skip ≠ Delete**: Skipped patients remain in database with SKIPPED status
9. **Manual Payment Verification**: Secretary must approve GCash receipts
10. **AI Informational Only**: AI never diagnoses or prescribes
11. **Walk-in Account Permanence**: Walk-in patients get permanent accounts
12. **Secure Temporary Passwords**: Hashed and never logged

## Future Enhancements

- File upload middleware for GCash receipts and prescription PDFs
- Walk-in registration endpoints
- Waitlist management endpoints
- More comprehensive error handling
- Unit tests and integration tests
- Docker containerization
- API documentation (Swagger/OpenAPI)