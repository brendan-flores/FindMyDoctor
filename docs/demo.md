# FindMyDoctor — Live Demonstration Guide

**Purpose:** This document is the step-by-step runbook for the FindMyDoctor project presentation. A team member should be able to perform every demonstration by following the numbered steps without reading source code.

**How to use this guide:**

- **Part A** is preparation — everything that must be done *before* the presentation starts.
- **Parts B–F** are per-role demonstrations.
- **Part G** is the recommended chronological "spine" — one appointment flowing Patient → Secretary → Doctor → Patient. Run the demo in this order so every screen builds on the previous one.
- Each demo step lists: Role, Platform, Prerequisites, Navigation, Actions, Information to Enter, Expected Result, What to Show, and Technical Verification.
- Field labels below match the implemented UI. If a label differs slightly on screen, use the field's purpose (e.g., "First Name") — do not invent new fields.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Roles and Permissions](#3-roles-and-permissions)
4. [Status Reference](#4-status-reference)
5. [Part A — Prepare the Demonstration Environment](#part-a--prepare-the-demonstration-environment)
6. [Part B — Patient Account Creation](#part-b--patient-account-creation)
7. [Part C — Patient Features](#part-c--patient-features)
8. [Part D — Secretary and Clinic Staff](#part-d--secretary-and-clinic-staff)
9. [Part E — Doctor Features](#part-e--doctor-features)
10. [Part F — Administrator](#part-f--administrator)
11. [Part G — Complete Cross-Role Workflow](#part-g--complete-cross-role-workflow)
12. [Feature Implementation Checklist](#12-feature-implementation-checklist)
13. [Presentation-Day Checklist and Fallbacks](#13-presentation-day-checklist-and-fallbacks)
14. [Known Limitations](#14-known-limitations)
15. [Source-Code Reference](#15-source-code-reference)

---

## 1. Project Overview

FindMyDoctor is a healthcare appointment-management platform for the Philippines (clinic timezone: **Asia/Manila**). It connects patients (mobile app) with doctors' clinics (web portal for doctors, secretaries, and administrators) through a shared Node.js REST API backed by PostgreSQL.

What it does, end to end:

- Patients register with email OTP, discover approved doctors, view real availability, and book a **date-based queue position** (no time-slot picking).
- Secretaries run the clinic floor: daily queue, walk-in registration, billing, payments, invoices, and patient chat.
- Doctors manage schedules, exceptions, breaks, capacity, and — through a **consultation workspace** — issue visit records and prescriptions with PDF output.
- Admins oversee accounts: approve/reject doctors, manage secretaries and admins, review an audit log, and deactivate/reactivate accounts.
- An optional **MediGuide AI chatbot** (patient-only) answers health questions and can list bookable doctors.

Three applications, one API:

| App | Path | Users | Stack |
|---|---|---|---|
| Mobile | `/mobile` | Patients (and secretaries for chat-only) | Flutter |
| Web | `/web` | Doctors, Secretaries, Admins | Next.js 16, React 19, Tailwind |
| Backend | `/backend` | — | Node.js, Express, TypeScript, PostgreSQL |

## 2. Architecture Overview

```text
Flutter mobile app ──┐
                     ├──> REST API  /api/v1  ──> PostgreSQL (source of truth)
Next.js web portal ──┘         │
                               ├──> Supabase (email OTP, Storage buckets)
                               ├──> AI provider (backend-only key, patient chatbot)
                               └──> FCM/APNs push (backend-only credentials)
```

Rules that shape the demo:

- **Mobile and web never touch PostgreSQL directly.** All data flows through `/api/v1`.
- **Patient ↔ Doctor direct chat does not exist.** Messaging is Patient ↔ Secretary only. Never demo or imply doctor chat.
- **Secrets stay on the backend.** AI keys, Supabase service key, DB credentials, push credentials are environment variables only.
- **Clinic date is Asia/Manila.** Queue numbers, capacity, and "today" are computed in that timezone regardless of server timezone.
- **Appointment model:** booking a date assigns a **queue number** (first-come-first-served). There are no time slots. Consultation duration defaults to 30 minutes and drives capacity math.

## 3. Roles and Permissions

| Role | How the account is created | Self-register? | Login OTP/2FA | Portal |
|---|---|---|---|---|
| **PATIENT** | Self-registration in the mobile app (`/signup`) with email OTP | Yes | No login OTP | Mobile app |
| **DOCTOR** | Self-registration on web (`/doctor-signup`) with email OTP → profile → admin approval. Admins can also provision via `POST /api/v1/admin/doctors` | Yes (primary path) | Optional (`two_factor_enabled`) | Web `/doctor/*` |
| **SECRETARY** | Created by an approved Doctor (`POST /api/v1/doctors/secretaries`) or by Admin (`POST /api/v1/admin/secretaries`). Always tied to exactly one doctor (`secretaries.doctor_id`) | No | Optional (`two_factor_enabled`) | Web `/secretary/*` (+ mobile chat-only) |
| **ADMIN** | Seeded via `npm run seed:admin`, or created by a SUPERADMIN (`POST /api/v1/admin/admins`) | No | **Mandatory OTP on every login** | Web `/admin/*` |
| **SUPERADMIN** | Seeded via `npm run seed:admin` | No | **No OTP** — logs in directly | Web `/admin/*` (incl. Admin management) |

Permission highlights (enforced server-side, not just hidden in the UI):

- **Patient:** own appointments, queue position, reschedule/cancel, payments hub, receipt upload, medical records, prescriptions, conversations with the secretary, MediGuide AI. Cannot see other patients' data or clinic operations.
- **Doctor:** own schedule/availability/capacity, own appointments, consultation workspace, patient records for own patients, prescriptions, signature upload, own secretary accounts. Cannot touch another doctor's data.
- **Secretary:** everything for **their assigned doctor only** — queue, walk-ins, schedule exceptions/breaks, capacity, payments/billing/invoices, patient records, conversations, settings (invoice details, GCash account details, QR upload). Cannot access other doctors' data. No visit/prescription reads.
- **Admin/SUPERADMIN:** user/doctor/secretary/admin management, approvals, audit log. **Denied** clinic operations (queue, capacity, payments, consultations) — returns 403.
- **SUPERADMIN-only:** create/edit/delete other admin accounts (`/admin/admin`).

## 4. Status Reference

Use these exact terms when narrating. They are the real values in the code.

**Doctor account**

| Field | Values | Meaning |
|---|---|---|
| `approval_status` | `PENDING` → `ACTIVE` or `REJECTED` | Admin approval gate |
| `profile_completion_status` | `INCOMPLETE` → `COMPLETE` → `SUBMITTED` | Professional profile progress |
| `rejection_reason` | text / null | Shown to the doctor after resubmission+approval cycle |

Login rules: `PENDING` + `SUBMITTED` = blocked ("awaiting administrator approval"); `PENDING` + unsubmitted = may log in to finish profile; `REJECTED` = cannot authenticate at all (generic invalid-credentials error); `ACTIVE` = full access.

**Appointment** (`appointments.status`)

`SCHEDULED` (created by booking) → `COMPLETED` (checkup finished) · `CANCELLED` · `NO_SHOW`. `CONFIRMED`/`IN_PROGRESS` also appear in filters/queries as active states.

**Queue entry** (`queue_entries.status`)

`WAITING` → `CALL_NEXT` sets `CALLED` → `Start Checkup` sets `IN_CHECKUP` → `Complete Checkup` sets `COMPLETED`. Side paths: `SKIPPED`, `NOT_PRESENT` (both re-queueable), `CANCELLED`, `NO_SHOW`. Timestamps `called_at`, `started_at`, `completed_at` are set automatically.

**Bill / payment** (`payments.status`, derived from `payment_transactions`)

`UNPAID` → `PENDING_VERIFICATION` (GCash receipt awaiting secretary review; shown as "For review") → `PARTIAL` → `PAID` · `OVERPAID` · `REJECTED` · `CANCELLED`. Transaction rows: method `CASH`/`GCASH`, status `PENDING`/`ACCEPTED`/`REJECTED`/`VOIDED`.

**Invoice** (`invoices.status`)

`ACTIVE` (downloadable) / `VOID` (audit only). One ACTIVE invoice per payment.

**Visit** (`visits.status`): `DRAFT` → `ISSUED`. **Prescription** (`prescriptions.status`): `ISSUED` / `VOIDED`.

**Waitlist** (`waitlists.status`): `WAITING` → `OFFERED` (24-hour offer window; patient can Book Now).

**Patient–doctor association** (`patient_doctor_associations.details_completion_status`): `PENDING` / `COMPLETE`. Required before a patient can book with a doctor.

**Key notification types** (useful to point at during the demo): `QUEUE_UPDATED` ("You're Next"), `APPOINTMENT_RESCHEDULED`, `APPOINTMENT_CANCELLED`, `SCHEDULE_CHANGE_NOTICE`, `NEW_PATIENT_MESSAGE`, `NEW_SECRETARY_MESSAGE`, `INVOICE_AVAILABLE`, `WAITLIST_UPDATE`, `PRESCRIPTION_AVAILABLE`, `PAYMENT_VERIFIED`, `PAYMENT_REJECTED`, `ADDITIONAL_CHARGE_ADDED`.

---

# Part A — Prepare the Demonstration Environment

Do all of this **before** presentation day. Items marked **[LIVE-SAFE]** can also be shown on stage; the rest must be pre-done.

## A.1 Backend setup **[PREP]**

From `backend/`:

```bash
npm install
cp .env.example .env   # then fill in real values (see A.5)
npm run migrate        # applies consolidated_schema.sql bootstrap + pending migrations
npm run seed:admin     # creates SUPERADMIN + regular ADMIN accounts
npm run dev            # tsx watch → http://localhost:3000, API at /api/v1
```

Verify:

```bash
curl http://localhost:3000/api/v1/health   # or any public endpoint; confirm the server responds
```

Admin seed accounts are defined in `backend/src/database/seedAdmin.ts` (emails and passwords are in that file — retrieve them there; do not paste credentials into shared docs or slides).

## A.2 Database **[PREP]**

- PostgreSQL must be running with the database from `DATABASE_URL`/`DB_*`.
- `npm run migrate` is the only supported schema entry point. It is idempotent — safe to rerun.
- For a clean demo you may reset data with `npm run clear:data` (destructive — only on a demo database, never production).

## A.3 Web application **[PREP + LIVE-SAFE]**

From `web/`:

```bash
npm install
npm run dev            # Next.js on http://localhost:3001
```

- `web/.env.local` needs `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1` (already present in this workspace).
- If Supabase client features are used, `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are also read by `web/src/lib/supabase.ts`.
- Login pages: `/doctor-login`, `/secretary-login`, `/admin/login`. Doctor self-registration: `/doctor-signup`.

## A.4 Mobile application **[PREP + LIVE-SAFE]**

From `mobile/`:

```bash
flutter pub get
flutter run            # pick a device/emulator
```

API base URL rules (`mobile/lib/core/constants/api_constants.dart`):

- **Debug build:** Android emulator → `http://10.0.2.2:3000/api/v1`; Android real device → `local_config.dart` `deviceBaseUrl` (your PC's LAN IP, e.g. `http://192.168.x.x:3000/api/v1`); iOS simulator/desktop/web → `http://localhost:3000/api/v1`.
- **Release build:** hardcoded production backend `https://findmydoctor-api.onrender.com/api/v1`. **For a local demo, run a debug build** so the app hits your local backend.
- To use a physical Android device, copy `mobile/lib/core/config/local_config.dart.example` → `local_config.dart`, set `deviceBaseUrl` to your PC IP and `useEmulator = false`.

## A.5 Required environment variables (names only — never commit values)

Backend (`backend/.env`): `DATABASE_URL` (or `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`), `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `NODE_ENV`, `PORT`, `TIMEZONE=Asia/Manila`, `CORS_ORIGIN` (include `http://localhost:3001` for the web app), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FUNCTION_SECRET`, `SUPABASE_STORAGE_BUCKET` (default `doctor-photos`), `SUPABASE_GCASH_BUCKET`, `SUPABASE_RECEIPT_BUCKET`, `SUPABASE_PRESCRIPTION_BUCKET`, `SUPABASE_SIGNATURE_BUCKET` (default `doctor-signatures`), `AI_API_KEY`, `AI_API_URL`, `AI_MODEL`, `AI_DAILY_LIMIT`, `FRONTEND_URL`, `UPLOAD_DIR`, `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`.

Web (`web/.env.local`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Mobile: none required — API base is compiled in (`api_constants.dart` / `local_config.dart`).

## A.6 External services checklist **[PREP]**

| Service | Needed for | If unavailable |
|---|---|---|
| Supabase Auth (email OTP) | Patient signup OTP, doctor signup OTP, admin login OTP, password reset, optional 2FA | **Registration and admin login cannot complete.** See §13 fallbacks. |
| Supabase Storage buckets | Doctor photos, signatures, GCash QR, payment receipts, prescription PDFs | Photo/QR/receipt/PDF uploads fail; core booking/queue still works. Buckets must exist: `doctor-photos`, `doctor-signatures` (private), `gcash-qr-codes`, `payment-receipts`, `prescription-pdfs`. |
| AI provider (`AI_API_KEY`) | MediGuide chatbot only | `/ai/chat` returns 503 "MediGuide unavailable"; everything else works. Demo without chatbot or note it as optional. |
| FCM/APNs push credentials | Push notifications | In-app notification list still works; push taps won't arrive. Optional for demo. |

## A.7 Demo data to prepare **[PREP — do in rehearsal, not on stage]**

Create these **before** the presentation so the live demo is smooth:

1. **Admin account** — via `npm run seed:admin`. Note the credentials from `backend/src/database/seedAdmin.ts`.
2. **Demo doctor (pre-approved)** — register via `/doctor-signup`, complete `/doctor-profile`, submit, then approve at `/admin/doctors`. This doctor is the one the patient books with.
3. **Doctor schedule** — the demo doctor adds Working Hours covering the demo dates (e.g., Mon–Sat 08:00–17:00), plus optionally one Exception and one Break Period to show those features. Verify `GET /api/v1/doctors/:id/availability` returns `AVAILABLE` for the demo date.
4. **Doctor capacity** — leave calculated capacity as-is, or set a Configured Capacity on `/doctor/schedule` → Capacity tab to control how many demo bookings fit.
5. **Secretary account** — created by the demo doctor at `/doctor/secretary` (email + temporary password the doctor chooses). First login forces password change + profile completion (see Part D).
6. **Doctor signature + GCash details** *(optional but recommended)* — doctor uploads signature at `/doctor/profile`; secretary configures GCash QR/account at `/secretary/settings/gcash-qr` and `/secretary/settings` so invoice PDFs and patient payment screens look complete.
7. **Invoice settings** *(optional)* — secretary fills clinic name/address/contact/footer at `/secretary/settings` → Clinic → Invoice details so invoices look real.
8. **Test patient** — either register live on stage (Part B, recommended — it *is* the demo) or pre-create a backup patient account in case OTP email delivery fails on stage.
9. **Optional second doctor** *(optional)* — a second `PENDING` doctor application lets you demo the admin approval/rejection flow live without touching the demo doctor.

**Recommended demo date strategy:** pick a weekday within the current week (patients only see the current week in the mobile app). Book on a date with several `AVAILABLE` days around it so reschedule can be shown.

---

# Part B — Patient Account Creation

**Demo Step B.1 — Open the mobile app and reach sign-up**

- Role: none (logged out)
- Platform: Mobile (Flutter)
- Prerequisites: backend + mobile debug build running (§A.1, §A.4)
- Navigation: Launch app → animated splash (~3 s) → Login screen → tap the sign-up / "Create Account" link → Sign Up screen
- Expected Result: Sign-up form with two sections — "Personal Information" and "Account Credentials".

**Demo Step B.2 — Fill in the registration form**

- Information to Enter (all fields as labeled):
  - First Name, Middle Name (optional), Last Name
  - Date of Birth (date picker)
  - Sex — dropdown labels map to `MALE`, `FEMALE`, `OTHER`, `NOT_SPECIFIED`
  - Mobile Number — Philippine mobile format (`09XXXXXXXXX` or allocated `08` prefixes; international input supported via country-code selector)
  - Address
  - Email — **use a real inbox you control** (OTP is emailed)
  - Username — min 3 characters, letters/numbers/underscore
  - Password — must satisfy strength rules; Confirm Password
- Actions: Fill all required fields → tap **Create Account**
- Expected Result: App calls `POST /api/v1/auth/patient/otp/send`, which validates email/username uniqueness **before** sending OTP (409 shown inline if taken). On success, the OTP verification screen appears.
- What to Show: The form sections, password visibility toggle, inline validation errors (try submitting empty first if you want to show validation).
- Technical Verification: `POST /api/v1/auth/patient/otp/send` stages the full signup (incl. patient details) in `pending_patient_signups` and sends a Supabase email OTP.

**Demo Step B.3 — Verify OTP and create the account**

- Actions: Enter the 6-digit code from the email → submit (verify). Resend is available with a 60-second cooldown (`POST /api/v1/auth/patient/otp/resend`).
- Expected Result: `POST /api/v1/auth/patient/otp/verify` creates `users` + `patients` rows atomically, returns tokens, and signs the patient in. First-time patients see onboarding slides ("Find the right doctor", "Manage your health", "Book appointments easily") before the main app.
- What to Show: OTP screen, then the onboarding slides, then the patient home.
- Technical Verification: verify endpoint re-checks email/username uniqueness inside the creation transaction (409 on race).

**Demo Step B.4 — Log in (subsequent sessions)**

- Navigation: Login screen. Field label is **"Email or Username"** — both work (`WHERE email = $1 OR username = $1`).
- Actions: Enter email or username + password → **Log In**.
- Expected Result: Routed by role — patient → `/home` tabbed shell; secretary → `/secretary-home` (chat-only). Patients get a 7-day access / 30-day refresh session.
- What to Show: Mention that the same mobile login also serves secretaries, and the backend `role` decides the destination.

**Demo Step B.5 — Complete/verify the patient profile**

- Navigation: Home → **Profile** tab → Account section → profile summary opens the read-only Patient Profile screen (`/patient-profile`); edit via **Patient Details** where offered (e.g., during booking or profile edit flows).
- Expected Result: Shows name, email (non-editable), phone, address, DOB, sex as registered. Profile fields: first/middle/last name, DOB, sex, phone, address are required on update; optional fields (emergency contact, medical history, allergies, current medications) can be cleared with empty values.
- Technical Verification: `GET/PUT /api/v1/patients/me`.

---

# Part C — Patient Features

All on **Mobile** unless noted. Patient home has 5 bottom tabs: **Home, Doctors, Appointments, Chat, Profile**.

**Demo Step C.1 — Home dashboard**

- Navigation: `/home` (default after login).
- Expected Result: Greeting/account summary, quick actions (Doctors, Appointments, **Payments** — "Bills & Invoices", Medical Records, notifications bell with unread badge), specialty chips, recommended doctors, clinic cards, and secretary-chat/AI entry points.
- What to Show: The quick-actions grid and the floating **MediGuide** badge button (bottom-right, visible on Home and Doctors tabs).

**Demo Step C.2 — Doctor discovery**

- Navigation: **Doctors** tab (or Home → Doctors).
- Expected Result: Search bar (name/specialty/practice), location line "Metro Manila • Near me", specialty chips with doctor counts, "Top Verified Doctors" horizontal carousel, hospital cards derived from real practice data.
- Actions to show: type in search; tap a specialty chip; open the filter chips row (All, Available Today, hospital names, Top Rated) on the filtered list view; show active-filter chips are individually removable + Clear All.
- What to Show: Only **ACTIVE, approved** doctors appear (`GET /api/v1/doctors` filters `approval_status='ACTIVE'`).
- Technical Verification: `GET /api/v1/doctors`; filters are client-side AND-combined.

**Demo Step C.3 — Doctor profile**

- Actions: Tap **View Profile** on a doctor card.
- Navigation: `/doctor-profile` (patient-only).
- Expected Result: Photo, name, specialty, credentials, consultation fee, years of experience, default visit length, today's availability/slots left, next available date, expandable biography, languages, areas of expertise, weekly hours, clinic name/address/room, and a Google Maps "Get directions" link. Private fields (email, phone, PRC, approval status) are never shown. Sticky **"Book appointment"** button starts booking.
- Technical Verification: `GET /api/v1/patient/doctors/:id/profile` — returns only public-safe fields.

**Demo Step C.4 — Book an appointment** *(core demo — detailed in Part G, Step G.3)*

- Navigation: Doctor card **Book Visit** or profile **Book appointment** → `/doctor-schedule`.
- Flow: pick a date on the availability calendar → **Continue Booking** → if the patient has no COMPLETE record with this doctor → `/patient-details` form → `/booking-confirmation` auto-submits → confirmation screen with **queue number** and total patients for the day.
- Expected Result: `POST /api/v1/appointments` returns 201 with `queueNumber`; a `WAITING` queue entry, a `SCHEDULED` appointment, an `UNPAID` payment row, and a notification are created atomically.
- What to Show: Date status colors (AVAILABLE / FULL / UNAVAILABLE / PAST / NON_WORKING), the waitlist card on FULL dates, and the queue-number confirmation.
- Technical Verification: booking re-validates everything server-side (past date, availability, capacity, same-day conflict `CONFLICT`, record completeness) inside one transaction with an advisory lock.

**Demo Step C.5 — Appointments tab + live queue**

- Navigation: **Appointments** tab.
- Expected Result: Filters Upcoming (`SCHEDULED`/`CONFIRMED`/`IN_PROGRESS`), Completed (`COMPLETED`), Cancelled (`COMPLETED`→`CANCELLED`/`NO_SHOW`); date filter; per-tab counts respect the date; a **Live Queue card** shows queue number, now-serving, patients ahead, estimated wait (patients ahead × 30 min), and polls every 30 s.
- Actions to show: open appointment → `/appointment-detail` → **Reschedule** (`/reschedule`, only SCHEDULED/on-or-after-today/not-started) and **Cancel** (with confirmation).
- Expected Result after reschedule: `PATCH /api/v1/appointments/:id/reschedule` moves the queue entry to the end of the new date, renumbers the old date, adjusts capacity, sends `APPOINTMENT_RESCHEDULED`. After cancel: queue entry deleted, queue renumbered, capacity released, `APPOINTMENT_CANCELLED`, next waitlisted patient promoted.
- What to Show: Real status names; the "needs attention" banner appears here if a doctor schedule change flagged the appointment.

**Demo Step C.6 — Waitlist** *(optional)*

- On a FULL date in `/doctor-schedule`, the payment-method selector is replaced by **Join Waitlist**.
- Navigation: `/waitlist` page lists entries (`WAITING`/`OFFERED`).
- Expected Result: When a slot frees (cancellation/reschedule), `WAITLIST_UPDATE` notification → **Book Now** opens `/doctor-schedule` with the offered date preselected.
- Technical Verification: `GET/POST /api/v1/waitlists*` (PATIENT-only).

**Demo Step C.7 — Payments hub**

- Navigation: Home quick action **Payments**, or Profile → Payments & Invoices, or COMPLETED appointment card → `/payments`.
- Expected Result: `GET /api/v1/payments/me` lists all bills newest-first with filters All/Unpaid/Pending/Paid/Rejected. Each card: appointment, doctor, amount breakdown, method, status chip.
- Actions to show: expand **GCash QR & account details** (public `GET /api/v1/payments/gcash-qr?doctorId=`); **Pay with GCash / Upload New Receipt** → `/payment` guided upload (`POST /api/v1/payments/:appointmentId/receipt`, optional "Amount you paid"); rejected bills show the reason + retry; paid bills show **View Invoice** → `InvoiceBottomSheet` → PDF download saved via the device file service.
- What to Show: The receipt-upload → secretary-review loop is the billing story; the invoice is issued by the secretary, not auto-generated.

**Demo Step C.8 — Chat (patient ↔ secretary, and MediGuide)**

- Navigation: **Chat** tab — two segments: **Clinic** (secretary conversations) and **MediGuide** (AI).
- Clinic: conversation list → thread (`/conversation-thread`). Send a message → secretary's web chat and mobile secretary home show it unread. Patient-info sheet is secretary-side only.
- MediGuide: ask a health question → streamed answer; try "find doctors for X on <date>" → doctor cards with Book Visit; history list + New conversation; daily limit message if exceeded.
- Rules to state aloud: **no patient↔doctor chat exists**; MediGuide refuses diagnosis and gives urgent-care guidance; patient identifiers are stripped before the AI provider.
- Technical Verification: `GET/POST /api/v1/conversations*`, `POST /api/v1/ai/chat` (PATIENT-only, `ai_daily_limits` table).

**Demo Step C.9 — Medical records & prescriptions**

- Navigation: Home/Profile → Medical Records (`/medical-records`).
- Expected Result: **History** tab = issued visits (date, "Dr. Name", photo, diagnosis, notes); **Prescriptions** tab = issued prescriptions (date, doctor, medication count). Filters: Last 7 days / Last 30 days / All time; pull-to-refresh.
- Tap a prescription → `/prescription-detail`: doctor/clinic identity, `RX-YYYYMMDD-XXXXXXXX` number, patient info, consultation details, medication cards (name, dosage, frequency, duration, qty, instructions), doctor notes, replacement info, **Download PDF**.
- What to Show: Only `ISSUED` records appear; PDFs use the standardized filename `SURNAME_Firstname_RX-…pdf`.
- Technical Verification: `GET /api/v1/visits/me`, `/visits/me/:id`, `/prescriptions/me`, `/prescriptions/:id/download`.

**Demo Step C.10 — Notifications**

- Navigation: bell icon → `/notifications`.
- Expected Result: List with unread badges; tapping `APPOINTMENT_*`, `QUEUE_UPDATED`, `SCHEDULE_CHANGE_NOTICE` deep-links to the appointment; `INVOICE_AVAILABLE` opens the invoice; `WAITLIST_UPDATE` opens doctor schedule with the offered date; payment notifications open the payment screen. Mark-read is ownership-validated (404 for others' notifications).
- What to Show: These notifications are the glue of the cross-role demo — point this out.

**Demo Step C.11 — Profile & security**

- Profile tab sections: Account (profile page), Security (**Change Password** → `/change-password`; note `must_change_password` accounts skip current-password check), Notifications (push toggle → registers/removes device token via `POST/DELETE /api/v1/notifications/device-tokens`), About (app version, Privacy notice → `/privacy-notice`), Log Out.
- Password reset (logged out): Login → Forgot Password → `/forgot-password` → email → 6-digit code → new password (`/reset-password`). Three backend endpoints under `/api/v1/auth/password-reset/*`; rate-limited; works for all roles.

---

# Part D — Secretary and Clinic Staff

Secretaries are **provisioned, not self-registered**. Two creation paths:

- **By the Doctor** (demo path): Doctor Portal → `/doctor/secretary` → enter secretary **email + password** → `POST /api/v1/doctors/secretaries`. Creates `users.role=SECRETARY`, `must_change_password=true`, `secretaries.doctor_id=<doctor>`, `is_approved=true`, names NULL.
- **By Admin**: `/admin/secretaries` → Create Secretary (email, password, first/last name, doctor). `must_change_password=false`.

Mobile note: the same Flutter app accepts secretary logins, but secretaries get a **chat-only** home (`/secretary-home` → conversations + patient-info sheet). All clinic operations below are on the **web** portal.

**Demo Step D.1 — Secretary first login (doctor-created account)**

- Platform: Web · Prerequisites: secretary account created by the demo doctor.
- Navigation: `/secretary-login` → email + temporary password → **Log In**.
- Expected Result: `must_change_password` → redirected to `/secretary/change-password`. After changing, layout checks profile completeness → missing first/last name or valid Philippine contact number → `/secretary/complete-profile`.
- Actions: Set new password → complete profile: First Name, Last Name, Contact Number (PH mobile `09…` or landline accepted for staff) → save → `/secretary/dashboard`.
- What to Show: This enforced onboarding is a talking point — accounts can't be used half-configured.
- Technical Verification: `POST /api/v1/auth/login`, `POST /api/v1/auth/change-password`, `PUT /api/v1/secretaries/me`.

**Demo Step D.2 — Secretary dashboard**

- Navigation: `/secretary/dashboard`.
- Expected Result: KPIs and **Payments Needing Action** (PENDING_VERIFICATION GCash receipts, UNPAID completed consultations, PAID-without-invoice) linking to `/secretary/payments`.
- Sidebar nav: Dashboard, **Daily Queue**, Walk-ins, Patients, Appointments, Schedule, Conversations, Payments. Profile (`/secretary/profile`) and Settings (`/secretary/settings`) are separate pages outside the sidebar list.

**Demo Step D.3 — Process the patient's appointment in the queue** *(spine of Part G)*

- Prerequisites: patient booked (Part G, Step G.3) — a `WAITING` entry exists for today.
- Navigation: `/secretary/queue` → select today's date (date selector; UI prefs persist per secretary).
- Expected Result: KPI cards (Total Patients, Waiting, Completed, Assigned Doctor), queue rows with patient name, queue number, status, source badge (ONLINE/WALK_IN), and the doctor's room number in the header.
- Actions:
  1. **Call Next Patient** (`POST /api/v1/queue/:date/next`) → first `WAITING` becomes `CALLED`; patient gets `QUEUE_UPDATED` ("You're Next") + best-effort push.
  2. Row action **Start Checkup** (`POST /api/v1/queue/:id/start-checkup`) → `IN_CHECKUP`; `started_at` set.
  3. Row shows **"Doctor finished"** chip once the doctor issues the consultation.
  4. **Complete Checkup** (`POST /api/v1/queue/:id/complete`) → `COMPLETED`; `completed_at` set. For walk-ins, the payment modal opens automatically (mandatory). For online patients, billing is handled via the BillingPanel.
- What to Show: Status-dependent actions per row: WAITING → Call / Not Present; CALLED → Start Checkup / Skip; IN_CHECKUP → Complete; SKIPPED/NOT_PRESENT → Re-queue. Date filter + status tabs + ONLINE/WALK_IN source filter + search.
- Technical Verification: all queue endpoints verify `secretaries.doctor_id` = entry's doctor; violations return 404 (non-disclosing). Statuses: `WAITING, CALLED, NOT_PRESENT, SKIPPED, IN_CHECKUP, COMPLETED, CANCELLED, NO_SHOW`.

**Demo Step D.4 — Billing & payments**

- Navigation: `/secretary/payments` (tabs: To Review, To Collect, Paid, Needs Attention) or open **BillingPanel** from a queue row / payments row.
- BillingPanel layout: status strip (Total / Paid / Balance / status chip) → Bill (Consultation fee first, locked) → Payments → Collect payment → invoice card.
- Actions to demonstrate:
  - **To Review:** open a `PENDING_VERIFICATION` GCash receipt (patient uploaded via `/payment`) → view receipt → **Accept** or **Reject** (with note) → `PATCH /api/v1/payments/:id/transactions/:txId/accept|reject`; patient gets `PAYMENT_VERIFIED`/`PAYMENT_REJECTED`.
  - **To Collect:** on an UNPAID/PARTIAL bill → **Collect payment** → prefills balance → choose `Cash` (tendered amount + change check) or `GCash` (reference no.) → Record → `POST /api/v1/payments/:id/transactions`. Bill recomputes to PAID.
  - **Add charge:** inline row — Type (Service / Medicine / Other), Name, Qty, Unit price → server computes `qty × unit_price`. `ADDITIONAL` flat charges also supported.
  - **Issue invoice:** once balance = 0 → sticky **Issue invoice** → `POST /api/v1/payments/:id/invoice` → invoice number `INV-…`, ACTIVE status, downloadable PDF (`GET /api/v1/invoices/:id/pdf`).
  - **Void / Edit bill:** void requires a reason (irreversible) → unlocks charges → fix → re-issue; replacement links via `replaces_invoice_id`. Show "Paid invoices are voided and reissued, never edited."
  - **Refunds:** only when OVERPAID → `POST /api/v1/payments/:id/refunds`.
- What to Show: One ACTIVE invoice per payment; charge/invoice locking; audit trail (`billing_audit_log`).

**Demo Step D.5 — Send invoice via chat**

- Navigation: `/secretary/conversations` → open the patient's conversation → **Send Invoice to Patient** → pick invoice.
- Expected Result: `INVOICE` message card in thread (number, date, total, status, View Invoice); patient gets `INVOICE_AVAILABLE` notification → invoice preview in app / Payments hub.
- Technical Verification: `POST /api/v1/conversations/:id/messages` `{messageType:'INVOICE', invoiceId}`; invoice must belong to the secretary's doctor and the conversation's patient.

**Demo Step D.6 — Walk-in registration**

- Navigation: `/secretary/walk-ins` → single-step form: Email, First Name, Middle Name (opt), Last Name, Date of Birth, Sex, Mobile Number, Address, Appointment Date → **Register**.
- Expected Result: `POST /api/v1/walk-ins/direct-register` — one transaction creates user+patient (`must_change_password=true`, temp password shown **to the secretary once** to hand to the patient), COMPLETE association with the assigned doctor, `SCHEDULED` appointment, `WALK_IN` queue entry at next queue number, capacity enforced.
- What to Show: No doctor-selection dropdown (assigned doctor only); duplicate email → conflict; temp password display is the credential-delivery mechanism.
- Follow-up: patient logs into mobile with temp password → forced password change → onboarding → appears in queue as WALK_IN; after Complete Checkup the **mandatory payment modal** appears (CASH → PAID immediately; GCASH → UNPAID until receipt upload).
- Technical Verification: `backend/src/api/walk-ins.ts`; registration_source `WALK_IN` vs `ONLINE`.

**Demo Step D.7 — Patients, appointments, schedule**

- `/secretary/patients`: search/list patients of the assigned doctor (`GET /api/v1/patients/search`); `/secretary/patients/[id]`: view/edit (six required fields: firstName, lastName, dateOfBirth, sex, phone, address; optional fields clearable).
- `/secretary/appointments`: appointment list for the assigned doctor, status filters (persisted per user), "Needs attention" badge on schedule-flagged rows.
- `/secretary/schedule`: four tabs — **Working Hours (read-only)**, **Exceptions** (add/edit/delete doctor leave/closures), **Break Periods**, **Capacity** (same UI as doctor's). Changes apply immediately; if they affect active future appointments, those appointments get `needs_attention` + patients get `SCHEDULE_CHANGE_NOTICE`.
- `/secretary/settings`: Account section (optional 2FA toggle, Change password, Trusted Browsers) + Clinic section (Invoice details form; GCash QR page at `/secretary/settings/gcash-qr` shows saved account name/number + upload/delete; GCash account name/number validated — PH mobile `09…`/`+63…` normalized).
- `/secretary/conversations`: three-column chat (list, thread with read/delivered indicators + 10 s auto-refresh, read-only patient-info sheet from `GET /conversations/:id/appointment-summary`).

---

# Part E — Doctor Features

Doctors self-register on web (or are admin-provisioned). Portal: `web` at `/doctor/*`.

**Demo Step E.1 — Doctor self-registration** *(optional live segment; otherwise use the pre-approved demo doctor)*

- Platform: Web · Navigation: `/doctor-login` → **Create an Account** → `/doctor-signup`.
- Step 1 fields: First Name, Middle Name (opt), Last Name, Email, Contact Number (PH mobile/landline), Password (strength rules + visibility toggle), Confirm Password → submit.
- Expected Result: `POST /api/v1/auth/otp/send` stages the signup in `pending_doctor_signups` (bcrypt-hashed password, 15-min expiry) and emails a 6-digit OTP. **No `users`/`doctors` rows yet.**
- Step 2: enter OTP → `POST /api/v1/auth/otp/verify` atomically creates `users` (role DOCTOR, email_verified) + `doctors` (`approval_status=PENDING`, `profile_completion_status=INCOMPLETE`), returns tokens + role-scoped cookies → redirect to `/doctor-profile`.
- What to Show: Two-step nature — account exists only after OTP; professional details come next.

**Demo Step E.2 — Complete professional profile & submit**

- Navigation: `/doctor-profile` (reached after OTP, or by logging in while PENDING+INCOMPLETE).
- Fields: professional photo (PNG ≤4 MB, preview/remove), Specialty, Credentials, PRC License Number (7 digits, unique), Hospital/Clinic (searchable select), Room Number, Years of Experience, Areas of Expertise, Biography, Consultation Fee, Languages Spoken, and **available schedule** (working hours via `/api/v1/doctors/me/schedules`).
- **Submit for Approval** stays disabled until required fields complete; submit validates only professional fields → `profile_completion_status=SUBMITTED`, `approval_status` stays `PENDING` → confirmation modal "Profile Submitted Successfully!" → **Continue to Login** (signs out → `/doctor-login`).
- Rejection path (mention): admin rejects with reason → doctor can't log in (generic error) → after resubmission cycle they see the banner + reason on `/doctor-profile` and can resubmit (→ PENDING again).

**Demo Step E.3 — Admin approval** → see Part F, Step F.2. After approval the doctor logs in at `/doctor-login` → routed to `/doctor/dashboard` (or `/doctor-profile` if profile incomplete; untrusted browser may see `/doctor/trust-device` first).

**Demo Step E.4 — Doctor dashboard**

- Navigation: `/doctor/dashboard`.
- Expected Result: KPIs, **"Now in checkup"** cards (appointments whose queue entry is `IN_CHECKUP`, with Start/Continue/View consultation + `hasDraft`/`doctorFinished` state), **"Needs a Record"** section (COMPLETED consultations missing a visit record and/or prescription, linking to `/doctor/appointments/[id]`), upcoming appointments.
- Sidebar: Dashboard, Appointments, Schedule, Patients, Secretary, Prescriptions. Profile (`/doctor/profile`) and Settings (`/doctor/settings`) are separate pages outside the sidebar list. Setup Progress Tracker (collapsible) shows the 4 onboarding steps and hides when all complete.

**Demo Step E.5 — Schedule management**

- Navigation: `/doctor/schedule` — tabs: **Working Hours** (weekly recurring shifts; multiple blocks/day allowed; start<end, no overlaps), **Exceptions** (date-specific leave/closures; past dates hidden), **Break Periods** (must fall inside working hours, no overlaps), **Capacity** (Calculated vs Configured vs Final vs Registered vs Remaining per date).
- Expected Result: `GET/POST/PUT/DELETE /api/v1/doctors/me/schedules`, `/unavailability`, `/break-periods`, `/capacity`. Mutations show immediate pending state and reconcile from the response.
- What to Show: This is what patients see as AVAILABLE/FULL on the mobile calendar — connect it to C.4.

**Demo Step E.6 — The consultation workspace** *(spine — detailed in Part G)*

- Entry: Dashboard "Now in checkup" → **Start consultation**, or `/doctor/appointments` row action, or `/doctor/appointments/[id]`.
- Prerequisite: secretary moved the queue entry to `IN_CHECKUP`. The doctor never touches queue status.
- `POST /api/v1/consultation/appointments/:appointmentId/start` creates the **draft visit** idempotently.
- Workspace (`web/src/components/consultation/ConsultationWorkspace.tsx`): patient banner (allergies/medications render as "not recorded yet" / "confirmed none" / text; inline edit → `PATCH /api/v1/consultation/patients/:patientId`), "Last visit with this doctor" (or "First visit"), reason for visit, vitals/clinical fields, medication list with favorites + suggestions from own history.
- **Autosave:** `PATCH /api/v1/consultation/visits/:visitId/draft` with `baseUpdatedAt`; concurrent edit → HTTP 409 → "Reload latest" warning (never silent loss).
- **Finish → review (read-only) → Issue:** Issue requires reason for visit + patient DOB/sex complete. `POST /api/v1/consultation/visits/:visitId/issue` finalizes visit `ISSUED`, creates prescription only if ≥1 medication named, generates the PDF, sends a generic `PRESCRIPTION_AVAILABLE` notification. Issued records stand even if PDF generation fails (retry offered).
- Correction path: editing an issued visit sets `is_edited`/`edited_at` + `visit_edit_history`; prescriptions are never edited — **Void** (reason ≥3 chars → `VOIDED`) then issue a **replacement** linked via `replaces_prescription_id`.

**Demo Step E.7 — Patients, prescriptions, secretary, profile, settings**

- `/doctor/patients`: list own patients (`GET /api/v1/patients/doctor/:doctorId`), search, stats; **Add Patient** associates an existing patient account (`POST /api/v1/patients/associate` — cannot create accounts; 404 directs to mobile registration).
- `/doctor/patients/[id]`: demographics/contact/medical info, edit mode (same 6 required fields), appointment history, prescription history, visit history, quick "Edit Visit" modal.
- `/doctor/prescriptions`: history/search list — Issued/Voided badges, void reasons, replacement links, PDF actions + **Regenerate PDF**.
- `/doctor/secretary`: list own secretaries + **create** (email + password; see D intro).
- `/doctor/profile`: read-only registration details + **Edit Profile** (personal + professional fields; email read-only; PRC read-only pending dedicated process; photo replace PNG ≤4 MB; room number always editable) + **signature upload** section (PNG ≤4 MB → private `doctor-signatures` bucket, 300 s preview URLs, `has_signature` only exposed).
- `/doctor/settings`: Account section — optional 2FA toggle, Change password, Trusted Browsers card (list/revoke/sign-out-all).
- `/doctor/appointments`: list with status filters, stats, Start/Continue/View consultation actions, "Doctor finished" chip.

---

# Part F — Administrator

Admins are provisioned (`npm run seed:admin` or SUPERADMIN creation) — there is **no admin self-registration**.

**Demo Step F.1 — Admin login**

- Platform: Web · Navigation: `/admin/login` (the `/auth/admin-login` URL redirects here).
- Fields: Email + Password → **Log In**. Expected role `ADMIN`; backend accepts `ADMIN` and `SUPERADMIN`.
- OTP: regular **ADMIN always requires login OTP** (6-digit email code via `OtpVerification` component, `POST /api/v1/auth/verify-login-otp`, resend with 60 s cooldown). **SUPERADMIN logs in directly, no OTP.** Wrong-role accounts get generic invalid-credentials.
- Sessions: browser-session cookies, 90-min access / 2-h refresh / 2-h idle / 8-h absolute. No trusted-browser prompt for admins.
- Expected Result: `/admin/dashboard`.

**Demo Step F.2 — Approve/reject the demo doctor** *(do this live if the optional E.1 segment ran; otherwise pre-approved)*

- Navigation: `/admin/doctors`.
- Expected Result: stats (Pending/Active/Rejected), status filter, doctor cards → detail modal with two sections — **Basic Information** (name, email, verified badge, contact) and **Professional Information** (photo, specialty, credentials, PRC, hospital/clinic, experience, expertise, bio, fee, languages, schedule via `GET /api/v1/admin/doctors/:id/schedules`).
- Actions: **Approve** → confirm dialog → `PATCH /api/v1/admin/doctors/:id/approve`. Backend validates first/last name, contact number, specialty, credentials, PRC, hospital/clinic **and verified email** before setting `ACTIVE`; approval email sent; audit logged. Cannot approve `REJECTED` (must resubmit first) or already-`ACTIVE`.
- **Reject** → modal with required reason textarea → `REJECTED` + `rejection_reason` + rejection email + audit entry.
- Also available: **Deactivate/Reactivate** doctor accounts.
- What to Show: The two-section review layout and that approval is gated on complete professional data.

**Demo Step F.3 — Admin dashboard & user management**

- `/admin/dashboard`: platform stats via `GET /api/v1/admin/dashboard/stats`.
- `/admin/users`: all user accounts table (role, status, created date).
- `/admin/secretaries`: list, **Create Secretary** (email, password, first/last name, doctor select — requires doctorId), approve, reset password (`POST /api/v1/admin/secretaries/:id/reset-password`), deactivate/reactivate.
- `/admin/admin` *(SUPERADMIN only)*: **Create Admin**, list, edit (`PATCH /admins/:id`), delete (`DELETE /admins/:id`).
- `/admin/doctors` also has a Create Doctor action (`POST /api/v1/admin/doctors`) — note for accuracy: admin-provisioned doctors are created `is_approved=true` but the insert does **not** set `approval_status`/`email_verified`/`contact_number`, so they may not appear in patient search or pass approval validation until the profile is completed — the self-registration path is the reliable demo route. Verify behavior before demoing this button.
- `/admin/audit-log`: filterable audit trail (action type, actor, date range) → clickable rows → Audit Details modal (actor, target, action, timestamp Asia/Manila, reason, metadata). Examples to point at: doctor approvals/rejections, secretary creation, billing mutations.
- `/admin/settings`: admin account settings.

**Permission boundary to state:** ADMIN/SUPERADMIN get **403** on clinic operations — queue, capacity, payments detail, invoices, consultations. They oversee accounts, not clinic floors.

---

# Part G — Complete Cross-Role Workflow

**The spine: one appointment, Patient → Secretary → Doctor → Patient.** Run Parts B→F setup first, then execute these steps live in order. Status names are the real ones.

**Demo Step G.1 — Patient books (Mobile)**

- Role: Patient (new account from Part B) · Platform: Mobile
- Prerequisites: demo doctor ACTIVE with schedule covering today/future demo date.
- Navigation: Doctors tab → doctor card → **Book Visit** → `/doctor-schedule`.
- Actions: tap an `AVAILABLE` date → **Continue Booking** → (first time with this doctor) `/patient-details` → fill required fields → **Submit** → `/booking-confirmation` auto-calls `POST /api/v1/appointments` → confirmation screen.
- Information to Enter (patient details, if prompted): First/Last name, DOB, Sex, Mobile Number, Address (+ optional Middle Name).
- Expected Result: Appointment `SCHEDULED`; queue entry `WAITING` with `queue_number`; `payments` row `UNPAID`; `registered_count` +1; patient notification created.
- What to Show: "You are patient #N" queue position; total patients for the day.
- Next: Secretary.

**Demo Step G.2 — Secretary sees and calls the patient (Web)**

- Role: Secretary · Platform: Web `/secretary/queue`
- Actions: open today's queue → find the ONLINE row → **Call Next Patient** (or row **Call**) → then **Start Checkup**.
- Expected Result: `WAITING`→`CALLED`→`IN_CHECKUP`; `called_at`/`started_at` set; patient receives `QUEUE_UPDATED` ("You're Next") — optionally show the patient's Live Queue card / notification on the phone **now** for a nice cross-device moment.
- Next: Doctor.

**Demo Step G.3 — Doctor conducts the consultation (Web)**

- Role: Doctor · Platform: Web `/doctor/dashboard` → "Now in checkup" card → **Start consultation** (or `/doctor/appointments/[id]`).
- Actions: review patient banner (allergies/meds status), enter reason for visit + clinical details, add ≥1 medication (name, dosage, frequency, duration, qty, instructions), let autosave run (or click save), **Finish** → review screen → **Issue**.
- Expected Result: visit `DRAFT`→`ISSUED` (`issued_at`, `doctor_finished_at`); prescription `ISSUED` + PDF generated; patient gets `PRESCRIPTION_AVAILABLE`; dashboard "Needs a Record" clears for this consult; secretary queue row shows **"Doctor finished"** chip.
- What to Show: autosave/409 protection briefly, the review-before-issue gate (reason + DOB/sex required), medication table on the PDF.
- Next: Secretary completes checkup + billing.

**Demo Step G.4 — Secretary completes checkup and bills (Web)**

- Role: Secretary · Platform: Web `/secretary/queue` → the `IN_CHECKUP` row → **Complete Checkup** → `COMPLETED`. Then open **BillingPanel** (from the row or `/secretary/payments`).
- Actions (online patient path): add a charge if desired (e.g., Service) → **Collect payment** → choose Cash or GCash (+reference) → Record → balance ₱0 → **Issue invoice**.
- Alternative to show: patient already uploaded a GCash receipt → bill sits `PENDING_VERIFICATION` in **To Review** → Accept → then Issue invoice. (Requires the patient to have done C.7 first — you can do the patient receipt upload between G.1 and G.4 for a richer loop.)
- Expected Result: `payments.status` → `PAID`; `invoices.status` → `ACTIVE`; optional: send invoice via `/secretary/conversations` → patient `INVOICE_AVAILABLE`.
- What to Show: status strip Total/Paid/Balance, invoice card with View/Print, "voided and reissued, never edited" rule.
- Next: Patient sees results.

**Demo Step G.5 — Patient sees the outcome (Mobile)**

- Role: Patient · Platform: Mobile
- Actions: check **Notifications** (`PRESCRIPTION_AVAILABLE`, `PAYMENT_VERIFIED`/`INVOICE_AVAILABLE`, `QUEUE_UPDATED`) → **Medical Records** → History shows the visit; Prescriptions shows the Rx → open `/prescription-detail` → **Download PDF** → Payments hub shows PAID bill + **View Invoice**.
- Expected Result: everything the clinic did is visible to the patient — record, prescription PDF, invoice — with real filenames and statuses.
- Close the loop verbally: "The same REST API and PostgreSQL records powered every screen you just saw — mobile, web doctor, web secretary, and admin all read the same source of truth."

**Optional add-ons within the spine:** patient reschedules before G.2 (shows queue renumbering + `APPOINTMENT_RESCHEDULED`); secretary adds an Exception affecting the appointment (shows `needs_attention` + `SCHEDULE_CHANGE_NOTICE`); patient cancels (shows waitlist promotion if a waiter exists).

---

# 12. Feature Implementation Checklist

Legend: ✅ implemented & demoable · 🔧 implemented, needs config/prerequisite data · ◐ partial · 📋 documented/planned, not implemented · ❓ unable to verify

## Patient (mobile)

| Feature | Status | Notes |
|---|---|---|
| Email-OTP registration | ✅ | Needs Supabase email delivery |
| Email-or-username login | ✅ | |
| Password reset (email OTP, 3-step) | ✅ | Needs Supabase email |
| Onboarding/tutorial | ✅ | First-login slides + tutorial overlay |
| Doctor search/filter/profile | ✅ | Client-side filters; verified-only = approval flag; "Top Rated" = verified-only (not real ratings) |
| Availability calendar + booking | ✅ | Current week only for patients; queue-number model |
| Patient-details gate per doctor | ✅ | `patient_doctor_associations` PENDING/COMPLETE |
| Reschedule / cancel | ✅ | PATIENT-only, availability+capacity revalidated |
| Live queue card | ✅ | `GET /queue/today/me`, 30 s polling |
| Waitlist join/offer/book-now | ✅ | 24-h offers |
| Payments hub, GCash QR, receipt upload | ✅ | Needs secretary-configured GCash details for full effect 🔧 |
| Invoice view/download | ✅ | Only after secretary issues ACTIVE invoice |
| Patient↔secretary chat | ✅ | |
| MediGuide AI chatbot | 🔧 | Needs `AI_API_KEY`; otherwise 503 |
| Medical records / prescriptions / PDF | ✅ | ISSUED-only |
| Notifications + deep links | ✅ | Push needs FCM/APNs creds 🔧 |
| Profile, change password, push toggle, privacy notice | ✅ | |

## Doctor (web)

| Feature | Status | Notes |
|---|---|---|
| Self-registration + OTP + profile + submit | ✅ | `/doctor-signup` → `/doctor-profile` |
| Admin approval workflow (PENDING/ACTIVE/REJECTED) | ✅ | Rejected can't log in; resubmit restores PENDING |
| Login OTP (optional 2FA) + trusted devices | ✅ | `/doctor/trust-device` |
| Dashboard, "Now in checkup", "Needs a Record" | ✅ | |
| Schedule: working hours / exceptions / breaks / capacity | ✅ | Immediate apply; flags appointments needs_attention |
| Appointments list + consultation workspace | ✅ | Requires queue `IN_CHECKUP` (secretary action) |
| Visit draft autosave + 409 protection | ✅ | |
| Issue visit + prescription + PDF | ✅ | PDF needs Supabase Storage buckets 🔧 |
| Void prescription + replacement | ✅ | |
| Signature upload (PNG ≤4 MB, private bucket) | 🔧 | Bucket `doctor-signatures` must exist |
| Patients list/detail/edit, associate existing patient | ✅ | Cannot create patient accounts |
| Prescriptions history + regenerate PDF | ✅ | |
| Secretary management (create/list) | ✅ | Doctor must be ACTIVE |
| Profile edit + photo upload | 🔧 | PNG ≤4 MB, `doctor-photos` bucket |
| Settings: 2FA, password, trusted browsers | ✅ | |

## Secretary (web + mobile chat)

| Feature | Status | Notes |
|---|---|---|
| Provisioned by doctor or admin | ✅ | Doctor-created ⇒ forced password change + profile completion |
| Daily queue management (all transitions) | ✅ | Scoped to assigned doctor |
| Walk-in direct registration | ✅ | Temp password shown once; mandatory payment modal after checkup |
| Legacy multi-step walk-in flow | ✅ | `POST /walk-ins/*` endpoints still exist |
| Billing panel: charges, collect, review receipts, refunds | ✅ | ACTIVE-invoice locking rules |
| Invoice issue / void / edit-bill reissue / PDF | 🔧 | Needs payments billed; invoice settings improve output |
| Send invoice via conversation | ✅ | |
| Patient↔secretary chat (web 3-column + mobile) | ✅ | Read-only patient-info sheet |
| Patient list/search/edit (assigned doctor only) | ✅ | |
| Schedule exceptions/breaks/capacity (assigned doctor) | ✅ | Working hours read-only |
| GCash QR upload + account details | 🔧 | `gcash-qr-codes` bucket; PH mobile validation |
| Invoice details settings | ✅ | |
| 2FA, trusted browsers, change password | ✅ | |
| Mobile: chat-only home | ✅ | No queue/payments/walk-ins on mobile — by design |

## Admin (web)

| Feature | Status | Notes |
|---|---|---|
| Login (mandatory OTP for ADMIN; none for SUPERADMIN) | ✅ | Needs Supabase email for ADMIN |
| Dashboard stats | ✅ | |
| Doctor list/review/approve/reject/deactivate | ✅ | Approval validates completeness + verified email |
| Create doctor (admin-provisioned) | ◐ | Created without `approval_status`/verified email — may not pass patient-visibility/approval checks; prefer self-registration flow |
| Secretary list/create/approve/reset-password/deactivate | ✅ | |
| User list | ✅ | Read-only table |
| Admin management (SUPERADMIN) | ✅ | `/admin/admin` |
| Audit log + details modal | ✅ | |
| Clinic operations (queue/payments/etc.) | ❌ by design | 403 — platform oversight only |

## Cross-cutting

| Feature | Status | Notes |
|---|---|---|
| Push notifications (FCM/APNs) | 🔧 | Needs provider creds; in-app list always works |
| Schedule-change → needs_attention → patient notice | ✅ | |
| Queue renumbering on cancel/reschedule + WAITLIST promotion | ✅ | |
| Rate limiting, role-scoped cookies, session versioning | ✅ | Backend-enforced |
| Clinics table / clinic entities | 📋 removed | `003_remove_clinics.sql`; practice info lives on `doctors` |
| Patient↔doctor chat | 📋 prohibited | Never implemented, by design |
| Real doctor ratings/reviews | 📋 not implemented | "Top Rated" filter = verified-only |
| Backend pagination on doctor list | 📋 not implemented | Full list loaded, client-filtered |

---

# 13. Presentation-Day Checklist and Fallbacks

## Day-before checklist

- [ ] `backend`: `.env` complete → `npm run migrate` (idempotent) → `npm run seed:admin` → `npm run dev` — leave running.
- [ ] `web`: `npm run dev` on :3001 — leave running. Open `/doctor-login`, `/secretary-login`, `/admin/login` once to confirm they render.
- [ ] `mobile`: `flutter pub get`, `flutter run` **debug build** on the presentation device/emulator; confirm it reaches login (API reachable).
- [ ] Demo doctor ACTIVE + schedule covering the demo dates; exceptions/breaks/capacity optionally set.
- [ ] Secretary account created, first-login password change + profile **already done** (don't burn stage time on it — or keep it as a live segment if confident in OTP/email).
- [ ] GCash QR + account details configured; invoice settings filled; doctor signature uploaded (for a polished PDF).
- [ ] Backup patient account pre-registered (in case live OTP fails).
- [ ] Optional second PENDING doctor for live approval demo.
- [ ] Browser profiles: use **incognito/normal windows** per role to avoid cookie cross-talk; web supports multiple concurrent portal sessions via role-scoped cookies.
- [ ] Devices charged; hotspot/LAN stable; emulator `10.0.2.2` only works while backend runs on the same host.

## Morning-of checklist

- [ ] Backend health: `curl http://localhost:3000/api/v1/...` responds; web loads; mobile logs in.
- [ ] Log in once with each role to confirm sessions; log out.
- [ ] Confirm demo date still shows `AVAILABLE` on `/doctor-schedule` (capacity may have been consumed by rehearsal bookings — cancel rehearsal appointments or pick a fresh date).
- [ ] Close unnecessary apps; preload the exact routes you'll visit (`/secretary/queue`, `/doctor/dashboard`, `/admin/doctors`, mobile Doctors tab).
- [ ] Have `docs/SYSTEM_STATE.md` open for status names if asked.

## Likely failures → fallbacks

| Failure | Fallback |
|---|---|
| **OTP email not arriving** (Supabase down/quota) | Patient/doctor signup and admin login are blocked — cannot bypass auth. Options: (a) use pre-registered backup accounts and narrate the OTP screens from screenshots/rehearsal; (b) verify spam/junk; (c) resend after 60 s; (d) reschedule demo segment. Never fabricate a successful OTP. |
| **Supabase Storage down** | Skip photo/signature/QR/receipt/PDF-dependent steps; booking→queue→consultation→billing core still works. Prescription Issue still succeeds (PDF retry offered). |
| **AI provider down / no `AI_API_KEY`** | `/ai/chat` returns 503 "MediGuide unavailable" — show the error gracefully or skip chatbot; demo doctor-lookup verbally. |
| **Push notifications not arriving** | In-app notification list + badges still demonstrate everything; state that push needs provider creds. |
| **Live queue empty on stage** | Pre-create the booking in rehearsal and keep it `WAITING` for the demo date, or run G.1 live immediately before G.2 (booking takes seconds). |
| **Doctor not ACTIVE on stage** | Keep a second pre-approved doctor; or approve the pending one live at `/admin/doctors` (needs the doctor's profile submitted beforehand). |
| **Capacity FULL on demo date** | Use the waitlist flow instead (Join Waitlist → offer → Book Now) — it's a feature, not a failure. Or pick another AVAILABLE date. |
| **Web session expired mid-demo** | Role-scoped cookies; just log in again — sessions are per-portal so doctor/secretary/admin can stay logged in simultaneously. |
| **Mobile can't reach backend** | Confirm debug build (release → Render prod). Android emulator needs `10.0.2.2`; real device needs `local_config.dart` LAN IP; same Wi-Fi as the backend host. |
| **Rate limit (429)** | General budget 600/min, auth budget stricter — pause a few seconds; Retry-After header is honored by the web client. Don't script rapid-fire logins. |

## What NOT to do on stage

- Don't demo patient↔doctor chat — it doesn't exist.
- Don't show `.env` files, tokens, or the Supabase service key.
- Don't claim admin can manage queues/payments — it's 403 by design.
- Don't present planned items (ratings, clinic entities, backend pagination) as working.

---

# 14. Known Limitations

- **No patient↔doctor messaging** — by design; only Patient↔Secretary and Patient↔MediGuide.
- **No self-service doctor approval** — every doctor must be admin-approved; `REJECTED` accounts cannot log in at all.
- **Admin-provisioned doctors** (`POST /api/v1/admin/doctors`) are created without `approval_status`/verified email — they may be invisible to patients and fail approval validation; the self-registration flow is the supported path.
- **No patient self-registration on web** — patients exist only in the mobile app.
- **Secretary mobile app is chat-only** — all clinic operations are web.
- **No real ratings** — "Top Rated" filter maps to verified-only; no review system.
- **Doctor list has no backend pagination** — full list fetched, filtered client-side.
- **Patients see current week only** for booking (`GET /doctors/:id/availability` role-filters dates).
- **Appointments are date+queue based** — no time-slot selection; consultation duration (default 30 min) is implicit.
- **Invoice editing is void-and-reissue**, never in-place.
- **Prescriptions immutable once issued** — corrections = void + replacement.
- **Push delivery is best-effort** and needs FCM/APNs credentials; in-app notifications always work.
- **Rate limits apply** — avoid scripted rapid loghits during demo.

---

# 15. Source-Code Reference

Quick map for developers verifying what the guide describes:

| Area | Files |
|---|---|
| Backend entry, route mounts, rate limits | `backend/src/index.ts` |
| Auth (login, OTP challenges, sessions, trusted browsers, password reset) | `backend/src/api/auth.ts`, `backend/src/api/otp.ts`, `backend/src/api/patientOtp.ts`, `backend/src/api/passwordReset.ts`, `backend/src/modules/auth/` |
| Patient OTP signup | `backend/src/api/patientOtp.ts`, `pending_patient_signups` table |
| Doctor self-registration/approval | `backend/src/api/otp.ts`, `backend/src/api/doctors.ts` (`/doctors/me/*`), `backend/src/api/admin.ts` (`/admin/doctors/*`) |
| Appointments + booking transaction | `backend/src/api/appointments.ts` |
| Queue | `backend/src/api/queue.ts`, `backend/src/modules/queue/queueService.ts` |
| Walk-ins | `backend/src/api/walk-ins.ts` |
| Billing/payments/invoices | `backend/src/api/payments.ts`, `backend/src/api/invoices.ts`, `backend/src/api/secretaries.ts` (secretaryPaymentsRouter) |
| Consultation workspace API | `backend/src/api/consultation.ts` |
| Conversations/messaging | `backend/src/api/conversations.ts` |
| AI chatbot | `backend/src/api/ai-chat.ts`, `backend/src/services/aiService.ts` |
| Push | `backend/src/services/pushService.ts` |
| Storage (photos, signatures, receipts, PDFs) | `backend/src/services/storageService.ts` |
| Availability/capacity | `backend/src/modules/availability/availabilityService.ts`, `backend/src/modules/capacity/capacityService.ts` |
| Schema | `backend/database/consolidated_schema.sql`, `backend/src/database/migrate.ts` |
| Admin seed | `backend/src/database/seedAdmin.ts` (credentials defined here) |
| Web portals | `web/src/app/doctor*/`, `web/src/app/secretary*/`, `web/src/app/admin*/`, `web/src/components/layout/*Sidebar.tsx`, `web/src/components/consultation/ConsultationWorkspace.tsx`, `web/src/components/BillingPanel.tsx` |
| Mobile app | `mobile/lib/app/app.dart` (routes), `mobile/lib/features/*` (auth, doctors, appointments, payments, medical-records, conversations, secretary, waitlist, notifications), `mobile/lib/core/constants/api_constants.dart` |
| System state (authoritative behavior log) | `docs/SYSTEM_STATE.md`, root `SYSTEM_STATE.md` |
| Architecture rules | `docs/architecture-essentials.md`, `docs/architecture.md`, `docs/prd.md` |

---

*Generated from source-code inspection of `backend/`, `web/`, `mobile/`, and `docs/` on 2026-11-26. If the implementation changes, update this guide and `docs/SYSTEM_STATE.md` together.*
