---
agent: devin-local
session: sedate-beryllium
created: 2026-11-05T12:38:59Z
---
# Patient Waitlist Feature Implementation Plan

Implement a complete Patient Waitlist feature allowing patients to join waitlists when appointments are fully booked, with automatic promotion when slots become available, 24-hour offer expiration, and full mobile UI integration.

# Patient Waitlist Feature Implementation Plan

## Summary
Implement a complete Patient Waitlist feature allowing patients to join waitlists when appointments are fully booked, with automatic promotion when slots become available, 24-hour offer expiration, and full mobile UI integration.

## Implementation Phases

### Phase 1: Database Schema and Migration

**File: `backend/database/041_add_waitlists.sql`**

Create a new `waitlists` table with the following schema:
- `id` (UUID, primary key)
- `patient_id` (UUID, foreign key to patients)
- `doctor_id` (UUID, foreign key to doctors)
- `waitlist_date` (DATE, the date the patient wants to wait for)
- `status` (VARCHAR, enum: WAITING, OFFERED, CONVERTED, EXPIRED, CANCELLED)
- `position` (INTEGER, calculated based on join order)
- `offered_at` (TIMESTAMP, when status changed to OFFERED)
- `expires_at` (TIMESTAMP, 24 hours after offered_at)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

Constraints:
- Unique constraint on (patient_id, doctor_id, waitlist_date) to prevent duplicates
- Foreign keys to patients and doctors (no clinics FK as per requirements)
- Check constraint for status enum
- Indexes on (doctor_id, waitlist_date, status) for efficient querying
- Index on (patient_id) for user-specific queries
- Trigger for auto-updating updated_at

### Phase 2: Backend API Layer

**File: `backend/src/api/waitlists.ts`**

Create and mount a new router at `/api/v1/waitlists` with patient-only endpoints:

1. **POST `/api/v1/waitlists/`** - Join a waitlist
   - Body: `{ doctorId, waitlistDate }`
   - Validations:
     - Doctor exists and is active (is_approved = true)
     - Requested date is in the future
     - Schedule is genuinely FULL (check daily_capacities)
     - Patient has no existing active entry for same doctor/date
   - Create waitlist entry with status WAITING
   - Calculate position based on existing entries for that doctor/date
   - Return success with position

2. **GET `/api/v1/waitlists/me`** - View authenticated patient's waitlist entries
   - Return all waitlist entries for the authenticated patient
   - Include doctor details (name, specialty, practice_name)
   - Order by waitlist_date DESC, then position ASC

3. **GET `/api/v1/waitlists/:id`** - View individual entry
   - Verify ownership through patient record linked to authenticated user
   - Return full entry details with doctor information

4. **DELETE `/api/v1/waitlists/:id`** - Leave a waitlist
   - Verify ownership
   - Update status to CANCELLED
   - Recalculate positions for remaining WAITING entries
   - Return success

Mount the router in `backend/src/index.ts`:
```typescript
import waitlistsRouter from './api/waitlists.js';
app.use(`/api/${apiVersion}/waitlists`, authenticate, authorize('PATIENT'), waitlistsRouter);
```

### Phase 3: Waitlist Promotion Service

**File: `backend/src/modules/waitlists/waitlistPromotionService.ts`**

Create a reusable service for waitlist promotion:

**Function: `promoteNextPatient(doctorId: string, date: string)`**
- Called when an appointment is cancelled or rescheduled (slot becomes available)
- Find the earliest WAITING patient for that doctor/date
- If found:
  - Update status to OFFERED
  - Set offered_at to CURRENT_TIMESTAMP
  - Set expires_at to offered_at + 24 hours
  - Create notification using `createNotification()` with type 'WAITLIST_UPDATE'
  - Return the promoted waitlist entry
- If no WAITING patients, return null

**Function: `expireOfferedWaitlists()`**
- Can be called periodically (e.g., via cron job or on-demand)
- Find all OFFERED entries where expires_at < CURRENT_TIMESTAMP
- For each expired entry:
  - Update status to EXPIRED
  - Recalculate positions for remaining WAITING entries
  - Try to promote the next patient for that doctor/date
- Return count of expired entries

**Position Calculation:**
- Position = 1 + (count of WAITING entries with earlier created_at for same doctor/date)
- Recalculate whenever status changes from WAITING to non-WAITING

### Phase 4: Integration with Appointment Cancellation/Rescheduling

**Modify: `backend/src/api/appointments.ts`**

1. **In `PATCH /:id/cancel` endpoint:**
   - After capacity is decremented and queue is reassigned
   - Call `promoteNextPatient(doctorId, appointmentDate)`
   - This will automatically offer the slot to the earliest waiting patient

2. **In `PATCH /:id/reschedule` endpoint:**
   - If the old date's capacity becomes available after rescheduling
   - Call `promoteNextPatient(doctorId, oldAppointmentDate)`
   - This will offer the old slot to waiting patients

### Phase 5: Notification Support

**Modify: `backend/src/api/notifications.ts`**

Add 'WAITLIST_UPDATE' to the `NotificationTypes` constant:
```typescript
export const NotificationTypes = {
  // ... existing types
  WAITLIST_UPDATE: 'WAITLIST_UPDATE',
} as const;
```

### Phase 6: Mobile API Service Extension

**Modify: `mobile/lib/core/services/api_service.dart`**

Add waitlist API methods:

```dart
// Join a waitlist
Future<Map<String, dynamic>> joinWaitlist({
  required String doctorId,
  required String waitlistDate,
}) async {
  return await post(
    '/waitlists',
    body: {
      'doctorId': doctorId,
      'waitlistDate': waitlistDate,
    },
    requireAuth: true,
  );
}

// Get patient's waitlist entries
Future<Map<String, dynamic>> getMyWaitlists() async {
  return await get('/waitlists/me', requireAuth: true);
}

// Get single waitlist entry
Future<Map<String, dynamic>> getWaitlistEntry(String id) async {
  return await get('/waitlists/$id', requireAuth: true);
}

// Leave a waitlist
Future<Map<String, dynamic>> leaveWaitlist(String id) async {
  return await delete('/waitlists/$id', requireAuth: true);
}
```

### Phase 7: Mobile UI - Doctor Schedule Page Update

**Modify: `mobile/lib/features/doctors/presentation/doctor_schedule_page.dart`**

1. **When a date is FULL:**
   - Show a "Join waitlist" action button instead of booking confirmation
   - Display message: "All slots are fully booked. Join the waitlist to be notified when a slot becomes available."

2. **Join waitlist action:**
   - Show confirmation dialog: "Join waitlist for [date]?"
   - Call `ApiService().joinWaitlist()`
   - On success:
     - Show success snackbar: "You've joined the waitlist for [date]. Position: [position]"
     - Navigate to waitlist screen
   - On error:
     - Show error snackbar with message
     - Allow retry

### Phase 8: Mobile UI - New Waitlist Screen

**File: `mobile/lib/features/waitlist/presentation/waitlist_page.dart`**

Create a new screen displaying the patient's waitlist entries:

**Features:**
- Pull-to-refresh functionality
- List of waitlist entries with:
  - Doctor name and specialty
  - Waitlist date
  - Current position
  - Status (WAITING, OFFERED, EXPIRED, etc.)
  - Time since joined
- Leave waitlist functionality with confirmation dialog
- Loading states
- Empty state (no waitlist entries)
- Error states with retry button
- Status-specific UI:
  - WAITING: Show position and "You'll be notified when a slot opens"
  - OFFERED: Show "A slot is available! Book within 24 hours" with call-to-action
  - EXPIRED: Show "Offer expired" with message
  - CANCELLED: Show "Cancelled"
  - CONVERTED: Show "Successfully booked"

**File: `mobile/lib/features/waitlist/models/waitlist.dart`**

Create a model for waitlist data:
```dart
class Waitlist {
  final String id;
  final String doctorId;
  final String doctorName;
  final String doctorSpecialty;
  final String waitlistDate;
  final String status;
  final int position;
  final String? offeredAt;
  final String? expiresAt;
  final String createdAt;
  // ... toMap() and fromMap() methods
}
```

### Phase 9: Mobile Navigation Integration

**1. Add waitlist route to main.dart**
- Add route `/waitlist` pointing to `WaitlistPage`

**2. Add entry point from Home/Appointments tab**
- In `home_page.dart` Appointments tab, add a "My Waitlists" button or list item
- Navigate to `/waitlist` on tap

**3. Add entry point from Notifications**
- In `notifications_page.dart`, handle WAITLIST_UPDATE notification type
- On tap, navigate to `/waitlist`

### Phase 10: Testing and Verification

**Backend Testing:**
- Test waitlist creation with valid/invalid data
- Test duplicate prevention (same patient, doctor, date)
- Test position calculation and recalculation
- Test promotion on appointment cancellation
- Test promotion on appointment rescheduling
- Test 24-hour expiration logic
- Test leave waitlist functionality
- Test ownership verification for read/delete operations

**Mobile Testing:**
- Test join waitlist from schedule page
- Test waitlist list display
- Test pull-to-refresh
- Test leave waitlist with confirmation
- Test empty states
- Test error states
- Test notification deep-linking to waitlist screen
- Test status-specific UI rendering

**Integration Testing:**
- Test full flow: Cancel appointment → Patient promoted → Notification sent → Patient books
- Test expiration flow: Offer expires → Next patient promoted
- Test concurrent waitlist joins (position ordering)

## Files to Create

1. `backend/database/041_add_waitlists.sql` - Database migration
2. `backend/src/api/waitlists.ts` - Waitlist API router
3. `backend/src/modules/waitlists/waitlistPromotionService.ts` - Promotion service
4. `mobile/lib/features/waitlist/models/waitlist.dart` - Waitlist data model
5. `mobile/lib/features/waitlist/presentation/waitlist_page.dart` - Waitlist screen

## Files to Modify

1. `backend/src/index.ts` - Mount waitlists router
2. `backend/src/api/appointments.ts` - Integrate promotion on cancel/reschedule
3. `backend/src/api/notifications.ts` - Add WAITLIST_UPDATE type
4. `mobile/lib/core/services/api_service.dart` - Add waitlist API methods
5. `mobile/lib/features/doctors/presentation/doctor_schedule_page.dart` - Add join waitlist UI
6. `mobile/lib/features/home/presentation/home_page.dart` - Add waitlist entry point
7. `mobile/lib/features/notifications/presentation/notifications_page.dart` - Handle WAITLIST_UPDATE deep-link
8. `mobile/lib/main.dart` - Add waitlist route

## Risks and Considerations

1. **Concurrency:** Waitlist promotion must handle concurrent cancellations gracefully. Use advisory locks similar to appointment booking.

2. **Position Recalculation:** When a patient leaves or is promoted, positions must be recalculated for remaining WAITING entries to maintain order.

3. **Offer Expiration:** If a patient doesn't book within 24 hours, the offer expires and the next patient should be promoted. Consider implementing a scheduled job or checking on-demand.

4. **Notification Delivery:** Ensure FCM/APNs delivery works correctly for WAITLIST_UPDATE notifications.

5. **Data Integrity:** The unique constraint on (patient_id, doctor_id, waitlist_date) prevents duplicates but must be enforced at the database level.

6. **Edge Cases:**
   - Patient tries to join waitlist for a date that's not FULL
   - Patient cancels appointment and then tries to join waitlist for same date
   - Multiple cancellations in rapid succession
   - Waitlist entry exists but patient is no longer active

7. **Performance:** Position recalculation queries should be optimized with proper indexes.

8. **UX:** Clear messaging about waitlist status and timeframes is critical for patient understanding.

## Migration Execution

After creating the migration file `041_add_waitlists.sql`, execute it:
```bash
cd backend
psql -U your_user -d your_database -f database/041_add_waitlists.sql
```

Or add an npm script to `package.json` if following the project's pattern:
```json
"scripts": {
  "migrate:waitlists": "psql $DATABASE_URL -f database/041_add_waitlists.sql"
}
```

Then run:
```bash
npm run migrate:waitlists
```

## Version Update

This feature adds new business rules and database schema changes, so update the version:
- Update `docs/CURRENT_VERSION.md` from `01.30` to `01.31`
- Add entry to `docs/VERSION_HISTORY.md` with detailed changes
