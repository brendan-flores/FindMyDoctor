# FindMyDoctor Version History

This document contains the complete version history for the FindMyDoctor application.

---

### 01.25 (October 25, 2026)

**Purpose:** Enable secretaries to record payments for walk-in patients immediately after consultation completion, improving cash flow tracking and reducing manual paperwork.

**Significant Features:**
- Walk-in payment recording flow:
  - New backend endpoint `POST /api/v1/payments/walk-in` (SECRETARY only) that accepts payment details (appointmentId, paymentMethod, consultationFee, additionalCharges).
  - Payment modal opens automatically after completing a walk-in patient's checkup (registration_source = WALK_IN).
  - Modal is mandatory for walk-in patients; secretary must record payment to complete the flow.
  - Payment methods: CASH (status PAID immediately) or GCASH (status UNPAID, patient uploads receipt later).
  - Additional charges can be added during payment recording (reusing existing charge management UI from payments page).
  - Total amount = consultation fee + sum of additional charges.
  - Backend validates walk-in registration source, checks for duplicate payments, and verifies doctor assignment.
  - Backend uses transaction to ensure atomicity of payment and charge creation.
  - CASH payments trigger notification to patient (PAID status).
  - GCASH payments do not trigger notification (UNPAID status, patient will upload receipt later).
- Frontend WalkInPaymentModal component with payment method dropdown, pre-filled consultation fee, additional charges management, and total calculation.
- Payment recording integrated into secretary queue page at `/secretary/queue`.
- Queue endpoint `GET /api/v1/queue/:date` updated to include doctor's consultation_fee for payment modal.
- Web API client `secretaryApi.ts` updated with `recordWalkInPayment` method and QueueEntry interface now includes consultation_fee.

**Improvements:**
- Streamlined payment recording at point of service for walk-in patients.
- Real-time total calculation with additional charges.
- Reusable charge management UI pattern from existing payments page.

**Bug Fixes:** None

**Removed/Modified Functionality:** None

**Breaking Changes:** None (new feature only; existing payment flows unchanged).

**Documentation Updates:** Updated `CURRENT_VERSION.md`, `VERSION_HISTORY.md`, and `SYSTEM_STATE.md`.

---

### 01.24 (October 24, 2026)

**Purpose:** Enforce two-step verification sequence in the forgot password flow across Mobile Patient, Web Doctor, and Web Secretary platforms, ensuring passwords cannot be reset without prior valid code verification.

**Significant Features:**
- Two-step Forgot Password verification flow:
  1. User submits email to request a reset code (`POST /api/v1/auth/password-reset/request`).
  2. The email sent contains only the verification code (no magic links or other reset controls).
  3. UI displays only the verification code (OTP) input field and the "Verify Code" button (with resend button on cooldown).
  4. New password, confirm password, and password reset controls remain hidden until the code is verified.
  5. Upon successful code verification (`POST /api/v1/auth/password-reset/verify`), backend returns a signed `resetToken` (15-minute expiry, bound to user and current `session_version`).
  6. UI reveals new password, confirm password, and "Reset Password" button.
  7. User resets password using the `resetToken` (`POST /api/v1/auth/password-reset/reset`).
- Added backend endpoint `POST /api/v1/auth/password-reset/verify` to verify 6-digit OTP with Supabase Auth and issue signed `resetToken`.
- Updated backend endpoint `POST /api/v1/auth/password-reset/reset` to require and validate `resetToken` against user's current `session_version`, preventing bypass and replay attacks.
- Updated Web Doctor reset password page (`/doctor/reset-password`) to follow the two-step verification sequence.
- Updated Web Secretary reset password page (`/secretary/reset-password`) to follow the two-step verification sequence.
- Updated Mobile Patient reset password page (`reset_password_page.dart`) to follow the two-step verification sequence.
- Updated Web API client `authApi.ts` with `verifyResetCode()` and updated `resetPassword()` to send `resetToken`.
- Updated Mobile `api_service.dart` with `verifyPasswordResetOtp()` and updated `resetPassword()` to send `resetToken`.
- Documented `password_reset` flow in `supabase-email-template-configuration.md` with template rendering only the verification code.
- Added comprehensive unit tests in `backend/src/api/passwordReset.test.ts` and widget tests in `mobile/test/reset_password_page_test.dart`.

**Improvements:**
- Backend-enforced security: password reset requests without a valid `resetToken` obtained from successful verification are rejected.
- Single-use reset tokens: `session_version` increment prevents token reuse and replay attacks.

**Bug Fixes:** None

**Removed/Modified Functionality:**
- Removed simultaneous display of OTP and new password fields immediately upon opening the reset password page.

**Breaking Changes:** None (backward compatibility preserved; clients updated simultaneously across Web and Mobile).

**Documentation Updates:** Updated `CURRENT_VERSION.md`, `VERSION_HISTORY.md`, `SYSTEM_STATE.md`, and `supabase-email-template-configuration.md`.

---

### 01.23 (October 24, 2026)

**Purpose:** Extend the forgot password feature to the web Doctor and Secretary portals for consistent user experience across all platforms.

**Significant Features:**
- Web Doctor Portal forgot password flow: Doctor Login → Forgot Password → enter email → send OTP → Reset Password → enter OTP + new password → reset → back to Doctor Login with success message
- Web Secretary Portal forgot password flow: Secretary Login → Forgot Password → enter email → send OTP → Reset Password → enter OTP + new password → reset → back to Secretary Login with success message
- Web Doctor forgot password page (`/web/src/app/doctor/forgot-password/page.tsx`) with email input form, following the same design patterns as the login page (colors, spacing, card styling, buttons)
- Web Doctor reset password page (`/web/src/app/doctor/reset-password/page.tsx`) with OTP field (6 digits), new password field, confirm password field, password requirements indicators (8+ chars, number, uppercase), resend code button with 60-second cooldown, error banner, and loading state
- Web Secretary forgot password page (`/web/src/app/secretary/forgot-password/page.tsx`) with email input form, following the same design patterns as the secretary login page
- Web Secretary reset password page (`/web/src/app/secretary/reset-password/page.tsx`) with OTP field, new password field, confirm password field, password requirements indicators, resend code button with 60-second cooldown, error banner, and loading state
- Added password reset API client functions to web `authApi.ts`: `requestPasswordReset()` and `resetPassword()` methods calling the existing backend endpoints
- Updated Doctor login page to link to `/doctor/forgot-password` via the "Forgot Password?" link
- Updated Secretary login page to link to `/secretary/forgot-password` via the "Forgot Password?" link
- Web pages reuse the existing backend endpoints (`POST /api/v1/auth/password-reset/request` and `POST /api/v1/auth/password-reset/reset`) which already support both doctor and secretary users via email lookup
- Match the mobile behavior: email validation, OTP sending, password requirements, success/error states, and 60-second resend cooldown for OTP
- Web pages follow the existing web login page design patterns (shadcn/ui components, Tailwind styling)
- Include password strength indicators matching the mobile implementation
- Use the same error messages and success notifications as mobile

**Improvements:** None

**Bug Fixes:** None

**Removed/Modified Functionality:** None

**Breaking Changes:** None (all changes are additive; backend endpoints already existed; no schema changes; existing authentication flows untouched)

**Documentation Updates:** Version files synced.

---

### 01.22 (October 24, 2026)

**Purpose:** Add a secure password reset feature allowing users to reset their password via email OTP verification without authentication.

**Significant Features:**
- Mobile password reset flow: Login → Forgot Password → enter email → send OTP → Reset Password → enter OTP + new password → reset → back to Login with success message
- Backend API endpoints for password reset: `POST /api/v1/auth/password-reset/request` (send OTP) and `POST /api/v1/auth/password-reset/reset` (verify OTP and update password)
- Mobile forgot password page (`forgot_password_page.dart`) with email input form, following the same design patterns as login and signup pages (background with soft blobs, back button, logo, white form card, custom text fields, primary button, trust footer)
- Mobile reset password page (`reset_password_page.dart`) with OTP field (6 digits), new password field, confirm password field, password requirements indicators (8+ chars, number, uppercase), resend code button with 60-second cooldown, error banner, and loading state
- Password reset request endpoint validates email, checks if user exists in PostgreSQL, and sends OTP via Supabase Auth with rate limiting (3 requests per 10 minutes per email)
- Password reset endpoint validates the 6-digit OTP with Supabase Auth, hashes the new password with bcrypt, updates the PostgreSQL users table, clears the `must_change_password` flag if present, and increments `session_version` to invalidate all existing refresh tokens and trusted browser sessions
- OTP service functions `sendPasswordResetOtp()` and `verifyPasswordResetOtp()` in `otpService.ts` use Supabase Auth with `shouldCreateUser: false` to prevent creating Supabase users; PostgreSQL remains the source of truth for application accounts
- Password reset is available to all user roles (PATIENT, DOCTOR, SECRETARY, ADMIN, SUPERADMIN) through the same flow
- For security, the request endpoint returns a success message even if the email is not registered (does not reveal email existence)

**Improvements:**
- Added password reset API constants to mobile `api_constants.dart`
- Added `requestPasswordReset()` and `resetPassword()` methods to mobile `api_service.dart`
- Wired the "Forgot Password?" button in mobile `login_page.dart` to navigate to the forgot password page

**Removed/Modified Functionality:** None

**Breaking Changes:** None (all changes are additive; no schema changes; existing authentication flows untouched)

**Documentation Updates:** `SYSTEM_STATE.md` updated with password reset flow details; version files synced.

---

### 01.21 (October 23, 2026)

**Purpose:** Fix the mobile Secretary Chat tab rendering a completely blank page (no list, no empty state, no spinner) whenever the patient actually had conversations.

**Bug Fix:**
- Root cause: the 01.20 zero-frame guard (`if (MediaQuery.of(context).size.height > 300)`) was nested inside the `_conversations.isEmpty` branch of the inline collection-if chain in `_buildChatContent()`. Dart binds a trailing `else` to the nearest unmatched `if`, so the final `else` (the conversation-card list) attached to the *inner height guard* instead of the outer `else if (_conversations.isEmpty)` chain. The effective logic became: loading → spinner, empty → empty state, **has conversations → render nothing at all**. Any patient with an existing conversation saw the blank tab; a patient with zero conversations still saw the "No conversations yet" state, which is why the bug surfaced only for accounts with real message history.
- Fix: the tab body was extracted into a public `ChatTabContent` stateless widget (`mobile/lib/features/home/presentation/home_page.dart`) with explicit early-return branches — loading → spinner, empty → height-guarded "No conversations yet" filler (zero-first-frame safety preserved), otherwise → `Column` of conversation cards. `_buildChatContent()` now delegates via `isLoading` / `conversations` / `onRefresh`; `onRefresh` preserves the previous behavior of reloading conversations after a thread is closed (mounted-checked). `_buildConversationCard` and `_formatTimestamp` moved unchanged into the widget.

**Tests:**
- Added `mobile/test/chat_tab_content_test.dart` (4 tests, all passing): conversation list renders cards when the list is not empty, empty state renders when no conversations exist, loading spinner renders while loading, unread badge shows the unread count.
- Full mobile `flutter test` suite: 138 pass / 11 failing — the same 11 pre-existing failures (verified in 01.20); `flutter analyze` stays at the 42 pre-existing issues baseline.
- Verified on the Android emulator: the Chat tab now renders the conversation card (secretary name, practice, preview, timestamp) and the card opens the conversation thread with full message history.

**Breaking Changes:** None. Backend, API, data, and login/session flow untouched.

**Documentation Updates:** `SYSTEM_STATE.md` updated in the Mobile Application section; version files synced.

---

### 01.20 (October 23, 2026)

**Purpose:** Redesign the patient Profile tab on mobile into grouped Account / Security / Notifications / About / Log Out sections, add a standalone read-only patient profile screen and a static privacy notice screen, and give the user a persisted push-notification preference.

**Significant Features:**
- Mobile Profile tab (`_buildProfileContent` in `home_page.dart`) rewritten into labeled sections:
  - **Account:** summary card (name, email, role) with a "View patient profile" row that opens the new standalone `PatientProfilePage` (read-only, `GET /api/v1/patients/me` via the existing `getCurrentPatient()` call; loading/error+retry states; shows exactly the same fields as the patient-details flow — fixed a literal `'_userEmail'` rendering bug while wiring it up).
  - **Security:** "Change password" row opening `ChangePasswordPage` via `MaterialPageRoute` with `onSuccess` returning to the Profile tab (success flow now returns to Profile instead of pushing the change page inline).
  - **Notifications:** push-notifications switch labeled `profile_push_switch`, backed by a persisted `push_notifications_enabled` preference (default ON so first-time users match the existing auto-registration behavior). Toggling ON asks the native host / OS for the FCM token and registers it through the existing `POST /device-tokens` endpoint (returns `409`-tolerant idempotent registration); Toggling OFF removes the stored token through `DELETE /device-tokens/:id` and clears the preference. If the OS notification permission is denied, a hint plus `openAppSettings()` is shown. No per-category switches were added.
  - **About:** app version read at runtime via `package_info_plus` (pubspec version), and a "Privacy notice" row opening the new static `PrivacyNoticePage` ("Last updated: October 2026").
  - **Log Out:** unchanged behavior (no confirmation dialog, still removes the device token server-side before clearing the local session).
- New public routes `/patient-profile` and `/privacy-notice` in `app.dart`, inside the authenticated guarded group (unauthenticated requests bounce to `/login`; logout-required state enforces `/change-password`; secretaries are kept on the chat-first home). Mobile patients can only ever view and change their own data through the same pre-existing patient-scoped endpoints — no new endpoints, no queue/payment/clinic-management features.
- `PushNotificationService` (`mobile/lib/core/services/push_notification_service.dart`): `registerForCurrentUser()` now returns `Future<bool>` (true when a token was actually registered); added idempotent `disableForCurrentUser()` (DELETE via the stored `device_token_id`, then clears prefs), the `push_notifications_enabled` preference key with `isPushPreferred()`/`setPushPreferred()`, a test-only `PushNotificationService.withApiService(apiService)` constructor, and the method channel is now exposed as the public `PushNotificationService.channel` constant.
- `HomePage` accepts an optional test seam `pushNotificationService` (falls back to `PushNotificationService.instance`), so widget tests can inject a fake registration service.

**Improvements:**
- New mobile dependencies: `permission_handler` (^12.0.0, needed because the app had no native push host/permission plumbing — bare `MainActivity.kt`) and `package_info_plus` (^8.0.0, the only runtime source of the pubspec version for the About section). `pubspec.lock` regenerated (the previously committed lock was already corrupt and could not be parsed).
- Accessibility/large-text: all new Profile rows use ≥44 px touch targets with `Semantics` labels (`profile_view_details`, `profile_change_password`, `profile_privacy_notice`, `profile_push_switch`), consistent spacing, and text scaling-safe layout.
- Fixed the pre-existing first-frame crash in `_buildChatContent()`: the empty-conversations filler used an unguarded `MediaQuery.of(context).size.height - 300` that produced a negative `BoxConstraints` (`h=-299.0`) on the zero-sized first layout pass — the exact bug class `test/initial_frame_layout_test.dart` was added to prevent in commit `488dcee`. The filler is now guarded (`if > 300`), matching the pattern the old profile filler had. This also un-wedges `initial_frame_layout_test.dart`, which previously failed (and hung a 10-minute attempt) — verified to fail identically at the previous commit (`85b8532` guard regression).

**Removed/Modified Functionality:**
- The old lightweight Profile tab (single card of rows) is replaced by the grouped sections above; the mate "View patient profile" flow now goes through the standalone screen instead of the patient-details form.
- `registerForCurrentUser` callers that ignored the return value still work (the `bool` result is additive, non-breaking).

**Breaking Changes:** None (all changes reuse existing patient-scoped endpoints; no schema changes; login, session handling, and `_logout()` flow untouintouched).

**Tests:**
- Added `mobile/test/profile_section_test.dart` (8 tests, all passing): switch ON registers a token through an injected fake `ApiService`; switch OFF removes the stored token; permission-denied surfaces the settings hint (via a fake `PermissionHandlerPlatform`); Account row opens `/patient-profile`; Privacy row opens `/privacy-notice`; Change password row opens `ChangePasswordPage`; About shows the pubspec version (mocked `PackageInfo`); unauthenticated `MyApp` cannot reach `/patient-profile` (redirects to login).
- Full mobile `flutter test` suite run; `flutter analyze` back at the 42 pre-existing issues baseline (no new analyzer issues). `initial_frame_layout_test.dart` now passes again after the chat-filler guard.
- Pre-existing failures NOT touched: `booking_confirmation_page_test.dart` + `patient_details_test.dart` (reference a nonexistent `receiptImage` param), `change_password_page_test.dart` "Unauthenticated access..." + `otp_verification_page_test.dart` structure test (both verified to fail identically at the previous commit — MyApp's `_initializeApp` await on the push method channel never completes under the fake-async test binding without a channel mock, leaving the splash on screen), and the backend's 5 known jest failures.

**Documentation Updates:** `SYSTEM_STATE.md` updated (profile sections, push preference, new routes/screens), version files synced.

---

### 01.19 (October 23, 2026)

**Purpose:** Fix the mobile Doctor Schedule page failing with 401 "Invalid or expired token" in the "Clinic Schedule & Calendar" card, and remove a RenderFlex pixel overflow on the doctor schedule page.

**Significant Features:** None (bug fixes).

**Improvements:**
- Mobile: the week-range header ("Oct 18 – Oct 24, 2026" + "Regular Clinic" badge) is wrapped in `Center(FittedBox(scaleDown))` so the once-overflowing row scales down on narrow screens instead of clipping; date-info rows (`_buildInfoRow`) give the value an `Expanded(Text(textAlign: end))` so long values wrap instead of overflowing.
- Mobile: fixed a 14 px RenderFlex overflow on the Doctors page "Hospitals & Medical Centers" section header (`doctors_page.dart`) by wrapping the title/subtitle column in `Expanded` (same pattern as the "Top Verified Doctors" header) so the "See all" action never pushes the row past its bounds and the subtitle wraps instead of clipping.

**Bug Fixes:**
- Backend: `middleware/auth.ts` `resolveRolePrefix` exempted the shared sub-resource `/doctors/:id/availability` from the DOCTOR namespace check. The patient mobile app sends its PATIENT token to that endpoint, which the cross-role portal check rejected (401 "Invalid or expired token"), breaking the Clinic Schedule & Calendar card. The endpoint already supports patients (patient-scoped response filtering) and was only reachable with a DOCTOR token after the cross-role hardening. Doctor-portal-only routes remain guarded by `authorize('DOCTOR')`.

**Breaking Changes:** None.

**Tests:**
- `middleware/auth.test.ts`: +3 tests — PATIENT and DOCTOR tokens both pass `authenticate` on `/api/v1/doctors/:id/availability`; `/doctors/me` still rejects PATIENT (401). Backend jest: 342 passing, same 5 pre-existing unrelated failures (`date`, `appointments`, `conversations`, `payments`, `queue`).
- Mobile: `flutter analyze doctor_schedule_page.dart` clean (only a pre-existing unnecessary-import info).

**Documentation Updates:** `SYSTEM_STATE.md`, `architecture.md`, and `architecture-essentials.md` updated with the shared sub-resource exemption.

---

### 01.18 (October 23, 2026)

**Purpose:** Redesign the Secretary Settings page (`/secretary/settings`) into labeled "Account" and "Clinic" sections, adding a Change password card, QR-code status (thumbnail, Active/Not uploaded badge, last-updated date), and display-only "Coming soon" placeholders for upcoming clinic settings.

**Significant Features:**
- Secretary Settings grouped into "Account" (Two-Factor Authentication, Change password, Trusted Browsers) and "Clinic" (Clinic Payment Settings plus placeholders) with equal card spacing; the missing-gap bug between Trusted Browsers and Clinic Payment cards was fixed.
- Change password card added (reuses `POST /api/v1/auth/change-password`): verifies the current password, revokes all other trusted browsers and refresh tokens server-side, and keeps the current session signed in (fresh token pair for this browser).
- Clinic Payment Settings card now shows the current GCash QR thumbnail, an "Active"/"Not uploaded" status badge, and the last-updated date (Asia/Manila), with the note shortened to: "Patients see this QR code in the mobile app when they pay. Receipt review is on the Payments page."
- Display-only "Coming soon" placeholder cards added: "Invoice details" (waiting for the invoice feature) and "GCash account details" (waiting for the patient payments view). They have no interactivity and make no requests.

**Improvements:**
- Backend: added `doctors.gcash_qr_updated_at` (migration `033_add_gcash_qr_updated_at.sql`, applied via `npm run migrate:gcash-qr-updated-at`); set on QR upload, cleared on QR deletion, and returned by `GET /api/v1/gcash-qr/doctor/:doctorId` as `gcashQrUpdatedAt`. `doctors.updated_at` could not be used because profile/photo edits also bump it.
- Backend: fixed portal-role resolution in `middleware/auth.ts` `resolveRolePrefix` — role names are now anchored to the mount namespace, so secretary-only sub-resource paths like `/gcash-qr/doctor/:id` are no longer misread as the DOCTOR portal (a valid secretary token previously received 401 on that route).
- Shared `TrustedBrowsersCard` gained a `confirmDialogs` prop (default true for the doctor page); the secretary page passes false so Revoke and "Sign out of all devices" act immediately without confirmation dialogs, as required.
- 2FA description reworded to "Require a verification code when you sign in from a new or untrusted browser." with the duplicated explainer removed; toggle uses `role="switch"` / `aria-checked`.

**Bug Fixes:**
- Fixed secretary tokens being rejected with 401 "Invalid or expired token" on `/api/v1/gcash-qr/doctor/:id` due to over-greedy URL role matching in `resolveRolePrefix`.

**Removed/Modified Functionality:**
- `GET /api/v1/gcash-qr/doctor/:doctorId` response now includes the optional additive `gcashQrUpdatedAt` field (non-breaking).

**Breaking Changes:** None.

**Tests:**
- Added `gcashQr.test.ts`: assigned-doctor GET returns the URL and upload timestamp; a secretary assigned to another doctor is 403; missing doctor is 404. These tests also regress the `resolveRolePrefix` fix.
- Backend jest: all auth/middleware/gcash suites pass (339 passing; the 5 remaining failures — `date.test.ts`, `appointments`, `conversations`, `payments`, `queue` — are pre-existing stale-date/mock-teardown failures unrelated to this work).
- Web `tsc --noEmit` and `next build` pass.

**Documentation Updates:**
- `prd.md` FR-021, `SYSTEM_STATE.md` (secretary settings, deployment note), and `architecture-essentials.md` (migrations list, settings pages) updated.

**TODOs / Known Issues (pre-existing, not introduced here):**
- Pre-existing backend test failures: `src/utils/date.test.ts` expects a hardcoded clinic date (`2026-10-16`) while the current clinic date is `2026-10-23`; `appointments/conversations/payments/queue` tests share a mock `release` teardown error.

---

### 01.17 (October 23, 2026)

**Purpose:** Redesign the Doctor Settings page (`/doctor/settings`) into a single labeled "Account" section with the 2FA toggle, a Change password card (reusing the shared password-change endpoint), and an enhanced Trusted Browsers card that identifies the current browser.

**Significant Features:**
- Doctor Settings page redesigned into one labeled "Account" section with equal card spacing containing: Two-Factor Authentication, Change password, and Trusted Browsers. No payment/Clinic section (Secretary-only).
- Change password card added builds (`web/src/components/settings/ChangePasswordCard.tsx`): current/new/confirm fields, show/hide toggles, min-8 validation, and reuse of the existing `POST /api/v1/auth/change-password` endpoint.
- A successful password change revokes all other trusted browsers and refresh tokens server-side while the current session stays signed in (fresh token pair issued for this browser).
- Trusted Browsers card now labels the row matching the request's trust cookie with a "This browser" badge.

**Improvements:**
- Backend: `GET /api/v1/auth/trusted-browsers` returns an `is_current` boolean on each row by comparing the request's trusted-browser cookie against stored `token_hash` hashes; no token or hash value is exposed. No schema change required.
- Trusted Browsers card: revoking the current browser confirms that the next sign-in will require a verification code; "Sign out of all devices" confirms "Sign out everywhere? You will need to sign in again on every device." `window.confirm` replaced with a keyboard-accessible `ConfirmDialog` component (`web/src/components/ui/ConfirmDialog.tsx`, no libraries).
- Trusted Browsers card shows the 5 most recent browsers with a "View all" toggle when more exist; dates render in Asia/Manila.
- 2FA description reworded to "Require a verification code when you sign in from a new or untrusted browser." with the duplicated explainer removed; the toggle uses `role="switch"` / `aria-checked`.

**Bug Fixes:** None.

**Removed/Modified Functionality:**
- `GET /api/v1/auth/trusted-browsers` response rows now include the optional additive `is_current` field (non-breaking).
- 2FA toggles remain doctor/Secretary-scoped with unchanged backend endpoints and role checks.

**Breaking Changes:** None.

**Tests:**
- Added backend tests: trusted-browsers list flags the current browser via the request trust cookie and returns all rows as not current without the cookie; existing auth suites (change-password, session policy) still pass.
- Web `tsc --noEmit` and `next build` pass.

**Documentation Updates:**
- `prd.md` FR-002-A item 10, `SYSTEM_STATE.md`, and `architecture-essentials.md` updated for "This browser" labeling, View-all cap, confirmation texts, and the doctor Account section.

**TODOs / Known Issues (pre-existing, not introduced here):**
- The trusted-browsers/device-trust feature remains uncommitted baseline work on `main`; this version builds on it.
- Pre-existing backend test failures unrelated to settings: `src/utils/date.test.ts` expects a hardcoded clinic date (`2026-10-16`) but the current clinic date is `2026-10-23`; `queue.test.ts`/`conversations.test.ts` fail on a mock `release` teardown error.



**Purpose:** Replace the Doctor/Secretary "Remember Me" checkbox with an explicit post-login device-trust prompt that grants a 30-day persistent session and OTP skipping only after the current login has fully succeeded.

**Significant Features:**
- Removed the Remember Me checkbox from `/doctor-login` and `/secretary-login`.
- Added post-login trust pages at `/doctor/trust-device` and `/secretary/trust-device` showing the detected browser, operating system, and device type.
- "Trust this device" registers/rotates a trusted browser for 30 days, upgrades the current session to the 30-day persistent policy, and skips OTP on later logins from that browser when 2FA is enabled. The password is always required.
- "Do not trust this device" keeps the 7-hour access / 8-hour refresh / 8-hour idle browser-session policy, registers no trust, and clears any stale trusted-browser cookie.
- Trusting a device never bypasses the OTP required for the current login; OTP verification always issues a short untrusted session and the prompt appears afterward.
- Existing trusted browsers skip OTP and the trust prompt on later logins.

**Improvements:**
- Backend: `authService.login()` treats the trusted-device cookie as the source of truth, ignores the legacy `rememberMe` login field, and returns `isTrustedBrowser` / `requiresTrustPrompt`.
- Backend: `verifyLoginOtp()` always issues a short staff session and never auto-registers trust.
- Backend: added `trustCurrentBrowser()` to register/rotate the device and reissue a 30-day persistent token pair while preserving the original session start.
- Backend: added `GET /api/v1/auth/trusted-browsers/current-device` and `POST /api/v1/auth/trusted-browsers/trust-current`; reused `POST /api/v1/auth/revoke-trusted-browser` for "Do not trust this device".
- Backend: `AuthRequest` exposes the access token's `sst`/`iat` so the trust upgrade preserves the session start.
- Web: added shared `deviceInfo.ts`, `DeviceTrustCard`, and trust pages; trust pages bypass the dashboard shell.
- Web: Secretary password change takes precedence over the trust prompt; profile completion follows the trust choice.
- Web: `authApi` includes the new trust response fields and device/trust methods; `OtpVerification` no longer sends `rememberMe`.
- Reused the existing `trusted_browsers` table; no new database migration was required.

**Removed/Modified Functionality:**
- Remember Me is no longer a login-form choice for Doctor/Secretary accounts.
- The internal `rememberMe` token/session-policy flag is retained for backward compatibility but now means an explicit trusted-device session.
- `login_otp_challenges.remember_me` remains in the schema for compatibility; new challenges store `false` and it no longer grants trust.
- Admin/SuperAdmin and Patient behavior is unchanged.

**Architecture:**
- Session policy remains centralized in `backend/src/modules/auth/sessionPolicy.ts`.
- Trusted-device tokens remain SHA-256 hashes in PostgreSQL, sent only through HttpOnly/Secure/SameSite cookies, rotated on use, and never exposed to JavaScript or API response bodies.
- Trust state is still revoked by password change/reset, account deactivation, and "Sign out of all devices" via `users.session_version`.

**Testing:**
- Backend and web TypeScript checks pass.
- Targeted Jest: `auth.session.test.ts`, `auth.test.ts`, and `authService.test.ts` — 65/65 pass.
- Full backend Jest run: 334 passed, 24 failed; the 24 failures are the same pre-existing suites (`date`, `conversations`, `payments`, `appointments`, `queue`), with no new failures.
- Live browser verification still requires real Doctor/Secretary credentials, OTP delivery, and a running backend.

**Documentation:**
- Updated `docs/prd.md`, `docs/architecture.md`, `docs/architecture-essentials.md`, `docs/SYSTEM_STATE.md`, `backend/README.md`, and `CHANGES.md`.
- Updated `CURRENT_VERSION.md` to 01.16 and added this entry to `VERSION_HISTORY.md`.

---

### 01.15 (October 20, 2026)

**Purpose:** Enable mobile login to accept either email or username for authentication, with conditional validation and automatic username population during registration

**Significant Features:**
- Mobile login page now accepts both email and username for authentication
- Conditional validation: email format validated only if input contains `@` symbol; usernames accepted without email format validation
- Backend `/api/v1/auth/login` endpoint queries both `email` and `username` columns for authentication
- Username automatically generated from email (part before @) during all registration flows

**Improvements:**
- Mobile: Updated `login_page.dart` validator to accept both email and username with conditional email format validation
- Backend: Updated `authService.ts` register function to populate username column
- Backend: Updated `authService.ts` registerDoctor function to populate username column
- Backend: Updated `walk-ins.ts` walk-in registration to populate username column (both instances)
- Backend: Updated `doctors.ts` secretary creation to populate username column
- Backend: Updated `admin.ts` admin creation, doctor creation, and secretary creation to populate username column
- Backend: Patient OTP registration (`patientOtp.ts`) already populates username from pending signup

**Removed/Modified Functionality:**
- No existing authentication functionality removed; email-only login still works
- Username column was already present in database (migration 009_patient_username_migration.sql)
- Login backend query already supported both email and username; now properly utilized with populated usernames

**Architecture:**
- Database: username column already exists in `users` table (VARCHAR(50), UNIQUE, indexed)
- Backend: modified user creation SQL statements across all registration flows to include username
- Mobile: enhanced validation logic in login form

**Testing:**
- Backend: all user creation flows now populate username from email
- Mobile: login validation accepts both email format and username format
- Backend login query: `WHERE (email = $1 OR username = $1)` leverages populated usernames

**Documentation:**
- Updated CURRENT_VERSION.md to 01.15
- Added VERSION_HISTORY.md entry for 01.15
- Updated SYSTEM_STATE.md with new "Email or Username Login" section documenting conditional validation and automatic username generation

---

### 01.14 (October 20, 2026)

**Purpose:** Implement GCash QR code management feature for the Secretary Web Dashboard, allowing secretaries to upload, preview, and replace their assigned doctor's GCash QR code, which is displayed to patients in the mobile app during the payment process

**Significant Features:**
- Secretary Web Dashboard GCash QR Management at `/secretary/settings/gcash-qr`: upload, preview, and replace the clinic's static GCash QR code
- Doctor-specific GCash QR codes stored in the `doctors.gcash_qr_url` database column (migration `029_add_gcash_qr_url.sql`)
- Backend API endpoints for GCash QR management: `GET /api/v1/gcash-qr/doctor/:doctorId`, `POST /api/v1/gcash-qr/doctor/:doctorId/upload`, `DELETE /api/v1/gcash-qr/doctor/:doctorId`
- Updated public GCash QR endpoint `GET /api/v1/payments/gcash-qr` to accept `doctorId` query parameter and return doctor-specific QR from database
- Mobile app now fetches doctor-specific GCash QR code via `ApiService.getGcashQr(doctorId)` and displays it in the payment screen
- Supabase Storage integration for GCash QR codes (bucket `gcash-qr-codes`, configurable via `SUPABASE_GCASH_BUCKET`)

**Improvements:**
- Backend: added `gcash_qr_url` column to `doctors` table with index (migration `029_add_gcash_qr_url.sql`)
- Backend: extended `storageService.ts` with `uploadGcashQr`, `deleteGcashQr`, and `validateGcashQrFile` functions for QR code storage
- Backend: created new API router `/backend/src/api/gcashQr.ts` with secretary-only QR management endpoints
- Backend: updated `payments.ts` public GCash QR endpoint to accept `doctorId` query parameter
- Web: added `/secretary/settings/gcash-qr/page.tsx` with QR upload (PNG/JPEG, 5MB limit), preview, and delete functionality
- Web: updated `/secretary/settings/page.tsx` with navigation link to GCash QR Management section
- Mobile: updated `PaymentScreen` to accept optional `doctorId` parameter and fetch doctor-specific QR code
- Mobile: updated `ApiService.getGcashQr()` to require `doctorId` parameter and pass it as query parameter

**Removed/Modified Functionality:**
- No existing payment, booking, or queue functionality was removed
- Payment verification workflow remains unchanged in the Payments page (receipt review, verify/reject, payment history)
- GCash QR management is separate from payment verification to maintain clear separation of concerns

**Architecture:**
- Database: added `/backend/database/029_add_gcash_qr_url.sql` and `/backend/src/database/applyGcashQrUrl.ts`
- Backend: added `/backend/src/api/gcashQr.ts`, modified `/backend/src/api/payments.ts`, `/backend/src/services/storageService.ts`, and `/backend/src/index.ts`
- Web: added `/web/src/app/secretary/settings/gcash-qr/page.tsx`, modified `/web/src/app/secretary/settings/page.tsx`
- Mobile: modified `/mobile/lib/features/payments/presentation/payment_screen.dart` and `/mobile/lib/core/services/api_service.dart`

**Testing:**
- Backend: migration `029_add_gcash_qr_url.sql` applied successfully via `npm run migrate:gcash-qr-url`
- Backend: `tsc --noEmit` clean
- Web: `next build` succeeded (41 routes including `/secretary/settings/gcash-qr`); `tsc --noEmit` clean
- Mobile: `flutter analyze --no-pub` reports no errors (only pre-existing infos/warnings)

**Documentation:**
- Updated CURRENT_VERSION.md to 01.14
- Added VERSION_HISTORY.md entry for 01.14
- Updated architecture-essentials.md to include new migration `029_add_gcash_qr_url.sql` in the database concepts list

---

### 01.13 (October 20, 2026)

**Purpose:** Extend the shared mobile application to secretaries so they can sign in with their existing credentials and manage patient conversations from a chat-first home, with role-based routing, push notification deep links, and a read-only patient-info sheet

**Significant Features:**
- Shared patient/secretary mobile application: secretaries log in with the same username/password as the secretary web dashboard through the existing `POST /api/v1/auth/login`; there is no separate app or credential system
- Role-based routing driven by the backend-returned `User.role`: patients land on the existing patient home (Home, Doctors, Appointments, Chat), secretaries land on the chat-first home at `/secretary-home`
- Secretary mobile home at `/secretary-home`: conversation list with patient information, last-message previews, unread counts/badges, pull-to-refresh, and periodic refresh, scoped by the backend to the secretary's assigned doctor
- Read-only patient-info sheet in the mobile app backed by `GET /api/v1/conversations/:id/appointment-summary`, with no appointment mutations
- Minimal secretary mobile menu containing only Notifications, Profile, Settings, and Logout
- Push notification handling: the mobile app registers its device token after authentication and removes/invalidates it on logout, then opens the correct conversation thread from `NEW_PATIENT_MESSAGE` (secretaries) or `NEW_SECRETARY_MESSAGE` (patients) notification taps

**Improvements:**
- Mobile: `api_service.dart` `login()` verifies a shared account as a patient and then as a secretary, retrying only on `INVALID_CREDENTIALS` and keeping the backend `User.role` as the source of truth
- Mobile: added `getAppointmentSummary`, `registerDeviceToken`, and `removeDeviceToken` API methods plus `conversationAppointmentSummary` and `notificationsDeviceTokens` constants
- Mobile: `logout()` now removes the registered push device token and clears the persisted `user_role`, `device_token_id`, and `device_token`
- Mobile: restored sessions re-register the device token and route from the persisted role
- Mobile: `ChangePasswordPage` sends secretaries to `/secretary-home` after a password change while preserving the patient onboarding/home flow
- Mobile: route guards redirect unauthenticated users to login, enforce the mandatory password-change requirement, and keep secretaries away from patient-only routes
- Mobile: the shared conversation thread shows the patient's name in the header when a secretary opens it (from the secretary conversation list or a chat notification deep link), while patients keep the existing doctor/secretary header

**Removed/Modified Functionality:**
- Secretary mobile chat is no longer planned follow-up work; it is implemented in the shared mobile application
- Secretary mobile access deliberately excludes queue management, payment verification, walk-in registration, and schedule management screens; all appointment management remains on the secretary web dashboard
- Direct patient–doctor chat remains prohibited; no patient↔doctor messaging was added
- Backend, web, and database behavior are unchanged; the mobile app reuses existing endpoints, the `Conversation` model, and the shared conversation thread

**Architecture:**
- Mobile: added `/mobile/lib/core/navigation/app_navigator.dart`, `/mobile/lib/core/services/push_notification_service.dart`, `/mobile/lib/features/secretary/models/patient_summary.dart`, `/mobile/lib/features/secretary/presentation/secretary_home_page.dart`, and `/mobile/lib/features/secretary/presentation/patient_info_sheet.dart`
- Mobile: modified `/mobile/lib/app/app.dart`, `/mobile/lib/core/constants/api_constants.dart`, `/mobile/lib/core/services/api_service.dart`, `/mobile/lib/features/auth/presentation/login_page.dart`, and `/mobile/lib/features/auth/presentation/change_password_page.dart`
- Mobile: push uses a native `MethodChannel('findmydoctor/push')` bridge for FCM/APNs token and tap delivery (no new client dependency added; provider credentials stay on the backend)
- Backend: unchanged; reuses `/api/v1/auth/login`, the conversations endpoints, `/api/v1/conversations/:id/appointment-summary`, and the device-token endpoints

**Testing:**
- Mobile: `flutter analyze --no-pub` reports no errors (only pre-existing infos/warnings)
- Mobile: `flutter test test/login_page_navigation_test.dart test/api_service_login_test.dart` passed 14/14
- Mobile: fixed a compile-blocking nullable type mismatch in `test/password_change_enforcement_test.dart`; four pre-existing failures remain because those tests expect a Current Password field that the page hides during a mandatory change (out of scope for this release)

**Documentation:**
- Updated `docs/prd.md` (shared patient/secretary mobile application, Secretary Mobile Experience, patient-info sheet, communication restriction, FR-031, FR-039, secretary views and scope lists, new section 28.2 Mobile Authentication and Routing)
- Updated `docs/architecture.md` (mobile application tree and shared-app note, Mobile Authentication and Routing, Secretary Mobile Navigation, communication/chat architecture)
- Updated `docs/architecture-essentials.md` (new Shared Mobile Application Access subsection under Secretary Chat Rules and additional chat implementation checklist items)
- Updated `docs/SYSTEM_STATE.md` (shared mobile login/routing and secretary mobile messaging/push state, replacing the planned-follow-up note)
- Updated CURRENT_VERSION.md to 01.13 and added this VERSION_HISTORY.md entry

---

### 01.12 (October 19, 2026)

**Purpose:** Implement the secretary–patient chat feature across the backend and the secretary web application, with role-based conversation access, read-status unread counts, chat notifications with FCM/APNs push delivery, device-token management, and a read-only appointment-summary endpoint

**Significant Features:**
- Secretary Web Dashboard chat at `/secretary/conversations` replaces the placeholder with a functional three-column interface: conversation list (patient details, unread badges/counts, latest-message previews), message thread with distinct sender/recipient styling, and a composer; the sidebar adds an unread badge on the Conversations item without changing its layout
- Read-only appointment-summary endpoint `GET /api/v1/conversations/:id/appointment-summary` backs the secretary chat patient-info sheet (secretary-only, assigned-doctor scope, doctor-association access rules; appointment fields only, no mutations)
- Device-token management: `POST /api/v1/notifications/device-tokens` and `DELETE /api/v1/notifications/device-tokens/:id` let an authenticated user register and remove only their own push tokens (`device_tokens` table, migration `028_add_device_tokens.sql`, applied via `npm run migrate:device-tokens`)
- Push delivery integrated after a message is saved via `backend/src/services/pushService.ts` (FCM HTTP v1 with legacy server-key fallback, APNs token-based over HTTP/2); provider credentials remain backend-only and delivery is best-effort, targeting only intended recipients

**Improvements:**
- Backend: `GET /conversations` returns unread counts computed from `messages.read_at` excluding the caller's own messages, plus a latest-message preview consistent with the newest saved message, for both patient and secretary listings
- Backend: `POST /conversations` reuses the patient's single conversation per doctor (no per-secretary duplicate histories); secretaries assigned to the same doctor (`secretaries.doctor_id`) share the same message history
- Backend: role-based access enforced consistently across listing, creation, retrieval, message retrieval, sending, and read-status updates (patient: own conversations for doctors with `patient_doctor_associations` records; secretary: patients associated with the assigned doctor)
- Backend: after a message is saved, recipients receive generic notifications with titles and bodies that never contain message content: patient-sent → `NEW_PATIENT_MESSAGE` to the assigned secretaries; secretary-sent → `NEW_SECRETARY_MESSAGE` to the patient; recipients only, never the sender
- Backend: added `conversationService` (`backend/src/modules/conversations/conversationService.ts`) centralizing authorized-conversation access checks and recipient notifications; added push backend configuration (`FCM_*`, `APNS_*`) in `backend/src/config/index.ts`
- Web: `secretaryApi.ts` adds `conversationApi` (list, get, messages, send, mark-as-read, appointment summary) and `Conversation`/`ConversationMessage`/`AppointmentSummary` types using relative API paths against the existing base URL

**Bug Fixes:**
- Fixed patient conversation unread counts including the patient's own sent messages

**Removed/Modified Functionality:**
- `POST /conversations` no longer requires both `secretaryId` and `doctorId`; it now requires `doctorId` (with optional `secretaryId`) and validates the patient's doctor association plus the secretary's doctor assignment; responses are enriched with secretary/doctor names
- `PATCH /conversations/:id/read` and message retrieval now enforce conversation authorization (previously unauthenticated-body verification only); unauthorized attempts return `403 CONVERSATION_ACCESS_DENIED` or `404`
- Direct patient–doctor chat remains prohibited; no patient↔doctor messaging endpoints were added
- Secretary mobile chat is planned follow-up work and is not implemented

**Architecture:**
- Backend: modified `/backend/src/api/conversations.ts`, `/backend/src/api/notifications.ts`, `/backend/src/config/index.ts`; added `/backend/src/modules/conversations/conversationService.ts`, `/backend/src/services/pushService.ts`
- Database: added `/backend/database/028_add_device_tokens.sql` and `/backend/src/database/applyDeviceTokens.ts` (`device_tokens` table, indexes, provider+token uniqueness)
- Web: modified `/web/src/app/secretary/conversations/page.tsx`, `/web/src/lib/api/secretaryApi.ts`, `/web/src/components/layout/SecretarySidebar.tsx`
- Mobile: unchanged; existing patient conversation list/messages/send responses remain compatible

**Testing:**
- Backend: added `src/api/conversations.test.ts` (16 tests) covering role-based listing, secretary doctor-scope, association-gated creation, conversation reuse, unauthorized message/read access denial, recipient notifications with generic push payloads (never the sender), read-status updates, and device-token register/remove ownership
- Backend: conversations test suite 16/16 passed; `tsc --noEmit` clean
- Web: `next build` succeeded (40 routes including `/secretary/conversations`); `tsc --noEmit` clean; lint shows only pre-existing errors in unrelated pages

**Documentation:**
- Updated `docs/prd.md` (section 16 Secretary–Patient Chat, section 24 Notifications, FR-031, FR-039, Secretary Web Dashboard scope) and `docs/architecture.md` (communication module, chat architecture, secretary chat and device-token endpoints, notification module, database tables)
- Updated `docs/architecture-essentials.md` (Secretary Chat Rules access/sharing/unread/patient-info sheet/push rules, database tables and migration list, chat implementation checklist)
- Updated `docs/SYSTEM_STATE.md` (Database Schema, Patient-Secretary Messaging and Push Notifications, Secretary Web Chat)
- Updated CURRENT_VERSION.md to 01.12 and added this VERSION_HISTORY.md entry

**Testing:**
- Mobile: Flutter analyze completed with only pre-existing warnings (no new errors)
- Mobile: Added image_picker dependency successfully
- Backend: Static file serving configured for /public directory
- Backend: Payment endpoints structured for public/authenticated split

**Documentation:**
- Updated CURRENT_VERSION.md to 01.12
- Added VERSION_HISTORY.md entry for 01.12
- Created `/backend/public/README.md` with GCash QR setup instructions

---

### 01.11 (October 18, 2026)

**Purpose:** Replace FindMyDoctor branding logos across mobile and web applications and implement platform-aware API base URL configuration

**Significant Features:**
- Replaced FindMyDoctor logo across mobile application with new branding
- Replaced FindMyDoctor logo across web application with new branding
- Implemented sticky logo headers across mobile app pages for consistent branding visibility

**Improvements:**
- Mobile: Added sticky logo headers to maintain branding visibility while scrolling through pages
- Web: Improved logo sizing in web portal sidebars for better visual consistency
- Backend: Added platform-aware base URL configuration for cross-platform API connectivity
- Backend: Configured uploads rewrite to use dynamic API base URL for proper file serving across platforms

**Bug Fixes:**
- Fixed API connectivity issues across different platforms by implementing dynamic base URL resolution
- Fixed logo sizing inconsistencies in web portal sidebars

**Removed/Modified Functionality:**
- No authentication, registration, OTP, appointment booking, doctor search, queue logic, or business rules were changed; only branding and platform connectivity were updated

**Architecture:**
- Mobile: Modified `/mobile/lib/` (logo assets and page layouts for sticky headers)
- Web: Modified `/web/src/` (logo assets and sidebar components)
- Backend: Modified `/backend/src/` (base URL configuration and uploads rewrite)

**Testing:**
- Verified logo rendering across mobile and web applications
- Verified API connectivity with platform-aware base URL configuration
- Verified file upload/download functionality with dynamic URL rewriting

**Documentation:**
- Updated CURRENT_VERSION.md to 01.11
- Added VERSION_HISTORY.md entry for 01.11

---

### 01.10 (October 18, 2026)

**Purpose:** Report a taken username on the patient sign-up form before any OTP is sent, instead of only after OTP verification

**Significant Features:**
- Patient sign-up now verifies username availability up-front: `POST /api/v1/auth/patient/otp/send` returns `409 Conflict` with `Username already taken` before the sign-up is staged or any OTP is emailed

**Improvements:**
- Backend: The patient OTP `/send` endpoint checks username uniqueness after the existing email existence check and before OTP staging and sending (validation order: email existence check → username uniqueness check → OTP staging and sending)
- Mobile: The sign-up form surfaces the `/send` `409 Conflict` message verbatim (e.g. `Username already taken`, `Email is already registered`) in its inline error banner and snackbar and keeps the user on the form, so a taken username no longer forces the patient to restart registration
- Mobile: `SignUpPage` accepts an optional injected `ApiService` (test seam), matching the existing `AppointmentsPage` pattern; the default behavior is unchanged

**Bug Fixes:**
- Fixed the mobile sign-up form reporting every `409 Conflict` as "Email already exists. Please use a different email.", which mislabelled a taken username

**Removed/Modified Functionality:**
- The username uniqueness check remains in the `/verify` endpoint as the safety net for concurrent registration attempts; no OTP verification flow, Supabase integration, database schema, or architecture was changed

**Architecture:**
- Backend: Modified `/backend/src/api/patientOtp.ts`
- Mobile: Modified `/mobile/lib/features/auth/presentation/signup_page.dart`
- Database: No schema changes; the `users` username unique constraint is unchanged and remains the final backstop

**Testing:**
- Backend: Added `Patient OTP /send - up-front email and username checks` tests (taken username → `409 Username already taken` with no OTP sent and nothing staged; taken email → `409 Email is already registered` with no OTP sent; the email is checked before the username; available email + username → sign-up staged and OTP sent)
- Backend: Live verification against the running API and PostgreSQL confirmed fresh email + taken username → `409 Username already taken`; taken email → `409 Email is already registered`; both taken → `409 Email is already registered`
- Mobile: Added widget tests driving `SignUpPage` through the real `ApiService` with a mock HTTP client (taken username → backend message shown on the form, no navigation to OTP verification, exactly one request; available username → navigates to OTP verification, exactly one request)
- Backend: Full suite 251 passed with 4 pre-existing failures (`src/utils/date.test.ts` timezone, `src/api/auth.test.ts` change-password); `tsc --noEmit` clean. Mobile: 109 passed with 2 pre-existing failures (`password_change_enforcement_test.dart` mock signature, `widget_test.dart` counter smoke test); `flutter analyze` unchanged from baseline
- Not verified: live mobile-device submission of the sign-up form (covered by widget tests against the real `ApiService` and by live API calls instead)

**Documentation:**
- Updated `docs/prd.md` (FR-001-A flow, `/send` endpoint, security requirements, mobile implementation) and `docs/SYSTEM_STATE.md` (Patient Registration & Authentication, Mobile Application) to document the up-front email/username check and the sign-up form error handling
- Updated CURRENT_VERSION.md to 01.10
- Added VERSION_HISTORY.md entry for 01.10

---

### 01.09 (October 18, 2026)

**Purpose:** Fix the mobile layout crash (`Each child must be laid out exactly once.`) and the stuck data-loading state on app launch

**Significant Features:**
- None (bug fix release)

**Improvements:**
- Mobile: The home page no longer derives a negative `SizedBox` height from the viewport (`MediaQuery.size.height - 200` / `- 350`); the empty-state filler is only reserved when there is positive vertical space
- Mobile: The login, sign-up, and OTP pages clamp their scrollable `minHeight` to zero instead of subtracting from a possibly zero height, and the OTP box sizing clamps to zero
- Mobile: The home page clears its loading flags on both success and failure and guards its post-`await` `setState` calls with a `mounted` check
- Mobile: App startup authentication check now always completes initialization (falling back to the login screen if token/storage reads fail) so the startup progress indicator cannot hang
- Mobile: Removed the redundant `AppointmentsPage.didUpdateWidget` refetch that could trigger duplicate appointments API calls on parent rebuilds

**Bug Fixes:**
- Fixed the crash `Each child must be laid out exactly once.`: on Android the first frame is laid out against a 0x0 viewport, which produced an invalid negative constraint, failed the body build, replaced it with an `ErrorWidget`, and left the Scaffold's multi-child layout inconsistent
- Fixed the app getting stuck on loading data (until a manual refresh or hot restart) caused by the corrupted first frame

**Removed/Modified Functionality:**
- No authentication, registration, OTP, appointment booking, doctor search, or queue logic was changed; only layout guards and async state handling were adjusted

**Architecture:**
- Mobile: Modified `/mobile/lib/features/home/presentation/home_page.dart`, `/mobile/lib/features/auth/presentation/login_page.dart`, `/mobile/lib/features/auth/presentation/signup_page.dart`, `/mobile/lib/features/auth/presentation/otp_verification_page.dart`, `/mobile/lib/features/appointments/presentation/appointments_page.dart`, `/mobile/lib/app/app.dart`

**Testing:**
- Mobile: New `initial_frame_layout_test.dart` drives the zero-sized -> real viewport transition for the login, sign-up, and home pages and asserts the invalid-constraint and multi-child-layout errors no longer occur
- Mobile: Full suite passes (107 passed); the 2 pre-existing failures (`password_change_enforcement_test.dart` mock signature, `widget_test.dart` counter smoke test) are unchanged and unrelated

**Documentation:**
- Updated `docs/SYSTEM_STATE.md` (Mobile Application) to document the first-frame layout guards, loading-state handling, and startup initialization resilience
- Updated CURRENT_VERSION.md to 01.09
- Added VERSION_HISTORY.md entry for 01.09

---

### 01.08 (October 17, 2026)

**Purpose:** Fix the patient OTP `/verify` endpoint so a taken username returns a clear conflict error instead of a misleading verification failure

**Significant Features:**
- The patient OTP `/verify` endpoint now checks username uniqueness inside the account-creation transaction, mirroring the existing email uniqueness check
- A taken username returns `409 Conflict` with the message `Username already taken`

**Improvements:**
- Backend: A `users.username` unique violation (PostgreSQL `23505`) raised by a concurrent sign-up is mapped to the same clear `Username already taken` conflict message instead of a raw database error
- Backend: No account is created when the email or username is already in use; the transaction is rolled back

**Removed/Modified Functionality:**
- None. OTP sending/verification, the email uniqueness check, resend, staged sign-up handling, and account-creation behavior are unchanged

**Architecture:**
- Backend: Modified `/backend/src/api/patientOtp.ts` (added an in-transaction username uniqueness check and clearer conflict mapping)

**Testing:**
- Backend: New `patientOtp.test.ts` covers the username conflict, the email conflict, the unique-violation race, invalid-OTP handling, and the happy path

**Documentation:**
- Updated `docs/prd.md` (FR-001-A), `docs/architecture.md`, `docs/architecture-essentials.md`, and `docs/SYSTEM_STATE.md` to document in-transaction email/username uniqueness enforcement
- Updated CURRENT_VERSION.md to 01.08
- Added VERSION_HISTORY.md entry for 01.08

---

### 01.07 (October 17, 2026)

**Purpose:** Redesign the mobile OTP verification page to match the redesigned login and sign-up pages

**Significant Features:**
- Mobile OTP verification page rebuilt to share the login/sign-up visual identity (soft gradient background, gradient brand mark with PH badge, elevated white card, prominent CTA)

**Improvements:**
- Mobile UI: OTP page now shows the destination email in a tinted chip and the six code boxes are responsive, evenly spaced, and size themselves to fit any screen width
- Mobile UI: OTP boxes have distinct empty, filled, focused (primary border with a soft shadow), and error (red border/fill) states with smooth animated transitions
- Mobile UI: Added a "Paste" affordance that reuses the existing clipboard-paste logic
- Mobile UI: Verify button matches the shared CTA treatment (colored shadow, loading spinner); the resend action is a rounded outlined button and the countdown is a muted pill with a clock icon
- Mobile UI: Inline animated error banner added (consistent with login/sign-up) alongside the existing error snackbar
- Mobile UI: Back button rendered as the shared circular affordance and only shown when the page is pushed; keyboard-aware scrolling added

**UI/UX Changes:**
- Mobile OTP verification page visually aligned with the redesigned login and sign-up pages; responsive across 320x568 up to 768x1024 with keyboard-aware scrolling and no overflow

**Removed/Modified Functionality:**
- No OTP verification logic, API integration, validation, resend functionality, countdown behavior, error handling, or navigation was changed

**Architecture:**
- Mobile: Modified `/mobile/lib/features/auth/presentation/otp_verification_page.dart` (UI only)

**Testing:**
- Mobile: New `otp_verification_page_test.dart` verifies structure, empty-code validation, error clearing on input, countdown-to-resend transition, and no overflow across five screen sizes
- Pre-existing unrelated test failures (`password_change_enforcement_test.dart` mock override compile error, `widget_test.dart` counter smoke test) remain unchanged

**Documentation:**
- Updated CURRENT_VERSION.md to 01.07
- Added VERSION_HISTORY.md entry for 01.07

---

### 01.06 (October 17, 2026)

**Purpose:** Redesign the mobile patient sign-up page to match the login UI and collect complete patient information during registration

**Significant Features:**
- Mobile patient sign-up page redesigned to share the login page's visual identity (soft gradient background, gradient brand mark with PH badge, elevated white card, sectioned form, prominent CTA)
- Patient sign-up now collects full patient information: separate first name, middle name (optional), last name, date of birth, sex, mobile number, and address (in addition to email, username, password, and confirm password)
- Backend patient OTP registration flow extended to stage and persist the complete patient profile

**Improvements:**
- Mobile UI: Sign-up form grouped into "Personal Information" and "Account Credentials" sections with subtle section headers
- Mobile UI: Separate First Name (required), Middle Name (Optional), and Last Name (required) fields replace the single Full Name field
- Mobile UI: Date of Birth uses a date picker (read-only field) and Sex uses a dropdown with user-friendly labels (Male, Female, Other, Prefer not to say) mapped to backend values
- Mobile UI: Inline animated error banner added alongside the existing error snackbar; loading disables fields and prevents duplicate submissions
- Mobile core: `CustomTextField` gained optional `readOnly` and `onTap` parameters (backward compatible) to support the date picker field
- Mobile core: `PrimaryButton` label is now overflow-safe (single line with ellipsis) for narrow screens and enlarged system text
- Backend: Patient OTP sign-up payload now accepts `firstName`, `middleName`, `lastName`, `dateOfBirth`, `sex`, `phone` and `address` (validated against the same rules as `patients.ts`); legacy `fullName` is still accepted and split for backward compatibility
- Backend: `POST /auth/patient/otp/verify` now writes all captured patient details to the `patients` table in the same transaction that creates the account

**UI/UX Changes:**
- Mobile patient sign-up page visually aligned with the redesigned login page; responsive across 320x568 up to 768x1024 with keyboard-aware scrolling and no overflow
- Mobile UI: Sex dropdown refined to match the design system — field now mirrors `CustomTextField` (rounded outline, filled surface, error/focus borders, focus shadow, animated chevron) and the expanded options menu uses a rounded elevated surface with comfortable item height, a highlighted selected row with a check mark, and tinted pressed/focus feedback

**Removed/Modified Functionality:**
- The mobile sign-up form no longer collects a single "Full Name" field (replaced by separate name components)
- No authentication, OTP sequence, navigation, or session-handling behavior was removed or changed

**Database Changes:**
- Migration `026_add_pending_patient_signup_details.sql` adds `middle_name`, `date_of_birth`, `sex` (NOT NULL default 'NOT_SPECIFIED' with CHECK constraint), `phone` and `address` to `pending_patient_signups` (idempotent)

**Architecture:**
- Mobile: Modified `/mobile/lib/features/auth/presentation/signup_page.dart`
- Mobile: Modified `/mobile/lib/core/services/api_service.dart` (`sendPatientOtp` signature), `/mobile/lib/core/widgets/custom_text_field.dart`, `/mobile/lib/core/widgets/primary_button.dart`
- Backend: Modified `/backend/src/api/patientOtp.ts`; added `/backend/database/026_add_pending_patient_signup_details.sql` and `/backend/src/database/applyPendingPatientSignupDetails.ts`
- Backend: Added npm script `migrate:pending-patient-signup-details`

**Testing:**
- Mobile: New `signup_page_test.dart` verifies separate name fields, required patient fields, excluded fields, validation messages, password mismatch, and no overflow across five screen sizes
- Mobile: Existing login navigation and API login tests remain green (25/25 total in the run including the new sign-up tests)
- Backend: `tsc --noEmit` passes; migration applied to the database
- Pre-existing unrelated test failure (`password_change_enforcement_test.dart` mock override compile error) remains unchanged

**Documentation:**
- Updated CURRENT_VERSION.md to 01.06
- Added VERSION_HISTORY.md entry for 01.06
- Updated prd.md (FR-001-A), architecture.md (§6.1), architecture-essentials.md (Patient Registration with OTP), and SYSTEM_STATE.md (Patient Registration, Database Schema, Mobile Application)

---

### 01.05 (October 17, 2026)

**Purpose:** Modernize the mobile patient login page UI for a polished, production-ready experience

**Significant Features:**
- Redesigned mobile login page with a modern, card-based layout and improved visual hierarchy

**Improvements:**
- Mobile UI: Login page now uses a soft decorative gradient background with subtle accent blobs and a centered, width-constrained responsive layout
- Mobile UI: Compact gradient brand mark with PH badge and a cleaner "Welcome Back" header
- Mobile UI: Login form presented in an elevated white card with rounded corners (24px) and subtle shadow
- Mobile UI: Login button is more prominent with a colored shadow and distinct loading (spinner), success (teal "Signed In" state), and error feedback
- Mobile UI: Added an animated inline error banner in addition to the existing error snackbar
- Mobile UI: Back button on the login page is only shown when the page is pushed onto the navigation stack (not when it is the root route)
- Mobile UI: Added a security trust footer and refined the sign-up row
- Mobile core: `CustomTextField` enhanced with focus-aware border/icon accent styling, a subtle focus shadow, and optional `borderRadius`, `textInputAction`, and `autofillHints` parameters (backward compatible)

**UI/UX Changes:**
- Mobile patient login page visually redesigned; email/password fields, password show/hide toggle, input borders, icons, and spacing modernized
- Responsive layout verified across 320x568 up to 768x1024 with keyboard-aware scrolling and no overflow

**Removed/Modified Functionality:**
- None. Authentication logic, API integration, validation rules, navigation, and session handling are unchanged

**Architecture:**
- Mobile: Modified `/mobile/lib/features/auth/presentation/login_page.dart` - UI/layout redesign only
- Mobile: Modified `/mobile/lib/core/widgets/custom_text_field.dart` - additive, backward-compatible styling and input options

**Testing:**
- Mobile widget tests: Existing login navigation and API login tests all pass (14/14)
- Verified no layout overflow across multiple mobile and tablet screen sizes
- Pre-existing unrelated test failures (password-change mock override and default counter smoke test) remain unchanged

**Documentation:**
- Updated CURRENT_VERSION.md to 01.05
- Added VERSION_HISTORY.md entry for 01.05
- Updated SYSTEM_STATE.md Mobile Application section with the login page UI redesign

---

### 01.04

**Purpose:** Walk-in Patient Password Change and Onboarding Flow

**Significant Features:**
- Walk-in first login password change: Removed "current password" field requirement for walk-in patients during first login
- Walk-in onboarding flow: Walk-in patients now see onboarding screens after successful password change, aligning with regular app registration experience
- Enhanced password change UX: Different password change flows for walk-in first login vs. regular password changes

**Improvements:**
- Backend API: Modified `/api/v1/auth/change-password` endpoint to make `currentPassword` optional when `must_change_password` is true
- Backend service: Updated `changePassword` function to skip current password verification for walk-in first login (when `mustChangePassword` parameter is true)
- Mobile UI: Change password page now hides "Current Password" field when `must_change_password` flag is true
- Mobile navigation: Walk-in patients are automatically navigated to onboarding screens after successful password change
- Mobile API service: Updated to handle optional `currentPassword` parameter, omitting it from request body when null

**UI/UX Changes:**
- Walk-in first login: Only "New Password" and "Confirm New Password" fields shown
- Regular password change: All three fields shown (Current, New, Confirm)
- Walk-in onboarding: Three onboarding screens shown after password change (Find the right doctor, Manage your health, Book appointments easily)
- Page description updated: Shows different text based on whether it's a required change or regular change

**Testing:**
- Backend tests: Added 2 new tests for walk-in password change flow (with and without current password verification)
- Mobile widget tests: Added 2 new tests for walk-in first login behavior (field hiding and onboarding navigation)
- Mobile API tests: Added 2 new tests for optional currentPassword parameter handling
- All existing tests updated to support the new password change flow
- All tests passing (backend: 19 tests, mobile: 25 tests)

**Architecture:**
- Backend: Modified `/backend/src/api/auth.ts` - Updated change-password endpoint validation logic
- Backend: Modified `/backend/src/modules/auth/authService.ts` - Enhanced changePassword with mustChangePassword parameter
- Mobile: Modified `/mobile/lib/features/auth/presentation/change_password_page.dart` - Added conditional field rendering and onboarding navigation
- Mobile: Modified `/mobile/lib/core/services/api_service.dart` - Updated changePassword to accept optional currentPassword
- Mobile: Updated test files to cover new walk-in password change flow

**Documentation:**
- Updated CURRENT_VERSION.md to 01.04
- Added VERSION_HISTORY.md entry for 01.04
- Updated AGENTS.md to automate version updates (removed user approval requirement)

---

### 01.03

**Purpose:** Secretary Schedule Management

**Significant Features:**
- Secretary Schedule page: Implemented complete schedule management interface for secretaries at `/secretary/schedule`
- Four-tab interface: Working Hours (read-only), Exceptions (add/edit/delete), Break Periods (add/edit/delete), Capacity
- Navigation updates: Doctor sidebar "My Profile" renamed to "Profile"; Secretary sidebar "Capacity" replaced with "Schedule"
- Backward compatibility: Redirect from `/secretary/capacity` to `/secretary/schedule` for existing bookmarks

**Backend API Endpoints:**
- GET `/api/v1/secretaries/managed-doctors/schedules` - Read-only access to assigned doctor's weekly working hours
- GET `/api/v1/secretaries/managed-doctors/unavailability` - List date-specific exceptions
- POST `/api/v1/secretaries/managed-doctors/unavailability` - Create exception
- PUT `/api/v1/secretaries/managed-doctors/unavailability/:id` - Update exception
- DELETE `/api/v1/secretaries/managed-doctors/unavailability/:id` - Delete exception
- GET `/api/v1/secretaries/managed-doctors/break-periods` - List break periods
- POST `/api/v1/secretaries/managed-doctors/break-periods` - Create break period
- PUT `/api/v1/secretaries/managed-doctors/break-periods/:id` - Update break period
- DELETE `/api/v1/secretaries/managed-doctors/break-periods/:id` - Delete break period

**Security & Authorization:**
- Ownership enforcement: All secretary schedule endpoints derive doctor_id from authenticated secretary's `secretaries.doctor_id`
- Non-disclosing 404: Requests for records outside assigned doctor's scope return 404 without revealing existence
- Role-based access: Endpoints restricted to SECRETARY role only; other roles receive 403 Forbidden
- Read-only working hours: Secretaries can view but not modify weekly working hours (doctor-only feature)

**Validation:**
- Exception validation: Start date must be <= end date, valid date format required
- Break period validation: Start time must be < end time, valid HH:MM time format required
- Transaction support: Exception and break period modifications use database transactions for data integrity

**Testing:**
- Comprehensive test suite: Added `backend/src/api/secretaries.test.ts` with 23 tests covering:
  - Schedule read access restricted to assigned doctor
  - Exception CRUD operations with ownership enforcement
  - Break period CRUD operations with ownership enforcement
  - Role-based authorization (SECRETARY-only)
  - Validation rules enforcement
  - 404 responses for out-of-scope records
- All new tests passing
- Backend test suite: 234 tests passing (3 pre-existing timezone test failures unrelated to this work)

**Architecture:**
- Web: Created Secretary Schedule page at `/web/src/app/secretary/schedule/page.tsx`
- Web: Created redirect page at `/web/src/app/secretary/capacity/page.tsx`
- Web: Updated Doctor sidebar in `/web/src/components/layout/DoctorSidebar.tsx`
- Web: Updated Secretary sidebar in `/web/src/components/layout/SecretarySidebar.tsx`
- Backend: Enhanced `/backend/src/api/secretaries.ts` with schedule management endpoints
- Backend: Added getClient import for transaction support
- Documentation: Updated `docs/SYSTEM_STATE.md` to reflect implemented changes

**Documentation:**
- Updated CURRENT_VERSION.md to 01.03
- Added VERSION_HISTORY.md entry for 01.03
- Updated SYSTEM_STATE.md to remove planned changes and document implemented Secretary Schedule functionality

---

### 01.02

**Purpose:** Secretary queue management web dashboard (Completed)

**Significant Features:**
- Secretary queue management page: Implemented complete daily queue management interface for secretaries at `/secretary/queue`
- Date filtering: Added date picker to view queue for specific dates
- Doctor assignment enforcement: Queue automatically filtered to show only patients for the secretary's assigned doctor
- Unified queue display: Shows both online and walk-in patients in a single unified queue with queue numbers
- Queue status management: Implemented status-based actions (Call Next, Start Checkup, Complete, Skip, Not Present)
- Registration source display: Shows whether each patient registered online or as a walk-in

**Improvements:**
- Queue status color coding: Visual indicators for different queue statuses (Waiting, Called, In Checkup, Completed, Not Present, Skipped, Cancelled, No Show)
- Action button state management: Buttons dynamically appear based on current queue status
- Loading and empty states: Proper loading indicators and empty state messages
- Toast notifications: Success and error feedback for all queue actions
- Responsive date picker: Custom date picker component for selecting queue dates

**Architecture:**
- Web: Added complete queue management page at `/web/src/app/secretary/queue/page.tsx`
- Web: Connected to existing backend queue API endpoints (`/api/v1/queue`)
- Web: Integrated with existing apiClient for authenticated API calls
- Web: Reused existing Toast component for notifications
- Web: Followed established web component patterns from doctor schedule page

**Documentation:**
- Updated CURRENT_VERSION.md to 01.02
- Added VERSION_HISTORY.md entry for 01.02

---

### 01.01

**Purpose:** Queue management improvements and navigation fixes (Completed)

**Significant Features:**
- Queue reassignment on appointment cancellation: When a patient cancels their appointment, all patients with higher queue numbers are automatically shifted down (e.g., if #6 cancels, #7 becomes #6, #8 becomes #7)
- Queue change notifications: Affected users receive notifications when their queue numbers are updated, including their old and new queue numbers
- Cancelled user rebooking behavior: When a cancelled user rebooks on the same day, they receive the last queue number (next available) instead of retaining their original queue number

**Improvements:**
- Concurrency-safe queue assignment: Implemented PostgreSQL advisory locks for both online appointments and walk-ins to prevent duplicate queue numbers under concurrent requests
- Atomic capacity checks: Added FOR UPDATE locks on daily_capacities table to ensure capacity checks and increments are atomic
- Navigation fix: Fixed "View in Appointments" button to navigate to the existing appointments tab within the home page instead of opening a separate page without navigation
- Duplicate booking prevention: System already prevents users from booking multiple appointments with the same doctor on the same date (excluding CANCELLED and NO_SHOW statuses)

**Bug Fixes:**
- Fixed navigation issue where clicking "View in Appointments" from booking confirmation opened a page without the bottom navigation bar
- Removed duplicate /appointments route that was conflicting with the existing tab-based navigation

**Architecture:**
- Backend: Enhanced appointment cancellation endpoint with advisory lock-based queue reassignment
- Backend: Enhanced appointment booking endpoint with advisory lock-based queue assignment
- Backend: Enhanced walk-in registration endpoint with advisory lock-based queue assignment
- Mobile: Updated home page to accept initialTab parameter for direct tab navigation
- Mobile: Updated booking confirmation page to navigate to home page with appointments tab selected

**Documentation:**
- Created separate VERSION_HISTORY.md file for easier access to version history
- Updated VERSION.md to reference VERSION_HISTORY.md for history details

---

### 01.00 (Initial Release)

**Purpose:** Initial recorded system version

**Significant Features:**
- Established system-wide version tracking for the web application, mobile application, and backend API
- Implemented core patient, doctor, secretary, and admin user roles
- Established authentication system with email/username login
- Implemented OTP-based verification for patient registration
- Established doctor profile completion and approval workflow
- Implemented appointment reservation system with queue management
- Implemented doctor availability and capacity management
- Established role-based access control across all applications

**Architecture:**
- Modular monolith backend with REST API
- Flutter mobile application for patients
- Next.js web application for doctors, secretaries, and admins
- PostgreSQL as the single source of truth
- Supabase Auth for OTP delivery and verification only
- Supabase Storage for doctor professional photos

**Documentation:**
- Established versioning rules and workflow
- Created comprehensive architecture documentation
- Established system state tracking in SYSTEM_STATE.md
- Created AGENTS.md for AI agent guidelines
