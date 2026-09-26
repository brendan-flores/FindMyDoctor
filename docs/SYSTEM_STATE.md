# FindMyDoctor — System State

This document contains the current system state for the FindMyDoctor project. It should be updated whenever changes are made that affect the documented system state, including authentication, registration, OTP verification, doctor approval workflows, database structures, API endpoints, application behavior, or architecture.

Current System State (September 2026):
- Doctor self-registration creates accounts with `approval_status = 'PENDING'` requiring admin approval
- Three-state doctor approval workflow: PENDING → ACTIVE (approved) or REJECTED
- Patient registration uses email OTP verification via Supabase for account creation
- Supabase is used only for OTP email verification, not for storing application data
- Backend API includes comprehensive endpoints for doctors, admin, OTP, appointments, queue, payments, etc.
- Database schema includes approval status fields, pending doctor signups staging table, and pending patient signups staging table
- Backend API endpoints for patient OTP: `/api/v1/auth/patient/otp/send`, `/api/v1/auth/patient/otp/verify`, `/api/v1/auth/patient/otp/resend`
- Backend API endpoints for doctor OTP: `/api/v1/auth/otp/send`, `/api/v1/auth/otp/verify`, `/api/v1/auth/otp/resend`
- Web application provides role-specific dashboards for Doctor, Secretary, and Admin users
- Mobile application includes OTP verification page for patient registration with full backend integration