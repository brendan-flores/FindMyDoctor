# Task 10 — AI chatbot safety, data minimization, and key handling audit

Audit and strengthen the existing AI chatbot. This is primarily a security-hardening task. Ensure it does not diagnose medical conditions, minimize patient data sent to external providers, and keep provider keys backend-only. This task may run alongside the other Week 7 work.

The only new behavior in scope is the six patient-facing capabilities (C1-C6), the free-tier controls (F1-F7), the missing-key handling (K1-K4), and the mobile placement (M1-M10). Do not add any other feature.

Applicable files: backend/src/api/ai-chat.ts, backend environment variables, mobile/lib/core/constants/api_constants.dart, and any web AI usage.

## Safety requirements
- S1. The AI must refuse diagnosis requests and direct patients with serious issues to see a doctor.
- S2. Strip patient identifiers such as name, email, phone, and IDs before sending context to the AI provider.
- S3. Keep the AI API key on the backend; never expose it in mobile or web code or client responses.
- S4. Restrict AI chat to patients; doctors must not have access.
- S5. Log what is sent to the AI while redacting sensitive content.

## AI capabilities (must all operate within S1-S5)
- C1. Answer general health questions (health education, self-care tips, what a test or term means).
- C2. Tell patients when to see a doctor, including urgent-care guidance when something sounds serious.
- C3. Help patients prepare for a visit, such as what to tell the doctor or what to ask.
- C4. List available doctors by specialty and date ("doctors available today with cardiology"). The backend runs the availability query and the app shows doctor cards with a "Book visit" button. The AI only extracts the specialty and date.
- C5. Point patients to app features, like booking, the Doctors tab, or contacting the secretary.
- C6. Keep conversation history per patient, with "New conversation" and a history list.

## Backend work
- B1. Audit backend/src/api/ai-chat.ts and strengthen the system prompt to define the AI as a medical assistant that never diagnoses. It must refuse diagnosis requests and urgent-care cases with guidance to see a doctor. Add safety tests.
- B2. Strip name, email, username, phone, user IDs, patient IDs, and doctor IDs from prompt context before calling the external provider.
- B3. Log only redacted AI prompt and payment content, following existing redaction patterns.
- B4. Verify that AI_API_KEY and provider configuration remain in backend-only environment configuration through config.ai; they must not appear in responses or client bundles.
- B5. Keep the AI routes PATIENT-only and conversations scoped per patient.
- B6. Keep provider and model configuration server-side. The default model is gpt-3.5-turbo, adjustable through the environment.

## Backend work for the AI capabilities
- BC1. System prompt: cover C1, C2, C3, and C5. The AI must never diagnose, prescribe, change medication, claim to be a doctor, or choose a specialty or condition from symptoms. For symptom-based requests it gives see-a-doctor guidance and lets the patient choose a specialty.
- BC2. Doctor lookup (C4): the AI's only job is to extract the specialty and date from the patient's message, returned as structured output. The backend then runs its existing doctor availability query (Asia/Manila for "today") and returns the results to the app as doctor cards. Doctor names, IDs, schedules, and availability results must never be included in any prompt sent to the external provider. Only active, approved doctors are returned. If nothing is available, the response says so and offers the next available day. Booking still goes through the existing booking flow, including the doctor-specific patient record check.
- BC3. Conversation history (C6): conversations are scoped per patient. Use the existing endpoints /ai/chat and /ai/conversations (and the existing per-conversation endpoints). Support starting a new conversation and listing a patient's own conversations. Only the most recent messages are sent to the provider as context, after redaction.

## Free-tier controls (enforced in the backend before calling the provider)
- F1. Per-patient daily message limit, counted on the Asia/Manila calendar day. Doctor lookup requests count like any other AI message. Counters are stored and enforced server-side, per patient.
- F2. The limit value is configurable through backend environment configuration (not hardcoded); choose the default from the provider's current quota.
- F3. Per-patient rate limit to stop rapid-fire requests.
- F4. Maximum length for each patient message and a max_tokens cap on each AI response.
- F5. Send only a short window of recent messages as context.
- F6. When the daily limit is reached, return a clear limit-reached response without calling the provider.
- F7. Handle provider rate-limit (429), quota, and timeout errors gracefully; never pass raw provider errors to the client. Limit and rate-limit events are logged with the same redaction rules as other AI logging.

## Missing or invalid AI configuration
- K1. The backend must start normally when AI_API_KEY is not set. Reading config.ai must not throw at startup.
- K2. If AI_API_KEY is missing or the provider is unreachable, /ai/chat returns a clear "AI assistant unavailable" response (for example HTTP 503 with an error code) without calling the provider and without including any configuration details or key information.
- K3. A missing key does not count against the patient's daily message limit.
- K4. History, "New conversation", access checks, and limit logic continue to work without a key.

## Mobile and web audit
- A1. Audit mobile/lib/core/constants/api_constants.dart and the /ai/chat usage to confirm mobile calls the backend and contains no provider key.
- A2. Audit any web AI usage to confirm it calls the backend and never holds provider keys.
- A3. Perform an exposure check to confirm the key is absent from mobile and web code.

## Mobile work for the AI capabilities
- M1. Place the AI inside the existing patient Chat tab as a segmented control: "Clinic" | "MediGuide (AI)". Add a Home quick-action entry that opens the MediGuide segment.
- M2. Add a floating "Ask MediGuide" shortcut inside the patient shell, shown only on the main patient screens (Home, Doctors, Appointments, Chat). Tapping it opens the MediGuide conversation page. Hide it on authentication and onboarding screens, on the MediGuide conversation page itself, on payment, receipt-upload and booking-confirmation screens, and while the keyboard is open. Secretary and doctor sessions never show it. Give it an accessible label. No badges or notification dots.
- M3. Show a persistent "general health information only, not a diagnosis" banner and a one-time first-use notice that MediGuide is an AI health information assistant, not a doctor, and that personal identifiers are not sent to the AI provider.
- M4. Add "New conversation" and a conversation history list.
- M5. Render doctor lookup results as doctor cards with a "Book visit" button that opens the existing booking flow.
- M6. Render diagnosis refusals and urgent-care responses as a distinct card with actions such as "Find a doctor" or "Book appointment".
- M7. Show the limit-reached message and friendly error states, including "MediGuide unavailable". The conversation page, history list, and shortcut still open normally when MediGuide is unavailable. Never show raw backend or provider messages.
- M8. Make the MediGuide thread visually distinct from the secretary chat (bot icon, different bubble style, "MediGuide, not a doctor" label).
- M9. Guard the MediGuide route so only patients can open it (secretaries cannot reach it from the secretary mobile home, including by deep link).
- M10. Add no MediGuide entry to the web doctor, secretary, or admin portals.

## Tests (safety, access, and limit tests use a mocked provider and must not require a real AI_API_KEY)
- T1. Diagnosis refusal and urgent-care guidance; no symptom-to-specialty selection by the AI.
- T2. Redaction of name, email, username, phone, user IDs, patient IDs, and doctor IDs from prompt context; redacted AI prompt and payment logging.
- T3. Doctor lookup extracts only specialty and date; no doctor data appears in provider prompts; only active, approved doctors are returned.
- T4. Patient-only access: doctors, secretaries, and admins are rejected; a patient cannot read another patient's conversations.
- T5. Daily limit blocks the next message without calling the provider, resets on the next Asia/Manila day, and is per patient; the rate limit triggers; overlong messages are rejected.
- T6. Provider 429, quota, and timeout errors return a friendly response with no raw provider details.
- T7. With AI_API_KEY unset, the backend starts, /ai/chat returns the unavailable response, history still works, and the response contains no key or configuration values.
- T8. Exposure check: AI_API_KEY and provider configuration are absent from API responses, mobile code, and web code.

## Documentation
- D1. Update SYSTEM_STATE.md, architecture.md, and PROJECT_SCHEDULE.md (and prd.md or architecture-essentials.md if a requirement changes) as part of the same change.

## Out of scope
Symptom checking, access to patient records or prescriptions, AI access for doctors/secretaries/admins, web AI UI, voice, image upload, streaming, and a keyword fallback for doctor lookup.