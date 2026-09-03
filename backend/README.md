# FindMyDoctor Backend

This directory contains the FindMyDoctor REST API and modular-monolith backend.

The backend serves both the mobile Flutter application and the Next.js web application, providing a shared API for patient, doctor, secretary, and admin functionality.

The backend owns authentication, authorization, doctor discovery, scheduling, appointments, patient records, patient-secretary messaging, AI integration, notifications, and administration.

## Boundary

```text
mobile/ -> REST API -> backend/ -> PostgreSQL
                        |
                        -> External AI provider
web/    -> REST API -> backend/ -> PostgreSQL
                        |
                        -> External AI provider
```

The mobile and web apps must not connect directly to PostgreSQL or the AI provider. AI provider credentials remain server-side.

## Planned structure

```text
backend/
+-- src/
|   +-- api/
|   +-- modules/
|   +-- services/
|   +-- domain/
|   +-- repositories/
|   +-- config/
+-- test/
+-- README.md
```

Use a modular monolith. Keep patient-secretary communication supported, and do not add direct patient-to-doctor chat.