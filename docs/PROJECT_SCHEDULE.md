# FindMyDoctor Project Schedule

This schedule follows Section 3.2, **Project Schedules**, in the SPMP. The SPMP describes a recommended 9-week prototype delivery baseline and allows parallel work where dependencies and staffing permit.

**Progress status:** Weeks 1–4 are marked done as requested. This status is a project progress marker and is not an independent verification of each deliverable.

| Week | Primary activities | Exit evidence | Status |
|---|---|---|---|
| Weeks 1–3 | Initiation, architecture, authentication, RBAC, OTP flows, doctor approval, admin provisioning, and web dashboards. | Approved baselines, role-protection tests, admin seed, and protected routes. | Done |
| Week 4 | Scheduling module (working hours, availability, break periods), capacity calculation (30-minute default), daily capacity configuration, and reservation system foundation. | Capacity calculation tests, schedule CRUD operations, and basic reservation tests. | Done |
| Week 5 | Unified queue management with sequential numbering, concurrency-safe queue assignment, automatic queue reassignment on cancellation with notifications, capacity enforcement across online and walk-in registrations, walk-in registration with temporary password generation, doctor-specific patient record check before booking, and mobile navigation to appointments view. | Booking/queue integration tests, conflict prevention tests, walk-in account lifecycle tests, concurrency-safe queue assignment tests, queue reassignment notification tests, and doctor-specific patient record validation tests. | Done |
| Week 6 | GCash payment flow (static QR code, receipt upload, verification states), additional charges, payment verification, and secretary-patient chat (conversation authorization and messaging). | Payment state tests, receipt verification workflow, and chat authorization tests. | Not started |
| Week 7 | AI chatbot integration (safety and data minimization), consultation/visit records, medical history, prescription management, and PDF generation. | AI safety tests, data minimization verification, prescription PDF tests, and medical-record association tests. | Not started |
| Week 8 | Mobile integration with appointments, queue, history, prescriptions, and notifications; end-to-end role workflows; basic notifications. | Role-based end-to-end workflow tests and mobile feature integration tests. | Not started |
| Week 9 | Regression testing, performance/concurrency checks, privacy/security review, defect resolution, UAT, deployment, release notes, and handover. | Release candidate, UAT approval, and approved prototype release. | Not started |

## Source

FindMyDoctor SPMP, Section 3.2, **Project Schedules** (schedule begins on printed page 7; Week 9 continues on printed page 8): [FindMyDoctor_SPMP_v1.0.pdf](../FindMyDoctor_SPMP_v1.0.pdf).
