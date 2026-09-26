Single Source of Truth: Never invent requirements, roles, or database schemas. Always read /docs/prd.md, /docs/architecture.md, and /docs/architecture-essentials.md before executing a task.

Strict Architecture Enforcement: The Flutter mobile application in /mobile must NEVER connect directly to PostgreSQL. All database interactions must occur through the Node.js API in /backend.

Hard Communication Boundary: The system must never provide direct patient-to-doctor chat. Any messaging feature you build must strictly adhere to Patient ↔ Secretary or Patient ↔ AI Chatbot boundaries.

Security & AI Credentials: AI provider API keys must remain safely on the backend. Never expose these keys or database URLs to the mobile application.

No Speculative Dependencies: Do not introduce Kafka, GraphQL, microservices, or any over-engineered frameworks. Stick to the documented Modular Monolith Backend and PostgreSQL setup.

Verify Before Changing: Before modifying existing modules, analyze the current implementation to ensure you do not accidentally bypass the established role-based access controls (Patient, Doctor, Secretary, Clinic Staff, Admin).

Documentation Synchronization: When a user-requested feature change adds, modifies, replaces, or removes a documented requirement, workflow, business rule, role permission, or architecture decision, update the relevant files in `/docs/prd.md`, `/docs/architecture.md`, and/or `/docs/architecture-essentials.md` as part of the same task. The codebase and documentation must remain consistent. Before completing the task, verify that no outdated or conflicting documentation remains.

System State Synchronization: `SYSTEM_STATE.md` is the dedicated document for the project's current system state. When making changes that affect the documented system state, update `SYSTEM_STATE.md` in the same task. This includes changes to authentication, registration, OTP verification, doctor approval workflows, database structures, API endpoints, application behavior, or architecture. Do not duplicate the detailed system-state information in `AGENTS.md`; keep it in `SYSTEM_STATE.md`. Always keep `SYSTEM_STATE.md` synchronized with the actual implementation.