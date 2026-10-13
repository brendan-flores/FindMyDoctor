# FindMyDoctor Version History

This document contains the complete version history for the FindMyDoctor application.

---

### 01.01 (In Progress)

**Purpose:** Queue management improvements and navigation fixes

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
