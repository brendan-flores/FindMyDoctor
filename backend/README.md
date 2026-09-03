# FindMyDoctor Backend

This directory contains the FindMyDoctor REST API and modular-monolith backend.

The backend owns authentication, authorization, doctor discovery, scheduling, appointments, patient records, patient-secretary messaging, AI integration, notifications, and administration.

## Boundary

```text
mobile/ -> REST API -> backend/ -> PostgreSQL
                         |
                         -> External AI provider
```

The mobile app must not connect directly to PostgreSQL or the AI provider. AI provider credentials remain server-side.

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