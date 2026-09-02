# FindMyDoctor — Architecture Essentials

## 1. Purpose

This document contains the essential development rules for FindMyDoctor.

It must be used together with:

```text
PRD.md
ARCHITECTURE.md
```

These rules apply to developers and AI coding agents.

---

# 2. Project Definition

FindMyDoctor is a:

> **Mobile doctor appointment-booking, appointment-management, patient-secretary communication, and AI-assisted healthcare information application.**

Core workflow:

```text
Find Doctor
    ↓
Check Availability
    ↓
Book Appointment
    ↓
Manage Appointment
    ↓
Communicate with Secretary
    ↓
Use AI Assistant
    ↓
Visit
    ↓
Prescription
```

---

# 3. Core Architecture

Use:

```text
Mobile App
    ↓
REST API
    ↓
Modular Monolith Backend
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

The mobile application must **never connect directly to PostgreSQL**.

Correct:

```text
Mobile → Backend → PostgreSQL
```

---

# 4. Roles

Supported roles:

```text
PATIENT
DOCTOR
SECRETARY
CLINIC_STAFF
ADMIN
```

Do not create additional roles unless the requirements are explicitly updated.

---

# 5. Critical Communication Rule

This is one of the most important project requirements.

```text
Patient ↔ Secretary   YES
Patient ↔ AI          YES
Patient ↔ Doctor      NO
```

The system must **never provide direct patient-to-doctor chat**.

Do not create:

```text
doctor chat screens
doctor chat endpoints
doctor conversation tables
doctor messaging services
```

unless the PRD is explicitly changed.

---

# 6. Patient–Secretary Chat Rules

Patients may:

- Start conversations with authorized secretaries.
- Send messages.
- Receive replies.
- View conversation history.
- Ask appointment-related questions.
- Ask scheduling questions.
- Ask clinic-related questions.

Secretaries may:

- View authorized patient conversations.
- Reply to patients.
- View relevant appointment information.
- Assist with scheduling and clinic-related questions.

The backend must verify conversation membership on every protected operation.

---

# 7. AI Chatbot Rules

The AI chatbot is for:

> **General medical information and health-related education.**

Patients may ask about:

- General health concerns
- Symptoms
- Health topics
- General healthcare information
- When they may need professional medical attention

The AI is **not a doctor**.

---

# 8. AI Restrictions

The AI must not:

```text
Diagnose a patient
Prescribe medication
Change prescriptions
Replace professional medical advice
Claim certainty about a medical condition
Make clinical decisions
Pretend to be a doctor
```

The AI should clearly state its limitations when appropriate.

---

# 9. AI Safety Rule

AI responses should generally follow:

```text
User Question
     ↓
Validate
     ↓
Safety Processing
     ↓
AI
     ↓
Safety / Response Processing
     ↓
User
```

For potentially serious or emergency situations, the AI should encourage appropriate professional or emergency care.

---

# 10. AI Provider Security

The mobile app must never receive the AI provider API key.

Correct:

```text
Mobile
  ↓
Backend
  ↓
AI Provider
```

Incorrect:

```text
Mobile
  ↓
AI Provider
```

unless a future architecture explicitly defines a secure alternative.

---

# 11. AI Data Minimization

Do not automatically send all patient information to the AI provider.

Avoid sending:

```text
Full Medical History
Full Patient Record
Prescription Records
Unrelated Appointments
Other Patient Data
Authentication Secrets
Database Credentials
```

Only send information required for the current AI interaction.

---

# 12. Backend Architecture Rule

Use:

```text
API
 ↓
Service
 ↓
Domain Logic
 ↓
Repository
 ↓
PostgreSQL
```

Do not place major business logic inside mobile UI components or API controllers.

---

# 13. Module Rules

Use separate modules for:

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

Keep responsibilities separated.

---

# 14. Authentication Rules

All protected operations require authentication.

The backend must determine:

```text
Who is the user?
What role do they have?
What resource are they accessing?
Are they allowed to perform this action?
```

Never trust role information supplied by the mobile client.

---

# 15. Authorization Rules

### Patient

Can:

- Manage own appointments.
- Access own prescriptions.
- Chat with authorized secretaries.
- Use AI chatbot.

Cannot:

- Access another patient's data.
- Chat with doctors.
- Access another patient's conversation.

### Doctor

Can:

- Manage own schedule.
- View authorized appointments.
- View authorized patient information.
- Create prescriptions.

Cannot:

- Use patient-secretary chat as a patient.
- Obtain direct patient-chat functionality.

### Secretary

Can:

- Access authorized clinic conversations.
- Reply to patients.
- View relevant appointment information.

Cannot:

- Access unrelated clinic conversations.
- Perform doctor-only operations.

### Admin

Can:

- Manage users.
- Approve doctors.
- Approve clinics.
- Manage secretaries.
- Review basic appointment information.

---

# 16. Conversation Rules

A normal conversation contains:

```text
Patient
+
Secretary
+
Clinic
```

It must not contain:

```text
Doctor
```

as a participant in patient-secretary chat.

The database structure should reinforce this rule.

---

# 17. Message Rules

Every message must:

- Belong to a valid conversation.
- Have a valid sender.
- Be authorized by the backend.
- Be timestamped.
- Remain associated with its conversation.

Never allow a user to send a message simply by providing another user's ID.

---

# 18. Appointment Rules

Appointment availability must always be verified server-side.

Never trust:

```text
Frontend availability
```

Use:

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

# 19. Double-Booking Rule

Double booking is unacceptable.

Use:

- Transactions.
- Database constraints.
- Server-side checks.
- Appropriate locking/isolation.

Frontend checks are not sufficient.

---

# 20. Database Rules

PostgreSQL is the source of truth for persistent data.

Use:

- Foreign keys.
- Constraints.
- Indexes.
- Transactions.
- Migrations.

Do not bypass database integrity rules from application code.

---

# 21. Required Communication Tables

The architecture should support:

```text
conversations
messages
```

for patient-secretary communication.

AI conversations should use separate structures:

```text
ai_conversations
ai_messages
```

Do not combine AI chat and patient-secretary chat into the same conversation model unless the architecture is intentionally redesigned.

---

# 22. Doctor Chat Restriction

The following are prohibited by default:

```text
POST /doctor-chat
POST /doctors/:id/chat
GET  /doctor-conversations
doctor_id in patient-secretary conversation records
```

Do not accidentally create doctor messaging while implementing generic chat functionality.

---

# 23. API Rules

Use:

```text
/api/v1
```

Use resource-oriented endpoints.

Examples:

```text
GET  /doctors
POST /appointments
GET  /appointments/:id
GET  /conversations
POST /conversations/:id/messages
POST /ai/chat
```

Avoid unnecessary custom action endpoints when a resource-oriented approach is appropriate.

---

# 24. API Security Rule

Authorization must happen on the backend.

For example:

```text
GET /conversations/123
```

must verify that the authenticated user belongs to or is authorized for conversation `123`.

Never assume that knowing an ID grants access.

---

# 25. AI API Rules

AI requests should follow:

```text
Authenticate
 ↓
Validate
 ↓
Authorize
 ↓
Process Safety
 ↓
Call AI Provider
 ↓
Process Response
 ↓
Return Result
```

AI credentials must remain server-side.

---

# 26. Sensitive Data Rules

Treat these as sensitive:

```text
Patient information
Allergies
Medical history
Medications
Visit notes
Prescriptions
Patient-secretary messages
AI medical conversations
```

Do not expose sensitive data through:

- Public endpoints.
- Search results.
- Logs.
- URLs.
- Unprotected files.

---

# 27. Prescription Rules

Only authorized doctors can create prescriptions.

Patients can only access their own prescriptions.

Prescription PDFs must not be publicly accessible.

---

# 28. Validation Rules

Validate on:

```text
Mobile
 ↓
API
 ↓
Business Logic
 ↓
Database
```

Client-side validation improves UX.

Backend validation protects the system.

Database constraints protect data integrity.

---

# 29. Error Rules

Use predictable error codes:

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
SERVER_ERROR
```

Never expose:

```text
SQL statements
API keys
Stack traces
Internal secrets
Sensitive medical information
```

---

# 30. Logging Rules

Do not log:

```text
Passwords
API Keys
Authentication Tokens
Full Medical Histories
Full Prescription Contents
Sensitive Chat Contents
```

Log technical failures without exposing sensitive information.

---

# 31. Time Rules

Use:

```text
Asia/Manila
```

consistently for the target environment.

Be consistent with:

- Appointments
- Working hours
- Messages
- Notifications
- AI timestamps

---

# 32. Database Migration Rules

All schema changes must use migrations.

Required additions for the communication features may include:

```text
secretaries
conversations
messages
ai_conversations
ai_messages
```

Never manually modify shared database schemas without a migration.

---

# 33. Dependency Rules

Before adding a dependency:

1. Check whether the project already has a solution.
2. Confirm the dependency is necessary.
3. Avoid duplicate libraries.
4. Keep the architecture simple.

---

# 34. Avoid Overengineering

Do not introduce:

```text
Microservices
Kubernetes
Kafka
Complex Event Bus
CQRS
Event Sourcing
Multiple Databases
```

without a documented requirement.

Default:

```text
Mobile
 ↓
Modular Backend
 ↓
PostgreSQL
```

---

# 35. AI Coding Agent Rules

When an AI coding agent works on the project:

### Rule A — Read First

Inspect the existing implementation before making changes.

### Rule B — Follow the Documents

Follow:

```text
PRD.md
ARCHITECTURE.md
ARCHITECTURE-ESSENTIALS.md
```

### Rule C — Do Not Invent Requirements

Do not add features that are not required.

### Rule D — Preserve Communication Restrictions

Never accidentally introduce patient-doctor messaging.

### Rule E — Protect AI Credentials

Never expose AI API keys to the mobile application.

### Rule F — Protect Healthcare Data

Treat patient information, prescriptions, messages, and AI medical conversations as sensitive.

### Rule G — Keep Business Logic Server-Side

Do not implement critical authorization or appointment rules only on the mobile side.

### Rule H — Preserve Existing Patterns

Reuse existing project patterns before introducing new architecture.

### Rule I — Minimize Changes

Modify only what is necessary.

### Rule J — Test Before Finishing

Test affected features and related business rules.

---

# 36. Feature Implementation Checklist

Before completing a feature:

```text
[ ] Requirement exists in PRD
[ ] Correct role identified
[ ] Correct module identified
[ ] Mobile UI implemented
[ ] API implemented
[ ] Authorization implemented
[ ] Validation implemented
[ ] Business rules implemented
[ ] Database migration created if needed
[ ] Security reviewed
[ ] Error handling implemented
[ ] Tests added
[ ] Existing features checked
```

For communication features also verify:

```text
[ ] Patient ↔ Secretary works
[ ] Secretary ↔ Patient works
[ ] Patient ↔ Doctor remains blocked
```

For AI features also verify:

```text
[ ] AI credentials remain server-side
[ ] AI safety instructions are applied
[ ] AI does not claim to diagnose
[ ] AI errors are handled
[ ] Sensitive information is minimized
```

---

# 37. Source of Truth

When requirements conflict:

```text
Explicit Current Requirement
          ↓
PRD.md
          ↓
ARCHITECTURE.md
          ↓
ARCHITECTURE-ESSENTIALS.md
          ↓
Existing Implementation
```

A significant architectural change should be reflected in the documentation.

---

# 38. Final Golden Rules

```text
1. Mobile never connects directly to PostgreSQL.

2. Backend is the source of truth for business rules.

3. PostgreSQL is the source of truth for persistent data.

4. Never trust the mobile client.

5. Authorization must always be enforced on the backend.

6. Never allow appointment double booking.

7. Patients can chat with secretaries.

8. Secretaries can reply to patients.

9. Patients cannot directly chat with doctors.

10. Never create a doctor-chat endpoint unless the requirements explicitly change.

11. Patients can use the AI chatbot for general medical information.

12. The AI chatbot must never present itself as a doctor.

13. The AI chatbot must not provide definitive diagnosis or prescribe treatment.

14. AI credentials must remain on the backend.

15. Minimize sensitive data sent to external AI services.

16. Protect patient, prescription, message, and AI conversation data.

17. Use transactions for critical operations.

18. Use migrations for database changes.

19. Keep modules separated.

20. Avoid premature overengineering.

21. Follow the PRD before adding functionality.

22. Reuse existing project patterns.

23. Test critical scheduling, authorization, communication, and AI logic.

24. Keep the project an educational prototype, not a production EHR.
```

---

# 39. Architecture Mental Model

```text
                         PATIENT
                            │
             ┌──────────────┼───────────────┐
             │              │               │
             ▼              ▼               ▼
       APPOINTMENTS     SECRETARY       AI CHATBOT
             │            CHAT               │
             │              │               │
             ▼              ▼               ▼
         DOCTOR         SECRETARY      EXTERNAL AI
             │
             ▼
       PRESCRIPTIONS

                 Patient ──X── Doctor Chat
```

The core rule is:

> **FindMyDoctor allows patients to communicate with clinic secretaries and the AI chatbot, but direct patient-to-doctor chat is intentionally not supported.**