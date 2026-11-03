# FindMyDoctor — Product Requirements Document

## 1. Product Overview

### Product Name

**FindMyDoctor**

### Product Type

Mobile doctor appointment-booking, patient queue-management, healthcare communication, payment-recording, and AI-assisted healthcare information platform.

### Product Purpose

FindMyDoctor is an educational healthcare appointment-management prototype designed to connect patients, doctors, and secretaries through a centralized mobile application.

Patients can search for doctors, view doctor profiles and availability, reserve consultation schedules, receive queue numbers, manage appointments, communicate with secretaries, use an AI chatbot for general medical concerns, and access their consultation and prescription history.

Doctors can manage their availability, daily patient capacity, appointments, patient information, visit history, and digital prescriptions.

Secretaries are responsible for operational tasks such as walk-in registration, daily queue management, patient communication, payment verification, daily capacity management, day-to-day exception and break-period changes, and appointment-related assistance.

Administrators manage users, doctors, secretaries, and approvals.

### Core Workflow

**Find a Doctor → Check Availability → Reserve a Schedule → Receive Queue Number → Attend Consultation → Manage Medical/Payment Records**

### Patient Communication

The platform provides two patient communication channels:

- **Patient ↔ Secretary** — allowed for appointment, schedule, and related concerns.
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

Patients often need to call to:

- Ask whether a doctor is available.
- Ask about schedules.
- Determine available appointment times.
- Ask about consultation fees.
- Reserve an appointment.
- Ask questions about an existing reservation.

They may also rely on manual processes for:

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
2. Display doctor information.
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
15. Allow optional GCash advance payment through a static QR code.
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
- AI making medical decisions.
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
- Manage date-specific exceptions and break periods.
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
- View their assigned doctor's weekly working hours without changing them.
- Add, edit, and delete date-specific exceptions and break periods for their assigned doctor.
- Configure daily patient capacity for their assigned doctor.
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
- Generate invoices for paid payments.
- Void and reissue invoices to correct errors (voided invoices remain in audit trail but are not downloadable).
- View necessary patient information according to permissions.

## 5.5 Administrator

Administrators can manage:

- Users.
- Doctors.
- Secretaries.
- Approvals.
- Platform-level account and approval oversight.

Administrators do not participate in clinic or consultation operations. They must not manage doctor working hours, availability, break periods, daily capacity, reservations, the operational queue, payment verification, or consultation records. Those responsibilities belong to doctors and authorized secretaries.

---

# 6. User Roles and Permissions

| Role | Main Responsibilities |
|---|---|
| Patient | Search, reserve, manage appointments, use queue, chat with secretary, use AI, access own records |
| Doctor | Manage schedule/capacity, appointments, patient information, visits, prescriptions |
| Secretary | Walk-ins, queue, patient chat, payment verification, daily operations |
| Admin | Users, doctors, secretaries, approvals, platform oversight; no clinic or consultation operations |

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

# 7. Doctor Information

Each doctor profile should include:

- Doctor name.
- Specialty.
- Credentials.
- Biography.
- Consultation/checkup fee.
- Availability.
- Professional photo (PNG, max 4MB, stored in Supabase Storage).
- Clinic/practice name, address, and room number.
- Years of experience.
- Areas of expertise.
- Languages spoken.

The patient-facing profile is available only to authenticated patients and only for active, approved doctors with active accounts. It shall not display the doctor's email address, contact number, PRC license number, approval status, account status, queue contents, or any other patient's data. Empty optional sections are hidden, except the Schedule section which is always shown regardless of today's availability to allow patients to view the doctor's weekly working days and hours and plan future bookings.

**Photo Storage:**
- Doctor professional photos are stored in Supabase Storage bucket `doctor-photos`
- Photos are served via Supabase public URLs
- PNG format only, maximum 4MB file size
- Server-side validation for file type, size, and PNG magic number signature
- Legacy `/uploads/` URLs supported for existing photos (backward compatibility)

---

# 8. Doctor Availability and Daily Capacity

The system shall manage patient bookings based on:

- Doctor availability.
- Operating hours.
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

The doctor and an authorized secretary may configure a lower maximum patient capacity for a particular date. A secretary may configure capacity only for their assigned doctor.

The configured limit shall override the calculated capacity when it is lower.

### Final Daily Capacity

The final allowed capacity is the effective maximum used for the daily queue.

### Schedule Management Permissions

Doctors may create, edit, and delete weekly working hours, exceptions, and break periods. Secretaries may view weekly working hours but may not create, edit, or delete them. A secretary may add, edit, and delete date-specific exceptions and break periods only for their assigned doctor, and may configure capacity for that doctor.

Schedule changes must follow the doctor schedule validation rules: start <= end, breaks must fall within working hours, and breaks must not overlap. Before saving an exception or break-period change that affects dates with active appointments, the system must show the secretary or doctor the number of affected appointments and require explicit confirmation. After confirmation, the change is saved and affected patients are notified through the notification module. Appointments are not automatically cancelled; the secretary handles them through the existing cancel and reschedule flows.

---

# 9. Appointment and Reservation Rules

Patients may reserve regular consultation schedules without advance payment.

Payment is **not required** for a successful regular reservation.

### Doctor-Specific Patient Record Check

When a patient selects a doctor and proceeds with appointment booking, the system must check whether that patient already has an existing record associated with the selected doctor.

**Backend API Endpoints:**
- `GET /api/v1/patients/check-record?doctorId={id}` - Patient-only endpoint to check if they have an existing record with the selected doctor
- `POST /api/v1/patients/submit-details` - Patient-only endpoint to submit required details for a specific doctor before first booking
- `GET /api/v1/patients/me` - Patient-only endpoint to view their own profile
- `PUT /api/v1/patients/me` - Patient-only endpoint to update their own profile (requires authentication)
- `GET /api/v1/patients/doctor/:doctorId` - Doctor-only endpoint to list all patients who have associations or appointments with them
- `GET /api/v1/patients/search` - Secretary-only endpoint to search patients by email, phone, or name for walk-in registration (restricted to assigned doctor's patients)
- `GET /api/v1/patients/:id` - Doctor and Secretary endpoint to view specific patient details (with role-based authorization)

**Check Criteria:**
- The system must verify if the patient has a prior relationship with the selected doctor (such as a previous appointment, completed consultation, or submitted patient details).
- Having an account or a record with another doctor must not automatically count as having an existing record with the selected doctor.
- The check must use the patient's authenticated account and the selected doctor's identity.
- The backend queries the `patient_doctor_associations` table for persistent associations, with fallback to the `appointments` table for backward compatibility.

**If No Existing Record:**
- The system must prompt the patient to fill out the required personal details before proceeding with the booking.
- Required fields: first name (required), middle name (optional), last name (required), date of birth (required), sex (required: MALE, FEMALE, OTHER, NOT_SPECIFIED), mobile number (required), address (required)
- Optional fields: emergency contact name, emergency contact phone, medical history, allergies, current medications
- After the patient submits the required details via `POST /api/v1/patients/submit-details`, the system saves them in the `patients` table and creates a persistent association in the `patient_doctor_associations` table.
- The patient must be allowed to continue booking without restarting the process after successful save.

**If Existing Record Exists:**
- The patient may proceed directly with booking without filling out the same details again.
- The system must not create duplicate patient accounts or duplicate doctor-patient records unnecessarily.

**Patient Details Storage and Access:**
- Doctors view and manage patient details on the Doctor Dashboard at `/doctor/patients/`
- Doctors can also view patient details within appointment records at `/doctor/appointments/:id`
- Secretaries save patient details during walk-in registration at `/secretary/walk-ins/`
- Secretaries view and search patient details at `/secretary/patients/` (restricted to their assigned doctor's patients)
- Patient details are also shown contextually in the queue view at `/secretary/queue/`
- All patient details operations must go through the backend REST API; mobile and web applications must not connect directly to PostgreSQL

### Reservation Success Criteria

A reservation is successful when the system:

1. Validates the doctor.
2. Validates the schedule.
3. Validates capacity.
4. Validates the selected date.
5. Confirms no conflicting reservation exists for the same date.
6. Validates that the patient has an existing record with the selected doctor or collects required details if none exists.
7. Creates the reservation.
8. Assigns the patient a queue number.
9. Adds the patient to the unified daily queue.
10. Updates the remaining daily capacity.
11. Displays the queue confirmation.

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

Patients who do not use the application or prefer to visit directly may register as walk-ins.

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
4. The credentials are provided to the patient through the designated process.
5. The account is marked as requiring a password change.
6. At first login, the patient must change the generated password.
7. The patient cannot access normal application features until the password is changed.
8. After successful password change, the patient views onboarding screens before accessing the application (same as regular app registration).

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

The platform may refine these statuses according to operational procedures.

---

# 16. Secretary–Patient Chat

Patients can communicate with secretaries regarding:

- Appointment time.
- Schedule questions.
- Information.
- Reservation concerns.
- Queue-related questions.
- Other appropriate concerns.

Secretaries can:

- Review authorized patient conversations.
- Reply to patients.
- View relevant appointment information.
- Assist patients.
- Answer patients through the Secretary Web Dashboard chat at `/secretary/conversations` or the shared patient/secretary mobile application.

### Shared Patient and Secretary Mobile Application

Patients and secretaries use the same mobile application and the same credentials as the web dashboards. After authentication the backend-returned `User.role` determines the experience:

- The authenticated `role` field is the single source of truth; secretaries sign in with the same username and password as the secretary web dashboard.
- Secretaries are routed to a chat-first secretary home (`/secretary-home`) containing the conversation list, last-message previews, and unread counts, while patients continue to the existing patient home with Home, Doctors, Appointments, and Chat tabs.
- The mobile secretary experience reuses the shared conversation thread and the same backend conversations, messages, read status, unread counts, and latest-message previews as the secretary web chat, so both interfaces stay synchronized.
- Secretaries assigned to the same doctor share access to the same authorized conversations and message history.
- The mobile application adds no separate credential system; authentication, authorization, and role checks remain enforced on the backend as well as through mobile navigation.

### Shared Conversation Access

A conversation belongs to one patient and one doctor:

- Each patient has a single conversation per doctor. Creating or retrieving a conversation reuses the existing conversation and message records; per-secretary duplicate histories are never created.
- All secretaries assigned to the same doctor (`secretaries.doctor_id`) share access to the relevant patient conversations of that doctor and write to the same message history.
- A patient may access only their own conversations and only for a doctor with whom they have a matching `patient_doctor_associations` record.
- A secretary may access conversations only for patients associated with their assigned doctor; access checks are enforced on listing, creation, retrieval, message retrieval, sending, and read-status updates.

### Read Status and Previews

- Message read status is tracked by `messages.read_at`.
- Conversation-list results include an unread count computed from `read_at` and excluding the current user's own sent messages, plus a latest-message preview consistent with the most recently saved message.
- `PATCH /api/v1/conversations/:id/read` marks incoming messages as read for the authorized caller.

### Secretary Mobile Experience

The secretary mobile home screen at `/secretary-home` displays a conversation list containing patient information, last-message previews, and unread counts, limited by the backend to the secretary's assigned doctor. Tapping a conversation opens the shared conversation thread titled with the patient's name, where the secretary can view the patient's message history, send and receive messages, and mark the conversation as read on open. A read-only patient-info sheet exposes the authorized appointment summary.

The secretary mobile menu is intentionally minimal and contains only Notifications, Profile, Settings, and Logout. Secretaries must not have queue management, payment verification, walk-in registration, or schedule management screens in the mobile application; all appointment management remains on the secretary web dashboard. On logout, the authenticated session is cleared and the registered push device token is removed or invalidated.

### Patient-Info Sheet

The secretary web chat and the secretary mobile chat include a read-only patient-info sheet backed by `GET /api/v1/conversations/:id/appointment-summary`. The endpoint returns only the read-only appointment fields the interface needs (appointment date, status, reason for visit, queue number, and the patient's basic contact details), enforces the same role-based access rules as the conversation it belongs to (secretary-only, assigned-doctor scope, doctor-association), and exposes no appointment mutations.

### Communication Restriction

Patients cannot directly communicate with doctors through chat.

The platform must not provide a patient-doctor chat workflow.

The secretary web chat and the secretary mobile chat deliver conversation notifications and push reminders to patients through the notification module. Push notifications use generic titles and bodies, never include message content, and open the correct conversation thread only after the authenticated user's authorization is verified. The patient mobile experience remains the mobile chat.

---

# 17. MediGuide — AI Health Information Assistant

FindMyDoctor shall provide MediGuide, an AI health information assistant, for general medical information.

Patients may ask about:

- General symptoms.
- General health concerns.
- Health information.
- General healthcare topics.
- Whether professional medical attention may be appropriate.

The AI should:

- Provide general informational responses.
- Explain limitations.
- Clearly state it is MediGuide, FindMyDoctor's AI health information assistant, not a doctor when asked.
- Suggest professional care when appropriate.
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

Because the system does not have a GCash payment API, the system shall use a static/default GCash QR code.

Patients may:

1. View the GCash QR code.
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
- Other charges.

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
- New patient chat message (NEW_PATIENT_MESSAGE).
- New secretary chat message (NEW_SECRETARY_MESSAGE).
- Prescription availability.
- Payment verification.
- Waitlist updates.

Chat notifications are sent only to the message recipient (never the sender), use generic titles and bodies, and never include message content. Patient-sent messages notify the secretaries assigned to the conversation's doctor; secretary-sent messages notify the patient. Registered device tokens may receive an additional FCM/APNs push with the same generic payload; provider credentials remain on the backend.

---

# 25. Functional Requirements

## FR-001 — Registration

The system shall allow users to register accounts.

## FR-001-A — Patient Registration with OTP

Patients shall be able to register accounts through email OTP verification. The registration flow shall:

1. Collect patient information: first name, middle name (optional), last name, date of birth, sex, mobile number, address, email, username, and password
2. Check the email and username availability, then send a 6-digit OTP code to the patient's email via Supabase (no OTP is sent when either is already taken)
3. Verify the OTP code before creating the patient account
4. Create the patient account in PostgreSQL upon successful OTP verification
5. PostgreSQL remains the single source of truth for patient account data
6. Supabase is used only for OTP email delivery and verification, not for storing patient data

**Patient Information Requirements:**
- Names are collected as separate first name, middle name (optional), and last name components (persisted as `first_name`, `middle_name`, `last_name`)
- Required fields: first name (1–100 characters), last name (1–100 characters), date of birth (valid date), sex, mobile number (maximum 20 characters), address
- Sex must be one of `MALE`, `FEMALE`, `OTHER`, or `NOT_SPECIFIED`
- Email, username, password (minimum 8 characters), and confirm password are also required
- Emergency contact details, medical history, allergies, and current medications are NOT collected during patient sign-up
- All patient details collected at sign-up are staged and then persisted to the `patients` table when the account is created after OTP verification

**Backend API Endpoints:**
- `POST /api/v1/auth/patient/otp/send` - Validate the sign-up form, stage it and send the OTP to the patient email; a taken email or username returns `409 Conflict` and no OTP is sent
- `POST /api/v1/auth/patient/otp/verify` - Verify OTP and create patient account
- `POST /api/v1/auth/patient/otp/resend` - Resend OTP for existing staged signup

**Backend Implementation:**
- Service: `patientOtpService.ts` handles Supabase OTP operations
- Router: `patientOtp.ts` provides API endpoints
- Database: `pending_patient_signups` table stages registration data (including the detailed patient fields)
- Migration: `008_patient_signup_otp_flow.sql` creates the staging table; `026_add_pending_patient_signup_details.sql` adds `middle_name`, `date_of_birth`, `sex`, `phone` and `address`

**Security Requirements:**
- Password hashed with bcrypt before storage
- Email verified through OTP before account activation
- Temporary patient data staged during OTP process
- Single PostgreSQL transaction for account creation after OTP verification
- Email and username uniqueness are checked up-front in `/send` - after the email existence check and before the sign-up is staged or any OTP is sent - so a taken username is reported on the sign-up form instead of after OTP verification; both checks are repeated inside the account-creation transaction in `/verify`, which returns `409 Conflict` with `Email is already registered` or `Username already taken` (the `users` unique constraints are the final backstop against concurrent sign-ups)
- 15-minute expiration for staged sign-up data
- Automatic cleanup of expired staged sign-ups

**Mobile Implementation:**
- Page: `otp_verification_page.dart` provides 6-digit OTP input interface
- Page: `successful_registration_page.dart` displays registration success message
- Page: `onboarding_page.dart` provides 3-screen onboarding flow (Find doctor, Manage health, Book appointments)
- API Service: `api_service.dart` includes patient OTP methods and token management
- Integration: `signup_page.dart` calls backend to send OTP and navigate to verification; a `409 Conflict` from `/send` is shown on the form (using the backend message, e.g. `Username already taken`) and the user stays on the form, so an unavailable username never reaches OTP verification
- Features: Auto-focus, paste support, resend timer, error handling
- Flow: OTP verification → Successful registration → Onboarding → Home dashboard (authenticated)
- Authentication: After successful OTP verification, user is automatically authenticated and can access the app directly

## FR-002 — Authentication

The system shall authenticate users before protected access.

## FR-002-A — Device Trust, Trusted Browsers, and Session Lifetime

The system shall let Doctor and Secretary accounts explicitly trust a browser after authentication, while Admin and SuperAdmin sessions are intentionally short and never rememberable.

1. Doctor and Secretary login forms shall not include a Remember Me checkbox.
2. After a Doctor or Secretary successfully completes authentication (password and, when 2FA is enabled, OTP), an untrusted browser shall be shown a device-trust page displaying the detected browser and operating-system details.
3. The device-trust page shall offer "Trust this device" and "Do not trust this device".
4. When the user chooses "Trust this device" (Doctor/Secretary):
   - The browser is registered as trusted for 30 days.
   - The current session is upgraded to the 30-day persistent session policy.
   - Later logins from that browser skip OTP when 2FA is enabled, but the password is always required.
5. When the user chooses "Do not trust this device" (Doctor/Secretary):
   - No trusted browser is registered.
   - The session uses browser-session cookies and ends when the browser closes or after 8 hours of inactivity, whichever comes first.
   - OTP is required on every login when 2FA is enabled.
   - Any stale trusted-browser cookie for that browser is cleared.
6. The trust decision shall occur only after the current login has fully succeeded. Trusting a device shall never bypass the OTP required for the current login.
7. A browser that is already trusted shall skip OTP (when 2FA is enabled) and the device-trust page on later logins.
8. Trusted-browser tokens shall be high-entropy random values stored only as SHA-256 hashes in PostgreSQL, sent only through an HttpOnly/Secure/SameSite cookie, rotated on each successful use, and never exposed to JavaScript, localStorage, or API response bodies.
9. Device trust shall never bypass password verification, account status checks, role checks, or approval checks, and it shall never reveal which condition failed.
10. Doctor and Secretary settings shall list trusted browsers (device label, created date, last used date, expiry shown in Asia/Manila) with a per-browser Revoke action and a "Sign out of all devices" action. The row belonging to the browser making the request shall be labeled "This browser". Revoking the current browser shall confirm that the next sign-in will require a verification code. "Sign out of all devices" shall show the confirmation "Sign out everywhere? You will need to sign in again on every device." When more than five trusted browsers exist, the settings shall show the five most recent and offer a "View all" toggle.
11. Changing or resetting a password, deactivating an account, or choosing "Sign out of all devices" shall revoke all trusted browsers and refresh tokens for that account.
12. Logging out shall end only the current portal session and shall not revoke trusted-browser status.
13. When 2FA is disabled, the Doctor/Secretary dashboard shall show a non-blocking banner recommending (not requiring) that 2FA be enabled.
14. Admin and SuperAdmin accounts:
    - OTP is mandatory on every login; there is no device-trust prompt and no trusted-browser support.
    - Sessions use browser-session cookies with a 2-hour idle timeout, a 90-minute access token, and an 8-hour absolute maximum.
    - Logout clears the Admin/SuperAdmin session.
15. Access and refresh cookies shall be role-scoped (`doctor_`, `secretary_`, `admin_`, `patient_` prefixes), use path `/`, and be HttpOnly and Secure in production. A non-sensitive, JavaScript-readable browser-session hint cookie (`<prefix>_sessionActive`) lets the web client discard a non-persistent session after a browser restart.
16. Multiple portal sessions in different roles may coexist in the same browser; middleware resolves the session from the role implied by the request path and rejects cross-role use.
17. Token validation shall be rate-limited, failures shall be logged without token values, and expired sessions shall be cleared with the message "Your session has expired. Please log in again."

## FR-002-B — API Rate Limiting and Read Reliability

The system shall keep dashboard navigation responsive without weakening authentication limits or authorization checks.

1. The API shall enforce two per-IP rate-limit budgets: a general budget of 300 requests per 60-second window for normal dashboard traffic, and a stricter budget of 30 requests per 15-minute window for login, login-OTP verification/resend, registration, patient OTP, and password change.
2. Rate-limited (`429`) responses shall include a `Retry-After` header and the standard `{ success: false, error: { code: "RATE_LIMIT", message } }` envelope. Pre-flight `OPTIONS` requests shall not consume either budget.
3. Rate limiting shall never replace authentication or role authorization; every API request shall still be authenticated and authorized as before.
4. The web client may automatically retry only idempotent `GET` requests, up to three total attempts, with exponential backoff and jitter capped at 5 seconds. A server-provided `Retry-After` value shall take precedence when present.
5. The web client shall never automatically retry `POST`, `PUT`, `PATCH`, or `DELETE` requests.
6. The web client may cache successful `GET` responses in memory for at most 15 seconds, scoped to the current portal role. The cache shall be cleared when the session token or role changes, after any successful data-changing request, and on logout.
7. Role-scoped or patient-specific data shall not be served from a cache shared across different users or roles.
8. Server-side availability range caching may reuse results for at most 20 seconds, keyed by doctor and date range, only for reads without a patient identity. Any successful data-changing request through the doctors, secretaries, appointments, or walk-ins modules shall invalidate it.
9. Dashboard endpoints shall aggregate data in a bounded number of queries rather than per-row queries.
10. Client-side list filtering shall be performed locally and shall not issue a network request per keystroke.

## FR-003 — Role-Based Access

The system shall enforce role-based permissions.

## FR-004 — Doctor Search

Patients shall be able to search for doctors.

## FR-005 — Doctor Profiles

The system shall display doctor information.

## FR-005-A — Doctor Rejection and Resubmission

The system shall support a doctor rejection and resubmission workflow:

1. Administrators shall be able to reject doctor applications with a required rejection reason.
2. Rejected doctors shall have `approval_status = 'REJECTED'` and a stored `rejection_reason`.
3. Rejected doctors shall be able to authenticate to the system specifically to correct and resubmit their application.
4. Rejected doctors shall not be able to access the Doctor Dashboard or appear in public doctor search while in REJECTED status.
5. Rejected doctors shall be able to view their rejection reason through the doctor profile endpoint.
6. Rejected doctors shall be able to edit their professional profile fields and schedule.
7. Rejected doctors shall be able to resubmit their profile for review.
8. On successful resubmission, the doctor's `approval_status` shall be restored to 'PENDING' and `rejection_reason` shall be cleared.
9. Administrators shall not be able to directly approve a REJECTED doctor; the doctor must resubmit first.
10. The doctor profile page shall display a rejection banner with the reason when in REJECTED status.
11. The doctor profile page shall allow editing and resubmission when in REJECTED status, even if `profile_completion_status === 'SUBMITTED'`.
12. The doctor login page shall route authenticated doctors based on approval_status: ACTIVE → dashboard, REJECTED → profile page.
13. PENDING doctors shall not be able to log in while awaiting administrator approval.

## FR-006 — Availability

The system shall display available consultation schedules.

## FR-007 — Consultation Duration

The default estimated consultation duration shall be 30 minutes.

## FR-008 — Capacity Calculation

The system shall calculate estimated daily capacity from available consultation time and consultation duration.

## FR-009 — Configured Capacity

The doctor and an authorized secretary shall be able to configure a daily maximum for a particular date. A secretary may configure capacity only for their assigned doctor.

## FR-010 — Capacity Override

The configured lower maximum shall override calculated capacity. A secretary may configure this limit only for their assigned doctor.

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

The system shall display the static GCash QR code.

Secretaries manage the QR code for their assigned doctor from the secretary dashboard (`/secretary/settings/gcash-qr`), and the secretary settings page shows the current QR image, an Active/Not uploaded status badge, and the last-updated date (Asia/Manila). Secretaries can configure clinic-specific invoice information (clinic name, address, contact number, footer line) through the Invoice details form on the settings page; these settings are stored in the `invoice_settings` table scoped by doctor and will be used in future invoice PDF generation. GCash account details exist only as a display-only "Coming soon" placeholder.

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

Patients and authorized secretaries shall be able to exchange messages through the shared conversation model:

- Each patient has one conversation per doctor; secretaries of the same doctor (`secretaries.doctor_id`) share access to the same conversation and message history without duplicate histories.
- A patient accesses only their own conversations and only for doctors with a matching `patient_doctor_associations` record; a secretary accesses only conversations for patients associated with their assigned doctor.
- Conversation listing returns an unread count computed from `messages.read_at` (excluding the caller's own messages) and a latest-message preview.
- The Secretary Web Dashboard chat at `/secretary/conversations` provides a three-column interface (conversation list, message thread, composer) with a read-only patient-info sheet from `GET /api/v1/conversations/:id/appointment-summary`.
- The shared patient/secretary mobile application provides a secretary conversation list at `/secretary-home`, the shared conversation thread, a read-only patient-info sheet, and a minimal menu (Notifications, Profile, Settings, Logout) using the same conversations, messages, read status, unread counts, and latest-message previews as the web chat.
- Secretary mobile users cannot manage appointments or access queue, payment, walk-in, or schedule screens; all appointment management remains on the secretary web dashboard.
- Patient↔Doctor direct chat remains prohibited (FR-032).

## FR-032 — Doctor Chat Restriction

Patients shall not be able to directly chat with doctors.

## FR-033 — MediGuide (AI Health Information Assistant)

Patients shall be able to communicate with MediGuide for general medical information.

## FR-034 — MediGuide Safety

MediGuide shall not claim to diagnose, prescribe, or replace professional care.

## FR-035 — Consultation History

Completed consultations shall be recorded in the patient's history.

## FR-036 — Medical Record Association

Medical records shall remain associated with the correct patient account.

## FR-037 — Prescription Creation

Doctors shall be able to create digital prescriptions.

## FR-038 — Prescription PDF

The system shall generate prescription PDFs.

## FR-039 — Notification System

The system shall provide relevant application notifications, including notifications to affected patients after a confirmed doctor or secretary exception or break-period change affects dates with active appointments.

Chat message notifications use two types: `NEW_PATIENT_MESSAGE` (sent to the secretaries assigned to the conversation's doctor when a patient sends a message) and `NEW_SECRETARY_MESSAGE` (sent to the patient when a secretary sends a message). Notifications go only to recipients (never the sender), use generic titles and bodies, and never include message content. Users may register and remove push device tokens through `POST /api/v1/notifications/device-tokens` and `DELETE /api/v1/notifications/device-tokens/:id`; registered users' devices receive FCM/APNs pushes with the same generic payloads, and provider credentials remain on the backend.

The mobile application registers the device token after successful authentication and removes or invalidates it during logout. A tapped `NEW_PATIENT_MESSAGE` or `NEW_SECRETARY_MESSAGE` notification opens the conversation thread only for the role that owns that notification type, and only after the authenticated user's access to the conversation is verified.

The mobile patient Profile tab is grouped into Account, Security, Notifications, About, and Log Out sections. The Account section opens a read-only standalone patient profile screen for the signed-in patient; the Security section reuses the shared change-password flow; the About section shows the running app version and opens a static in-app privacy notice. The Notifications section exposes a single push-notifications switch (no per-category switches): turning it ON registers this device's token through the existing device-token endpoint, turning it OFF removes the stored token through the same endpoint, and the on/off intent persists locally (`push_notifications_enabled`, default ON so existing auto-registration behavior is unchanged) so nothing silently re-enables push after the user disables it. If the OS notification permission is denied, a hint plus the OS app-settings screen is offered.

## FR-040 — Doctor Approval

Administrators shall be able to approve/reject doctors.

Doctors who complete self-registration, email OTP verification, and profile submission are created with `approval_status = 'PENDING'`, `is_approved = false`, and `profile_completion_status = 'SUBMITTED'`, and must wait for administrator approval before accessing the system. Administrators can view pending doctors through the Admin Doctors page, review complete doctor information, and either approve (setting `approval_status = 'ACTIVE'` and `is_approved = true`) or reject (setting `approval_status = 'REJECTED'` and `is_approved = false`) the registration. Only ACTIVE doctors can log in and access the Doctor Dashboard.

## FR-041 — Secretary Management

Doctors shall be able to add Secretaries for their practice. Each Secretary must belong to exactly one Doctor, and a Doctor may have multiple Secretaries. The assignment is stored in `secretaries.doctor_id`, derived from the authenticated Doctor when inviting the Secretary, and retained through password change and profile completion.

The Doctor's Secretary/Team page shall show only Secretaries assigned to that Doctor. Secretary setup updates the Secretary's account/profile without changing the Doctor assignment. Administrators may continue managing Secretary accounts through the existing administrative workflow.

---

# 26. Core User Stories

### Patient — Reservation

**As a patient,** I want to reserve a consultation without paying in advance so that I can secure my queue position even if I plan to pay later.

### Patient — Queue

**As a patient,** I want to receive a queue number after successful reservation so that I know my position for the day.

### Patient — Secretary Chat

**As a patient,** I want to chat with the secretary so that I can ask questions about my appointment, schedule, or healthcare concerns.

### Patient — AI

**As a patient,** I want to ask an AI chatbot about a medical concern so that I can receive general health information.

### Patient — GCash

**As a patient,** I want to pay the consultation fee through GCash and upload my receipt so that I can request advance payment verification.

### Patient — History

**As a patient,** I want my consultation history to remain connected to my account so that I can review my previous healthcare visits.

### Secretary — Walk-in

**As a secretary,** I want to register walk-in patients into the same queue as online patients so that all patients are managed fairly.

### Secretary — Queue

**As a secretary,** I want to call, skip, and update patients so that I can manage the daily queue.

### Secretary — Payment

**As a secretary,** I want to review GCash receipts and confirm payment so that payment records remain accurate.

### Secretary — Capacity

**As a secretary,** I want to configure the daily patient limit so that the system does not exceed its capacity.

### Secretary — Schedule Changes

**As a secretary,** I want to view my assigned doctor's weekly working hours and manage date-specific exceptions and break periods, with confirmation when active appointments are affected, so that I can help with day-to-day schedule changes without changing the doctor's weekly commitment.

### Doctor — Capacity

**As a doctor,** I want to configure how many patients I can accommodate on a specific day so that the daily queue matches my workload.

### Patient — Profile Map

**As a patient,** I want to view the profile information so that I can easily find out relevant details before my appointment.

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

## Profile Management

```text
Patient
  ↓
View Doctor Profile
  ↓
View Profile Information
  ↓
Patient Views Professional Details
```

---

# 28. MVP Scope

### Patient

- Registration/login.
- Doctor search.
- Doctor profiles.
- Profile management.
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
- Self-registration (account created with PENDING status, requires admin approval).

### Secretary

- Patient chat (secretary web dashboard and the shared patient/secretary mobile application).
- Mobile secretary conversation list, shared conversation thread, read-only patient-info sheet, and minimal Notifications/Profile/Settings/Logout menu.
- Walk-in registration (web).
- Account creation.
- Weekly working hours view (read-only).
- Exception and break-period management for the assigned doctor.
- Daily capacity management.
- Queue management.
- Patient calling.
- Payment verification.
- Additional charges.
- Cancellation/no-show management.

Secretaries cannot manage appointments, queue, payments, walk-ins, or schedules through the mobile application; those operations remain on the secretary web dashboard.

### Administrator

- User management.
- Doctor management.
- Secretary management.
- Profile management.
- Approvals.
- Platform oversight only; no clinic or consultation operations.

### Admin Account Provisioning

**Initial Admin Account:**
- Created through a backend seed script during initial setup
- Seed script is idempotent - running it multiple times will not create duplicate Admin accounts
- Default credentials are provided and must be changed immediately after first login
- Password is securely hashed using bcrypt before storage

**Additional Admin Accounts:**
- Can only be created by authorized Admin users through the Admin dashboard
- Public registration endpoint does not allow Admin role registration
- All Admin accounts must use the shared `users` table with `role = ADMIN`
- Backend verifies `role = ADMIN` for all Admin API routes and functionality

**Security Requirements:**
- Passwords are never stored in plaintext
- All passwords are hashed using bcrypt with salt rounds
- Admin login at `/admin/login` verifies backend-returned role before granting access
- Cross-role access is blocked through backend verification

**Seed Process:**
- Run `npm run seed:admin` to create the initial Admin account
- Run `npm run seed` to run all seed scripts including Admin provisioning
- The seed script checks for existing Admin accounts before creating new ones

### Web Application (Doctor, Secretary, Admin)

The web application provides role-specific dashboards for doctors, secretaries, and administrators:

**Doctor Web Dashboard:**
- Appointments management
- Schedule management
- Patient information
- Prescription creation

**Secretary Web Dashboard:**
- Daily queue management
- Walk-in registration
- Schedule management (weekly working hours view only, exceptions, break periods, and capacity)
- Payment verification
- Patient communication (three-column chat with conversation list, message thread, composer, and read-only patient-info sheet at `/secretary/conversations`; the shared mobile application also provides the secretary conversation list, thread, read-only patient-info sheet, and a minimal Notifications/Profile/Settings/Logout menu, while appointment management stays on the web dashboard)

**Admin Web Dashboard:**
- User management
- Doctor management
- Secretary management
- Platform oversight

---

# 28.1 Web Authentication and Routing

The web application uses role-based route namespaces with dedicated authentication flows:

### Route Structure

```text
FiDo Web
├── Admin
│   └── `/admin/login` → `/admin/dashboard`
├── Doctor
│   └── `/doctor-login` → `/doctor/dashboard`
├── Secretary
│   └── `/secretary-login` → `/secretary/dashboard`
└── Doctor Sign-Up (Self-Registration)
    └── `/doctor-signup` → Basic Registration → Supabase email OTP → PostgreSQL Doctor account (PENDING + INCOMPLETE) → Profile Completion → Submit for Approval → PENDING / Awaiting Admin Review
```

### Authentication Behavior

**Root Route (`/`):**
- Unauthenticated users redirect to `/doctor-login` (default login)
- Authenticated users redirect to their role-specific dashboard

**Admin Authentication:**
- Dedicated login at `/admin/login`
- Admin-only UI with no Doctor/Secretary selector
- The backend verifies the account role matches the login page before issuing an OTP challenge or sending an OTP; an Admin-page login accepts ADMIN and the existing SUPERADMIN role
- Doctor and Secretary accounts are rejected with a generic invalid-credentials/account-role error and do not proceed to OTP verification
- Successful login redirects to `/admin/dashboard`
- Non-Admin login attempts are denied

**Doctor Authentication:**
- Dedicated login at `/doctor-login`
- Doctor-only UI with no role selector
- The login request identifies the expected DOCTOR role, which the backend verifies before issuing an OTP challenge or sending an OTP
- Admin, SuperAdmin, and Secretary accounts are rejected with a generic invalid-credentials/account-role error and do not proceed to OTP verification
- Successful login redirects to `/doctor/trust-device` when the browser is untrusted; after the trust choice it continues to `/doctor/dashboard` (or the profile-correction page for a rejected doctor)
- A browser that is already trusted goes directly to `/doctor/dashboard`
- Non-Doctor login attempts are denied

**Secretary Authentication:**
- Dedicated login at `/secretary-login`
- Secretary-only UI with no role selector
- The login request identifies the expected SECRETARY role, which the backend verifies before issuing an OTP challenge or sending an OTP
- Admin, SuperAdmin, and Doctor accounts are rejected with a generic invalid-credentials/account-role error and do not proceed to OTP verification
- Successful login redirects to `/secretary/change-password` when a password change is required; otherwise to `/secretary/trust-device` when the browser is untrusted
- After the trust choice, login continues to `/secretary/dashboard` (or the profile-completion page)
- A browser that is already trusted goes directly to `/secretary/dashboard`
- Non-Secretary login attempts are denied

### Device Trust, Trusted Browsers, and Session Lifetime

**Device Trust Prompt (Doctor and Secretary):**
- Login forms do not include a Remember Me checkbox.
- After the current login is fully authenticated, an untrusted browser is shown a device-trust page with the detected browser and operating-system details.
- **Trust this device:** registers the browser for 30 days, upgrades the current session to the 30-day persistent policy, and skips OTP on later logins from that browser when 2FA is enabled. The password is always required.
- **Do not trust this device:** keeps browser-session cookies with an 8-hour idle timeout, registers no trust, and requires OTP on every login when 2FA is enabled. Any stale trust cookie is cleared.
- Trusting a device never bypasses the OTP required for the current login. The trust page appears only after that OTP has succeeded.
- Existing trusted browsers skip both the OTP and the trust page on later logins.

**Trusted Browser Recognition:**
- Tokens are cryptographically secure random values stored only as SHA-256 hashes in the PostgreSQL `trusted_browsers` table.
- Each record includes `user_id`, `token_hash`, `device_info`, `expires_at` (30 days), `created_at`, `revoked_at`, and `last_used_at`.
- The token lives only in an HttpOnly/Secure/SameSite `trustedBrowser` cookie, is rotated on each successful use, and is never returned in a response body, stored in localStorage, or read by JavaScript.
- Trust expires after 30 days; a new browser, an expired token, or cleared cookies require OTP again when 2FA is enabled.
- Password change, password reset, account deactivation, or "Sign out of all devices" revokes all trusted browsers and refresh tokens for the account.

**Settings and Revocation:**
- Doctor and Secretary settings pages show trusted browsers with device label, created date, last used date, and expiry.
- Each browser can be revoked individually; "Sign out of all devices" revokes every trusted browser and refresh token.
- Logout ends only the current portal session and does not revoke trust.

**Admin and SuperAdmin:**
- OTP is mandatory on every login; device trust and trusted browsers are not available.
- Browser-session cookies, 2-hour idle timeout, 90-minute access token, 8-hour absolute maximum.
- Logout clears the Admin/SuperAdmin session.

**Session Storage and Isolation:**
- Cookies are role-scoped (`doctor_`, `secretary_`, `admin_`, `patient_` prefixes) and use path `/`.
- Access/refresh cookies are HttpOnly and Secure in production. A non-sensitive `<prefix>_sessionActive` browser-session hint is JavaScript-readable so the client can drop a non-persistent session after a browser restart.
- Multiple portal sessions may coexist; middleware resolves the role from the request path and rejects cross-role use.
- Password verification, account status, role, and approval checks always apply; device trust cannot bypass them.
- Token validation is rate-limited, failures are logged without token values, and expired sessions redirect to login with "Your session has expired. Please log in again."

**Scope:**
- Applies to the web application (Doctor and Secretary dashboards; Admin portal for the shorter-session rules).
- Patient mobile/web behavior keeps its existing 7-day access / 30-day refresh policy.

### Doctor Sign-Up (Self-Registration)

The doctor sign-up page at `/doctor-signup` allows a doctor to create an account without an Administrator through a two-step flow:

- Reachable from the Doctor login page at `/doctor-login` through the "Create an Account" link.
- **Step 1 - Basic Registration:** Collects only basic information (first name, middle name optional, last name, email, contact number, password, confirm password).
- Submits to `POST /api/v1/auth/otp/send`, which validates the payload and stages the sign-up - including the bcrypt-hashed password - in the `pending_doctor_signups` table. No account is created at this step.
- Supabase is used only to email the 6-digit OTP to the doctor's address.
- **Step 2 - OTP Verification:** `POST /api/v1/auth/otp/verify` verifies the OTP with Supabase and, only when verification succeeds, creates the `users` record (`role = DOCTOR`, `email_verified = true`) and the `doctors` profile with `profile_completion_status = 'INCOMPLETE'` in a single PostgreSQL transaction.
- PostgreSQL is the single source of truth for doctor accounts, credentials and profile data; Supabase stores no application account or profile data.
- Passwords are hashed with bcrypt before storage and are never stored or logged in plaintext.
- Email address must be unique; duplicates are rejected.
- Self-registered doctors are created with `approval_status = 'PENDING'`, `is_approved = false`, and `profile_completion_status = 'INCOMPLETE'`, requiring profile completion and administrator approval before they can access the system.
- The doctor sees a "Registration Submitted Successfully" message after OTP verification directing them to complete their professional profile.
- A successful verification returns a success message and directs the doctor to complete their profile.

### Doctor Profile Completion

After successful OTP verification, doctors must complete their professional profile:

- **Profile Update Endpoint:** `PUT /api/v1/doctors/me/profile` (requires Doctor authentication)
  - Accepts professional profile fields: professional_photo_url, specialty, credentials, prc_license_number, practice_name, years_of_experience, areas_of_expertise, biography, consultation_fee, consultation_type, languages_spoken
  - Validates PRC license number format (7 digits) and uniqueness
  - Automatically updates `profile_completion_status` to 'COMPLETE' when all required fields are present
  - Allows partial updates (field-by-field or multiple fields at once)

- **Profile Submission Endpoint:** `POST /api/v1/doctors/me/profile/submit` (requires Doctor authentication)
  - Validates required fields before submission: first name, last name, verified email, contact number, specialty, credentials, PRC license number, hospital/clinic
  - Sets `profile_completion_status = 'SUBMITTED'` and `profile_submitted_at` to current timestamp
  - Keeps `approval_status = 'PENDING'` (does not approve the doctor)
  - Returns message directing doctor to wait for admin approval

- The PRC license number is stored on the doctor profile and may only be registered once.
- PRC license numbers are recorded but are not verified against a PRC registry; PRC verification remains out of scope.

### Doctor Available Schedule Management

Doctors can manage their available schedules through authenticated endpoints that reuse the existing `doctor_schedules` table infrastructure:

- **GET /api/v1/doctors/me/schedules** (requires Doctor authentication)
  - Retrieves the authenticated doctor's schedule configurations
  - Returns all schedule records for the doctor

- **POST /api/v1/doctors/me/schedules** (requires Doctor authentication)
  - Creates a new schedule configuration for the authenticated doctor
  - Accepts: day_of_week (0-6), start_time, end_time, consultation_duration_minutes, is_active
  - Validates day_of_week range and prevents duplicate schedules for the same day
  - Returns the created schedule record

- **PUT /api/v1/doctors/me/schedules/:id** (requires Doctor authentication)
  - Updates an existing schedule configuration
  - Accepts partial updates to schedule fields
  - Verifies ownership - only allows updates to schedules belonging to the authenticated doctor
  - Returns the updated schedule record

- **DELETE /api/v1/doctors/me/schedules/:id** (requires Doctor authentication)
  - Deletes a schedule configuration
  - Verifies ownership - only allows deletion of schedules belonging to the authenticated doctor
  - Returns success confirmation

This reuses the existing `doctor_schedules` table and does not create a new schedule representation. Weekly working hours are managed by doctors only; secretaries may view their assigned doctor's weekly hours and manage date-specific exceptions and break periods. This does not grant schedule-management permissions to ADMIN or SUPERADMIN.

Administrator-provisioned doctor accounts remain available for accounts created on a doctor's behalf.

### Role-Based Protection

- `/admin/*` routes - Allow only ADMIN users
- `/doctor/*` routes - Allow only DOCTOR users
- `/secretary/*` routes - Allow only SECRETARY users
- All role verification uses backend-returned role, not frontend selector
- Cross-role access is blocked and credentials are cleared on mismatch

### Backend Integration

- Uses existing JWT-based authentication through `/api/v1/auth/login`
- Token stored in localStorage
- Role verification on protected routes
- API client includes Authorization header for authenticated requests

---

# 28.2 Mobile Authentication and Routing

The mobile application is shared by patients and secretaries and reuses the existing backend authentication system and the same credentials as the web dashboards.

### Shared Login

- The login page at `/mobile/lib/features/auth/presentation/login_page.dart` accepts a username or email and password for both patients and secretaries.
- The backend verifies the account and returns its `User.role`, which is the single source of truth for the experience. Secretaries sign in with the same credentials as the secretary web dashboard.
- If two-factor authentication is enabled for a secretary, the login OTP step is completed on the web dashboard and the mobile app informs the user.

### Role-Based Navigation

- After a successful login the role is stored with the session so restored sessions route correctly.
- Patients land on the existing patient home with Home, Doctors, Appointments, and Chat tabs.
- Secretaries land on the secretary chat-first home at `/secretary-home`.
- Users with an outstanding mandatory password change are redirected to the change-password page first; after changing the password, secretaries continue to `/secretary-home` and patients continue to their existing flow.
- Route guards redirect unauthenticated users to login, enforce the password-change requirement, and keep secretaries away from patient-only routes (and vice versa).
- Secretaries cannot reach queue, payment, walk-in, or schedule screens through mobile navigation; all appointment management remains on the web dashboard.
- Logout clears the authenticated session and removes or invalidates the registered push device token.

### Push Notifications and Deep Linking

- After successful authentication the mobile application registers its device token with `POST /api/v1/notifications/device-tokens`; logout removes the token through `DELETE /api/v1/notifications/device-tokens/:id`.
- `NEW_PATIENT_MESSAGE` notifications target secretaries and `NEW_SECRETARY_MESSAGE` notifications target patients; notification titles, bodies, and push previews are generic and never contain message content.
- Tapping a chat notification opens `/conversation-thread` for the correct conversation, but only after the authenticated user's authorization to that conversation is verified.

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

Patients communicate with secretaries for healthcare concerns and with AI for general medical information. Direct patient-doctor chat is excluded.

### AI Responsibility

AI is informational only and must clearly communicate its limitations.

### Data Integrity

Appointments, queues, payments, medical history, and prescriptions must remain consistent.

### Educational Focus

The platform demonstrates realistic appointment and healthcare management workflows without attempting to become a production EHR.

---

# 31. Final Product Definition

FindMyDoctor is a mobile appointment and healthcare management platform centered around:

**Find Doctor → Check Availability → Reserve → Queue → Consult → Record → Prescription**

Supporting workflows include:

**Patient ↔ Secretary**

for healthcare communication,

**Patient ↔ AI**

for general medical information,

and:

**Patient ↔ Doctor**

is intentionally **not supported as direct chat**.

The application combines online reservations and walk-in registrations into one daily queue while allowing optional GCash advance payment and maintaining patient consultation history.
