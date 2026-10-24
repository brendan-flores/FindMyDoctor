# Changes

## Dashboard 429 elimination: rate limits, read caching, and query batching (2026-10-24)

**Scope:** Web Doctor/Secretary/Admin dashboard navigation, backend rate limiting, availability reads, and dashboard/payment query patterns. No API contract, schema, role, or authorization change.
**Status:** Implemented, type-checked, and tested. **Not committed or pushed.**

### Root cause

- `backend/.env` configured `RATE_LIMIT_WINDOW_MS=900000` (15 minutes) with a general `RATE_LIMIT_MAX_REQUESTS` of 100 or less, and the single limiter was mounted on all `/api/` traffic.
- Each client-side route change re-mounted layouts/sidebars that re-fetched `/doctors/me`, `/doctors/me/schedules`, `/secretaries/me`, `/users/me`, and `/conversations`, while dashboard pages also re-fetched their summary endpoints. Normal navigation therefore consumed the small 15-minute budget and returned `429`.
- The web client had no GET cache, no in-flight de-duplication, and no 429 backoff, so every navigation produced fresh requests and surfaced the 429 immediately.
- Some dashboard endpoints also issued avoidable queries: the Doctor dashboard re-queried schedule/break/exception rows already loaded for capacity, the Secretary dashboard serialized independent reads and used a correlated unread subquery, and the payments list loaded charges one payment at a time (N+1).

### Changes

**Backend rate limiting**
- New `backend/src/middleware/rateLimit.ts` with `createRateLimiter`, `apiLimiter`, and `authLimiter`.
- General budget: `300` requests per `60,000 ms` per IP (`RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS`).
- Sensitive auth budget: `30` requests per `900,000 ms` per IP (`AUTH_RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_WINDOW_MS`) for `/auth/login`, `/auth/verify-login-otp`, `/auth/resend-login-otp`, `/auth/otp`, `/auth/patient/otp`, `/auth/register`, and `/auth/change-password`. Sensitive routes count against both budgets, so the stricter limit wins.
- `429` responses now always include `Retry-After` and the standard `{ success: false, error: { code: "RATE_LIMIT", message } }` envelope. `OPTIONS` pre-flight requests are skipped.
- Rate limiting is additive to authentication/role checks; no protected route became public.
- Updated `backend/.env` in place (non-secret rate-limit values) and documented the variables in `backend/.env.example` and `backend/src/config/index.ts`.

**Server-side read caching**
- New `backend/src/utils/ttlCache.ts` (`TtlCache` with TTL, prefix invalidation, and in-flight sharing).
- `backend/src/modules/availability/availabilityService.ts` now caches availability ranges for `AVAILABILITY_CACHE_TTL_MS` (default `20,000 ms`), keyed by doctor + start + end. Patient-specific reads (`patientId` present) always bypass the cache.
- Successful non-`GET` requests through the doctors, secretaries, appointments, and walk-ins routers invalidate the cache.
- Availability range reads now load schedules, breaks, exceptions, capacity, and appointments in batched queries instead of per-date work.

**Query batching**
- `capacityService.calculateCapacityRange` uses 4 batched queries and exports `buildCapacityResult` / `calculateCapacityWithContext` for callers that already hold schedule rows.
- Doctor dashboard: 8 independent reads run in one `Promise.all`; capacity reuses the loaded schedule/break/exception/capacity rows.
- Secretary dashboard: independent reads run concurrently; the per-patient correlated unread subquery was replaced with one aggregate over `messages`/`conversations` guarded by `EXISTS appointments`.
- Payments list: charges are loaded with one `payment_id = ANY($1::uuid[])` query and grouped in memory.

**Web client**
- New `web/src/lib/api/requestPolicy.ts`: GET-only retry on 429, 3 total attempts, 500 ms base exponential backoff, jitter up to 250 ms, 5 s cap, and `Retry-After` precedence.
- New `web/src/lib/api/ttlCache.ts` and `web/src/lib/api/apiClient.ts` integration:
  - Successful GET responses are cached in memory for 15 seconds under `<portalRole>|<endpoint>`.
  - Concurrent identical non-abortable reads share one in-flight request.
  - The cache is cleared on token/role change, logout/session expiry, and after any successful `POST`/`PUT`/`PATCH`/`DELETE`. A generation counter prevents pre-clear requests from repopulating stale data.
  - `apiClient.get` accepts `{ signal, skipCache, cacheTtlMs }`; mutations are never cached or retried.
  - Dashboard pages abort reads on unmount; Doctor sidebar save-event refreshes use `skipCache: true`.
- API wrappers (`doctorApi`, `secretaryApi`, `adminApi`) accept the new options for profile, schedules, dashboard, stats, and audit-log reads.

### Before/after measurements

Counts are derived from the code paths (no live server or database was used; see limitations). "Round trips" means sequential await batches.

| Scenario | Before | After |
| --- | --- | --- |
| Doctor dashboard first load (HTTP) | 4 GETs (sidebar profile + schedules, page profile + dashboard) | 4 GETs (cache is empty on first load) |
| Doctor dashboard re-navigation within 15 s (HTTP) | 4 GETs | 0 GETs (all cached) |
| Doctor dashboard endpoint (DB) | 12 queries, 12 sequential round trips | 9 queries in 2 round trips |
| Secretary dashboard first load (HTTP) | 4 GETs (layout `/users/me`, sidebar `/conversations`, dashboard + profile) | 4 GETs |
| Secretary dashboard re-navigation within 15 s (HTTP) | 4 GETs | 0 GETs (30 s badge poll still refreshes) |
| Secretary dashboard endpoint (DB) | 10 queries, 10 sequential round trips after the secretary lookup | 10 queries in one parallel batch after the lookup |
| Secretary unread count (DB) | Correlated subquery per patient conversation | 1 aggregate query |
| Payments list with N payments (DB) | 1 list query + N charge queries | 1 list query + 1 charge query |
| Availability range cache hit (DB) | 5 batched queries | 0 queries within the 20 s TTL |
| General rate-limit budget | ≤100 requests / 15 min | 300 requests / 60 s |
| Auth rate-limit budget | Shared general budget | 30 requests / 15 min |
| GET 429 handling | Immediate error | 3 attempts with `Retry-After`/backoff, capped at 5 s |

### Verification

- Backend `npx tsc --noEmit` — **pass**.
- Web `npx tsc --noEmit` — **pass**.
- Web unit tests (`cd web && npm test`, Node built-in runner): **10/10 pass** (`requestPolicy.test.ts`, `ttlCache.test.ts`).
- New backend tests:
  - `backend/src/middleware/rateLimit.test.ts` — limit enforcement, `Retry-After` + error envelope, OPTIONS skip, strict auth scoping.
  - `backend/src/utils/ttlCache.test.ts` — TTL, prefix invalidation, in-flight sharing.
  - `backend/src/modules/availability/availabilityCache.test.ts` — cache reuse, invalidation, patient-specific bypass.
  - `backend/src/modules/capacity/capacityService.test.ts` — batched range calculation.
  - `backend/src/api/payments.test.ts` — batched charges test.
- Full backend Jest run — **357 passed, 26 failed, 383 total**. All 26 failures are in the five previously documented pre-existing suites (`date`, `conversations`, `payments`, `appointments`, `queue`); no new test or new code path fails. `payments.test.ts` has 14 pre-existing verify/reject/receipt failures on routes untouched by this change; the new batched-charges test passes.

### Assumptions and limitations

- The live reproduction (rapid clicking in a signed-in dashboard against a running backend) was **not** performed: no test credentials were provided, and the configured database is remote/production and was intentionally not touched.
- Request/query counts above are code-derived. Absolute latency and real 429 timing depend on deployment (`trust proxy`, number of API instances, database latency).
- Rate-limit counters are in-process (the default `express-rate-limit` memory store). Multiple API instances or a restart reset the budget per instance. If the API is later scaled horizontally, use a shared store without changing the documented budgets.
- The client cache is per browser tab and per session. It is not shared across tabs and does not survive reload. Data changed in another tab can be up to 15 seconds stale.
- No database migration or index was added, per the constraint not to modify the remote database. If dashboard queries remain slow at real data volumes, add indexes through a normal migration (for example on `appointments(doctor_id, appointment_date)`, `queue_entries(doctor_id, queue_date)`, and `messages(conversation_id, read_at)`).

### Documentation and version

- Updated `docs/prd.md` (new `FR-002-B`), `docs/architecture.md`, `docs/architecture-essentials.md`, and `docs/SYSTEM_STATE.md`.
- `docs/CURRENT_VERSION.md` remains **01.21** and `docs/VERSION_HISTORY.md` was not changed because version changes require explicit approval.

### Follow-ups

- Add a shared rate-limit store (for example PostgreSQL/Redis already approved for the stack) only if the API is deployed with multiple instances.
- Consider metrics for 429 counts and dashboard endpoint latency to confirm the budgets in production.
- Consider a slightly longer cache TTL for rarely changing reference data if navigation still produces unnecessary reads; keep mutations invalidating it.

---

## Post-login device trust replaces Remember Me (2026-10-23)

**Scope:** Doctor and Secretary web authentication/session UX. Admin, SuperAdmin, and Patient behavior is unchanged.
**Status:** Implemented, type-checked, and covered by backend tests. **Not committed or pushed.**

### Behavior

- Removed the Remember Me checkbox from `/doctor-login` and `/secretary-login`.
- After a Doctor/Secretary login is fully authenticated (password and, when 2FA is enabled, OTP), an untrusted browser is routed to `/doctor/trust-device` or `/secretary/trust-device`.
- The trust page shows the detected browser and operating system and offers:
  - **Trust this device** — registers/rotates a 30-day trusted browser, upgrades the current session to the 30-day persistent policy, and skips OTP on later logins from that browser when 2FA is enabled. The password is always required.
  - **Do not trust this device** — keeps the 7-hour access / 8-hour refresh / 8-hour idle browser-session policy, registers no trust, and clears any stale trust cookie.
- Trusting never bypasses the OTP required for the current login. OTP verification always issues a short untrusted session; the trust page is shown afterwards.
- Existing trusted browsers skip OTP and the trust page on later logins.
- Secretary password change still takes precedence over the trust prompt. Profile completion follows the trust choice.
- Admin/SuperAdmin remain mandatory-OTP, short-session, and have no trusted devices. Patient sessions are unchanged.

### Backend

- `backend/src/modules/auth/authService.ts`
  - `login()` now treats a valid trusted-device cookie as the source of truth, ignores the legacy `rememberMe` login field, returns `isTrustedBrowser` and `requiresTrustPrompt`, and skips OTP only for a valid trusted device.
  - `verifyLoginOtp()` always issues a short staff session and never auto-registers trust.
  - Added `trustCurrentBrowser()` to register/rotate the trusted browser and reissue a 30-day persistent token pair while preserving the original session start.
- `backend/src/api/auth.ts`
  - Added `GET /api/v1/auth/trusted-browsers/current-device` (browser/OS details for the prompt).
  - Added `POST /api/v1/auth/trusted-browsers/trust-current` (Doctor/Secretary only; rejected while a password change is required).
  - Login and OTP responses now include `isTrustedBrowser` and `requiresTrustPrompt`.
  - `POST /api/v1/auth/revoke-trusted-browser` is reused for "Do not trust this device".
- `backend/src/middleware/auth.ts` exposes the access token's `sst`/`iat` so the trust upgrade preserves the original session start.
- Reused the existing `trusted_browsers` table. **No new migration was required.**

### Web

- `web/src/lib/api/authApi.ts` — added trust-prompt response fields and `getCurrentDevice()` / `trustCurrentDevice()`.
- `web/src/lib/deviceInfo.ts` — shared User-Agent browser/OS parser used by the trust page and settings card.
- `web/src/components/auth/DeviceTrustCard.tsx` — shared post-login trust UI.
- `web/src/app/doctor/trust-device/page.tsx` and `web/src/app/secretary/trust-device/page.tsx` — trust routes.
- `web/src/app/doctor/layout.tsx` and `web/src/app/secretary/layout.tsx` — bypass the dashboard shell for the trust pages.
- `web/src/app/doctor-login/page.tsx` and `web/src/app/secretary-login/page.tsx` — removed the checkbox and route to the trust page when required.
- `web/src/components/auth/OtpVerification.tsx` — no longer sends `rememberMe`.
- `web/src/components/settings/TrustedBrowsersCard.tsx` — uses the shared device parser and updated empty-state text.

### Verification

- Backend `npx tsc --noEmit` — **pass**.
- Web `npx tsc --noEmit` — **pass**.
- Targeted Jest:
  - `backend/src/api/auth.session.test.ts` — **22/22 pass**.
  - `backend/src/api/auth.test.ts` + `backend/src/modules/auth/authService.test.ts` — **43/43 pass**.
- Full backend Jest run — **334 passed, 24 failed**. The 24 failures are the same pre-existing suites (`date`, `conversations`, `payments`, `appointments`, `queue`); no new failures.
- Not live-verified: a real Doctor/Secretary login, OTP delivery, and running backend are required to click through the browser flow.

### Documentation

- Updated `docs/prd.md`, `docs/architecture.md`, `docs/architecture-essentials.md`, and `docs/SYSTEM_STATE.md`.
- Version bumped to `01.16` on user approval; `CURRENT_VERSION.md` and `VERSION_HISTORY.md` were updated.

---

## "Sign out of all devices" failure fix (2026-10-23)

**Scope:** Doctor/Secretary trusted-browser settings. No endpoint, cookie-name, or UI changes.
**Status:** Migration applied; route covered by a mocked test. **Not committed or pushed.**

### Root cause

- `POST /api/v1/auth/trusted-browsers/revoke-all` calls `revokeAllUserSessions()`, which executes `UPDATE users SET session_version = session_version + 1 WHERE id = $1`.
- Migration `032_add_session_version.sql` had not been applied to the configured database, so PostgreSQL rejected the statement. The route caught the error and returned HTTP 500 with `Failed to sign out of all devices`, which `TrustedBrowsersCard` displayed as a toast.
- Listing trusted browsers and revoking a single browser still worked because those paths do not touch `users.session_version`.

### Fix

- Applied the idempotent migration to the configured database:
  - `cd backend && npm run migrate:session-version`
  - Statement: `ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;`
- Verified `public.users.session_version` exists as `integer`, `NOT NULL`, default `0`.
- No application-code change was required: the endpoint, service, and cookie-clearing logic already implemented the intended behavior.
- Added a mocked route test in `backend/src/api/auth.session.test.ts`:
  - Authenticated Doctor `POST /trusted-browsers/revoke-all` returns `200` and `Signed out of all devices`.
  - The route executes the `users.session_version` increment and `trusted_browsers` revocation.
  - Only Doctor cookies (`doctor_accessToken`, `doctor_refreshToken`, `doctor_sessionActive`, `doctor_trustedBrowser`) are cleared; other portals are untouched.

### Verification

- Database column check — **pass** (`session_version` present with the expected type/default).
- Backend `npx tsc --noEmit` — **pass**.
- Targeted Jest run — **31/31 pass** (`backend/src/middleware/auth.test.ts`, `backend/src/api/auth.session.test.ts`).
- Full backend Jest run — **328 passed, 24 failed**. The 24 failures remain confined to the same pre-existing suites (`date`, `conversations`, `payments`, `appointments`, `queue`); no new failures.
- Not live-verified: clicking the button in a browser requires a real Doctor login and OTP; the mocked route test plus the applied column cover the failure path.

---

## Doctor portal authentication bug fix (2026-10-23)

**Scope:** Doctor web portal session handling after the role-scoped cookie/localStorage change. No redesign; existing session policy, OTP, Remember Me, trusted-browser behavior, role checks, and endpoints are unchanged.
**Status:** Implemented and type-checked. **Not committed or pushed.**

### Root causes

1. **Profile and Settings still read the old global token names.**
   - `web/src/app/doctor/profile/page.tsx:75` and `:203` used `localStorage.getItem('token')`.
   - `web/src/app/doctor/settings/page.tsx:36-37` used `getCookie('accessToken') || localStorage.getItem('token')`.
   - `web/src/app/doctor-profile/page.tsx:112` and `:232` used `localStorage.getItem('token')`.
   New Doctor logins only write `doctor_token` / `doctor_accessToken`, so these pages found no token and redirected to `/doctor-login`.

2. **Shared `/patients` paths were forced to the PATIENT role.**
   - `backend/src/middleware/auth.ts:42` mapped any path containing `/patients` to `patient` before consulting `X-Portal-Role`.
   - Doctor requests to `/api/v1/patients/doctor/:id`, `/api/v1/prescriptions/patients/:id`, and `/api/v1/visits/patient/:id` were therefore checked against PATIENT and returned 401 `Invalid or expired token`. The client retried once after refresh and received the same 401, which is the Patients-page error in the report.

3. **Every refresh failure was treated as an expired session.**
   - `web/src/lib/api/apiClient.ts` (old refresh catch block) cleared storage and redirected to `?session=expired` for 429, 5xx, network, and malformed-response failures, not just a genuinely invalid refresh token.
   - Concurrent callers waiting on the same refresh were also never resolved if that refresh failed.

### Ruled out by code inspection

- **Cookie attributes:** set and clear both use path `/` with no domain override, so clearing matches the cookies that were set. No mismatched cookie was found.
- **Lifetime units:** JWT/cookie lifetimes are seconds and client watchdog values are minutes; no seconds-vs-milliseconds or timezone mix-up was found.
- **Coexisting portal sessions:** role-scoped cookie selection itself was sound. The failures came from path misresolution and legacy storage reads, not from Doctor and Secretary sessions sharing a browser.
- **`?session=expired` source:** only `apiClient.handleSessionExpired()` and “Sign out of all devices” produce that query. The old refresh handler made the first one too eager.

### Fixes

- `backend/src/middleware/auth.ts`
  - Only role-namespaced paths (`/doctors`, `/secretaries`, `/admin`) are path-authoritative.
  - Shared resource paths use `X-Portal-Role`; the existing cross-role rejection is preserved.
  - Patient mobile/API clients using `Authorization` are unaffected.
- `web/src/lib/api/apiClient.ts`
  - Added `getStoredToken()`: role-scoped cookie first (`doctor_accessToken`), then `doctor_token`, then legacy global keys, then the in-memory token.
  - Refresh now clears the session and redirects only on HTTP 400/401. 429, 5xx, network, and malformed-response failures leave the session intact.
  - A failed refresh now resolves concurrent waiters with `null` instead of leaving them pending.
- Doctor pages
  - `web/src/app/doctor/profile/page.tsx`, `web/src/app/doctor/settings/page.tsx`, and `web/src/app/doctor-profile/page.tsx` now use `apiClient.getStoredToken()`.
  - `web/src/app/doctor/dashboard/page.tsx` and `web/src/components/layout/DoctorSidebar.tsx` also use it so a valid cookie session is not rejected just because localStorage was cleared.
- No new cookie names, storage names, or endpoints were added.
- Documentation synchronized: `docs/architecture.md`, `docs/architecture-essentials.md`, and `docs/SYSTEM_STATE.md` now state that role-namespaced paths are authoritative, shared paths use `X-Portal-Role`, and only 400/401 refresh responses clear a session.

### Tests added

- New `backend/src/middleware/auth.test.ts` (15 tests):
  - Valid Doctor tokens succeed on `/doctors/me`, `/patients/doctor/:id`, `/prescriptions/patients/:id`, and `/visits/patient/:id`.
  - Valid Secretary and Patient tokens succeed on their shared/patient paths.
  - Correct role-scoped cookie is selected when both Doctor and Secretary cookies exist.
  - Doctor/Secretary paths remain authoritative over a spoofed header.
  - Missing, expired, and wrong-role tokens are rejected.
- Extended `backend/src/api/auth.session.test.ts` (3 new tests):
  - Refresh uses `doctor_refreshToken` and does not touch Secretary cookies.
  - Refresh does not read another portal's refresh cookie.
  - A failed Doctor refresh clears only Doctor cookies.

### Verification

- Backend `npx.cmd tsc --noEmit` — **pass**.
- Web `npx.cmd tsc --noEmit` — **pass**.
- Targeted Jest run — **30/30 pass** (`auth.test.ts`, `auth.session.test.ts`).
- Full backend Jest run — **327 passed, 24 failed**. The 24 failures are the same pre-existing failures in `date`, `conversations`, `payments`, `appointments`, and `queue`; no new failures were introduced. Jest may keep the process alive after completion; use `--forceExit`.

### Assumptions and unverified items

- Live reproduction against the configured database was not performed: `DB_HOST` points at the remote Render PostgreSQL instance, and the task prohibits touching remote/production databases. No local PostgreSQL is available. Verification used mocked Jest/supertest coverage plus TypeScript checks.
- The web client already sends `X-Portal-Role` on every request, so shared resource paths resolve correctly without an endpoint change.
- Not live-verified: full browser flow, simultaneous Doctor + Secretary tabs, hard refresh, and access-token expiry with a temporarily shortened lifetime. Those require a permitted database and a running backend.
- Migration `032_add_session_version.sql` was later applied on 2026-10-23 (see the "Sign out of all devices" fix above).
- Version files were left unchanged at `01.15` for this change because it required approval for version bumps; the later post-login device-trust change bumped the system to `01.16`.

---

# Previous change — Doctor/Secretary Remember Me & Admin Session Hardening

**Date:** 2026-10-23
**Scope:** Backend auth/session handling, web portals (Doctor, Secretary, Admin), documentation.
**Status:** Implemented, type-checked, and unit-tested. **Not committed or pushed.** Migration `032` was applied on 2026-10-23 (see the "Sign out of all devices" fix above and “Database migration” below).

---

## 1. Summary

Remember Me is now a real session-lifetime choice instead of a “Facebook-style” always-persistent session:

| Account | Remember Me unchecked | Remember Me checked | Admin / SuperAdmin |
|---|---|---|---|
| Access token | 7 hours | 7 days | 90 minutes |
| Refresh token | 8 hours | 30 days | 2 hours |
| Idle timeout | 8 hours | 30 days | 2 hours |
| Absolute maximum | none | 30 days | 8 hours |
| Cookies | Browser-session | Persistent | Browser-session |
| Trusted browser | No (existing trust revoked) | Yes, 30 days | Not available |
| OTP (2FA on) | Every login | Skipped on trusted browser | Every login (mandatory) |

Patient access/refresh lifetimes are unchanged (7 days / 30 days).

---

## 2. Backend changes

### New files
- `backend/src/modules/auth/sessionPolicy.ts` — single source of truth for role + Remember Me lifetimes, absolute/idle caps, cookie persistence, and trusted-browser eligibility.
- `backend/src/modules/auth/cookies.ts` — role-scoped cookie names and helpers:
  - `doctor_`, `secretary_`, `admin_`, `patient_` prefixes for access, refresh, trusted-browser, and session-hint cookies.
  - All cookies use path `/`.
  - Access/refresh: HttpOnly + Secure in production.
  - Trusted-browser: always HttpOnly, 30-day `maxAge`.
  - Non-sensitive `<prefix>_sessionActive` browser-session hint cookie (JavaScript-readable, no credentials).
- `backend/database/032_add_session_version.sql` — adds `users.session_version INTEGER NOT NULL DEFAULT 0` (idempotent).
- `backend/src/database/applySessionVersion.ts` + `npm run migrate:session-version` script.
- `backend/src/api/auth.session.test.ts` — 12 focused session/trusted-browser tests.

### `backend/src/modules/auth/authService.ts`
- Token lifetimes and cookie persistence now come from `getSessionPolicy`.
- Refresh tokens embed `session_version`; validation rejects tokens from an older version.
- Trusted-browser tokens:
  - High-entropy random values, SHA-256 hash stored in PostgreSQL only.
  - Read only from the HttpOnly cookie; the previous request-body fallback was removed.
  - Uploaded/rotated on each successful use.
  - Validated with expiry/revocation checks and rate-limited token validation.
  - Never returned in a JSON body.
- Added `revokeAllUserSessions` (increments `session_version`, revokes refresh tokens and trusted browsers).
- Added `listTrustedBrowsers`, `revokeTrustedBrowserById`, and existing `revokeTrustedBrowser` / `revokeAllTrustedBrowsers`.
- Password change re-issues session tokens and revokes prior sessions/trust.
- Server-authoritative Remember Me: the OTP challenge stores `remember_me`; the client cannot upgrade a challenge after the fact.

### `backend/src/middleware/auth.ts`
- Resolves the portal role from the request path (authoritative), falling back to `X-Portal-Role` only for shared endpoints.
- Reads role-scoped access cookies first, with legacy global cookies as fallback.
- Rejects cross-role token use.
- Logs failures without token values.

### `backend/src/api/auth.ts`
- `POST /login` — policy-based metadata (`rememberMe`, `persistent`, `idleTimeoutMinutes`, `maxSessionMinutes`); no session cookies until OTP succeeds when OTP is required.
- `POST /verify-login-otp` — server-side Remember Me handling; registers/rotates a trusted browser only on success.
- `POST /refresh` — policy-aware refresh, browser-session hint handling.
- `POST /logout` — clears only the current portal session; trusted-browser trust persists.
- `GET /trusted-browsers` — list current account’s browsers.
- `DELETE /trusted-browsers/:id` — revoke one browser.
- `POST /trusted-browsers/revoke-all` — “Sign out of all devices” (revokes all trust + refresh tokens and clears this browser’s cookies).
- `POST /revoke-trusted-browser` — backward-compatible current-browser revocation.
- `POST /change-password` — supports `must_change_password` walk-ins, revokes old sessions, issues new role-scoped tokens.

### `backend/src/api/admin.ts`
- Revokes trusted browsers and refresh tokens (`session_version`) on:
  - Admin deactivation of a doctor.
  - Admin deactivation of a secretary.
  - Secretary password reset.
  - Admin account deactivation.

---

## 3. Web changes

### `web/src/lib/api/apiClient.ts`
- Sends `X-Portal-Role` on API requests.
- Supports cookie-only refresh and retries the original request once after a successful refresh.
- Coordinates concurrent refreshes.
- Stores session metadata (`rememberMe`, `persistent`, idle/absolute limits).
- Preserves the original session start across token refreshes so the 8-hour Admin maximum and the 30-day remembered maximum cannot be extended by refreshing.
- Runs an idle/absolute watchdog and clears expired sessions with “Your session has expired. Please log in again.”
- Uses the non-sensitive `<prefix>_sessionActive` hint to discard non-persistent localStorage tokens after a browser restart.
- Skips automatic refresh/retry for login, OTP, refresh, and registration endpoints so invalid credentials/OTP show their real error instead of “Session expired”.
- Still never reads the trusted-browser cookie.

### Login pages
- `web/src/app/doctor-login/page.tsx` and `web/src/app/secretary-login/page.tsx`:
  - Remember Me controls real session persistence.
  - Removed JavaScript reads of the trusted-browser cookie.
  - Added a “Remember me” checkbox (label only, no helper subtext).
  - Store role-scoped session metadata.
- `web/src/app/admin/login/page.tsx`:
  - Removed Remember Me.
  - Added mandatory-OTP / short-session security notice and expired-session message.

### Settings and dashboards
- New `web/src/components/settings/TrustedBrowsersCard.tsx`:
  - Device label, created date, last used date, expiry.
  - Per-browser Revoke and “Sign out of all devices”.
- New `web/src/components/settings/TwoFactorBanner.tsx`:
  - Dismissible recommendation to enable 2FA when disabled; never blocks access.
- Added trusted-browser settings and 2FA banners to Doctor/Secretary settings and dashboards.
- Added `two_factor_enabled` to `DoctorProfile`.

---

## 4. Database migration

**File:** `backend/database/032_add_session_version.sql`
**Command:** `cd backend && npm run migrate:session-version`

**Applied on 2026-10-23.** The configured `DB_HOST` points at the remote Render PostgreSQL instance. With explicit user approval, the idempotent migration was executed against that database and the `users.session_version` column was verified as `integer`, `NOT NULL`, default `0`.

Refresh-token revocation based on `session_version` is now enforceable in the configured database.

---

## 5. Documentation updated

- `docs/prd.md` — rewrote FR-002-A and the duplicated Remember Me section.
- `docs/architecture.md` — replaced the old section with the implemented policy, revocation model, endpoints, cookie isolation, and schema notes; added migrations `022` and `032` to the migration list.
- `docs/architecture-essentials.md` — condensed equivalent policy plus do/do-not rules; added migrations `022` and `032`.
- `docs/SYSTEM_STATE.md` — replaced the obsolete “Facebook-style” state with the implemented session, trust, settings, admin, and endpoint behavior, including the migration deployment note.

Removed all obsolete “Facebook-style” / “sessions persist regardless of Remember Me” statements.

---

## 6. Verification

- Backend `npx.cmd tsc --noEmit` — **pass**.
- Web `npx.cmd tsc --noEmit` — **pass**.
- Targeted Jest run — **55/55 pass**:
  - `backend/src/api/auth.test.ts`
  - `backend/src/modules/auth/authService.test.ts`
  - `backend/src/api/auth.session.test.ts` (12 new tests)

### Known pre-existing full-suite failures
Full backend run: **309 passed, 24 failed** across 5 suites. All 24 failures are in untouched areas and reproduce independently:
- `backend/src/utils/date.test.ts`
- `backend/src/api/conversations.test.ts`
- `backend/src/api/payments.test.ts`
- `backend/src/api/appointments.test.ts`
- `backend/src/api/queue.test.ts`

Jest may keep the process alive after completion; run with `--forceExit`.

---

## 7. Version

A version bump was warranted (auth/session behavior + schema change). At the time, `docs/CURRENT_VERSION.md` read `01.15` and approval had not been given. The follow-up post-login device-trust change received approval and bumped the system to **01.16** (see the top section and `docs/VERSION_HISTORY.md`).

---

## 8. Not done

- No git commit or push.
- No other migrations were executed against the remote database; migration `032` was applied separately on 2026-10-23.
- No changes to unrelated failing test suites.
