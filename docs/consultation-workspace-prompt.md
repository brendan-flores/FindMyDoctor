# Task: Consultation workspace for doctors (visit + prescription in one flow)

Read `prd.md`, `architecture.md` and `architecture-essentials.md` first, then follow the project's conventions (naming, error handling, security rules, Asia/Manila timezone, role checks, versioning and documentation habits).

**Important:** this prompt is written from the project docs and screenshots, not from the code. It deliberately does not name tables, columns, endpoints, files, components, or status values beyond what the docs and screenshots confirm. Wherever it says "find the real name", look at the code and use what exists. If something here conflicts with the codebase, tell me instead of guessing.

---

## 1. Goal

Today a doctor records a visit from the Patients page (an "Edit Visit" modal) and creates a prescription from the Prescriptions page (a separate "Create Prescription" modal, where the patient and visit must be selected again). Replace that with **one consultation workspace** that opens when the patient is In Checkup, where the doctor records the visit and the prescription on a single page, reviews it, and issues it. The patient then receives the prescription directly in the mobile app.

The secretary keeps control of the queue. **The secretary still presses Complete Checkup.** The doctor finishing does not complete the queue entry.

## 2. Confirmed facts from the docs and screenshots (use these)

- Doctor web pages that exist: Dashboard, Appointments, an appointment detail page (`/doctor/appointments/:id`, which already shows patient details in appointment context), Schedule, Patients (`/doctor/patients/` and a per-patient page), Secretary, Prescriptions (`/doctor/prescriptions`), Profile, Settings.
- Secretary queue page: `/secretary/queue`. Queue statuses in the PRD: Waiting, Called, Not Present, Skipped, In Checkup, Completed, Cancelled, No-show. Secretary queue actions: Next Patient, Start Checkup, Skip / Not Present, Complete Checkup. Queue transitions are enforced by the backend.
- Data chain in the architecture doc: Patient Account -> Appointment -> Visit -> Prescription -> prescription items. Prescriptions link to a visit. Walk-ins use a real patient account created at registration; do not create disconnected temporary records.
- The architecture doc lists visit fields as reason for visit and notes; prescription items as medication name, dosage, frequency, duration, instructions. The current Edit Visit screen also has diagnosis, blood pressure, weight, height and temperature, so the code is probably ahead of the docs. Check.
- Allergies, medications, and emergency contact exist as patient details, but they are not collected at sign-up.
- The patient mobile app shows prescriptions under Medical Records -> Prescriptions. Prescription PDFs are served through short-lived signed links. A "prescription created" notification already exists. Notifications for chat use generic text with no content; follow the same privacy approach.
- The docs classify visit notes, allergies, medications, prescriptions, and medical history as sensitive data.
- Patients on the mobile app see only their own records. Secretaries are not given consultation records.

## 3. How to work

1. **Stage 0: explore and plan, no code.** Find and summarize how things actually work today:
   - the doctor Dashboard, Appointments page, appointment detail page, Patients page (including how a visit is added and edited), and Prescriptions page;
   - the real visit and prescription structures (columns, statuses if any, whether a visit must link to an appointment, whether diagnosis and vitals already exist);
   - how queue status relates to the appointment status, and where the queue row on `/secretary/queue` gets its data;
   - how a prescription's PDF is created and served today, and how the notification is created;
   - where patient allergies, medications, birth date, and sex are stored today and which pages edit them;
   - what the secretary is currently allowed to read about visits and prescriptions;
   - the project's conventions for migrations, tests, versioning, and documentation updates.
   Post a plan and **wait for my approval** before writing code. Include your answers to the open items in section 11.
2. Work in stages (section 10). After each stage, stop and report, then wait for me to say continue.
3. Small, reviewable commits. Do not break existing behavior. Existing visits and prescriptions must keep working and display correctly.

## 4. The flow (what must happen)

1. The secretary starts the checkup, as today. The patient becomes In Checkup.
2. The doctor sees that patient in a **Now in checkup** area on the Dashboard, with a **Start consultation** button. The same button appears on that patient's row on the Appointments page.
3. **Start consultation** opens the appointment detail page as the consultation workspace. A **draft visit** is created automatically and linked to this appointment (never created twice; opening again reopens the same draft). The draft autosaves as the doctor types and reopens exactly where they left off.
4. The doctor records the visit (reason, diagnosis, notes, vitals) and builds the prescription (medications with name, dosage, frequency, duration, quantity to dispense, instructions, plus notes for the patient). Helpers: medication suggestions as they type, favorites, and copy from the patient's previous prescription.
5. **Finish** switches the same page to a **read-only review**, showing the visit and the prescription as the patient will see them, with **Back to edit** and **Issue**. This is not a modal.
6. **Issue** does the following together:
   - the visit becomes final;
   - the prescription is created and its PDF is generated (only if there is at least one medication);
   - the patient is notified that a prescription is available, using generic text that does not name any medication or diagnosis;
   - the consultation is marked as **doctor finished** for the secretary's queue row.
7. The queue entry does **not** change status when the doctor issues. On `/secretary/queue` the patient's row shows a **Doctor finished** chip. The secretary then presses **Complete Checkup** as usual, which moves the patient to Completed and opens the Billing panel (already built).
8. Corrections after issuing:
   - Visit details can be edited later. Edited visits show an "edited" mark with the date, and there is a record of who changed what.
   - A prescription is never edited or deleted. A wrong one is **voided with a reason** and a new one is issued. The patient is notified generically that the prescription was updated. The voided one stays visible as Voided to the doctor and the patient.

## 5. UI specification

Use the project's existing frontend stack, components, and styling. No modals for the main flow.

### 5.1 Doctor Dashboard: "Now in checkup"
```
┌─ Now in checkup ──────────────────────────────────┐
│ Q-03  Maria Santos          In checkup since 2:05 │
│                              [ Start consultation ]│
└───────────────────────────────────────────────────┘
```
Show one card per patient currently In Checkup for this doctor. If a draft already exists, the button reads **Continue consultation**. If the doctor has already issued, show "Doctor finished" with a link to view. Show nothing when no one is In Checkup.

### 5.2 Appointments page
Add the same Start / Continue consultation button on the row of a patient who is In Checkup. Other rows are unchanged.

### 5.3 Appointment detail page = consultation workspace
```
┌─ Consultation · Q-03 · Maria Santos ──────────────────────────────┐
│ ⚠ Allergies: Penicillin   Current meds: Metformin   Last: Oct 2   │
├───────────────────────────────────────────────────────────────────┤
│ VISIT                                                             │
│  Reason     [ Acute respiratory infection                    ]    │
│  Diagnosis  [ Upper respiratory tract infection              ]    │
│  Notes      [ Clinical notes…                                ]    │
│  Vitals     BP [____]  Weight [__]  Height [__]  Temp [__]        │
├───────────────────────────────────────────────────────────────────┤
│ PRESCRIPTION                                   [+ Add medication] │
│  Amoxicillin 500mg · 1 cap · 3x daily · 7 days · qty 21     🗑    │
│  Paracetamol 500mg · 1 tab · every 6h if fever · 5 days     🗑    │
│  [ Copy from previous ]   [ Favorites ]                           │
│  Notes for patient [ …                                       ]    │
├───────────────────────────────────────────────────────────────────┤
│ Autosaved 2:14 PM                                  [ Finish ]     │  ← fixed bar at the bottom
└───────────────────────────────────────────────────────────────────┘
```
- One scrolling page. The bottom bar stays visible with the autosave time and the Finish button.
- When the patient is not In Checkup (or the consultation is already issued), the page shows the patient and visit information read-only with no Start / Finish controls, and shows the issued prescription if there is one. Keep whatever the appointment detail page shows today for other cases.
- Medication suggestions: find what already exists in the project that can supply medication names (for example previously used names, or an existing list). Do not integrate an external drug database or add a new dependency without asking me. If nothing exists, suggest names from this doctor's own previous prescriptions and the favorites list, and tell me.
- Favorites are per doctor. The doctor can save a medication row (name, dosage, frequency, duration, instructions) as a favorite and remove it later.
- Copy from previous: copies the medications of the patient's most recent prescription from this doctor into the current draft, editable. Hide the button when there is no previous prescription.

### 5.4 Patient banner (allergies and medications): three states
```
Not recorded yet   →  ⚠ Allergies: not recorded yet   [ Add ]        (amber)
Confirmed none     →  ✓ No known allergies                           (neutral)
Recorded           →  ⚠ Allergies: Penicillin   Current meds: Metformin
```
- A blank must never look like "no allergies". Distinguish "not recorded yet" from "confirmed none" (this likely needs a way to store that confirmation; find the least invasive option and tell me).
- The doctor can add or edit allergies and current medications directly in the banner without leaving the page. They save to the patient's record so the next visit already has them.
- Show **First visit** instead of a last-visit date when the patient has no previous completed visit with this doctor.

### 5.5 Review view (after Finish)
```
┌─ Review before issuing · Maria Santos ────────────────────────────┐
│ VISIT         reason · diagnosis · notes · vitals (read-only)     │
│ PRESCRIPTION  as the patient will see it (read-only)              │
│ ⚠ Missing: patient age and sex — add them before issuing          │  ← only when needed
├───────────────────────────────────────────────────────────────────┤
│ [ Back to edit ]                                    [ Issue ]     │
└───────────────────────────────────────────────────────────────────┘
```
- If information the prescription PDF needs is missing (the patient's name, age, or sex), show it here and block Issue until it is added, instead of printing a half-empty prescription. Let the doctor add it from this view. Check what the project's PDF already requires and use that list.
- If the doctor added no medications, Issue still finalizes the visit but creates no prescription and sends no prescription notification. Say so in the review ("No prescription will be created").
- After issuing, the doctor sees **Print / Download PDF** and a link back to the Dashboard.

### 5.6 Secretary queue row (`/secretary/queue`)
```
Q-03  MS  Maria Santos  Online  In Checkup  [Doctor finished]  [Complete Checkup]
```
- A small **Doctor finished** chip appears when the doctor has issued. The queue status itself is unchanged.
- The secretary must not receive diagnosis, notes, vitals, or medications. Expose only the finished indicator to the secretary's queue data.

### 5.7 Patients page and Prescriptions page
- Patients page: visit history and prescriptions reflect the new data. The existing "Add visit" becomes **Add past visit** for records that do not come from a queue visit (check whether a visit may exist without an appointment today, and tell me). Edited visits show the "edited" mark. Keep the existing Edit Visit modal for quick corrections.
- Prescriptions page: becomes a history and search list with status (issued, voided), with **Void and replace**. Keep creating from here only as a secondary path, using the same draft/issue rules, and say what you did.
- Small confirms (for example "Void this prescription?" with a required reason) may be modals. The visit, the prescription, and the review must never be three modals in a row.

### 5.8 Mobile (patient)
- Only **issued** prescriptions are visible to the patient. Drafts never appear.
- The notification opens the prescription (follow the existing notification and deep-link handling).
- Voided prescriptions are shown clearly as voided, with the replacement easy to find, so a correction does not look like missing information.
- Downloading the PDF keeps using short-lived links. No permanent public link.

## 6. Rules

- **Roles and access:** only the assigned doctor works in the consultation and sees its content. Patients see only their own issued records. Secretaries and admins get no access to consultation content. The finished indicator on the queue is the only thing the secretary sees.
- **Drafts:** a draft is private to the doctor, autosaves, and is never shown to the patient. Opening Start consultation twice must reopen the same draft. If two browser tabs edit the same draft, do not silently lose changes; warn or merge sensibly and tell me what you chose.
- **Issued records are final.** Prescriptions are voided and replaced, never edited or deleted. Visit edits are marked and logged. Keep a record of who did what and when, with a reason for voids.
- **Queue ownership:** the doctor never completes the queue entry. Issuing only sets the doctor-finished indicator. The secretary's Complete Checkup behaves exactly as it does today.
- **If the secretary completes the checkup before the doctor issues:** allow it. The draft stays, the doctor can still finish and issue afterwards, and the patient is notified when it is issued. Tell me if you see a problem with this.
- **Starting a consultation** requires the patient to be In Checkup with this doctor. Enforce on the backend, not only by hiding the button.
- **Cancelled or no-show** appointments cannot have a consultation started. If an appointment becomes cancelled or no-show while a draft exists, keep the draft but do not allow issuing, and tell me how you handled it.
- **Walk-ins** use exactly the same flow, since they have an account and an appointment. Do not create disconnected temporary records.
- **Notifications** use generic text, with no medication names, diagnosis, or notes, in the in-app notification and any push.
- **Required fields:** follow the existing required-field rules for visits and prescriptions. If none exist, propose a minimal set (for example a reason for visit) and tell me.
- **Existing data:** current visits and prescriptions must keep working. Treat existing records as final/issued, and do not change how old ones look to patients.

## 7. New patients and walk-ins

- First visit with this doctor: banner shows "not recorded yet" for allergies and medications, the last-visit area says **First visit**, **Copy from previous** is hidden, and the visit history shows a simple empty state.
- If the patient's age or sex is missing, the review step flags it before issuing.
- **Online new patient:** has an account and the app, so the notification and prescription reach them as described.
- **Walk-in who has not logged in yet:** no push will reach them, but the prescription is available on their account after their first login and password change. After issuing, the doctor gets Print / Download PDF to hand them a copy. Printing remains a doctor action; do not give the secretary access to prescription content.
- Secretary registration does not change in this task.

## 8. Do NOT

- Change queue logic, queue statuses, or the secretary's Complete Checkup behavior, other than showing the doctor-finished chip.
- Complete the checkup, create a bill, or touch payments from the doctor side.
- Let the doctor suggest or add charges in this task.
- Show consultation content to the secretary, or expose it in any endpoint the secretary can call.
- Add new libraries, external drug databases, or new top-level doctor pages without asking.
- Hard-delete visits or prescriptions.
- Invent names. Use the real tables, endpoints, and components you find.

## 9. Tests

Use the project's existing test setup, and a real test database if one exists (a mocked database cannot prove draft, concurrency, or permission behavior).
1. Full flow: patient In Checkup, doctor starts, draft created once, autosave persists across reload, doctor adds visit details and two medications, finishes, reviews, issues. The visit is final, one prescription exists with two items and a PDF, the patient gets one generic notification, the secretary's queue row shows the finished indicator, and the queue status is unchanged.
2. Starting twice reopens the same draft; a second tab does not silently overwrite.
3. A patient who is not In Checkup (or whose appointment is cancelled / no-show) cannot start a consultation (backend rejects).
4. Issue with no medications finalizes the visit with no prescription and no notification.
5. Missing age or sex blocks Issue until added; adding it from the review view works.
6. Allergy banner shows the three states correctly, including a new patient, and a blank is never shown as "no allergies".
7. Copy from previous and favorites work; Copy from previous is hidden for a first prescription.
8. Void and replace: the old prescription shows Voided, the new one is active, the patient sees both clearly, the notification is generic, a reason is required, and nothing is deleted.
9. Visit edit after issuing shows the "edited" mark and keeps a change record.
10. Secretary completing the checkup before the doctor issues still works, and the doctor can still issue afterwards.
11. Authorization: another doctor, a secretary, an admin, and another patient cannot read or change the draft, the visit content, or the prescription; the secretary queue data contains only the finished indicator.
12. Drafts never appear to the patient in the mobile app.
13. Existing visits and prescriptions still display; existing tests pass.

## 10. Stages (stop after each and report)

- **Stage 0:** exploration and plan, no code. Wait for my approval.
- **Stage 1:** consultation workspace on the appointment detail page, entry points (Dashboard card and Appointments button), auto-created draft visit, autosave, backend check that the patient is In Checkup, and the allergy/medication banner with its three states.
- **Stage 2:** prescription section in the workspace (including quantity, suggestions, favorites, copy from previous), the review view, Issue (final visit, PDF, generic patient notification), print/download, and the doctor-finished chip on the secretary queue row.
- **Stage 3:** corrections: visit edit marks and change record, prescription void and replace, patient-side voided display, notifications for updates.
- **Stage 4:** Patients page and Prescriptions page adjustments (Add past visit, history and search, status), existing data check, documentation updates following the repo's conventions, and the acceptance checklist.

## 11. Open items to answer in your Stage 0 plan

1. How queue status maps to the appointment status, and the cleanest way to expose a doctor-finished indicator to the secretary's queue data without exposing medical content.
2. Whether diagnosis and vitals already exist in the visit structure, and whether a visit can exist without an appointment today.
3. How to record "allergies confirmed none" distinctly from "not recorded".
4. Where medication suggestions will come from without adding a new dependency.
5. How autosave and the two-tabs case will work.
6. What the prescription PDF currently requires and where patient age, sex, and the doctor's license details come from.
7. What happens to a draft if the appointment becomes cancelled or no-show.
8. Anything in this prompt that conflicts with the real code or the docs.

## 12. Out of scope

Doctor-suggested charges, vitals entered by the secretary, patients entering their own allergies or medications in the mobile app, pharmacy integration or QR verification of prescriptions, doctor-initiated completion of the queue entry, controlled-drug or legal-format requirements, and changes to secretary registration. List any of these you think should be follow-ups.

## 13. Checkpoint format

At the end of each stage, report: what changed, files and migrations touched, how each item above was handled, test results, anything you decided that I should review, and the next stage you propose. Then wait.
