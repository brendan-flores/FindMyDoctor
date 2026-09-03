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
│ Clinic Staff UI                            │
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
│ Clinics                                    │
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
│ Clinics                                    │
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
   External AI Provider       Secure File Storage
                                  │
                                  ▼
                         GCash Receipts / PDFs
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
│   ├── secretary-chat/
│   ├── ai-chat/
│   ├── clinic-map/
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

---

# 5.1. Web Application Architecture

Recommended:

```text
web/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page with role selection
│   │   ├── doctor/            # Doctor dashboard
│   │   │   ├── page.tsx
│   │   │   ├── appointments/
│   │   │   ├── schedule/
│   │   │   ├── patients/
│   │   │   └── prescriptions/
│   │   ├── secretary/         # Secretary dashboard
│   │   │   ├── page.tsx
│   │   │   ├── queue/
│   │   │   ├── walk-ins/
│   │   │   ├── payments/
│   │   │   └── conversations/
│   │   └── admin/             # Admin dashboard
│   │       ├── page.tsx
│   │       ├── users/
│   │       ├── doctors/
│   │       ├── secretaries/
│   │       └── clinics/
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

# 7. Doctor Navigation

```text
Dashboard

Appointments
 ├── Today
 ├── Upcoming
 └── History

Schedule
 ├── Working Hours
 ├── Availability
 └── Daily Capacity

Patients

Prescriptions

Profile
```

---

# 8. Secretary Navigation

```text
Dashboard

Daily Queue

Appointments

Conversations

Walk-in Registration

Payments

Clinic

Profile
```

The secretary is the primary operational user for daily queue and payment verification.

---

# 9. Admin Navigation

```text
Dashboard

Users

Doctors

Secretaries

Clinics

Appointments

Profile
```

---

# 10. Backend Modules

Recommended backend modules:

```text
auth
users
patients
doctors
clinics
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
- Clinic operating hours.
- Break periods.
- Appointment duration.
- Unavailable periods.
- Doctor availability.

The default consultation duration is:

**30 minutes**

---

# 12. Capacity Module

The capacity module determines the maximum number of patients that can be registered for a particular date.

### Capacity Inputs

```text
Doctor Availability
Clinic Operating Hours
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

If the doctor/secretary has configured a lower maximum:

```text
Final Capacity = MIN(Calculated Capacity, Configured Capacity)
```

If there is no configured lower limit, the calculated capacity can be used.

---

# 13. Capacity Data Model

Recommended table:

```text
daily_capacities
----------------
id
doctor_id
clinic_id
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

- Create reservations.
- View appointments.
- Cancel appointments.
- Reschedule appointments.
- Update appointment states.
- Prevent booking conflicts.

Payment is intentionally separate from basic reservation creation.

---

# 16. Reservation Model

A regular reservation does not require payment.

A successful reservation results in:

```text
Appointment
    +
Queue Entry
    +
Capacity Consumption
```

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
clinic_id
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
clinic_id
status
created_at
updated_at
```

There should be no `doctor_id` in this patient-secretary conversation model.

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

---

# 28. Chat Architecture

```text
Patient Mobile
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
Notify Secretary
```

The same authorization model applies when the secretary replies.

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

Use a static/default clinic GCash QR.

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
- Make clinical decisions.
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

# 41. Clinic Module

Responsibilities:

- Clinic information.
- Doctors.
- Secretaries.
- Operating hours.
- Clinic location (address, latitude, longitude).
- Map coordinates storage and retrieval.
- Approval status.

---

# 42. Patient Module

Responsibilities:

- Account.
- Medical history.
- Allergies.
- Medications.
- Emergency contact.
- Appointment history.
- Consultation history.

---

# 43. Visit Module

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

# 44. Prescription Module

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

# 45. Notification Module

Notifications may be generated when:

- Reservation is created.
- Queue information changes.
- Secretary sends a message.
- Payment is verified.
- Prescription is created.
- Appointment changes.
- Waitlist status changes.

---

# 46. API Architecture

Base:

```text
/api/v1
```

### Capacity

```text
GET  /doctors/:id/capacity
PUT  /doctors/:id/capacity
POST /doctors/:id/capacity/:date
```

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
```

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

### Clinic Map

```text
GET  /clinics/:id/location
PATCH /clinics/:id/location
```

---

# 47. Reservation Transaction

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

# 48. Walk-in Transaction

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

# 49. Concurrency Protection

Capacity and queue registration are concurrency-sensitive.

The backend must prevent:

- Capacity overflow.
- Duplicate queue numbers.
- Double booking.
- Race conditions between online booking and walk-in registration.

Use PostgreSQL transactions, constraints, and appropriate locking/isolation.

---

# 50. Database Relationships

```text
USER
 ├── PATIENT
 ├── DOCTOR
 ├── SECRETARY
 ├── CLINIC STAFF
 └── ADMIN

CLINIC
 ├── DOCTORS
 └── SECRETARIES

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

# 51. Recommended Database Tables

```text
users
patients
doctors
clinics
secretaries
clinic_staff
doctor_clinics

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
```

---

# 52. Clinic Map Feature Architecture

The clinic map feature allows patients to view the physical location of a clinic directly within the doctor or clinic profile screen.

## Map Data Flow

```text
Patient
   ↓
Doctor Profile or Clinic Profile Screen
   ↓
GET /clinics/:id/location
   ↓
Backend Returns { address, latitude, longitude }
   ↓
Mobile Map Widget Renders Clinic Pin
   ↓
Patient Views Clinic Location
```

## Clinic Location Data Model

The `clinics` table shall include location fields:

```text
clinics
-------
id
name
address
latitude         -- decimal, e.g. 14.5995
longitude        -- decimal, e.g. 120.9842
contact_info
description
approval_status
created_at
updated_at
```

## Map Provider

The mobile application shall use a map provider (such as Google Maps or OpenStreetMap via flutter_map) to render the clinic location. The map package is selected during mobile implementation.

The map must:

- Display a pin at the clinic's coordinates.
- Show the clinic name and address as a label.
- Be read-only for patients (no editing).

## Permissions

```text
Patient     → Read clinic location (YES)
Doctor      → Read clinic location (YES)
Secretary   → Read clinic location (YES)
Admin       → Read and update clinic location (YES)
```

---

# 52. Security Architecture

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
│   │   │   ├── clinics/
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