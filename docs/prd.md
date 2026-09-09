# FindMyDoctor — Product Requirements Document

## 1. Product Overview

### Product Name

**FindMyDoctor**

### Product Type

Mobile doctor appointment-booking, patient queue-management, clinic communication, payment-recording, and AI-assisted healthcare information platform.

### Product Purpose

FindMyDoctor is an educational healthcare appointment-management prototype designed to connect patients, doctors, secretaries, and clinics through a centralized mobile application.

Patients can search for doctors, view doctor profiles and availability, reserve consultation schedules, receive queue numbers, manage appointments, communicate with clinic secretaries, use an AI chatbot for general medical concerns, and access their consultation and prescription history.

Doctors can manage their availability, daily patient capacity, appointments, patient information, visit history, and digital prescriptions.

Secretaries are responsible for clinic-side operations such as walk-in registration, daily queue management, patient communication, payment verification, daily capacity management, and appointment-related assistance.

Administrators manage users, doctors, clinics, secretaries, approvals, and basic platform information.

### Core Workflow

**Find a Doctor → Check Availability → Reserve a Schedule → Receive Queue Number → Attend Consultation → Manage Medical/Payment Records**

### Patient Communication

The platform provides two patient communication channels:

- **Patient ↔ Secretary** — allowed for appointment, schedule, clinic, and related concerns.
- **Patient ↔ AI Chatbot** — allowed for general medical information and concerns.

Patients **cannot directly chat with doctors** through the application.

### Project Scope

FindMyDoctor is an **educational appointment-management prototype**.

It is not intended to replace:

- A hospital information system
- A production Electronic Health Record (EHR)
- Professional medical consultation
- Professional diagnosis
- A production payment-processing system

---

# 2. Problem Statement

Patients often need to call clinics to:

- Ask whether a doctor is available.
- Ask about clinic schedules.
- Determine available appointment times.
- Ask about consultation fees.
- Reserve an appointment.
- Ask questions about an existing reservation.

Clinics may also rely on manual processes for:

- Appointment scheduling.
- Walk-in registration.
- Daily patient queues.
- Patient capacity monitoring.
- Payment verification.
- Patient inquiries.
- Consultation records.

Patients may additionally have general health questions but may not immediately know whether professional consultation is necessary.

FindMyDoctor addresses these problems through a centralized mobile application that combines:

- Doctor discovery.
- Online reservations.
- Daily patient capacity.
- Unified online and walk-in queue management.
- Patient-secretary communication.
- Optional GCash payment.
- Consultation and medical history.
- AI-based general medical information.

---

# 3. Product Goals

## 3.1 Primary Goals

FindMyDoctor should:

1. Allow patients to discover doctors.
2. Display doctor and clinic information.
3. Display doctor availability.
4. Calculate or configure daily patient capacity.
5. Allow patients to reserve consultation schedules without mandatory advance payment.
6. Assign queue numbers to online and walk-in patients.
7. Maintain one unified daily queue.
8. Allow secretaries to manage the daily queue.
9. Allow secretaries to register walk-in patients.
10. Allow patients to communicate with secretaries.
11. Allow patients to use an AI chatbot for general medical concerns.
12. Allow doctors to manage schedules and capacity.
13. Allow doctors to manage appointments and consultation records.
14. Allow doctors to create digital prescriptions.
15. Allow optional GCash advance payment through a static clinic QR code.
16. Allow secretaries to verify GCash receipts.
17. Maintain patient payment information and additional charges.
18. Maintain consultation and medical history.
19. Allow patients to access their records and prescriptions according to permissions.
20. Provide administrators with platform-management capabilities.

---

# 4. Non-Goals

The following are outside the initial scope:

- Direct patient-to-doctor chat.
- AI diagnosis.
- AI prescribing medication.
- AI replacing a doctor.
- AI making clinical decisions.
- Real-time video consultations.
- Emergency medical services.
- Full hospital management.
- Full production EHR functionality.
- Direct GCash API integration.
- Automatic GCash transaction verification.
- Insurance claim processing.
- Laboratory management.
- Pharmacy management.
- Medical-device integration.

The AI chatbot is an informational feature and does not replace professional medical care.

---

# 5. Target Users

## 5.1 Patient

Patients can:

- Search for doctors.
- View doctor profiles.
- Check availability.
- Reserve consultations.
- Receive queue numbers.
- View the daily queue position where supported.
- Cancel eligible reservations.
- Reschedule eligible reservations.
- Join waitlists.
- Chat with secretaries.
- Use the AI chatbot.
- Upload GCash payment receipts.
- View payment status.
- View consultation history.
- View available medical records.
- View prescription history.
- Access prescription PDFs.
- Receive notifications.

## 5.2 Doctor

Doctors can:

- Manage their profile.
- Manage working hours.
- Manage availability.
- Configure daily patient capacity.
- View appointments.
- View queue information where authorized.
- View authorized patient information.
- View consultation history.
- Record visit information.
- Create digital prescriptions.

Doctors do not directly chat with patients.

## 5.3 Secretary

Secretaries can:

- Manage patient-secretary conversations.
- Answer patient questions.
- Register walk-in patients.
- Locate existing patient accounts.
- Create patient accounts.
- Manage daily patient capacity where authorized.
- Manage the unified queue.
- Call patients.
- Skip or mark patients as not present.
- Start checkups.
- Complete checkups.
- Manage cancellations and no-shows.
- Review GCash payment receipts.
- Verify payments.
- Manage consultation payment status.
- Add additional charges.
- View necessary patient information according to permissions.

## 5.5 Administrator

Administrators can manage:

- Users.
- Doctors.
- Secretaries.
- Clinics.
- Approvals.
- Basic appointment information.

---

# 6. User Roles and Permissions

| Role | Main Responsibilities |
|---|---|
| Patient | Search, reserve, manage appointments, use queue, chat with secretary, use AI, access own records |
| Doctor | Manage schedule/capacity, appointments, patient information, visits, prescriptions |
| Secretary | Walk-ins, queue, patient chat, payment verification, daily operations |
| Admin | Users, doctors, secretaries, clinics, approvals, platform oversight |

### Communication Permissions

| Sender | Recipient | Allowed |
|---|---|---|
| Patient | Secretary | Yes |
| Secretary | Patient | Yes |
| Patient | AI Chatbot | Yes |
| AI Chatbot | Patient | Yes |
| Patient | Doctor | **No** |
| Doctor | Patient | **No direct chat** |

---

# 7. Doctor and Clinic Information

Each doctor profile should include:

- Doctor name.
- Specialty.
- Credentials.
- Biography.
- Consultation/checkup fee.
- Clinic.
- Clinic location.
- Availability.

Each clinic may contain:

- Clinic name.
- Address.
- Location (latitude and longitude coordinates).
- Map display (embedded map view of the clinic location).
- Contact information.
- Description.
- Doctors.
- Secretaries.

---

# 8. Doctor Availability and Daily Capacity

The system shall manage patient bookings based on:

- Doctor availability.
- Clinic operating hours.
- Break periods.
- Consultation duration.
- Configured daily patient capacity.

### Default Consultation Duration

The default estimated consultation duration shall be:

**30 minutes**

### Example Capacity Calculation

If the doctor has:

- 8 working hours.
- 30-minute consultation duration.
- No break periods.

The estimated capacity is:

**8 hours ÷ 0.5 hour = 16 patients**

The system may calculate this as the estimated daily capacity.

### Configured Capacity

The doctor and authorized secretary may configure a lower maximum patient capacity for a particular date.

The configured limit shall override the calculated capacity when it is lower.

### Final Daily Capacity

The final allowed capacity is the effective maximum used for the daily queue.

---

# 9. Appointment and Reservation Rules

Patients may reserve regular consultation schedules without advance payment.

Payment is **not required** for a successful regular reservation.

A reservation is successful when the system:

1. Validates the doctor.
2. Validates the schedule.
3. Validates capacity.
4. Validates the selected consultation period.
5. Confirms no conflicting reservation exists.
6. Creates the reservation.
7. Assigns the patient a queue number.
8. Adds the patient to the unified daily queue.
9. Updates the remaining daily capacity.
10. Displays the queue confirmation.

Example:

> **"You are number 1 in the queue for that day. Please come early. Thank you."**

---

# 10. Unified Daily Patient Queue

FindMyDoctor shall maintain one unified queue for:

- Online patients.
- Walk-in patients.

Online and walk-in patients have equal queue priority.

### Queue Number Assignment

Queue numbers are assigned sequentially based on the successful time of registration.

Example:

| Time | Source | Queue |
|---|---|---:|
| 9:01 AM | Online | 1 |
| 9:05 AM | Walk-in | 2 |
| 9:08 AM | Online | 3 |

The registration source must not affect queue priority.

### Registration Source

Each queue record must store:

- `ONLINE`
- `WALK_IN`

The source is used for monitoring and reporting only.

---

# 11. Daily Capacity and Queue Relationship

Every registered patient consumes one unit of daily capacity.

Example:

```text
Daily Capacity = 10

Online Patient registered
Remaining = 9

Walk-in Patient registered
Remaining = 8
```

When:

```text
Registered Patients >= Final Daily Capacity
```

the schedule becomes:

**FULL**

The system must prevent additional regular online bookings and walk-in registrations for that date.

---

# 12. Walk-in Registration

Patients who do not use the application or prefer to visit the clinic directly may register as walk-ins.

The secretary can:

1. Search for the patient.
2. Use an existing account if found.
3. Create an account if none exists.
4. Select the appropriate doctor.
5. Select the appropriate date/schedule.
6. Check remaining capacity.
7. Register the patient.
8. Assign a queue number.
9. Add the patient to the unified queue.

Walk-in registration follows the same daily capacity rules as online reservation.

---

# 13. Walk-in Account Creation

When a walk-in patient does not have an account:

1. The secretary collects the patient's email address.
2. The email becomes the patient's username/login identifier.
3. The system generates a random temporary password containing characters and numbers.
4. The credentials are provided to the patient through the clinic's designated process.
5. The account is marked as requiring a password change.
6. At first login, the patient must change the generated password.
7. The patient cannot access normal application features until the password is changed.

The generated patient account becomes the permanent identity used for:

- Booking history.
- Consultation history.
- Medical history.
- Payment information.
- Prescriptions.
- Other authorized patient information.

---

# 14. Queue Management

The secretary shall manage the daily queue.

The system should provide controls including:

- **Next Patient**
- **Start Checkup**
- **Skip / Not Present**
- **Complete Checkup**

### Example

Queue:

```text
1. Patient 1
2. Patient 2
3. Patient 3
```

If Patient 1 is called but is not present:

```text
Patient 1 → Not Present / Skipped
Patient 2 → Active
Patient 3 → Waiting
```

If Patient 2 is also unavailable:

```text
Patient 1 → Not Present / Skipped
Patient 2 → Not Present / Skipped
Patient 3 → Active
```

A skipped or temporarily unavailable patient shall not automatically lose their queue record.

---

# 15. Queue Status

Possible queue statuses:

- Waiting
- Called
- Not Present
- Skipped
- In Checkup
- Completed
- Cancelled
- No-show

The clinic may refine these statuses according to operational procedures.

---

# 16. Secretary–Patient Chat

Patients can communicate with secretaries regarding:

- Appointment time.
- Schedule questions.
- Clinic information.
- Reservation concerns.
- Queue-related questions.
- Other appropriate clinic concerns.

Secretaries can:

- View authorized patient conversations.
- Reply to patients.
- View relevant appointment information.
- Assist patients.

### Communication Restriction

Patients cannot directly communicate with doctors through chat.

The platform must not provide a patient-doctor chat workflow.

---

# 17. AI Medical Chatbot

FindMyDoctor shall provide an AI chatbot for general medical information.

Patients may ask about:

- General symptoms.
- General health concerns.
- Health information.
- General healthcare topics.
- Whether professional medical attention may be appropriate.

The AI should:

- Provide general informational responses.
- Explain limitations.
- Encourage professional medical consultation where appropriate.
- Encourage emergency care for potentially urgent situations.

The AI must not:

- Claim to be a doctor.
- Provide definitive diagnosis.
- Prescribe medication.
- Change prescriptions.
- Make treatment decisions.
- Replace professional consultation.

---

# 18. Consultation Payment

Each doctor shall have a consultation/checkup fee.

Patients may choose to pay in advance using GCash.

Advance payment is optional.

A successful reservation must not depend on payment.

---

# 19. GCash Payment

Because the system does not have a GCash payment API, the clinic shall use a static/default GCash QR code.

Patients may:

1. View the clinic's GCash QR code.
2. Scan the QR code using GCash.
3. Download/save the QR code if supported.
4. Make the payment externally.
5. Upload the GCash payment receipt through the application.

The system shall initially mark the uploaded receipt as:

**Pending Verification**

The secretary shall review the receipt.

When the receipt is accepted:

**Paid**

If invalid:

**Rejected**

Receipt upload must not automatically mean payment is valid.

---

# 20. Payment Status

Recommended statuses:

- Unpaid
- Pending Verification
- Paid
- Rejected

Each applicable consultation shall have a payment status.

Walk-in patients may pay after consultation, with the secretary responsible for confirming payment.

---

# 21. Additional Charges

The secretary may add additional applicable charges such as:

- Prescribed medicine.
- Additional services.
- Other clinic charges.

The system shall calculate:

**Consultation Fee + Additional Charges = Total Amount Due**

---

# 22. Medical and Consultation History

When a consultation is completed, the consultation and medical information shall be associated with the patient's account.

Records may include:

- Patient information.
- Doctor.
- Consultation date.
- Reason for visit.
- Visit notes.
- Medical history.
- Prescriptions.
- Payment information.

Walk-in patients must use the account created during registration so that their future application access remains linked to their existing history.

---

# 23. Prescription Management

Doctors can create digital prescriptions.

A prescription may contain:

- Patient.
- Doctor.
- Date.
- Medication.
- Dosage.
- Frequency.
- Duration.
- Instructions.
- Additional notes.

Patients can access their prescription history and prescription PDFs.

---

# 24. Notifications

Notifications may be generated for:

- Reservation confirmation.
- Queue information.
- Reservation cancellation.
- Rescheduling.
- New secretary message.
- Prescription availability.
- Payment verification.
- Waitlist updates.

---

# 25. Functional Requirements

## FR-001 — Registration

The system shall allow users to register accounts.

## FR-002 — Authentication

The system shall authenticate users before protected access.

## FR-003 — Role-Based Access

The system shall enforce role-based permissions.

## FR-004 — Doctor Search

Patients shall be able to search for doctors.

## FR-005 — Doctor Profiles

The system shall display doctor information.

## FR-006 — Availability

The system shall display available consultation schedules.

## FR-007 — Consultation Duration

The default estimated consultation duration shall be 30 minutes.

## FR-008 — Capacity Calculation

The system shall calculate estimated daily capacity from available consultation time and consultation duration.

## FR-009 — Configured Capacity

The doctor and authorized secretary shall be able to configure a daily maximum.

## FR-010 — Capacity Override

The configured lower maximum shall override calculated capacity.

## FR-011 — Reservation Without Payment

Patients shall be able to reserve a regular consultation without advance payment.

## FR-012 — Queue Number

Successful online and walk-in registrations shall receive sequential queue numbers.

## FR-013 — Unified Queue

Online and walk-in patients shall use the same daily queue.

## FR-014 — Queue Priority

Registration source shall not affect queue priority.

## FR-015 — Capacity Update

The system shall update remaining capacity after each successful registration.

## FR-016 — Full Schedule

The system shall prevent additional regular bookings and walk-in registrations when capacity is full.

## FR-017 — Walk-in Registration

Secretaries shall be able to register walk-in patients.

## FR-018 — Walk-in Account

The system shall create an account for a walk-in patient without an existing account.

## FR-019 — Temporary Password

The system shall generate a random temporary password for newly created walk-in accounts.

## FR-020 — First Login Password Change

The patient shall be required to change the temporary password before using normal application functionality.

## FR-021 — GCash QR

The system shall display the static clinic GCash QR code.

## FR-022 — Receipt Upload

Patients shall be able to upload GCash payment receipts.

## FR-023 — Payment Verification

Uploaded receipts shall initially be marked Pending Verification.

## FR-024 — Secretary Verification

Authorized secretaries shall verify uploaded receipts.

## FR-025 — Payment Status

The system shall maintain consultation payment status.

## FR-026 — Additional Charges

Secretaries shall be able to add additional charges.

## FR-027 — Total Amount

The system shall calculate consultation fees plus additional charges.

## FR-028 — Queue Management

Secretaries shall be able to manage the daily queue.

## FR-029 — Queue Actions

The system shall provide Next Patient, Start Checkup, Skip/Not Present, and Complete Checkup actions.

## FR-030 — Queue Preservation

Skipped patients shall remain recorded in the queue.

## FR-031 — Patient-Secretary Chat

Patients and authorized secretaries shall be able to exchange messages.

## FR-032 — Doctor Chat Restriction

Patients shall not be able to directly chat with doctors.

## FR-033 — AI Chatbot

Patients shall be able to communicate with the AI chatbot.

## FR-034 — AI Safety

The AI chatbot shall not claim to diagnose, prescribe, or replace professional care.

## FR-035 — Consultation History

Completed consultations shall be recorded in the patient's history.

## FR-036 — Medical Record Association

Medical records shall remain associated with the correct patient account.

## FR-037 — Prescription Creation

Doctors shall be able to create digital prescriptions.

## FR-038 — Prescription PDF

The system shall generate prescription PDFs.

## FR-039 — Notifications

The system shall provide relevant application notifications.

## FR-040 — Doctor Approval

Administrators shall be able to approve/reject doctors.

## FR-041 — Clinic Approval

Administrators shall be able to approve/reject clinics.

## FR-042 — Secretary Management

Administrators shall be able to manage secretary accounts and clinic associations.

## FR-043 — Clinic Map

The system shall display an embedded map view of the clinic's location on the clinic and doctor profile pages so that patients can easily locate the clinic.

The clinic record shall store latitude and longitude coordinates.

The map view is read-only for patients. Only administrators may update clinic location coordinates.

---

# 26. Core User Stories

### Patient — Reservation

**As a patient,** I want to reserve a consultation without paying in advance so that I can secure my queue position even if I plan to pay later.

### Patient — Queue

**As a patient,** I want to receive a queue number after successful reservation so that I know my position for the day.

### Patient — Secretary Chat

**As a patient,** I want to chat with the clinic secretary so that I can ask questions about my appointment, schedule, or clinic.

### Patient — AI

**As a patient,** I want to ask an AI chatbot about a medical concern so that I can receive general health information.

### Patient — GCash

**As a patient,** I want to pay the consultation fee through GCash and upload my receipt so that I can request advance payment verification.

### Patient — History

**As a patient,** I want my consultation history to remain connected to my account so that I can review my previous healthcare visits.

### Secretary — Walk-in

**As a secretary,** I want to register walk-in patients into the same queue as online patients so that all patients are managed fairly.

### Secretary — Queue

**As a secretary,** I want to call, skip, and update patients so that I can manage the daily clinic queue.

### Secretary — Payment

**As a secretary,** I want to review GCash receipts and confirm payment so that payment records remain accurate.

### Secretary — Capacity

**As a secretary,** I want to configure the daily patient limit so that the clinic does not exceed its capacity.

### Doctor — Capacity

**As a doctor,** I want to configure how many patients I can accommodate on a specific day so that the daily queue matches my workload.

### Patient — Clinic Map

**As a patient,** I want to view the clinic's location on a map so that I can easily find out where the clinic is before my appointment.

---

# 27. User Flows

## Online Reservation

```text
Patient
  ↓
Search Doctor
  ↓
View Doctor
  ↓
Select Date
  ↓
Check Capacity
  ↓
Select Available Consultation
  ↓
Confirm Reservation
  ↓
Assign Queue Number
  ↓
Add to Unified Queue
  ↓
Update Remaining Capacity
  ↓
Show Queue Confirmation
  ↓
Optional GCash Payment
```

## Walk-in

```text
Patient Arrives
  ↓
Secretary Searches Patient
  ↓
Existing Account?
 ├── Yes → Use Existing Account
 └── No
      ↓
   Create Account
      ↓
   Generate Temporary Password
      ↓
   Provide Credentials
  ↓
Select Doctor
  ↓
Check Capacity
  ↓
Register
  ↓
Assign Queue Number
  ↓
Unified Queue
```

## GCash

```text
View Consultation Fee
  ↓
View Static GCash QR
  ↓
Pay Through GCash
  ↓
Upload Receipt
  ↓
Pending Verification
  ↓
Secretary Reviews
 ├── Valid → Paid
 └── Invalid → Rejected
```

## Queue

```text
Daily Queue
  ↓
Next Patient
  ↓
Call Patient
  ↓
Present?
 ├── Yes → Start Checkup
 │             ↓
 │        Complete Checkup
 │
 └── No → Skip / Not Present
              ↓
         Remains Recorded
```

## Patient-Secretary Chat

```text
Patient
  ↓
Open Chat
  ↓
Select / Create Secretary Conversation
  ↓
Send Message
  ↓
Secretary Receives
  ↓
Secretary Replies
  ↓
Conversation History
```

## AI Chat

```text
Patient
  ↓
Open AI Chat
  ↓
Ask Medical Question
  ↓
Backend
  ↓
Safety Processing
  ↓
AI Provider
  ↓
Response Processing
  ↓
Patient
```

## Clinic Map

```text
Patient
  ↓
View Doctor Profile or Clinic Profile
  ↓
View Clinic Location Section
  ↓
Embedded Map Displays Clinic Pin
  ↓
Patient Views Address and Directions
```

---

# 28. MVP Scope

### Patient

- Registration/login.
- Doctor search.
- Doctor profiles.
- Clinic location map view.
- Availability.
- Reservation without mandatory payment.
- Queue number.
- Unified queue visibility.
- Appointment management.
- Secretary chat.
- AI chatbot.
- GCash QR.
- Receipt upload.
- Payment status.
- Consultation history.
- Prescription history.
- Prescription PDFs.
- Notifications.

### Doctor

- Profile.
- Schedule.
- Availability.
- Daily capacity.
- Appointments.
- Authorized patient information.
- Consultation history.
- Prescription creation.

### Secretary

- Patient chat.
- Walk-in registration.
- Account creation.
- Daily capacity management.
- Queue management.
- Patient calling.
- Payment verification.
- Additional charges.
- Cancellation/no-show management.

### Administrator

- User management.
- Doctor management.
- Secretary management.
- Clinic management.
- Approvals.
- Basic appointment monitoring.

---

# 29. Success Criteria

The system is successful when:

1. Patients can find doctors.
2. Patients can view doctor availability.
3. Patients can reserve without advance payment.
4. The system correctly calculates/configures daily capacity.
5. Online and walk-in patients share one queue.
6. Queue numbers are sequential.
7. Registration source does not affect priority.
8. The system stops registration when capacity is full.
9. Secretaries can register walk-in patients.
10. Walk-in patients receive proper generated accounts.
11. Temporary passwords must be changed on first login.
12. Patients can upload GCash receipts.
13. Secretaries can verify payments.
14. Additional charges can be recorded.
15. Secretaries can manage the daily queue.
16. Patients can chat with secretaries.
17. Patients cannot chat with doctors.
18. Patients can use the AI chatbot.
19. AI does not present itself as a doctor or diagnose patients.
20. Consultation history remains linked to patient accounts.
21. Doctors can create prescriptions.
22. Patients can access authorized prescription records.
23. Role-based access works correctly.
24. Sensitive healthcare information remains protected.

---

# 30. Product Principles

### Simplicity

Booking, queue management, secretary communication, and AI assistance should be easy to understand.

### Fair Queueing

Online and walk-in patients use the same queue and receive equal treatment.

### Payment Flexibility

Patients can reserve without advance payment while still having the option to pay through GCash.

### Security

Patient, payment, medical, prescription, and conversation data must be protected.

### Communication Boundaries

Patients communicate with secretaries for clinic concerns and with AI for general medical information. Direct patient-doctor chat is excluded.

### AI Responsibility

AI is informational only and must clearly communicate its limitations.

### Data Integrity

Appointments, queues, payments, medical history, and prescriptions must remain consistent.

### Educational Focus

The platform demonstrates realistic appointment and clinic-management workflows without attempting to become a production EHR.

---

# 31. Final Product Definition

FindMyDoctor is a mobile appointment and clinic-management platform centered around:

**Find Doctor → Check Availability → Reserve → Queue → Consult → Record → Prescription**

Supporting workflows include:

**Patient ↔ Secretary**

for clinic communication,

**Patient ↔ AI**

for general medical information,

and:

**Patient ↔ Doctor**

is intentionally **not supported as direct chat**.

The application combines online reservations and walk-in registrations into one daily queue while allowing optional GCash advance payment and maintaining patient consultation history.