# AGENTS.md

## Core rules
- Source of truth: never invent requirements, roles, or database schemas. Before a task, read /docs/architecture-essentials.md. Read only the relevant sections of /docs/prd.md and /docs/architecture.md for the feature you are touching (search by heading; do not load whole files). Use /docs/INDEX.md to find them if it exists.
- Architecture: the Flutter app (/mobile) never connects to PostgreSQL. All data access goes through the Node.js API (/backend). Use the documented modular monolith + PostgreSQL only; no Kafka, GraphQL, microservices, or other over-engineered frameworks.
- Communication: no direct patient-to-doctor chat. Messaging is only Patient <-> Secretary or Patient <-> AI Chatbot.
- Security: AI provider API keys and database URLs stay on the backend and are never exposed to mobile.
- Access control: before modifying a module, check the current implementation so you do not bypass role-based access (Patient, Doctor, Secretary, Clinic Staff, Admin).

## Database
- For any new or changed SQL in /backend/database, run the migration immediately (npm scripts in backend/package.json or direct SQL). Do not commit schema files you have not executed.
- Also mirror the final state into backend/database/consolidated_schema.sql in the same task. Full rules: /docs/db-rules.md (read it whenever you touch SQL).
- Never edit an already-applied migration; create a new one. If a change cannot be mirrored cleanly (conflicts, ambiguous ordering, destructive changes), stop and ask.
- In the final summary, list the migration files added and where they were mirrored.

## Documentation
- When a change adds, modifies, replaces, or removes a requirement, workflow, business rule, role permission, or architecture decision, update the relevant /docs files in the same task and make sure no outdated or conflicting text remains.
- Keep SYSTEM_STATE.md in sync with the actual implementation (auth, registration, OTP, doctor approval, database structure, API endpoints, behavior, architecture). Do not duplicate its details here.

## Versioning
- Read /docs/CURRENT_VERSION.md before changes (format 00.00). Rules: /docs/VERSION.md. History: /docs/VERSION_HISTORY.md.
- Do not change version files without user approval. If a bump seems warranted (new business rules or workflows, breaking changes, API/schema/auth/architecture changes), say so in the final summary and ask.

## Git and cleanup
- Never commit or push without explicit user confirmation.
- Delete temporary test/debug files when done; never commit them.