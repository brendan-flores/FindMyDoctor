# FindMyDoctor

FindMyDoctor is a healthcare appointment management prototype connecting patients, doctors, and secretaries through a centralized platform.

```text
FindMyDoctor/
+-- mobile/    # Flutter patient mobile app
+-- web/       # Next.js web dashboards (doctor/secretary/admin)
+-- backend/   # REST API and backend services (shared)
+-- docs/      # Product and architecture documentation
+-- UI-Prototypes/  # UI reference designs
+-- README.md
```

## Key Features

- **Unified Queue System**: Online and walk-in patients share one daily queue per doctor with sequential numbering
- **Concurrency-Safe Booking**: PostgreSQL advisory locks prevent duplicate queue numbers and capacity overruns
- **Queue Reassignment**: Automatic queue number updates when appointments are cancelled with patient notifications
- **Patient Information Validation**: Doctor-specific information check before booking
- **Week-Only Scheduling**: Patients see only the current week's availability
- **Queue Position Display**: Shows "You are patient #X out of Y" where Y is the configured capacity
- **Doctor Self-Registration**: OTP-verified registration with profile completion workflow
- **Two-Factor Authentication**: Optional 2FA for doctors and secretaries with trusted browser management
- **Professional Photo Upload**: PNG-only doctor photos stored in Supabase Storage
- **Approval Workflows**: Doctor and secretary approval processes
- **Role-Based Dashboards**: Separate interfaces for patients, doctors, secretaries, and admins

## Development Boundaries

- Run Flutter commands from `mobile/`
- Run Next.js commands from `web/`
- Run backend commands from `backend/`
- The mobile app communicates with the backend over the REST API
- The web app communicates with the backend over the REST API
- Both frontend apps must never connect directly to PostgreSQL or an external AI provider
- AI API keys and database credentials remain backend-only
- No direct patient-to-doctor messaging (enforced at API and database level)

## Architecture

- **Mobile**: Flutter for patient-facing features
- **Web**: Next.js 14 for doctor/secretary/admin dashboards
- **Backend**: Node.js/Express modular monolith with PostgreSQL
- **Communication**: REST API (`/api/v1`) connecting all components
- **Storage**: Supabase Storage for doctor professional photos
- **Database**: PostgreSQL with SQL migrations