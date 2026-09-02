# FindMyDoctor — System Architecture

## 1. Architecture Overview

FindMyDoctor is a **mobile doctor appointment-booking, appointment-management, communication, and AI-assisted healthcare information platform**.

The system consists of:

```text
┌──────────────────────────────────────────┐
│           FindMyDoctor Mobile App        │
│                                          │
│ Patient UI                               │
│ Doctor UI                                │
│ Secretary UI                             │
│ Clinic Staff UI                          │
│ Admin UI                                 │
│ AI Chat UI                               │
└───────────────────┬──────────────────────┘
                    │
                    │ HTTPS / JSON API
                    ▼
┌──────────────────────────────────────────┐
│             Backend API Server            │
│                                          │
│ Authentication & Authorization            │
│ Doctor Discovery                          │
│ Scheduling                                │
│ Appointment Management                    │
│ Patient Records                           │
│ Prescriptions                             │
│ Secretary Messaging                       │
│ AI Chatbot Integration                    │
│ Notifications                             │
│ Administration                            │
└───────────────────┬──────────────────────┘
                    │
                    │ SQL
                    ▼
┌──────────────────────────────────────────┐
│               PostgreSQL                  │
│                                          │
│ Users                                     │
│ Patients                                  │
│ Doctors                                   │
│ Clinics                                   │
│ Secretaries                               │
│ Schedules                                 │
│ Appointments                              │
│ Visits                                    │
│ Prescriptions                             │
│ Conversations                             │
│ Messages                                  │
│ AI Conversations                          │
│ AI Messages                               │
│ Waitlists                                 │
│ Notifications                             │
└──────────────────────────────────────────┘

                    │
        ┌───────────┴────────────┐
        ▼                        ▼
 External AI Service       File / Push Services
        │                        │
        ▼                        ▼
   AI Responses             PDFs / Notifications
```

### Communication Architecture

```text
Patient ↔ Secretary       YES
Patient ↔ AI              YES
Patient ↔ Doctor          NO
```

The mobile application must never connect directly to PostgreSQL.

---

# 2. Architectural Goals

The architecture should:

1. Support a mobile-first application.
2. Separate presentation, business logic, and data access.
3. Provide secure API communication.
4. Protect patient and communication data.
5. Prevent appointment conflicts.
6. Enforce role-based access.
7. Support patient-secretary communication.
8. Support controlled AI chatbot integration.
9. Keep scheduling logic centralized.
10. Remain simple enough for an educational project.

---

# 3. Architectural Style

Use a **modular monolith backend**.

```text
Mobile Application
        │
        ▼
     REST API
        │
        ▼
┌──────────────────────────────┐
│       Backend Modules        │
│                              │
│ Auth                         │
│ Users                        │
│ Patients                     │
│ Doctors                      │
│ Clinics                      │
│ Secretaries                  │
│ Schedules                    │
│ Appointments                 │
│ Visits                       │
│ Prescriptions                │
│ Conversations                │
│ Messages                     │
│ AI Chatbot                   │
│ Waitlists                    │
│ Notifications                │
│ Admin                        │
└───────────────┬──────────────┘
                │
                ▼
           PostgreSQL
```

Do not introduce microservices unless a future requirement explicitly justifies them.

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

The AI integration is treated as an external service dependency of the backend.

The mobile app never directly calls the AI provider unless a future architecture explicitly requires secure client-side integration.

---

# 5. Mobile Application Architecture

Recommended structure:

```text
mobile/
├── app/
├── features/
│   ├── auth/
│   ├── doctors/
│   ├── appointments/
│   ├── schedules/
│   ├── patients/
│   ├── prescriptions/
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

---

# 6. Mobile Navigation

## Patient

```text
Home
 ├── Search Doctors
 ├── Doctor Details
 ├── Availability
 └── Booking

Appointments
 ├── Upcoming
 ├── Past
 └── Details

Chat
 └── Secretary Conversations

AI Assistant

Waitlist

Prescriptions

Notifications

Profile
```

## Doctor

```text
Dashboard
Appointments
Schedule
Patients
Prescriptions
Profile
```

There is intentionally **no patient chat section for doctors**.

## Secretary

```text
Dashboard
Conversations
Appointments
Clinic Information
Profile
```

## Administrator

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

# 7. Backend Module Architecture

Core modules:

```text
auth
users
patients
doctors
clinics
secretaries
schedules
appointments
visits
prescriptions
conversations
messages
ai-chat
waitlists
notifications
admin
```

Each module should have a clearly defined responsibility.

---

# 8. Secretary Module

The secretary module manages the clinic-side patient communication role.

Responsibilities:

- Secretary profile
- Clinic association
- Conversation access
- Patient inquiries
- Appointment-related assistance
- Clinic-related questions

Secretaries should only access conversations assigned to or authorized for their clinic.

---

# 9. Conversation Module

The conversation module manages patient-secretary chat sessions.

A conversation should contain:

```text
conversation_id
patient_id
secretary_id
clinic_id
status
created_at
updated_at
```

Potential status:

```text
OPEN
CLOSED
ARCHIVED
```

The conversation belongs to the **patient-secretary communication domain**.

No patient-doctor conversation type should be implemented.

---

# 10. Message Module

Messages belong to a conversation.

Conceptual structure:

```text
messages
---------
id
conversation_id
sender_user_id
message
sent_at
read_at
```

Each message must reference a valid conversation participant.

The backend must verify that the sender is authorized to participate in the conversation.

---

# 11. Patient–Secretary Chat Architecture

```text
Patient Mobile App
       │
       │ POST /conversations/:id/messages
       ▼
Backend API
       │
       ├── Authenticate
       ├── Verify Patient Role
       ├── Verify Conversation Membership
       ├── Validate Message
       └── Save Message
       │
       ▼
PostgreSQL
       │
       ▼
Secretary Mobile App
```

The same permission model applies in the opposite direction.

### Important

The API should never accept:

```text
patient_id + doctor_id
```

to create a direct patient-doctor conversation.

---

# 12. Real-Time Messaging

The application may implement messaging using:

- WebSockets
- Server-Sent Events
- Polling

The implementation can be selected based on the mobile/backend technology.

For the MVP, a simple reliable approach is preferred.

Regardless of transport, PostgreSQL remains the persistent source of truth for messages.

---

# 13. AI Chatbot Module

The AI chatbot is a backend-integrated service.

Architecture:

```text
Patient
   │
   ▼
Mobile AI Chat UI
   │
   │ HTTPS
   ▼
Backend AI Module
   │
   ├── Authentication
   ├── Input Validation
   ├── Safety Processing
   ├── Conversation Context
   │
   ▼
External AI Provider
   │
   ▼
Safety / Response Processing
   │
   ▼
Backend
   │
   ▼
Mobile App
```

The AI provider must not receive unrestricted application access to PostgreSQL.

---

# 14. AI Chat Responsibilities

The backend AI module is responsible for:

- Sending user questions to the AI provider.
- Managing conversation context.
- Applying system instructions.
- Applying safety rules.
- Processing AI responses.
- Returning responses to the mobile application.
- Optionally recording conversation history.

The AI module must not directly modify:

- Appointments
- Prescriptions
- Patient records
- Doctor schedules

unless a future feature explicitly introduces such functionality with appropriate authorization and validation.

---

# 15. AI Safety Architecture

The AI pipeline should conceptually be:

```text
Patient Input
     ↓
Input Validation
     ↓
Safety / Policy Checks
     ↓
AI Request
     ↓
AI Response
     ↓
Response Safety Processing
     ↓
Patient
```

The AI must be instructed that it is an informational assistant.

The system should prevent or discourage AI behavior that:

- Claims to be a physician.
- Provides definitive diagnosis.
- Prescribes medications.
- Changes a doctor's prescription.
- Makes clinical decisions.
- Gives misleading certainty.

---

# 16. AI Emergency Handling

When the AI detects a potentially urgent scenario, it should prioritize appropriate emergency guidance.

Conceptually:

```text
Medical Question
      │
      ▼
AI Safety Evaluation
      │
      ├── General Information
      │        ↓
      │     AI Response
      │
      └── Potential Emergency
               ↓
       Recommend Immediate
       Professional / Emergency Care
```

The AI should not attempt to manage an emergency entirely through conversation.

---

# 17. AI Conversation Data

If AI conversations are persisted, use separate records from patient-secretary conversations.

Recommended:

```text
ai_conversations
-----------------
id
patient_id
created_at
updated_at

ai_messages
------------
id
conversation_id
role
content
created_at
```

Possible `role` values:

```text
USER
ASSISTANT
SYSTEM
```

AI conversation records must have appropriate access controls.

---

# 18. AI Privacy

The AI integration should minimize unnecessary sharing of sensitive patient information.

Before sending information to an external AI provider:

- Send only information necessary for the request.
- Avoid exposing unrelated patient records.
- Do not send authentication secrets.
- Do not expose database credentials.
- Do not provide unrestricted medical records to the AI by default.

The AI integration must follow the project's educational/prototype scope.

---

# 19. Authentication Module

Responsibilities:

- Registration
- Login
- Logout
- Token/session handling
- Authentication state
- Password management

---

# 20. Role-Based Access Control

Supported roles:

```text
PATIENT
DOCTOR
SECRETARY
CLINIC_STAFF
ADMIN
```

### Patient

Can:

- Search doctors
- Book appointments
- Manage own appointments
- Chat with authorized secretaries
- Use AI chatbot
- View own prescriptions

### Doctor

Can:

- Manage own schedules
- View own appointments
- Access authorized patient information
- Create prescriptions

Cannot:

- Access patient-secretary conversations unless explicitly required by another documented feature
- Participate in patient chat

### Secretary

Can:

- Manage authorized patient conversations
- Reply to patients
- View relevant appointment information
- Assist with clinic scheduling

### Clinic Staff

Can:

- Manage authorized clinic operations

### Admin

Can:

- Manage users
- Approve doctors
- Approve clinics
- Manage secretaries
- Review appointments

---

# 21. Communication Authorization Matrix

| Sender | Recipient | Allowed |
|---|---|---|
| Patient | Secretary | Yes |
| Secretary | Patient | Yes |
| Patient | AI | Yes |
| AI | Patient | Yes |
| Patient | Doctor | **No** |
| Doctor | Patient | **No direct chat** |

Backend authorization must enforce this matrix.

The mobile UI alone must not be responsible for preventing doctor chat.

---

# 22. Doctor Module

Responsibilities:

- Doctor profile
- Specialty
- Credentials
- Biography
- Consultation fee
- Approval status
- Doctor search

Approved doctors become available for booking according to system rules.

---

# 23. Clinic Module

Responsibilities:

- Clinic profile
- Address
- Location
- Contact information
- Doctors
- Secretaries
- Approval status

---

# 24. Schedule Module

Responsibilities:

- Working hours
- Appointment duration
- Unavailable dates
- Unavailable times
- Availability calculation

Availability:

```text
Working Hours
      -
Unavailable Periods
      -
Existing Appointments
      =
Available Slots
```

---

# 25. Appointment Module

Responsibilities:

- Create appointment
- View appointment
- Cancel appointment
- Reschedule appointment
- Update appointment status
- Prevent double booking
- Maintain appointment history

---

# 26. Double-Booking Prevention

The system must prevent simultaneous booking of the same slot.

Use:

- PostgreSQL constraints where applicable.
- Database transactions.
- Server-side checks.
- Appropriate locking/isolation.

Frontend availability checks are not sufficient.

---

# 27. Patient Module

Responsibilities:

- Patient profile
- Allergies
- Medical history
- Medications
- Emergency contact
- Appointment history

Sensitive data must be protected.

---

# 28. Visit Module

Responsibilities:

- Visit records
- Visit notes
- Appointment association
- Patient association
- Doctor association
- Prescription association

---

# 29. Prescription Module

Responsibilities:

- Prescription creation
- Prescription storage
- Prescription item management
- PDF generation
- Patient prescription access

Prescription PDF files should be protected.

---

# 30. Waitlist Module

Responsibilities:

- Create waitlist entries
- Manage waitlists
- Match availability
- Track waitlist status

---

# 31. Notification Module

Responsibilities:

- Appointment notifications
- New secretary message notifications
- Prescription notifications
- Waitlist notifications
- Other system events

---

# 32. Administrator Module

Responsibilities:

- User management
- Doctor approvals
- Clinic approvals
- Secretary management
- Appointment monitoring

---

# 33. PostgreSQL Database Architecture

Core tables:

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
appointments
visits
prescriptions
prescription_items
waitlists
notifications
conversations
messages
ai_conversations
ai_messages
```

---

# 34. Core Relationships

```text
USER
 ├── PATIENT
 ├── DOCTOR
 ├── SECRETARY
 ├── CLINIC STAFF
 └── ADMIN

PATIENT
 ├── APPOINTMENTS
 ├── WAITLISTS
 ├── PRESCRIPTIONS
 ├── CONVERSATIONS
 └── AI_CONVERSATIONS

SECRETARY
 └── CONVERSATIONS

DOCTOR
 ├── SCHEDULES
 ├── APPOINTMENTS
 ├── VISITS
 └── PRESCRIPTIONS

CLINIC
 ├── DOCTORS
 └── SECRETARIES

CONVERSATION
 └── MESSAGES

AI_CONVERSATION
 └── AI_MESSAGES

APPOINTMENT
 └── VISIT
      └── PRESCRIPTION
```

---

# 35. Users Table

```text
users
---------
id
email
password_hash
role
status
created_at
updated_at
```

---

# 36. Secretaries Table

```text
secretaries
------------
id
user_id
clinic_id
full_name
contact_number
status
created_at
updated_at
```

A secretary should be associated with a clinic.

---

# 37. Conversations Table

```text
conversations
--------------
id
patient_id
secretary_id
clinic_id
status
created_at
updated_at
```

A conversation represents a patient-secretary communication channel.

There should be **no doctor_id** in this table.

That structure reinforces the requirement that patients cannot directly chat with doctors.

---

# 38. Messages Table

```text
messages
---------
id
conversation_id
sender_user_id
message
sent_at
read_at
```

The backend must verify that `sender_user_id` belongs to a valid participant.

---

# 39. AI Conversations Table

```text
ai_conversations
-----------------
id
patient_id
created_at
updated_at
```

---

# 40. AI Messages Table

```text
ai_messages
------------
id
conversation_id
role
content
created_at
```

Potential roles:

```text
USER
ASSISTANT
SYSTEM
```

AI messages should be associated with the authenticated patient.

---

# 41. API Architecture

Base API:

```text
/api/v1
```

All protected communication endpoints require authentication.

---

# 42. Secretary Chat Endpoints

Example:

```text
GET    /conversations
POST   /conversations
GET    /conversations/:id
GET    /conversations/:id/messages
POST   /conversations/:id/messages
PATCH  /conversations/:id/read
```

The backend must verify whether the authenticated user is an authorized patient or secretary for the conversation.

---

# 43. Important API Restriction

Do not create an endpoint such as:

```text
POST /doctor-chat
POST /doctors/:id/chat
POST /conversations/doctor
```

for direct patient-doctor communication.

The API should not expose a mechanism that bypasses the communication policy.

---

# 44. AI Chat Endpoints

Example:

```text
POST   /ai/chat
GET    /ai/conversations
GET    /ai/conversations/:id
GET    /ai/conversations/:id/messages
```

The backend should identify the authenticated patient rather than trusting a client-provided patient ID.

---

# 45. AI Service Flow

```text
POST /ai/chat
       ↓
Authenticate Patient
       ↓
Validate Input
       ↓
Load Allowed Conversation Context
       ↓
Apply AI System Instructions
       ↓
Send Request to AI Provider
       ↓
Validate / Process Response
       ↓
Store AI Conversation Data
       ↓
Return Response
```

---

# 46. Doctor Endpoints

```text
GET    /doctors
GET    /doctors/:id
GET    /doctors/:id/availability
GET    /doctors/:id/schedules
POST   /doctors/:id/schedules
PUT    /doctors/:id/schedules/:scheduleId
DELETE /doctors/:id/schedules/:scheduleId
```

---

# 47. Appointment Endpoints

```text
POST   /appointments
GET    /appointments
GET    /appointments/:id
POST   /appointments/:id/cancel
POST   /appointments/:id/reschedule
PATCH  /appointments/:id
```

---

# 48. Prescription Endpoints

```text
POST   /prescriptions
GET    /prescriptions/:id
GET    /prescriptions/:id/pdf
GET    /patients/me/prescriptions
```

---

# 49. Notification Endpoints

```text
GET    /notifications
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
```

---

# 50. Administrative Endpoints

```text
GET    /admin/users

GET    /admin/doctors
PATCH  /admin/doctors/:id/approve
PATCH  /admin/doctors/:id/reject

GET    /admin/secretaries
PATCH  /admin/secretaries/:id/status

GET    /admin/clinics
PATCH  /admin/clinics/:id/approve
PATCH  /admin/clinics/:id/reject

GET    /admin/appointments
```

---

# 51. API Response Format

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
    "code": "FORBIDDEN",
    "message": "You are not authorized to access this conversation."
  }
}
```

---

# 52. Authentication and Authorization

The backend must enforce:

```text
Authentication
      ↓
Identify User
      ↓
Determine Role
      ↓
Verify Resource Ownership
      ↓
Verify Action Permission
      ↓
Execute Operation
```

Do not depend on UI visibility for security.

---

# 53. Communication Security

Patient-secretary messages must be protected.

Rules:

- Only conversation participants may read messages.
- Only authorized participants may send messages.
- Patients cannot access another patient's conversation.
- Secretaries cannot access conversations belonging to unrelated clinics unless explicitly authorized.
- Doctors cannot access patient-secretary conversations through normal doctor permissions.

---

# 54. AI Security

AI provider credentials must remain on the backend.

Never expose:

```text
AI_API_KEY
DATABASE_URL
AUTH_SECRET
```

to the mobile application.

The mobile app communicates with:

```text
Mobile → Backend → AI Provider
```

not:

```text
Mobile → AI Provider
```

unless a secure architecture explicitly requires it.

---

# 55. AI Data Minimization

The AI module should only provide the information required to answer a user's request.

Do not automatically send:

- Full patient records
- Full medical history
- Prescription records
- Unrelated appointments
- Other users' information

to the AI provider.

---

# 56. AI Output Handling

AI responses should be treated as **untrusted generated content**.

The backend should:

- Validate the response.
- Apply safety instructions.
- Handle provider failures.
- Avoid exposing internal prompts.
- Avoid exposing API credentials.
- Return a controlled response to the mobile application.

---

# 57. Scheduling and Time

The target timezone is:

```text
Asia/Manila
```

The system should use consistent date/time handling across:

- Appointments
- Schedules
- Unavailability
- Messages
- Notifications
- AI conversation timestamps

---

# 58. Database Transactions

Use transactions for critical multi-step operations.

### Booking

```text
BEGIN
  Check Slot
  Verify Conflict
  Create Appointment
  Create Notification
COMMIT
```

### Rescheduling

```text
BEGIN
  Verify Ownership
  Verify New Slot
  Update Appointment
  Create Notification
COMMIT
```

### Important Chat Operations

A message creation operation should ensure the conversation and participant authorization are valid before inserting the message.

---

# 59. Database Indexing

Potential indexes:

```text
users.email

doctors.specialty
doctors.approval_status

appointments.doctor_id
appointments.patient_id
appointments.appointment_date
appointments.status

conversations.patient_id
conversations.secretary_id
conversations.clinic_id

messages.conversation_id
messages.sent_at

ai_conversations.patient_id
ai_messages.conversation_id

notifications.user_id
notifications.is_read
```

Indexes should be based on actual query patterns.

---

# 60. File Storage

Prescription PDFs should use secure file storage.

```text
Prescription
      ↓
PDF Generator
      ↓
Secure Storage
      ↓
Storage Reference
      ↓
PostgreSQL
```

Prescription files must not be publicly accessible.

---

# 61. Search Architecture

Doctor search remains server-side:

```text
Mobile Search
      ↓
Doctor Search API
      ↓
Search Service
      ↓
PostgreSQL
      ↓
Filtered Doctors
      ↓
Mobile App
```

---

# 62. Error Handling

Use predictable errors:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
APPOINTMENT_SLOT_UNAVAILABLE
CONVERSATION_ACCESS_DENIED
AI_SERVICE_UNAVAILABLE
AI_RESPONSE_ERROR
INVALID_APPOINTMENT_STATUS
SERVER_ERROR
```

Do not expose internal implementation details.

---

# 63. Logging

Useful events include:

- Authentication failures
- Appointment conflicts
- Chat failures
- AI provider failures
- PDF generation failures
- Administrative actions

Do not log sensitive information unnecessarily.

Avoid logging:

- Passwords
- API keys
- Authentication secrets
- Full patient medical histories
- Full prescription contents
- Sensitive conversation contents

---

# 64. Deployment Architecture

```text
                 Internet
                    │
                    ▼
              Mobile App
                    │
                  HTTPS
                    │
                    ▼
              Backend API
             /      |      \
            /       |       \
           ▼        ▼        ▼
     PostgreSQL   Storage   AI Provider
                             │
                             ▼
                         AI Service
```

Push notification services can be added separately.

---

# 65. Environment Configuration

Examples:

```text
DATABASE_URL
AUTH_SECRET
AI_API_KEY
STORAGE credentials
PUSH credentials
```

Never commit secrets to Git.

---

# 66. Repository Structure

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
│   │   ├── patients/
│   │   ├── prescriptions/
│   │   ├── secretary-chat/
│   │   ├── ai-chat/
│   │   ├── waitlist/
│   │   └── notifications/
│   ├── components/
│   ├── services/
│   ├── api/
│   └── types/
│
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
│   │   │   ├── appointments/
│   │   │   ├── visits/
│   │   │   ├── prescriptions/
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

# 67. Testing Architecture

Test:

### Authentication

- Login
- Registration
- Role restrictions

### Appointments

- Availability
- Booking
- Double booking
- Cancellation
- Rescheduling

### Chat

- Patient can message secretary
- Secretary can reply
- Unauthorized patient cannot access another conversation
- Doctor cannot use patient-secretary chat

### AI

- Patient can send a message
- AI response is returned
- AI provider failure is handled
- Conversation ownership is enforced
- AI limitations are respected

### Prescriptions

- Doctor creates prescription
- Patient accesses own prescription
- Unauthorized users are rejected

---

# 68. Important Architectural Boundaries

```text
PATIENT
 │
 ├──────────────► SECRETARY CHAT
 │
 ├──────────────► AI CHATBOT
 │
 ├──────────────► APPOINTMENTS
 │
 └──────────────► PRESCRIPTIONS

PATIENT ──X──► DOCTOR CHAT
```

This is an intentional product and architecture constraint.

---

# 69. Scalability

The initial system does not require microservices.

Start with:

```text
Mobile
  ↓
Modular Backend
  ↓
PostgreSQL
```

The AI provider remains an external service.

Future scaling can introduce:

- Background workers
- Queues
- Caching
- Multiple API instances
- Dedicated messaging services

only when justified.

---

# 70. Final Architecture Principle

The core architecture is:

```text
                  MOBILE APP
                       │
                       │ HTTPS
                       ▼
                MODULAR BACKEND
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
 APPOINTMENTS    SECRETARY CHAT     AI CHATBOT
       │               │                │
       └───────────────┼────────────────┘
                       ▼
                   POSTGRESQL

AI CHATBOT
     │
     ▼
External AI Provider
```

The backend is the source of truth for:

- Authentication
- Authorization
- Appointments
- Scheduling
- Communication permissions
- Patient access
- Prescription access
- AI integration

PostgreSQL is the source of truth for persistent application data.

The most important communication rule is:

> **Patients can communicate with secretaries and the AI chatbot, but they cannot directly chat with doctors.**