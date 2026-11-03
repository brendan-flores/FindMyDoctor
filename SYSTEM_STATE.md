# FindMyDoctor System State

This document tracks the current state of the FindMyDoctor application, including key features, workflows, and system configurations.

**Current Version:** 01.30

**Last Updated:** October 30, 2026

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
- 01.30: Dashboard action items (missing records, unsent invoices)
- 01.29: Invoice voiding and reissue workflow
- 01.27: Secretary invoice settings
- 01.26: Prescription PDF generation
- 01.25: Walk-in payment recording
