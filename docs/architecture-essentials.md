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
CLINIC_STAFF
ADMIN
```

Do not invent roles without changing the project requirements.

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
- Clinic questions.
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

Secretaries cannot access unrelated clinic conversations without authorization.

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
Make clinical decisions
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
Clinic Operating Hours
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
Static Clinic GCash QR
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
- Additional clinic services.
- Other applicable clinic fees.

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
5. Provide credentials through the designated clinic process.
6. Require password change during first login.
7. Block normal application access until the password is changed.

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
```

before creating a reservation.

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
users
patients
doctors
clinics
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
```

---

# 32. API Rules

Use:

```text
/api/v1
```

Do not expose database access directly to the mobile app.

All important operations must pass through backend authorization and validation.

---

# 33. Doctor Chat Restriction

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

# 34. AI Coding Agent Rules

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

---

# 35. Feature Implementation Checklist

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
```

---

# 36. Avoid Overengineering

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

# 37. Naming Rules

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

# 38. Error Rules

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

# 39. Logging Rules

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

# 40. Final Golden Rules

```text
1. Mobile never connects directly to PostgreSQL.

2. Backend is the source of truth for business rules.

3. PostgreSQL is the source of truth for persistent data.

4. Default consultation duration is 30 minutes.

5. Capacity considers availability, clinic hours, breaks, and consultation duration.

6. Doctor and authorized secretary may configure a lower daily capacity.

7. Online and walk-in patients share one daily capacity.

8. Online and walk-in patients share one unified queue.

9. Queue priority is based on successful registration time.

10. Registration source does not affect queue priority.

11. Regular reservations do not require advance payment.

12. GCash uses a static clinic QR code.

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
```

---

# 41. Architecture Mental Model

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