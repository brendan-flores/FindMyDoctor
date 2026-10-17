Single Source of Truth: Never invent requirements, roles, or database schemas. Always read /docs/prd.md, /docs/architecture.md, and /docs/architecture-essentials.md before executing a task.

Strict Architecture Enforcement: The Flutter mobile application in /mobile must NEVER connect directly to PostgreSQL. All database interactions must occur through the Node.js API in /backend.

Hard Communication Boundary: The system must never provide direct patient-to-doctor chat. Any messaging feature you build must strictly adhere to Patient ↔ Secretary or Patient ↔ AI Chatbot boundaries.

Security & AI Credentials: AI provider API keys must remain safely on the backend. Never expose these keys or database URLs to the mobile application.

No Speculative Dependencies: Do not introduce Kafka, GraphQL, microservices, or any over-engineered frameworks. Stick to the documented Modular Monolith Backend and PostgreSQL setup.

Verify Before Changing: Before modifying existing modules, analyze the current implementation to ensure you do not accidentally bypass the established role-based access controls (Patient, Doctor, Secretary, Clinic Staff, Admin).

Database Migration Execution: When adding new database schema changes (SQL migration files in /backend/database), immediately run the migration to apply the changes to the database. Do not commit new schema files without executing them. This ensures the database is always in sync with the codebase and prevents other team members from encountering schema mismatch errors. Use the appropriate npm scripts in backend/package.json (e.g., npm run migrate:patient-required-fields) or direct SQL execution to apply migrations.

Documentation Synchronization: When a user-requested feature change adds, modifies, replaces, or removes a documented requirement, workflow, business rule, role permission, or architecture decision, update the relevant files in `/docs/prd.md`, `/docs/architecture.md`, and/or `/docs/architecture-essentials.md` as part of the same task. The codebase and documentation must remain consistent. Before completing the task, verify that no outdated or conflicting documentation remains.

System State Synchronization: `SYSTEM_STATE.md` is the dedicated document for the project's current system state. When making changes that affect the documented system state, update `SYSTEM_STATE.md` in the same task. This includes changes to authentication, registration, OTP verification, doctor approval workflows, database structures, API endpoints, application behavior, or architecture. Do not duplicate the detailed system-state information in `AGENTS.md`; keep it in `SYSTEM_STATE.md`. Always keep `SYSTEM_STATE.md` synchronized with the actual implementation.

Git Operations: Do not automatically commit and push changes. Git commits should only be made when explicitly requested by the user or as part of a clearly defined task. Always ask for confirmation before committing or pushing changes.

Application Version Management: Always read `/docs/CURRENT_VERSION.md` before making changes. This file contains only the current system version number (e.g., `01.00`) and is the authoritative source for the current version. `/docs/VERSION.md` contains the versioning rules. `/docs/VERSION_HISTORY.md` contains the complete version history. Use the `00.00` version format.

**Version Update Process:**
1. After implementing changes, evaluate the overall scope and impact to determine whether a version update is warranted
2. If an update is warranted, automatically apply the version update without user permission
3. Update the version files in this order:
   - Rewrite the version number in `/docs/CURRENT_VERSION.md` with the new version
   - Add a new version entry to `/docs/VERSION_HISTORY.md` with detailed changes
   - Ensure CURRENT_VERSION.md and the latest entry in VERSION_HISTORY.md match
4. If no update is warranted, leave both files unchanged

**Mandatory Version Update Criteria:**
- New business rules or workflows
- Breaking changes to existing functionality
- API endpoint changes that affect clients
- Database schema changes
- Authentication/authorization flow changes
- Architectural restructuring

**Discretionary Version Update Criteria:**
- Bug fixes and patches
- UI/UX improvements
- Performance optimizations
- Documentation updates
- Non-breaking API additions

Maintain one system-wide version covering the web application, mobile application, and backend API. Do not change the version files without user approval.