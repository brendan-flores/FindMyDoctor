# FindMyDoctor

FindMyDoctor is organized as three independently developed applications:

```text
FindMyDoctor/
+-- mobile/          # Flutter frontend (patient mobile app)
+-- mobile/backend/  # REST API and backend services
+-- web/             # Next.js web app (doctor/secretary/admin dashboards)
+-- docs/            # Product and architecture documentation
+-- README.md
```

## Development boundaries

- Run Flutter commands from `mobile/`.
- Run backend commands from `mobile/backend/`.
- Run Next.js commands from `web/`.
- The mobile app communicates with the backend over the REST API.
- The web app communicates with the backend over the REST API.
- Both frontend apps must never connect directly to PostgreSQL or an external AI provider.

The backend framework and database implementation will be added under `mobile/backend/` when selected.