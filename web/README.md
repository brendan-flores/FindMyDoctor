# FindMyDoctor Web

This directory contains the FindMyDoctor Next.js web application for doctor, secretary, and admin dashboards.

## Purpose

The web application provides desktop-friendly dashboards for:
- **Doctors**: Manage appointments, schedules, patients, prescriptions, and profile
- **Secretaries**: Manage daily queue, walk-ins, payments, and patient messaging
- **Admins**: Manage users, doctors, secretaries, approval workflows, and system settings

## Features

### Doctor Dashboard
- **Profile Management**: View and update professional profile, credentials, biography
- **Photo Upload**: Upload professional photo (PNG-only, max 4MB)
- **Schedule Management**: Add, update, and delete working hours
- **Capacity Configuration**: Set daily capacity limits
- **Appointments**: View and manage upcoming appointments
- **Patients**: View patient information and history
- **Prescriptions**: Create and manage digital prescriptions
- **Secretary Management**: Create and manage secretary accounts

### Secretary Dashboard
- **Queue Management**: View and manage daily queue, call next patient
- **Walk-in Registration**: Register walk-in patients with queue assignment
- **Payment Verification**: Verify or reject GCash receipts
- **Patient Chat**: Communicate with patients
- **Appointments**: View and manage appointments

### Admin Dashboard
- **User Management**: View and manage all users
- **Doctor Approvals**: Review and approve/reject doctor registrations
- **Secretary Approvals**: Review and approve/reject secretary registrations
- **System Settings**: Configure system-wide settings

## Structure

```text
web/
+-- src/
||   +-- app/              # Next.js app router pages
||   |   +-- page.tsx      # Landing page with role selection
||   |   +-- auth/         # Doctor/Secretary login and OTP verification
||   |   +-- doctor/       # Doctor dashboard
||   |   |   +-- profile/  # Profile management and photo upload
||   |   |   +-- schedule/ # Schedule and capacity management
||   |   |   +-- appointments/ # Appointment management
||   |   |   +-- patients/ # Patient management
||   |   |   +-- prescriptions/ # Prescription management
||   |   +-- secretary/   # Secretary dashboard
||   |   |   +-- queue/    # Queue management
||   |   |   +-- walk-ins/ # Walk-in registration
||   |   |   +-- payments/ # Payment verification
||   |   |   +-- chat/     # Patient messaging
||   |   +-- admin/        # Admin dashboard
||   |       +-- doctors/  # Doctor approval and management
||   |       +-- secretaries/ # Secretary approval and management
||   |       +-- users/    # User management
||   +-- components/      # Reusable React components
||   +-- lib/             # Utility functions and configurations
+-- public/              # Static assets
+-- package.json
+-- tsconfig.json
+-- tailwind.config.ts
+-- next.config.js
```

## Development

Install dependencies:
```bash
npm install
```

Run development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Backend Integration

The web application communicates with the REST API located in `backend/`. Both frontend applications (mobile and web) use the same backend API at `http://localhost:3000/api/v1`.

## Architecture Notes

- Uses Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Designed as role-based dashboards
- All dashboards share the same authentication and API integration
- JWT-based authentication with role-based access control
- Two-factor authentication support for doctors and secretaries
- Doctor self-registration with OTP verification and admin approval workflow
- Professional photo upload to Supabase Storage

## Important Notes

- The web app must not connect directly to PostgreSQL
- All data operations go through the backend REST API
- AI API keys and database credentials are backend-only
- Patient-doctor direct chat is not allowed (enforced at API level)
- All authentication and authorization is handled by the backend
