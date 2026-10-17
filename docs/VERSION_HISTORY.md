# FindMyDoctor Version History

This document contains the complete version history for the FindMyDoctor application.

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
