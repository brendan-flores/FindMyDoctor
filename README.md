# FindMyDoctor

FindMyDoctor is organized as three independently developed applications:

```text
FindMyDoctor/
+-- mobile/    # Flutter frontend (patient mobile app)
+-- web/       # Next.js web app (doctor/secretary/admin dashboards)
+-- backend/   # REST API and backend services (shared)
+-- docs/      # Product and architecture documentation
+-- README.md
```

## Development boundaries

- Run Flutter commands from `mobile/`.
- Run Next.js commands from `web/`.
- Run backend commands from `backend/`.
- The mobile app communicates with the backend over the REST API.
- The web app communicates with the backend over the REST API.
- Both frontend apps must never connect directly to PostgreSQL or an external AI provider.

The backend framework and database implementation will be added under `backend/` when selected.