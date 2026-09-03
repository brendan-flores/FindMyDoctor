# FindMyDoctor

FindMyDoctor is organized as two independently developed applications:

```text
FindMyDoctor/
+-- mobile/    # Flutter frontend
+-- backend/   # REST API and backend services
+-- docs/      # Product and architecture documentation
+-- README.md
```

## Development boundaries

- Run Flutter commands from `mobile/`.
- Run backend commands from `backend/`.
- The mobile app communicates with the backend over the REST API.
- The mobile app must never connect directly to PostgreSQL or an external AI provider.

The backend framework and database implementation will be added under `backend/` when selected.