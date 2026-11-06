# FindMyDoctor System State

This document tracks the current state of the FindMyDoctor application, including key features, workflows, and system configurations.

**Current Version:** 01.34

**Last Updated:** November 6, 2026

---

## Dashboard Action Items

### Doctor Dashboard - "Needs a Record"

The doctor dashboard at `/doctor/dashboard` includes a "Needs a Record" section that displays completed consultations missing visit records or prescriptions.

**Data Source:**
- Backend endpoint: `GET /api/v1/doctors/me/dashboard`
- Field: `consultationsNeedingRecords` array
- Query identifies queue entries with status `COMPLETED` where:
  - No visit record exists in `visits` table for that `appointment_id`, OR
  - No prescription exists in `prescriptions` table (linked via `visits.id`)
- Results scoped to the authenticated doctor
- Limited to 10 most recent entries, ordered by completion date

**Display:**
- Table with columns: Patient, Date, Missing, Action
- Missing badges: "Record" (red) and/or "Prescription" (red)
- Each row links to `/doctor/appointments/[id]`
- Empty state: "No consultations needing records"

**Behavior:**
- Items automatically disappear from the list once:
  - A visit record is created (for missing record items)
  - A prescription is created (for missing prescription items)

---

### Secretary Dashboard - "Payments Needing Action"

The secretary dashboard at `/secretary/dashboard` includes a "Payments Needing Action" section that displays payments requiring secretary attention.

**Data Source:**
- Backend endpoint: `GET /api/v1/secretaries/me/dashboard`
- Field: `paymentsNeedingAction` array
- Query includes payments where:
  - Status is `PENDING_VERIFICATION` (GCash receipts to review)
  - Status is `UNPAID` and appointment status is `COMPLETED` (unpaid completed consultations)
  - Status is `PAID` and no ACTIVE invoice exists (paid payments without invoices)
- Results scoped to the secretary's assigned doctor
- Limited to 10 most recent entries, ordered by creation date

**Display:**
- Shows patient name, appointment date, payment method, amount, and status
- Status badges:
  - Amber: "Pending" (PENDING_VERIFICATION)
  - Gray: "Unpaid" (UNPAID)
  - Green: "Paid — invoice not sent" (PAID without invoice)
- Each row links to `/secretary/payments`
- Empty state: "No payments needing action"

**Behavior:**
- Items automatically disappear from the list once:
  - Payment is verified or rejected (for PENDING_VERIFICATION)
  - Payment is marked as paid (for UNPAID)
  - Invoice is generated (for PAID without invoice)

---

## Invoice Status Workflow

**Invoice States:**
- `ACTIVE`: Current/valid invoice, downloadable via PDF
- `VOID`: Cancelled invoice, preserved for audit trail but not downloadable

**Voiding and Reissue:**
- Secretaries can void invoices via `POST /api/v1/invoices/:id/void`
- Voiding is irreversible
- After voiding, a new ACTIVE invoice can be generated for the same payment
- Backend enforces one ACTIVE invoice per payment
- Voided invoices remain in database for audit purposes

**Secretary Invoice Settings:**
- Scoped to the secretary's assigned doctor
- Fields: Clinic Name, Address, Contact Number, Footer Line
- Configured via `PUT /api/v1/secretaries/me/invoice-details`
- Used in invoice PDF generation

---

## Authentication and Session Management

**Session Version:**
- `users.session_version` field increments on:
  - Password change
  - Password reset
  - Account deactivation
  - "Sign out of all devices" action
- Invalidates all existing refresh tokens and trusted browser sessions

**Trusted Browser Sessions:**
- 30-day expiry from last activity
- Revocable via "Sign out of all devices"
- Stored in `trusted_browsers` table with hashed tokens

**Two-Factor Authentication:**
- Available for DOCTOR and SECRETARY roles
- Configured via `/doctor/settings` and `/secretary/settings`
- Uses email OTP during login when enabled

---

## Queue Management

**Queue Status Flow:**
- WAITING → CALLED → IN_CHECKUP → COMPLETED
- Alternative paths: NOT_PRESENT, SKIPPED, CANCELLED, NO_SHOW

**Queue Priority:**
- Sequential based on successful registration time
- Online and walk-in patients have equal priority
- Queue numbers assigned by backend/database

**Secretary Controls:**
- Next Patient, Start Checkup, Skip/Not Present, Complete Checkup
- All status transitions handled by backend

**Patient-facing queue endpoints:**
- `GET /api/v1/queue/today/me` (patient-only) resolves the patient from the bearer token and returns today's queue for every doctor the patient is scheduled with: `queueNumber`, `queueStatus`, `nowServing`, `patientsAhead`, `estimatedWaitMinutes`, `consultationDurationMinutes`, and doctor information (name, specialty, practice, room, photo, fee).
- `nowServing` is the highest `queue_number` with status `CALLED`/`IN_CHECKUP`, falling back to the highest `COMPLETED`; `null` means the clinic has not started.
- `patientsAhead` counts lower queue numbers still in `WAITING`/`CALLED`; `estimatedWaitMinutes` = `patientsAhead × consultation_duration_minutes` (default 30) from `daily_capacities`.
- `GET /api/v1/queue/:date/patient/:patientId` is scoped: patients may read only their own entry (403 otherwise), doctors only entries for their own doctor, secretaries only for their assigned doctor, admins any. Invalid dates return 400, missing entries 404.

**Queue numbering on removal:**
- Cancelling or rescheduling away from a date closes the gap: higher numbers shift down by one in ascending order and each affected patient receives a `QUEUE_UPDATED` notification.
- The shift is performed inside the same transaction while holding the doctor/date advisory lock, so the UNIQUE `(queue_date, doctor_id, queue_number)` constraint is never violated.

---

## Appointment Cancellation and Rescheduling

**Reschedule (`PATCH /api/v1/appointments/:id/reschedule`, patient-only):**
- Patients may reschedule only their own appointments (403 otherwise) that are `SCHEDULED`, on or after today, and not started (queue status `WAITING`, no `started_at`).
- The target date must differ from the current date, must be in the future relative to the clinic date, and must resolve to `AVAILABLE` from the availability service (working hours, breaks, exceptions, capacity). `FULL` returns `CAPACITY_FULL`, unavailable/non-working returns `APPOINTMENT_SLOT_UNAVAILABLE`, and an existing appointment with the same doctor that day returns `CONFLICT`.
- The transaction locks both dates in sorted order, re-reads both `daily_capacities` rows with `FOR UPDATE`, moves the queue entry to the end of the new date (`MAX(queue_number)+1`), renumbers the old date, updates the appointment date, and adjusts `registered_count` (−1 old, +1 new).
- The patient receives an `APPOINTMENT_RESCHEDULED` notification containing both schedules (old date/queue number and new date/queue number). Availability changes to the old date then trigger the waitlist promotion service.

**Cancellation (`PATCH /api/v1/appointments/:id/cancel`, patient-only):**
- Patients may cancel only their own appointments (403 otherwise). `CANCELLED`/`COMPLETED` appointments are rejected.
- CASH payments are deleted; GCASH payments are marked `CANCELLED`. The queue entry is deleted, the queue is renumbered, capacity is released, and the patient receives an `APPOINTMENT_CANCELLED` notification.
- After commit, the freed slot is offered to the first `WAITING` patient for that doctor/date through `promoteNextPatient` (`WAITLIST_UPDATE`).

---

## Waitlist Booking and Notifications

**FULL dates in mobile booking:**
- The doctor schedule screen shows the waitlist card only when the selected date is `FULL`.
- For `FULL` dates, the payment-method selector is hidden and the Join Waitlist action occupies the bottom action bar normally used by Continue Booking.
- Existing `WAITING` entries show their status without a join action; `OFFERED` entries show Book Now in the bottom action bar.
- The booking handler rejects any non-`AVAILABLE` status.

**Slot-available notification navigation:**
- `WAITLIST_UPDATE` notifications are created when the promotion service offers a freed slot to the next waiting patient.
- `related_entity_id` stores the waitlist entry id.
- Tapping the notification or its "Book Now" action fetches `GET /api/v1/waitlists/:id`, then `GET /api/v1/doctors/:id`, and opens `/doctor-schedule` with the doctor id, name, specialty, clinic, consultation fee, photo, and the offered `waitlist_date` as `defaultDate`.
- `GET /api/v1/waitlists/:id` returns `waitlist_date` as a date-only `YYYY-MM-DD` string to avoid timezone shifts when preselecting the date.
- If the waitlist or doctor lookup fails, the app falls back to `/waitlist`.

**Notification dropdown:**
- The header dropdown performs the same navigation as the full notifications page.
- `WAITLIST_UPDATE` items open `/doctor-schedule` with the offered waitlist date preselected.
- Payment-related items (`ADDITIONAL_CHARGE_ADDED`, `PAYMENT_VERIFIED`, `PAYMENT_REJECTED`) open `PaymentScreen` using the payment's appointment id.
- The dropdown closes before navigation, and the parent `onNotificationItemTap` callback runs afterwards.
- Notification messages display in full without a line limit or ellipsis.

---

## Payment Workflow

**Payment Status Flow:**
- UNPAID → PENDING_VERIFICATION → PAID (or REJECTED)
- CASH payments: UNPAID → PAID (immediate, no verification needed)
- GCASH payments: UNPAID → PENDING_VERIFICATION → PAID (after receipt verification)

**Additional Charges:**
- Secretaries can add charges for medicine, additional services, or other fees
- Charges linked to payment record
- Can be deleted before invoice generation

**Invoice Generation:**
- Only for PAID payments
- Secretary-only action
- Uses secretary's assigned doctor's invoice settings
- PDF stored in Supabase private bucket with signed URLs

---

## Prescription Management

**Prescription Creation:**
- Linked to specific visit records
- Doctor-only action
- Includes medication items with dosage, frequency, duration, instructions

**PDF Generation:**
- On-demand generation via `GET /api/v1/prescriptions/:id/pdf`
- Doctor and Patient access (via signed URLs)
- Stored in Supabase private bucket
- 60-second signed URL expiry

---

## Database Schema Key Points

**Required Tables:**
- users, patients, doctors, secretaries
- patient_doctor_associations
- doctor_schedules, doctor_unavailability, daily_capacities
- appointments, queue_entries
- visits, prescriptions, prescription_items
- payments, payment_charges, invoices
- conversations, messages
- ai_conversations, ai_messages
- waitlists, notifications, device_tokens
- pending_doctor_signups, pending_patient_signups
- login_otp_challenges, trusted_browsers
- invoice_settings
- schema_migrations (migration runner tracking)

**Patient Required Fields:**
- `patients.middle_name` (nullable)
- `patients.sex` (`VARCHAR(20) NOT NULL DEFAULT 'NOT_SPECIFIED'`)
- `patient_doctor_associations` links a patient to a doctor before the first appointment and carries `details_completion_status` (PENDING, COMPLETE)

**Migration Runner:**
- `npm run migrate` (`backend/src/database/migrate.ts`) is the single schema entry point.
- It discovers numbered `.sql` files, records applied files in `schema_migrations` (keyed by filename), skips already-recorded files, runs each pending migration inside its own transaction, and verifies required columns/tables after applying.
- Migrations `001`–`041` are baselined (recorded, never executed) because several are destructive or non-idempotent; `consolidated_schema.sql` is the complete idempotent schema that is actually applied.
- The runner refuses `--force`, never drops tables or data, and supports `--dry-run`. It is safe to rerun.

**Invoice Status:**
- Added in migration 040_add_invoice_status.sql
- Values: ACTIVE, VOID
- Constraint ensures only valid values

**Doctor Professional Photo:**
- Stored in Supabase Storage bucket `doctor-photos`
- PNG format only, max 4MB
- Server-side validation for file type, size, and PNG magic number

---

## Version History

See `docs/VERSION_HISTORY.md` for complete version history.

**Recent Versions:**
- 01.35: Patient appointment rescheduling, cancellation with waitlist promotion, and live queue tracking
- 01.34: Consolidated idempotent schema migration and tracked, rerunnable migration runner
- 01.33: Notification dropdown navigation and full message display
- 01.32: Waitlist slot notification opens doctor schedule with date preselected; FULL dates show only the bottom Join Waitlist action
- 01.31: Patient waitlist feature with automatic promotion and 24-hour offers
- 01.30: Dashboard action items (missing records, unsent invoices)
- 01.29: Invoice voiding and reissue workflow
- 01.27: Secretary invoice settings
- 01.26: Prescription PDF generation
- 01.25: Walk-in payment recording
