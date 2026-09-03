# FindMyDoctor Web

This directory contains the FindMyDoctor Next.js web application for doctor, secretary, and admin dashboards.

## Purpose

The web application provides desktop-friendly dashboards for:
- **Doctors**: Manage appointments, schedules, patients, and prescriptions
- **Secretaries**: Manage daily queue, walk-ins, payments, and messaging
- **Admins**: Manage users, doctors, secretaries, clinics, and system settings

## Structure

```text
web/
+-- src/
|   +-- app/              # Next.js app router pages
|   |   +-- page.tsx      # Landing page with role selection
|   |   +-- doctor/       # Doctor dashboard
|   |   +-- secretary/   # Secretary dashboard
|   |   +-- admin/        # Admin dashboard
|   +-- components/      # Reusable React components
|   +-- lib/             # Utility functions and configurations
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

The web application communicates with the REST API located in `backend/`. Both frontend applications (mobile and web) use the same backend API.

## Architecture Notes

- Uses Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Designed as role-based dashboards
- All dashboards share the same authentication and API integration
