# FindMyDoctor System State

This document tracks the current state of the FindMyDoctor application, including key features, workflows, and system configurations.

**Current Version:** 01.37

**Last Updated:** November 7, 2026

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

## Schedule-Change Confirmation

**What changed:** Exception and break-period changes (create/update/delete) that affect active future appointments no longer take effect silently. They are held as PENDING requests, confirmed or dismissed by the secretary, and affected appointments stay active but are flagged as needing attention. See `docs/SYSTEM_STATE.md` for the full detail.

**Data:**
- New `schedule_change_requests` table (migration `backend/database/047_add_schedule_change_requests.sql`, applied; consolidated schema updated).
- New `needs_attention` / `needs_attention_reason` / `needs_attention_flagged_at` columns on `appointments`.

**Flow:**
- Affected = active (`SCHEDULED`, `CONFIRMED`, `IN_PROGRESS`) future appointments (clinic date, Asia/Manila) newly in conflict with the change ( UPDATE = new conflicts only; BREAK matches whole-day for date-only appointments and time overlap for timed ones).
- Affected appointments exist → HTTP 202 with the request summary; otherwise the change applies exactly as before (DELETE always applies immediately when no pending duplicate exists).
- Secretary sees the request in `/secretary/dashboard` Schedule Alerts (doctor, date range, affected count, Confirm/Dismiss; confirm says how many patients will be notified). Confirm applies the change in one transaction, flags the affected appointments `SCHEDULE_CHANGE`, and sends each affected patient a `SCHEDULE_CHANGE_NOTICE` that opens the appointment. Dismiss leaves the schedule unchanged and notifies no one.
- `/secretary/schedule` and `/doctor/schedule` show "Pending confirmation" / "Awaiting secretary confirmation" states and disable the relevant actions while a request is pending; `/secretary/appointments` shows a "Needs attention" badge; `/home` appointment cards and the appointment detail screen show "The clinic changed the doctor's schedule. They will contact you." on affected appointments; the mobile notifications list opens the related appointment on tap (same deep link as appointment notifications).
- `needs_attention` clears automatically when the appointment is cancelled or rescheduled (date changed).
- `GET /api/v1/schedule-changes` (SECRETARY, own doctor's pending), `POST /:id/confirm`, `POST /:id/dismiss`; read-only `GET /api/v1/doctors/me/schedule-change-requests` for doctors.

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

## Payment Workflow (Billing Redesign)

**Billing Model:**
- Each `payments` row is a bill. `payment_transactions` rows record individual payments (PAYMENT) and refunds (REFUND) with method (CASH/GCASH), status (PENDING/ACCEPTED/REJECTED/VOIDED), receipt URL, reference number, patient-declared amount, and source (PATIENT_UPLOAD/SECRETARY).
- `payments.status` caches the derived billing status, recomputed by `recalculateBill()` after every charge/transaction change: UNPAID, FOR_REVIEW (stored as PENDING_VERIFICATION), PARTIAL, PAID, OVERPAID.
- Bill total = `consultation_amount + total_additional_charges`. Balance = bill total − accepted payments + accepted refunds.
- `payment_charges.charge_type` is one of `ADDITIONAL`, `MEDICINE`, `SERVICE`, or `OTHER` (migration `046_add_service_other_charge_types.sql`). `MEDICINE`, `SERVICE`, and `OTHER` charges carry `quantity` and `unit_price`; the server computes `amount = quantity × unit_price` and ignores any client-supplied line total. `ADDITIONAL` remains a flat amount for legacy callers.
- `billing_audit_log` records every billing mutation (charge add/remove, transaction create/accept/reject/void, refund, invoice create/void/unlock/reissue) with actor, entity, before/after state, and reason.

**Patient Receipt Upload:**
- `POST /api/v1/payments/:appointmentId/receipt` (PATIENT) accepts an optional `patient_declared_amount` multipart field.
- Creates/updates the payment and inserts a PENDING `payment_transactions` row (GCASH, source=PATIENT_UPLOAD) for secretary review.
- `GET /api/v1/payments/my-receipt/:appointmentId` (PATIENT) returns a short-lived signed Supabase URL for the patient's own uploaded receipt (falls back to the latest transaction receipt); 404 when none exists.

**Secretary Billing Endpoints:**
- `GET /api/v1/payments/by-appointment/:appointmentId` and `GET /api/v1/payments/:id/billing` — bill + charges + transactions + derived summary + active invoice.
- `POST /api/v1/payments/:id/transactions` — record payment/refund (GCASH requires reference_no; blocked while an ACTIVE invoice exists; the payment row is locked and an identical payment created in the last 30 seconds is rejected with 409 to prevent double-submits).
- `PATCH /api/v1/payments/:id/transactions/:txId/accept|reject|void` — review pending receipts / void accepted ones (reason required; voiding also voids the ACTIVE invoice).
- `POST /api/v1/payments/:id/charges` — add a charge. Blocked while an ACTIVE invoice exists (`INVOICE_LOCKED`); status/balance are recomputed server-side so adding a charge to a paid bill returns it to PARTIAL/UNPAID.
- `DELETE /api/v1/payments/:id/charges/:chargeId` — soft-delete a charge. Blocked while an ACTIVE invoice exists and blocked if the removal would leave the bill overpaid (`Removing this would overpay the bill by ₱X. Void a payment first.`).
- `POST /api/v1/payments/:id/refunds` — refund entry, only when OVERPAID.
- `POST /api/v1/payments/:id/invoice` — issue invoice only when balance = 0 and no ACTIVE invoice exists. Locks the payment row, verifies the secretary's assigned doctor, snapshots every accepted payment into `invoice_data`, and links a replacement to the voided invoice it supersedes.
- `POST /api/v1/invoices/:id/correct` — "Edit bill": requires a reason, verifies doctor assignment, and voids the ACTIVE invoice in one transaction (`status=VOID`, `voided_by/at/reason`) so charges unlock; writes `INVOICE_VOIDED` and `INVOICE_UNLOCKED` audit rows.
- `GET /api/v1/secretary/payments/review|collect|history?date=` — pending receipts, bills with balance, and invoiced history + cash/GCASH/grand totals (mounted via `secretaryPaymentsRouter` at `/api/v1/secretary`).

**Invoice Lifecycle:**
- `invoices` gained `replaces_invoice_id`, `replaced_by_invoice_id`, `voided_by`, `voided_at`, `void_reason`.
- States: ACTIVE (downloadable) / VOID (audit only; PDF download refused). One ACTIVE invoice per payment enforced by `idx_invoices_one_active_per_payment`.
- Edit-bill flow: `POST /invoices/:id/correct` voids + unlocks in one transaction → secretary changes charges and collects any new balance → `POST /payments/:id/invoice` issues a replacement linked through `replaces_invoice_id` / `replaced_by_invoice_id`.
- Replacement invoices display `Replaces INV-xxxx` and list every accepted payment (old and new GCash references included). Voided invoices remain in the audit trail only.
- The invoice "Payment Breakdown" (both the PDF and the in-app preview) is computed from the accepted-transaction snapshot in `invoice_data.payment.transactions`, never from the legacy `advance_payment`/`cash_tendered` columns when a snapshot exists (those were zero for payments recorded via the transaction flow, which made the preview show ₱0.00). Format: Cash line first, then GCash line (`GCash · Ref: <sorted refs>`), then Cash/GCash refund lines as separate negative lines when refunds exist. TOTAL PAID = accepted payments minus refunds and equals the sum of every line above it. The PDF generator divides refunds into separate negative lines and no longer double-counts GCash refunds.

**Secretary UI:**
- `/secretary/queue` and `/secretary/payments` open the shared `BillingPanel` modal instead of the old stacked PaymentModal/InvoiceModal (files removed).
- `BillingPanel` is a single scrolling view — Bill, then Payments, then Collect payment, then the invoice card — with a status strip (Total, Paid, Balance, status chip) pinned at the top. The four-tab layout was removed.
- Header reads `Billing · Q-03 · Patient Name`; the queue number comes from the `queueNumber` prop when opened from the queue and otherwise from `queue_number` in the billing response, so no appointment UUID is shown.
- Bill always lists the **Consultation fee** as the first, locked line so the displayed lines reconcile with the bill total. Additional charges follow, each showing its type and `qty × unit price` when present.
- Add charge is one inline row regardless of type: Type (Service / Medicine / Other), Name, Qty (default 1), Unit price, and a live line total. After adding, the row stays open for another item.
- Charges are editable until an ACTIVE invoice exists. Once it does, `+ Add charge` and Remove are hidden and an **Edit bill…** button appears with the hint `Invoice issued. Edit bill to change charges.`; the API also rejects charge changes server-side.
- Edit bill asks for a required reason (Forgot item / Wrong amount / Wrong price / Other + optional note) and shows `This will void INV-xxxx and unlock the bill.` Voiding and unlocking happen in one DB transaction with audit rows.
- Removing a charge opens a confirmation dialog. If the removal would leave the bill overpaid, the dialog shows `Removing this would overpay the bill by ₱X. Void a payment first.` and the server rejects it; otherwise removal is allowed after confirmation.
- Collect payment prefills Amount with the current balance. The action label follows the edited amount (`Record ₱500 · ₱544 left`, or `Record ₱1,044` once it clears the balance) and does not claim to issue the invoice. Cash tendered (Cash only) shows the live Change amount and blocks recording when it is below the amount; GCash shows the reference-number field.
- The primary action is a sticky footer outside the scrolling content: Record payment while a balance remains, Issue invoice once the bill is paid, so it cannot scroll out of view. It is disabled while a request is in flight to prevent double submission.
- Recording a payment never auto-issues the invoice. A paid bill shows an explicit **Issue invoice** button in the sticky footer with the wording `Issue the invoice to give the patient their receipt.`; the invoice then appears as a card (number, issued date, totals, View/Print, Edit bill…). Paid bills without an invoice also show `No active invoice, issue one when paid.`
- Billing status uses colored chips (Unpaid red, For review/Partial amber, Paid green, Overpaid purple) and lists methods as `Cash`/`GCash` rather than the raw enum values.
- The Payments list shows each transaction's date and time in Asia/Manila (e.g. `Nov 7, 2026 · 2:48 PM`) and keeps GCash reference numbers.
- Queue rows show billing chips (Unpaid/For review/Partial/Paid/Overpaid), a "To collect" filter, and Bill/View invoice actions after Complete Checkup. A PAID row with no ACTIVE invoice shows **Issue Invoice** plus a `No active invoice` badge instead of pretending an invoice exists.
- `/secretary/payments` uses action tabs (To Review, To Collect, Paid, Needs Attention) with search/date filters and a cash/GCASH day summary on Paid.

**Mobile:**
- Receipt upload screen has an optional "Amount you paid" field sent as `patient_declared_amount`.
- Appointment detail → Payment Information shows a "View Receipt" button for GCash payments; it fetches a signed URL via `GET /payments/my-receipt/:appointmentId` and displays the image in an in-app zoomable dialog (`InteractiveViewer`). Shown alongside "View Invoice" (PAID + COMPLETED).

**Legacy Compatibility:**
- Other pre-existing payment endpoints (verify, reject, mark-paid, record-payment, record, walk-in, payment-method, revert-unpaid) remain unchanged. Charge add/delete now follow the billing-redesign locking rules above.

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
- payments, payment_charges, payment_transactions, billing_audit_log, invoices
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
- 01.37: Schedule-change confirmation workflow — pending secretary approval for exception/break-period changes affecting active appointments, affected appointments flagged needs attention, patients notified via SCHEDULE_CHANGE_NOTICE
- 01.36: GCash account details for secretaries; patients see account name/number beside the GCash QR
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
