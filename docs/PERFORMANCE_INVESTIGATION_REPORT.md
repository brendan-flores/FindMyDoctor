# FindMyDoctor — Comprehensive Application Performance Investigation Report

**Project:** FindMyDoctor  
**Report Date:** November 25, 2026  
**Mode:** Read-Only Investigation (no source code, configuration, database, or deployment changes made)  
**Output File:** `docs/PERFORMANCE_INVESTIGATION_REPORT.md`

---

## 1. Executive Summary

The FindMyDoctor application is a multi-role healthcare platform consisting of a Next.js web frontend (Admin, Doctor, and Secretary portals) hosted on Vercel, a Node.js/Express/TypeScript backend hosted on Render's free tier, a PostgreSQL database, Supabase for email OTP delivery/verification, and a Flutter mobile application (patient and secretary shared).

Based on a thorough read-only inspection of the backend, web frontend, mobile application, and architecture documentation, the observed slow responses are **not caused by a single bottleneck**. Instead, they result from a combination of:

1. **Render free-tier cold starts** — the backend instance spins down after inactivity, adding up to 50+ seconds to the first request. This alone can explain the "long time to navigate to the OTP page" and "portal pages take a long time to load" symptoms, particularly for the first request of the day or after idle periods.

2. **Multi-hop login/OTP lifecycle** — every login that requires OTP involves: frontend → Render backend → Supabase (OTP send) → external email delivery → user retrieves code → frontend → Render backend → Supabase (OTP verify) → JWT issued. Each hop adds network latency, and Supabase calls are made synchronously in the request path.

3. **Sequential (non-parallel) data fetching in the Doctor portal** — the Doctor dashboard page fetches its profile *after* the layout has already fetched it, and the two fetches are sequential rather than parallel. The profile is therefore fetched twice per dashboard load.

4. **Mobile app duplicate login attempts** — the Flutter `ApiService.login()` tries the `PATIENT` role first, then retries with `SECRETARY` on `INVALID_CREDENTIALS`. Every secretary login therefore makes two backend login requests (each of which may trigger OTP flow), doubling login latency and consuming double the auth rate-limit budget.

5. **Absence of mobile caching and retry** — unlike the web `apiClient` (which has a 15-second GET cache, in-flight deduplication, retry with backoff, and 401 refresh-and-retry), the Flutter `ApiService` has no caching, no deduplication, and no automatic retry. Every screen data load hits the network.

6. **Database connection pool tuned for remote but with aggressive idle cleanup** — pool max 10 for Render, `idleTimeoutMillis: 10000` (10 seconds). Connections are closed quickly after idleness, so the next request must pay a new connection handshake. The backend also runs `testDatabaseConnection()` before `app.listen()`, which adds to cold-start startup time.

7. **No pagination on admin list endpoints** — `GET /api/v1/admin/doctors` and `GET /api/v1/admin/secretaries` return all rows without pagination. As these tables grow, response serialization and transfer time will increase.

8. **No database indexes added** — per `CHANGES.md` line ~100, no migration or index was added for dashboard queries (e.g., on `appointments(doctor_id, appointment_date)`, `queue_entries(doctor_id, queue_date)`, `messages(conversation_id, read_at)`). At real data volumes these table scans become expensive.

**Most likely causes of the reported problems, in order of likelihood:**
1. Render free-tier cold start (first request after inactivity) — explains intermittent long delays across all clients.
2. Multi-hop OTP/Supabase email delivery — explains slow login-to-OTP-page navigation and OTP request/response latency.
3. Sequential/double data fetching in the Doctor portal — explains slow initial doctor dashboard load.
4. Duplicate mobile login attempts + no mobile caching — explains slow mobile responses even when the backend is warm.

No evidence was found that upgrading Render alone would solve every problem; several findings are application-level and would persist after an infrastructure upgrade.

---

## 2. Application Architecture


### 2.2 Key Production Routes and Endpoints

| Area | Web Portal (Vercel) | Backend API (Render) | Mobile (Flutter) |
|------|---------------------|----------------------|------------------|
| Login | /doctor-login, /secretary-login, /admin/login | POST /api/v1/auth/login | login_page.dart -> api_service.dart login() |
| OTP Verify | OtpVerification component | POST /api/v1/auth/verify-login-otp | otp_verification_page.dart |
| Doctor Dashboard | /doctor/dashboard | GET /api/v1/doctors/me/dashboard | - |
| Secretary Dashboard | /secretary/dashboard | GET /api/v1/secretaries/me/dashboard | - |
| Admin Dashboard | /admin/dashboard | GET /api/v1/admin/dashboard/stats | - |
| Admin Doctors list | /admin/doctors | GET /api/v1/admin/doctors | - |

### 2.3 Login & OTP Lifecycle

1. User submits email/password + expectedRole. Frontend calls POST /api/v1/auth/login.
2. Backend authService.login(): queries users by email/username, bcrypt.compare, role match, (doctor: approval_status query), (staff: two_factor_enabled + trusted_browsers query). If OTP required: createLoginOtpChallenge() then sendLoginOtpForLogin(email) -> Supabase signInWithOtp -> email delivered.

### 2.4 Data-Loading Flow (Portal Page Example)

1. Portal page mounts (Next.js client component). useEffect calls API wrapper (e.g., doctorApi.getDashboard()).
2. web/src/lib/api/apiClient.ts: checks client TTL cache (15s default), collapses concurrent identical GETs (in-flight dedup), issues fetch() with Authorization Bearer token and credentials: include. On 401: refresh then retry once. On 429: retry with backoff (max 3 attempts).
3. Backend: authenticate middleware (JWT verify; DOCTOR role: extra doctors approval_status query) -> authorize middleware -> route handler.
4. Route handler runs PostgreSQL queries via pg Pool (max 10 remote / 20 local; idleTimeoutMillis 10000 remote).
5. Response serialized to JSON; frontend updates React state and renders.
3. Frontend navigates to OTP page.
4. User enters 6-digit OTP -> POST /api/v1/auth/verify-login-otp: load challenge, Supabase verifyOtp, consume challenge, load user, generate JWT, set cookies.
5. Frontend redirects to role dashboard.

---

## 3. Findings by Category

Each finding: ID, Category, Severity, Status, File path, Involved function/endpoint/config, Explanation, Performance impact, Evidence from source, Recommended investigation/improvement.

### 3.1 Authentication & OTP Findings

**FINDING-01: Render Free-Tier Cold Start (Instance Spin-Down)**
- Category: Backend Hosting / Infrastructure | Severity: Critical | Status: Confirmed (documented behavior; quantify via production timing)
- Files: backend/src/index.ts, backend/src/database/connection.ts
- Involved: app.listen() startup, testDatabaseConnection(), pg Pool init, Render free-tier instance
- Explanation: Render free tier spins down the backend instance after inactivity; Render documents this can delay requests by 50+ seconds. backend/src/index.ts runs testDatabaseConnection() (pool.connect + SELECT NOW()) BEFORE app.listen(), so the server accepts no request until the DB connection is proven. On cold start: instance provisioning + backend startup + DB handshake + pre-flight connection test all occur before the first response byte.
- Impact: First request after inactivity can be delayed ~50+ seconds (Render's documented bound). Matches reported "login takes a long time" and "portal pages take a long time to load," especially first request of the day or after idle periods. Subsequent requests are fast until spin-down recurs.
- Evidence: backend/src/index.ts lines 159-187 (testDatabaseConnection before app.listen). backend/src/database/connection.ts lines 5-14 (remote pool: max 10, idleTimeoutMillis 10000, connectionTimeoutMillis 10000). No render.yaml or Procfile found in repo (search returned none).
- Recommended investigation: Measure time-to-first-byte for first request after known idle period (e.g., overnight) vs subsequent requests. Measure backend startup duration and testDatabaseConnection() duration.

Admin OTP is always mandatory. Doctor/Secretary OTP only if two_factor_enabled=true and browser not trusted. SuperAdmin logs in directly without OTP.

**FINDING-02: Multi-Hop OTP/Supabase Email Delivery in Login Path**
- Category: Authentication / OTP | Severity: Critical | Status: Confirmed (code structure); delivery latency needs production measurement
- Files: backend/src/api/auth.ts, backend/src/modules/auth/authService.ts, backend/src/services/otpService.ts
- Involved: POST /api/v1/auth/login, sendLoginOtpForLogin(), supabaseAdmin.auth.signInWithOtp(), POST /api/v1/auth/verify-login-otp, supabaseAdmin.auth.verifyOtp()
- Explanation: Every OTP-requiring login performs two synchronous Supabase calls in the request path: (1) signInWithOtp to generate and email the OTP, (2) verifyOtp to validate the user-submitted code. Between them the user switches to email, retrieves the code, and submits it. The backend waits on Supabase for both. Email delivery depends on an external SMTP provider outside this codebase — inherently the slowest part of login.
- Impact: Adds network round trips to Supabase (possibly different region than Render) plus unpredictable email delivery time. Time to navigate to OTP page includes backend wait on Supabase signInWithOtp. "OTP requests/responses appear slow" includes Supabase verifyOtp latency.
- Evidence: backend/src/services/otpService.ts lines 49-57 (signInWithOtp), 90-94 (verifyOtp), 179-197 (sendLoginOtp with shouldCreateUser:false). backend/src/api/auth.ts lines 271-294 (login returns after sendLoginOtpForLogin completes). backend/src/modules/auth/authService.ts lines 984-1001 (verify-login-otp loads challenge then calls Supabase verifyOtp).
- Recommended investigation: Instrument Supabase signInWithOtp and verifyOtp call durations in production. Compare OTP login vs SuperAdmin direct login to isolate Supabase/email from backend processing.

**FINDING-03: bcrypt.hash with Salt Rounds 10 on Login/Registration**
- Category: Backend Processing | Severity: Medium | Status: Potential Issue (confirmed code; CPU cost depends on instance size)
- Files: backend/src/modules/auth/authService.ts, backend/src/api/otp.ts
- Involved: bcrypt.hash(password, 10) in register(), registerDoctor(), otp.ts /send endpoint
- Explanation: Password hashing uses bcrypt with 10 salt rounds. On a Render free-tier instance (limited CPU), each hash consumes measurable CPU time. Executed on every registration and doctor sign-up OTP /send. NOT executed on login (login uses bcrypt.compare, also costly but single-shot).
- Impact: Adds CPU-bound latency to registration flows. On a weak free-tier instance, each hash can be several hundred ms to over a second. Does not directly affect login speed (only compare).
- Evidence: backend/src/modules/auth/authService.ts line 65 (bcrypt.hash(password,10)), line 435 (registerDoctor), backend/src/api/otp.ts line 119 (bcrypt.hash(payload.password,10)).
- Recommended investigation: Measure bcrypt.compare duration on login in production on Render free tier. If high, evaluate work factor (security trade-off) or instance class.

**FINDING-04: Supabase Identity Provisioning (listUsers perPage 1000) on Account Creation**
- Category: Backend Processing / External Call | Severity: Medium | Status: Confirmed (code structure); needs production measurement
- Files: backend/src/services/otpService.ts
- Involved: ensureAdminSupabaseIdentity(), ensureDoctorSupabaseIdentity(), ensureSecretarySupabaseIdentity(), ensurePatientSupabaseIdentity()
- Explanation: Each ensure*SupabaseIdentity calls supabaseAdmin.auth.admin.listUsers({page:1, perPage:1000}) to check if a Supabase Auth user exists, then conditionally createUser. Invoked during doctor sign-up verification (otp.ts /verify), admin secretary creation (admin.ts /secretaries), admin creation (admin.ts /admins), doctor self-registration (authService.registerDoctor). The listUsers call scans up to 1000 users to find one email — an O(N) scan on every account creation.
- Impact: Adds one or two slow Supabase Admin API calls to account-creation flows (doctor signup verification, admin provisioning). Not on the hot login path, but contributes to slow registration/OTP verification responses.
- Evidence: backend/src/services/otpService.ts lines 281-284 (listUsers perPage 1000), 302-309 (createUser), repeated for doctor/secretary/patient/admin. backend/src/api/otp.ts line 247 (ensureDoctorSupabaseIdentity inside /verify).
- Recommended investigation: Measure listUsers and createUser durations during doctor sign-up verification. Evaluate whether Supabase offers a direct getUserByEmail lookup to avoid scanning 1000 users.

**FINDING-05: Login OTP Challenge Created Before OTP Sent; Resend Invalidates All Prior Challenges**
- Category: Authentication / OTP | Severity: Low | Status: Confirmed (code logic)
- Files: backend/src/modules/auth/authService.ts, backend/src/api/auth.ts
- Involved: createLoginOtpChallenge(), resend-login-otp endpoint, login_otp_challenges table
- Explanation: createLoginOtpChallenge inserts a row into login_otp_challenges (5-min expiry, 5 failed attempts). On resend, the endpoint runs a transaction: locks challenge row (FOR UPDATE), checks 60s cooldown, invalidates ALL previous unused challenges for the user, creates new challenge, updates last_otp_sent_at, commits, then calls sendLoginOtpForLogin. The transaction holds a row lock across the cooldown check and update.
- Impact: Minor. Transaction is short but holds a row lock and performs multiple queries on resend. Not a primary cause of reported slowness; contributes to OTP-request latency under concurrent use.
- Evidence: backend/src/api/auth.ts lines 377-476 (resend-login-otp). backend/src/modules/auth/authService.ts lines 933-946 (createLoginOtpChallenge).
- Recommended investigation: Confirm challenge table indexed on challenge_token_hash and user_id (per schema docs, indexes exist). Measure resend latency in production.
### 2.1 Production Request Flow

Web (Vercel) <-> Backend (Render free tier) <-> PostgreSQL; Backend <-> Supabase (OTP email); User <-> Web/Mobile.

### 3.2 Web Portal Findings

**FINDING-06: Doctor Portal Fetches Profile Twice and Sequentially**
- Category: Web Frontend / Doctor Portal | Severity: High | Status: Confirmed (source code)
- Files: web/src/app/doctor/layout.tsx, web/src/app/doctor/dashboard/page.tsx
- Involved: DoctorLayout refreshProfile (doctorApi.getProfile()), DoctorDashboard checkApprovalStatus (doctorApi.getProfile() then doctorApi.getDashboard())
- Explanation: Doctor layout owns shared profile request and fetches GET /api/v1/doctors/me once on mount via refreshProfile(). However, Doctor dashboard page independently calls doctorApi.getProfile() again in checkApprovalStatus BEFORE calling doctorApi.getDashboard(). These are sequential (profile first, then dashboard), and profile duplicates the layout's fetch. Dashboard load time ≈ profile latency + dashboard latency instead of max(profile, dashboard).
- Impact: Doctor dashboard initial load approximately doubled vs optimal parallel fetch. Matches reported "Doctor portal pages take a long time to load their data."
- Evidence: web/src/app/doctor/dashboard/page.tsx lines 30-94 (checkApprovalStatus calls getProfile then loadDashboardData calls getDashboard). web/src/app/doctor/layout.tsx lines 88-119 (layout already fetches getProfile on mount via refreshProfile). apiClient has 15s TTL cache (DEFAULT_GET_CACHE_TTL_MS=15_000 in requestPolicy.ts) and in-flight dedup (inFlightGets), so the second getProfile within 15s may be cache-served — but sequential structure still forces dashboard fetch to wait for profile effect.
- Recommended investigation: Confirm whether dashboard page getProfile is cache-hit or real second request (client-side timing logs — read-only inspection cannot confirm). Restructure so dashboard page uses layout's loaded profile, or fetches profile+dashboard in parallel via Promise.all (as Secretary dashboard does).

**FINDING-07: Admin Dashboard Runs Sequential Queries Instead of Parallel**
- Category: Backend / Admin Portal | Severity: Medium | Status: Confirmed (source code)
- Files: backend/src/api/admin.ts
- Involved: GET /api/v1/admin/dashboard/stats
- Explanation: Admin dashboard stats endpoint runs four queries sequentially: doctor status counts, user role counts, unassigned secretaries count, pending approvals list. All four are independent reads but awaited one after another. Frontend admin dashboard calls getDashboardStats() and getAuditLog() in parallel (Promise.all at web/src/app/admin/dashboard/page.tsx lines 21-24), so frontend is well-structured, but backend serializes internal queries.
- Impact: Total endpoint latency ≈ sum of four query latencies instead of max. On a cold Render instance with connection-handshake overhead, materially slower than necessary.
- Evidence: backend/src/api/admin.ts lines 48-88 (doctorStats, userStats, unassignedSecretaries, pendingApprovals each awaited sequentially, not wrapped in Promise.all).
- Recommended investigation: Wrap four independent queries in Promise.all. Measure endpoint duration before/after in production.

**FINDING-08: Admin List Endpoints Return All Rows Without Pagination**
- Category: Backend / Admin Portal | Severity: Medium | Status: Potential Issue (depends on table growth)
- Files: backend/src/api/admin.ts
- Involved: GET /api/v1/admin/doctors, GET /api/v1/admin/secretaries, GET /api/v1/admin/users
- Explanation: getAllDoctors() (admin.ts line 125) selects all columns from doctors JOIN users with no LIMIT/pagination. getAllSecretaries() (line 575) and getAllUsers() (line 13) similarly return all rows. Frontend admin pages (/admin/doctors, /admin/secretaries) load entire result set into memory and filter client-side (filteredDoctors, filteredSecretaries).
- Impact: As doctors, secretaries, users grow, response size, serialization time, transfer time, and client-side rendering time grow linearly. Admin doctors/secretaries pages progressively slower with no bound. Currently acceptable for small data, not scalable.
- Evidence: backend/src/api/admin.ts lines 125-204 (getAllDoctors, no LIMIT), 575-619 (getAllSecretaries, no LIMIT), 13-41 (getAllUsers, no LIMIT). web/src/app/admin/doctors/page.tsx lines 156-177 (client-side filtering of full array).
- Recommended investigation: Add pagination (page/limit) to these endpoints and update frontend pages to request pages. Add server-side search/filtering so database, not browser, does filtering.

**FINDING-09: Doctor Portal Sidebar Shares Profile Fetch but Page Refetches; No Prefetch**
- Category: Web Frontend / Doctor Portal | Severity: Low | Status: Confirmed (source code)
- Files: web/src/app/doctor/layout.tsx
- Involved: DoctorLayout (fetch profile once on mount, never re-fetch on navigation), createRefreshGate
- Explanation: Layout fetches profile once on mount and never re-fetches on navigation (intentional, good). Uses refresh gate (createRefreshGate) to coalesce overlapping triggers. No prefetching of likely-next-page data (e.g., link hover), so each navigation incurs a fresh request (mitigated by 15s cache).
- Impact: Minor; navigation between doctor pages cached 15s, so repeat navigation fast. First visit to each page still requires a request.
- Evidence: web/src/app/doctor/layout.tsx lines 88-119, web/src/lib/api/refreshGate.ts.
- Recommended investigation: Consider link-hover prefetching for most-traveled doctor pages (appointments, patients). Low priority.

**FINDING-10: Client-Side Rate Limit Can Surface 429 on Rapid Portal Navigation**
- Category: Web Frontend / All Portals | Severity: Low | Status: Confirmed (configuration)
- Files: web/src/lib/api/requestPolicy.ts, backend/src/middleware/rateLimit.ts, backend/src/config/index.ts
- Explanation: General API budget 600 requests per 60s per IP; auth budget 60 per 900s. Web client retries GETs on 429 with backoff (max 3 attempts, max 5s delay). Rapid navigation through many portal pages (each 1-3 API calls) can consume 600/min budget, surfacing 429s. CHANGES.md notes a prior incident where "each navigation produced fresh requests and surfaced the 429 immediately" before cache/dedup added. Cache/dedup now mitigate, but budget remains per-instance (in-memory store), so horizontal scaling resets budgets per instance.
- Impact: Intermittent 429 errors and retry delays during rapid navigation. Client backs off up to ~5s per request on 429, making portal feel unresponsive.
- Evidence: web/src/lib/api/requestPolicy.ts lines 10-13 (TTL 15s, 3 attempts), backend/src/config/index.ts lines 68-73 (600/60s general, 60/900s auth), backend/src/middleware/rateLimit.ts. CHANGES.md lines 26-28 describe prior 429 incident and fix (cache, dedup, backoff).
- Recommended investigation: Monitor 429 rate in production. If frequent, increase general budget or add shared (Redis) rate-limit store if scaling horizontally.

### 3.3 Mobile Application Findings

**FINDING-11: Mobile Login Attempts Two Roles Sequentially (Duplicate Login Requests)**
- Category: Mobile Application | Severity: High | Status: Confirmed (source code)
- Files: mobile/lib/core/services/api_service.dart
- Involved: ApiService.login() (lines 274-324), mobile/lib/features/auth/presentation/login_page.dart
- Explanation: ApiService.login() iterates const ['PATIENT', 'SECRETARY'] and calls POST /api/v1/auth/login for each role until one succeeds. For a secretary user, the first call (PATIENT) returns INVALID_CREDENTIALS, and only then is the SECRETARY call made. Every secretary login therefore makes TWO backend login requests. Each login request includes bcrypt.compare and, for OTP-requiring roles, a Supabase OTP send.
- Impact: Secretary login latency ≈ 2 × backend login latency. If OTP triggered, user may receive two OTP emails or be confused by first failure. Doubles auth rate-limit budget consumption (60/15min). Directly explains "Flutter mobile APK also experiences slow responses" at login.
- Evidence: mobile/lib/core/services/api_service.dart lines 282-317 (for loop over ['PATIENT','SECRETARY']; on ApiException catch only INVALID_CREDENTIALS retried with second role).
- Recommended investigation: Determine user's role ahead of time (store role in SharedPreferences after first login, or use a role selector) so only one login request is made. For returning users, skip the role loop and use stored role.

**FINDING-12: Mobile API Service Has No Caching, Deduplication, or Retry**
- Category: Mobile Application | Severity: High | Status: Confirmed (source code)
- Files: mobile/lib/core/services/api_service.dart
- Involved: ApiService.get(), post(), put(), patch(), delete()
- Explanation: Unlike web apiClient (15s TTL cache, in-flight GET dedup, retry with exponential backoff, 401 refresh-and-retry), Flutter ApiService has NO cache, NO deduplication of concurrent identical requests, NO retry on failure, and NO automatic token refresh. Every screen data load (doctors list, appointments, queue, profile, conversations) makes a fresh network request to Render. If a request fails due to transient cold start or network blip, it fails immediately to UI with no retry.
- Impact: Every Flutter screen load pays full network + backend latency. Repeated navigation to same screen repeats same requests. Transient failures (e.g., cold start) not retried, so users see errors instead of delayed-but-successful responses. Explains slow mobile responses independent of backend state.
- Evidence: mobile/lib/core/services/api_service.dart lines 83-100 (get), 103-118 (post), 245-268 (_handleResponse) — no cache, no retry, no refresh logic. Contrast web/src/lib/api/apiClient.ts (lines 134-135: getCache and inFlightGets; lines 712-789: retry logic).
- Recommended investigation: Add in-memory TTL cache and request dedup to ApiService.get(), add retry with backoff for safe GETs, add 401 refresh-and-retry. Measure screen-load duration before/after.

**FINDING-13: Mobile init() Performs Async SharedPreferences Read on Every App Start**
- Category: Mobile Application | Severity: Low | Status: Confirmed (source code)
- Files: mobile/lib/core/services/api_service.dart
- Involved: ApiService.init() (lines 43-46)
- Explanation: init() calls SharedPreferences.getInstance() and reads the access token. This is an asynchronous disk read. Must complete before authenticated requests can be made. On first launch there is no token; on subsequent launches this adds a small but non-zero delay before the first API call.
- Impact: Minor startup delay. Contributes to perceived slowness when app launched and immediately navigates to a data screen.
- Evidence: mobile/lib/core/services/api_service.dart lines 43-46.
- Recommended investigation: Confirm init() awaited before screens make requests. Consider initializing ApiService early (e.g., in main.dart) so token read overlaps with app startup.

### 3.4 Backend & Database Findings

**FINDING-14: Database Connection Pool Closes Idle Clients After 10 Seconds (Remote/Render)**
- Category: Database / Connection Management | Severity: High | Status: Confirmed (configuration)
- Files: backend/src/database/connection.ts
- Involved: pg Pool config (idleTimeoutMillis: 10000, max: 10, connectionTimeoutMillis: 10000)
- Explanation: For remote/DATABASE_URL connections (Render), pool configured with max 10 clients and idleTimeoutMillis 10000 (10 seconds). Idle clients closed after just 10 seconds of inactivity. Next request after short idle period must pay new TCP+TLS+PostgreSQL handshake. Combined with Render free-tier spin-down, even moderately idle periods force a fresh connection handshake.
- Impact: Requests after ~10+ seconds of backend idle time incur a new connection handshake (typically tens to hundreds of ms, more over cross-region links to PostgreSQL). Compounds with cold starts and makes "subsequent request duration" variable.
- Evidence: backend/src/database/connection.ts lines 5-14 (remote pool config vs local: max 20, idleTimeoutMillis 30000, connectionTimeoutMillis 2000).
- Recommended investigation: Measure connection-acquisition time for requests after varying idle intervals. Consider increasing idleTimeoutMillis and max for Render instance class, and keep a small keep-alive. Confirm PostgreSQL host region-aligned with Render to minimize handshake latency.

**FINDING-15: authenticate Middleware Issues Extra doctors Query for Every Doctor Request**
- Category: Backend Middleware / Authorization | Severity: Medium | Status: Confirmed (source code)
- Files: backend/src/middleware/auth.ts
- Involved: authenticate() (lines 155-169)
- Explanation: For every authenticated request with decoded.role === 'DOCTOR', middleware runs an extra query: SELECT approval_status FROM doctors WHERE user_id = $1 to reject REJECTED doctors. Adds one database round trip to every single doctor-portal API call (dashboard, schedules, patients, visits, prescriptions, etc.).
- Impact: Every doctor API call pays an extra query latency (~1-10 ms warm, more on cold connection). Across many dashboard/widget calls, accumulates. Consumes a pool connection for duration of each request.
- Evidence: backend/src/middleware/auth.ts lines 155-169 (doctor rejection check query inside authenticate()).
- Recommended investigation: Evaluate embedding approval_status in JWT payload so middleware can reject without a query (accepting trade-off that revocation latency bounded by token TTL), or cache approval status. Measure added latency per request.

**FINDING-16: Capacity Calculation Runs Multiple Queries Per Call; Called Repeatedly**
- Category: Database / Query Efficiency | Severity: Medium | Status: Confirmed (code structure)
- Files: backend/src/modules/capacity/capacityService.ts, backend/src/api/secretaries.ts, backend/src/api/doctors.ts
- Involved: calculateCapacity() (capacityService.ts lines 191-233), calculateCapacityRange() (lines 249-355)
- Explanation: calculateCapacity() runs three parallel queries (unavailability, schedules, breaks) plus a fourth query for daily_capacities via calculateCapacityWithContext. Secretary dashboard calls calculateCapacity(assignedDoctorId, targetDate) alongside 7 other queries (all in Promise.all — good). However, capacity update endpoints (PUT /me/capacity, POST /me/capacity/:date) call calculateCapacity up to three times in sequence (before update, after update, sometimes twice), each re-running the three schedule/break/unavailability queries.
- Impact: Capacity-related endpoints do redundant work. Secretary dashboard well-structured (parallel), but capacity write path repeats expensive reads. On cold connections, each calculateCapacity is 3-4 round trips.
- Evidence: backend/src/modules/capacity/capacityService.ts lines 191-233 (calculateCapacity: 3 parallel queries + calculateCapacityWithContext), backend/src/api/secretaries.ts lines 225-265 and 292-333 (multiple sequential calculateCapacity calls around writes). Note: calculateCapacityRange already uses 4 batched queries instead of per-date queries (good; per SYSTEM_STATE.md lines 279-282).
- Recommended investigation: Reduce repeated calculateCapacity calls in write paths to one call after the mutation. Consider precomputing/caching capacity per doctor/date with invalidation on schedule/break/capacity writes.

**FINDING-17: No Database Indexes Added for Dashboard Queries**
- Category: Database / Indexing | Severity: Medium | Status: Confirmed (documentation states none added)
- Files: docs/CHANGES.md, backend schema migrations
- Involved: appointments, queue_entries, messages, daily_capacities tables
- Explanation: CHANGES.md (line ~100) states: "No database migration or index was added, per the constraint not to modify the remote database. If dashboard queries remain slow at real data volumes, add indexes ... for example on appointments(doctor_id, appointment_date), queue_entries(doctor_id, queue_date), and messages(conversation_id, read_at)." Dashboard queries filter on these columns without confirmed index support. At real data volumes these become table scans.
- Impact: Dashboard and queue queries slow down proportionally to table size. Currently acceptable for small data; will degrade as appointments/queue/messages grow.
- Evidence: docs/CHANGES.md line ~100. Backend dashboard queries: backend/src/api/secretaries.ts lines 900-981 (queue_entries, payments, messages, conversations filters), backend/src/api/doctors.ts doctor dashboard (appointments, queue_entries filters).
- Recommended investigation: Run EXPLAIN ANALYZE on dashboard queries against production-scale data to confirm missing-index scans. Add indexes via normal migration (per AGENTS.md/db rules) and re-measure.

**FINDING-18: Request Logging Middleware Logs Every Request Body/Headers**
- Category: Backend Middleware | Severity: Low | Status: Confirmed (source code)
- Files: backend/src/index.ts
- Involved: app.use((req, _res, next) => { ... console.log(...) }) (lines 99-104)
- Explanation: Middleware logs every request's method, path, headers (redacted), and body (redacted) to console.log. Synchronous I/O on every request. On Render free-tier instance, adds CPU and I/O overhead to every request; log volume can be significant under traffic.
- Impact: Adds per-request overhead (serialization + console I/O). Likely small per request but non-zero and accumulates under load; can also slow log aggregation.
- Evidence: backend/src/index.ts lines 99-104.
- Recommended investigation: Consider sampling or conditionally disabling request logging in production; measure per-request overhead. Low priority relative to cold start and OTP.

**FINDING-19: No Backend Health Check That Verifies Database Connectivity**
- Category: Backend / Infrastructure | Severity: Low | Status: Confirmed (source code)
- Files: backend/src/index.ts
- Involved: GET /health (lines 107-109)
- Explanation: /health returns static { status: 'ok' } without checking database. No endpoint reports whether DB connection pool is healthy, so orchestrators/load balancers cannot route away from an instance with dead DB connection. /health/e2e-db exists but gated behind E2E_TEST_MODE === 'true' && NODE_ENV !== 'production', so never active in production.
- Impact: Indirect — prevents proactive detection of unhealthy instances; doesn't directly slow requests, but means a spun-up instance with failed DB connection could still receive traffic and fail slowly rather than fast.
- Evidence: backend/src/index.ts lines 107-109 (/health static), lines 112-121 (/health/e2e-db gated).
- Recommended investigation: Add production-safe /health/db running SELECT NOW() via pool and returning OK/ERROR. Use for uptime monitoring and to confirm warm state.

---

## 4. Authentication and OTP Performance

### 4.1 Complete Login & OTP Request Lifecycle

**Web portal (Doctor/Secretary/Admin):**

1. Browser submits POST /api/v1/auth/login (email, password, expectedRole) to Render backend.
2. Backend authService.login() (authService.ts):
   - Query users by email/username (1 DB round trip).
   - bcrypt.compare password (CPU).
   - Role match check.
   - If DOCTOR: query doctors approval status (1 DB round trip).
   - If staff: query two_factor_enabled (1 DB round trip) + checkTrustedBrowser (trusted_browsers query, 1 DB round trip).
   - If OTP required: createLoginOtpChallenge() (1 DB insert) + sendLoginOtpForLogin(email) -> Supabase signInWithOtp -> email sent to user.
   - Returns { requiresOtp: true, challengeId }.
3. Browser shows OTP entry page. (Delay here = backend response time + user email retrieval time.)
4. Browser submits POST /api/v1/auth/verify-login-otp (challengeId, otp).
5. Backend verifyLoginOtp() (authService.ts):
   - Load challenge from login_otp_challenges (1 DB query).
   - Supabase verifyOtp (external call).
   - Consume challenge (1 DB update).
   - Load user (1 DB query).
   - If DOCTOR: check approval status (1 DB query).
   - Generate JWT access + refresh tokens; set cookies.
6. Browser redirects to role dashboard.

**Mobile (Flutter shared patient/secretary app):**

- Same lifecycle, but ApiService.login() tries PATIENT then SECRETARY sequentially (Finding-11), so a secretary makes two login attempts before succeeding.

### 4.2 Potential Delay Sources (Ordered by Likely Impact)

| Step | Component | Delay Source | Evidence |
|------|-----------|--------------|----------|
| A | Render cold start | Instance spin-down + testDatabaseConnection() before listen | index.ts 159-187; Render free-tier warning |
| B | Backend login processing | bcrypt.compare, multiple sequential DB queries, auth middleware | authService.ts 105-248 |
| C | Supabase signInWithOtp | External network call to Supabase + email queueing | otpService.ts 49-57 |
| D | Email delivery | External SMTP/email provider (outside codebase) | otpService.ts comment |
| E | User retrieval | Human-dependent (time to open email and read code) | N/A |
| F | Supabase verifyOtp | External network call | otpService.ts 90-94 |
| G | Backend verify + JWT | Multiple DB queries + token generation | authService.ts 984-1076 |
| H | Frontend navigation | React route change + render | Next.js pages |

**Conclusion:** The longest, most variable delays are A (cold start), C+D (Supabase + email delivery), and E (user retrieval). Backend processing (B, G) is comparatively fast on a warm instance but adds up on a cold/free-tier instance. No evidence that the backend itself is doing heavy computation in the OTP path beyond bcrypt.compare and standard queries.

---

## 5. Web Portal Performance

### 5.1 Admin Portal

**Affected routes:** /admin/dashboard, /admin/doctors, /admin/secretaries, /admin/users, /admin/audit-log

- Dashboard (/admin/dashboard): loads stats + audit log in parallel via Promise.all — well-structured. Backend endpoint GET /admin/dashboard/stats runs four queries sequentially (Finding-07).
- Doctors list (/admin/doctors): getAllDoctors() returns all doctors unpaginated; client-side filtering (Finding-08). Viewing a doctor's detail additionally calls getDoctorById + getDoctorSchedules (two sequential requests after the list).
- Secretaries list (/admin/secretaries): getAllSecretaries() unpaginated; client-side filtering (Finding-08).
- Rate limit risk: rapid navigation through admin pages can consume the 600/min general budget, surfacing 429s (Finding-10).

### 5.2 Doctor Portal

**Affected routes:** /doctor/dashboard, /doctor/profile, /doctor/appointments, /doctor/patients, /doctor/prescriptions, /doctor/schedule

- Dashboard (/doctor/dashboard): profile fetched sequentially before dashboard data; profile also fetched by layout (Finding-06). Backend endpoint GET /doctors/me/dashboard runs 10 queries in Promise.all — well-structured on the backend.
- Layout (/doctor/layout.tsx): fetches profile once on mount, never re-fetches on navigation — good design. Uses refresh gate to coalesce triggers.
- Auth middleware overhead: every doctor API call pays an extra doctors approval-status query in authenticate() (Finding-15).

### 5.3 Secretary Portal

**Affected routes:** /secretary/dashboard, /secretary/queue, /secretary/walk-ins, /secretary/payments, /secretary/conversations, /secretary/settings

- Dashboard (/secretary/dashboard): loads dashboard + profile in parallel via Promise.all — well-structured. Backend GET /secretaries/me/dashboard runs 8 queries in Promise.all — well-structured.
- Backend dashboard (secretaries.ts 869-1034): runs queue counts, capacity, pending payments, unread messages, queue list, payments needing action, recent conversations in parallel — good. However, calculateCapacity is called separately (Finding-16) and getDashboard calls it once (fine).
- Capacity write paths: PUT /managed-doctors/capacity and POST /managed-doctors/capacity/:date call calculateCapacity multiple times sequentially around writes (Finding-16).

---

## 6. Mobile Application Performance

**Affected screens:** login_page.dart, otp_verification_page.dart, home_page.dart, doctors_page.dart, doctor_profile_page.dart, doctor_results_page.dart, doctor_schedule_page.dart, plus secretary screens (conversations, payments, queue, settings)

- Login (login_page.dart -> api_service.dart login()): tries PATIENT then SECRETARY sequentially — duplicate requests (Finding-11). No role pre-selection.
- API service (api_service.dart): no cache, no deduplication, no retry, no token refresh (Finding-12). Every screen load = fresh network request.
- init() reads token from SharedPreferences asynchronously on every app start (Finding-13).
- No loading/streaming differentiation: unlike web client which shows loading states and retries, mobile screens make blocking calls and show errors on failure.
- PDF/image downloads: downloadPrescriptionPdf(), downloadInvoicePdf(), downloadPdfFromUrl() make separate raw HTTP requests (not through cached get()), each paying full latency.
- Push token registration on logout (logout() lines 353-384) makes a DELETE request that could fail and is swallowed — minor.

---

## 7. Backend and Database Performance

### 7.1 Cold Starts & Startup

- Render free tier spins down the instance after inactivity (documented 50+ second delay). This is the single largest plausible explanation for intermittent long first-request latency across all clients (Finding-01).
- Backend startup: index.ts runs testDatabaseConnection() (pool.connect() + SELECT NOW()) BEFORE app.listen(), so no request is served until the DB round trip completes. On cold start, this adds DB handshake time before the server is even reachable.
- Pool config for Render: max 10, idleTimeoutMillis 10000, connectionTimeoutMillis 10000. Idle connections die after 10 seconds, forcing fresh handshakes (Finding-14).

### 7.2 Database Query Efficiency

- Dashboard endpoints (secretary, doctor) use Promise.all for independent reads — good (Findings-06, 07).
- Admin dashboard stats run 4 queries sequentially — suboptimal (Finding-07).
- Admin list endpoints unpaginated — scalability risk (Finding-08).
- authenticate() middleware adds a doctors query per doctor request (Finding-15).
- calculateCapacity() runs 3-4 queries per call; repeated in write paths (Finding-16).
- No indexes added for dashboard query filters (Finding-17).
- Capacity range calculation (calculateCapacityRange) already uses 4 batched queries instead of per-date queries — good optimization already in place (SYSTEM_STATE.md lines 279-282).

### 7.3 Connection Management

- Single pg Pool shared across the Express app (exported from connection.ts).
- query() helper logs every query with duration (connection.ts lines 38-49) — useful for diagnosis but adds per-query overhead (Finding-18).
- getClient() used for transactions (walks-ins, secretary unavailability/breaks, doctor secretary creation).
- Pool error handler calls process.exit(-1) on idle client error — a single idle-client pool error kills the whole process (risky on flaky connections).

---

## 8. Performance Measurement Plan

The following distinguishes what can be measured from source-code inspection (structural facts) from what requires production instrumentation.

### 8.1 Source-Code-Verifiable (No Production Access Required)

| # | Measurement | How | Source Evidence |
|---|-------------|-----|-----------------|
| 1 | Backend startup sequence | Confirm testDatabaseConnection() runs before app.listen() | backend/src/index.ts 159-187 |
| 2 | Pool size & idle timeout | Read pool config | backend/src/database/connection.ts 5-14 |
| 3 | OTP external calls | Confirm Supabase signInWithOtp/verifyOtp in request path | backend/src/services/otpService.ts 49-57, 90-94 |
| 4 | Mobile duplicate login | Confirm role loop in ApiService.login() | mobile/lib/core/services/api_service.dart 282-317 |
| 5 | Mobile cache/retry absence | Confirm api_service.dart lacks cache/retry | mobile/lib/core/services/api_service.dart |
| 6 | Client cache/dedup | Confirm TTL 15s, in-flight dedup, 429 backoff | web/src/lib/api/requestPolicy.ts, apiClient.ts |
| 7 | Sequential vs parallel portal fetches | Inspect Promise.all usage in pages | Doctor dashboard (sequential); Secretary/Admin dashboard (parallel) |
| 8 | Unpaginated admin lists | Confirm no LIMIT on admin list endpoints | backend/src/api/admin.ts |

### 8.2 Requires Production Instrumentation or Deployment Testing

| # | Measurement | Method |
|---|-------------|--------|
| 9 | Backend startup duration | Log process.hrtime or Date.now() from module load to app.listen() callback; log testDatabaseConnection() duration |
| 10 | First request after inactivity | Deploy a synthetic client that calls GET /health after N minutes of idle; measure time-to-first-byte |
| 11 | Subsequent request duration (warm) | Same synthetic client calling repeatedly; measure p50/p95/p99 |
| 12 | Backend endpoint response times | Add request-duration middleware (or use existing query() duration logs) per endpoint; export to logs/metrics |
| 13 | Database query execution times | pg query duration (already logged via query() helper); capture EXPLAIN ANALYZE for dashboard queries against production-scale data |
| 14 | Supabase OTP operation duration | Wrap signInWithOtp and verifyOtp calls with timing logs; correlate with user-reported OTP latency |
| 15 | Email delivery duration | Not measurable from code; measure from Supabase signInWithOtp return to user code receipt via client-side telemetry |
| 16 | Frontend API request duration | Add performance.mark/performance.measure around apiClient.get/post in Next.js; or use Vercel Speed Insights / browser Navigation Timing |
| 17 | Flutter API request duration | Wrap ApiService calls with Stopwatch and log durations; log cold vs warm app launch |
| 18 | Total login-to-OTP-page navigation time | Client-side timestamp from login button click to OTP page render (web and mobile) |
| 19 | Portal initial data-loading time | Client-side timestamp from dashboard mount to data render; break down by profile fetch vs dashboard fetch (doctor) |

**Measurement recommendation:** Start with items 9-12 (backend timing) and item 10 (cold start), since the Render free-tier behavior is the most likely explanation for the first-request delays and is the cheapest to confirm. Then measure item 14 (Supabase OTP) and item 18 (login-to-OTP navigation) to isolate the OTP/email component.

---

## 9. Prioritized Optimization Recommendations

### Priority 1: Immediate Performance Improvements (application-level, no infrastructure spend)

1. **Eliminate mobile duplicate login** — determine role before login (store role after first successful login, use a role selector, or send expectedRole from a known source) so secretary login makes one request instead of two.
2. **Doctor portal: fetch profile + dashboard in parallel** — restructure DoctorDashboard to not re-fetch profile sequentially after the layout already did; use Promise.all([profile, dashboard]) or consume the layout's profile.
3. **Admin dashboard: parallelize internal queries** — wrap the four independent stats queries in Promise.all.
4. **Add mobile GET cache + retry + dedup** — mirror the web apiClient patterns (15s TTL, in-flight dedup, 429 backoff, 401 refresh-and-retry) in Flutter ApiService.
5. **Add mobile request retry** — retry safe GETs on network failure/transient 5xx to mask cold-start blips.

### Priority 2: Backend and Database Optimization

6. **Increase / tune connection pool** — raise max and idleTimeoutMillis for the Render pool so idle connections aren't torn down after 10 seconds; keep a small warm pool.
7. **Add database indexes** — for dashboard/queue/payment filters (appointments(doctor_id, appointment_date), queue_entries(doctor_id, queue_date), messages(conversation_id, read_at), daily_capacities(doctor_id, date)). Confirm via EXPLAIN ANALYZE.
8. **Remove redundant calculateCapacity calls** — in capacity write paths, call it once after the mutation.
9. **Embed approval_status in JWT** (optional) — remove the per-request doctors query from authenticate() middleware; weigh against revocation latency.
10. **Add production-safe DB health check** — /health/db running SELECT NOW().

### Priority 3: Web Frontend Optimization

11. **Paginate admin list endpoints** — GET /admin/doctors, /admin/secretaries, /admin/users with page/limit; server-side search/filtering.
12. **Link-hover prefetching** for top doctor navigation targets (appointments, patients).
13. **Monitor 429 rate**; if frequent, raise the general rate-limit budget or use a shared store.

### Priority 4: Flutter Mobile Optimization

14. **Await ApiService.init() early** (app startup) so token read overlaps with launch.
15. **Add image/PDF download caching** for prescription/invoice PDFs.

### Priority 5: Hosting and Infrastructure Improvements

16. **Evaluate Render paid tier** — eliminates spin-down/cold start (the single biggest first-request delay). Confirm via measurement (item 10) before spending.
17. **Region alignment** — confirm Render backend, PostgreSQL, and Supabase are in the same/nearby region to minimize cross-region handshake and OTP call latency.
18. **Consider a keep-alive / ping** — if staying on free tier, a lightweight cron hitting GET /health can reduce spin-down frequency (trade: consumes the free tier's monthly hours).

---

## 10. Proposed Implementation Tasks

| Task ID | Task Title | Description | Affected Modules | Prerequisite Task | Expected Performance Improvement | Validation Method |
|---------|------------|-------------|------------------|-------------------|----------------------------------|-------------------|
| T1 | Measure backend cold-start duration | Instrument testDatabaseConnection() and startup-to-listen time; measure first-request-after-idle TTFB | backend/src/index.ts, backend/src/database/connection.ts | None | Baseline data to justify infrastructure spend | Production timing logs; compare first vs subsequent request |
| T2 | Eliminate mobile duplicate login | Store/resolve role before login; send single expectedRole | mobile/lib/core/services/api_service.dart, mobile/lib/features/auth/presentation/login_page.dart | None | Secretary login latency roughly halved; one less auth request | Measure login TTFB for patient vs secretary; confirm single request |
| T3 | Doctor portal parallel data load | Fetch dashboard + profile in parallel; avoid duplicate profile fetch | web/src/app/doctor/dashboard/page.tsx, web/src/app/doctor/layout.tsx | None | Doctor dashboard initial load closer to max(profile, dashboard) rather than sum | Measure dashboard mount-to-render time; confirm one profile request |
| T4 | Parallelize admin dashboard stats queries | Wrap four independent DB queries in Promise.all | backend/src/api/admin.ts | None | Admin stats endpoint latency reduced from sum to max of queries | Measure /admin/dashboard/stats duration before/after |
| T5 | Add mobile GET cache + retry + dedup | Implement TTL cache, in-flight dedup, 429 backoff, 401 refresh-and-retry | mobile/lib/core/services/api_service.dart | None | Fewer network requests; transient failures masked; faster repeat screen loads | Measure screen-load duration; confirm cached second load |
| T6 | Tune Render connection pool | Increase max and idleTimeoutMillis for remote pool | backend/src/database/connection.ts | T1 (baseline) | Fewer new connection handshakes after idle | Measure connection-acquisition time after idle intervals |
| T7 | Add dashboard database indexes | Add indexes on filtered/joined columns; confirm via EXPLAIN ANALYZE | Database migrations; backend/src/api/secretaries.ts, doctors.ts | T1 (baseline) | Dashboard/queue query latency stable as data grows | EXPLAIN ANALYZE; measure dashboard duration at production volume |
| T8 | Paginate admin list endpoints | Add page/limit to GET /admin/doctors, /admin/secretaries, /admin/users; update frontend | backend/src/api/admin.ts; web/src/app/admin/doctors/page.tsx, secretaries/page.tsx, users/page.tsx | T7 | Bound response size and client render time as tables grow | Measure admin list load time with realistic row counts |
| T9 | Add production-safe DB health check | GET /health/db running SELECT NOW() | backend/src/index.ts | None | Faster failure detection; better uptime monitoring | Health endpoint returns DB status; alerts on failure |
| T10 | Evaluate Render paid tier | Based on T1/T10 measurements, decide whether to upgrade to eliminate spin-down | Render dashboard (infrastructure) | T1, T10 | Eliminates 50+ second cold-start delay | Post-upgrade first-request-after-idle TTFB |

**Ordering rationale:** T1 and T2 are foundational (measurement + highest-impact mobile fix). T3/T4 are quick web wins. T5/T6 address runtime latency. T7/T8 address scalability. T9/T10 are operational/infrastructure and depend on T1's measurements before spending.

---

## 11. Final Assessment

**1. Is Render's free-tier cold start likely contributing to the problem?**

Yes. Render's free tier spins down the instance after inactivity, and Render documents that this can delay requests by 50 seconds or more. The backend additionally runs testDatabaseConnection() before app.listen(), so the first request after spin-down must wait for instance provisioning, backend startup, and a database connection handshake before any response is sent. This is the most likely explanation for the intermittent, long delays reported across all clients (login, portal page loads, mobile responses) — especially for the first request of the day or after idle periods.

**2. Which observed problems could be explained by cold starts?**

- "Logging into the web application takes a long time" — first login after idle waits on cold start + OTP.
- "After submitting login credentials, the application takes too long to navigate to the OTP verification page" — the sendLoginOtpForLogin -> Supabase call happens on a cold instance.
- "OTP-related requests and responses appear slow" — verify-login-otp on a cold instance.
- "Admin/Doctor/Secretary portal pages take a long time to load their data" — first dashboard load after idle.
- Mobile slow responses — the Flutter app talks to the same Render backend; a cold instance delays its first API call too.

Cold starts explain intermittent, first-request-after-idle slowness. They do not explain consistently slow responses on warm instances, which point to the application-level findings below.

**3. Which problems suggest additional backend or database bottlenecks?**

- The Doctor portal's sequential profile-then-dashboard fetch and duplicate profile request (Finding-06) slow the dashboard even on a warm backend.
- The mobile app's duplicate PATIENT-then-SECRETARY login (Finding-11) and absence of cache/retry (Finding-12) make mobile responses slow regardless of backend temperature.
- Admin dashboard sequential stats queries (Finding-07) and unpaginated admin lists (Finding-08) add latency and will worsen with data growth.
- The authenticate() middleware extra doctors query per doctor request (Finding-15) and capacity re-calculation on writes (Finding-16) add per-request overhead.
- Missing database indexes (Finding-17) will make dashboard queries slower as tables grow.

**4. Why does the mobile application also experience slow responses?**

The mobile app calls the same Render backend, so it is subject to the same cold-start delays as the web portals. In addition, the Flutter ApiService has no caching, no request deduplication, no retry, and no token refresh, so every screen load pays full network + backend latency and transient failures are not retried. Most significantly, ApiService.login() tries PATIENT then SECRETARY sequentially, so every secretary login makes two backend login requests (doubling login latency and auth rate-limit consumption). These are application-level issues that persist even when the backend is warm.

**5. Would upgrading Render likely improve performance?**

Partially. Upgrading Render (to a paid instance type that doesn't spin down) would likely eliminate the 50+ second cold-start delay, which is the largest single contributor to first-request-after-idle slowness. It would also provide more CPU for bcrypt operations and a more stable connection pool. However, it would not fix: the mobile duplicate-login double-request, the missing mobile cache/retry, the Doctor portal's sequential/double profile fetch, the admin sequential stats queries, unpaginated admin lists, or missing database indexes. Those would persist after an upgrade and should be addressed in parallel or first.

**6. What should we measure before spending money on infrastructure?**

Measure, in order:
1. First-request-after-idle duration (backend TTFB after ~30-60 minutes idle) — confirms the cold-start magnitude.
2. Subsequent (warm) request duration for login, OTP verify, and dashboard endpoints — establishes the warm baseline.
3. Backend startup duration (testDatabaseConnection() + time to app.listen()) — quantifies the pre-flight cost.
4. Supabase signInWithOtp / verifyOtp duration — isolates the OTP/email component from backend processing.
5. Database query times for dashboard queries (EXPLAIN ANALYZE) — confirms whether indexes are needed.

If the cold start is ~50s and warm requests are fast, an infrastructure upgrade is the highest-value spend. If warm requests are also slow, application-level optimization (Priority 1-4 tasks) should come first.

**7. What should we optimize first?**

Priority 1 application fixes, because they are zero-cost and address problems that exist regardless of infrastructure:
1. Eliminate the mobile duplicate login (PATIENT-then-SECRETARY).
2. Make the Doctor portal fetch profile and dashboard in parallel (remove the duplicate/sequential profile fetch).
3. Add mobile GET caching, deduplication, and retry.

Then measure the cold start (T1). If confirmed as the dominant delay, proceed to infrastructure (Render upgrade) plus backend/database tuning (Priority 2: pool tuning, indexes, parallel admin queries).

---

**End of report.** This document is read-only and contains no source code modifications. All file paths and code references were verified against the repository at C:\Users\Bren\Documents\FindMyDoctor.