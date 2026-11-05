# Waitlist Feature Testing Plan

## Branch Name:
waitlist-feature-implementation

## Description of Changes/Features:
Implemented a complete waitlist feature allowing patients to join waitlists when appointments are fully booked, with automatic promotion when slots become available, 24-hour offer expiration, and full mobile UI integration including:
- Backend API endpoints for waitlist management
- Mobile waitlist page with status tracking
- Waitlist status display on doctor schedule page
- Waitlist badge indicator on Appointments tab
- Waitlist section on Appointments page
- Book Now functionality for promoted patients
- Notification system for waitlist updates

## Feature Validation: Patient Waitlist System

## Prerequisites:
- A running backend server with PostgreSQL database
- Database migration 041_add_waitlists.sql must be applied
- A patient account registered and verified
- A doctor account with approved status and configured schedule
- At least one date where the doctor's schedule is FULL (fully booked)
- Flutter mobile app running or build ready for testing

## Steps:

### Test 1: Join Waitlist from Doctor Schedule Page

**Step 1:** Log in as a patient
- Expected: Patient successfully logs in and lands on Home screen

**Step 2:** Navigate to Doctors tab and select a doctor
- Expected: Doctor profile page loads with schedule information

**Step 3:** Tap on a date that shows as "Fully Booked"
- Expected:
  - Date info section shows the "Fully Booked" message
  - The payment method selector is hidden
  - "Continue Booking" is not shown
  - "Join Waitlist" appears in the bottom action bar where "Continue Booking" normally appears

**Step 4:** Tap "Join Waitlist" button
- Expected: Confirmation dialog appears asking to join waitlist for the selected date

**Step 5:** Confirm by tapping "Join"
- Expected: 
  - Success snackbar appears: "You've joined the waitlist. Position: #X. You'll be notified when a slot becomes available and you're next in line."
  - UI updates to show waitlist status instead of the bottom "Join Waitlist" action
  - Shows "You're on the Waitlist" with position number
  - "View Full Waitlist" button appears

**Step 6:** Verify waitlist status is displayed
- Expected: 
  - Status badge shows "You're on the Waitlist"
  - Position is displayed (e.g., "Position #3")
  - Message says "Position #3. You'll be notified when a slot becomes available."

### Test 2: View Waitlist Status on Appointments Tab

**Step 1:** Navigate to Appointments tab
- Expected: 
  - Red badge appears on Appointments tab icon showing waitlist count (e.g., "1")
  - Appointments page loads with waitlist section at the top

**Step 2:** Verify waitlist section
- Expected:
  - Section header shows "Active Waitlists" with hourglass icon
  - Waitlist card displays doctor name, specialty, and date
  - Status badge shows position (e.g., "Position #3")
  - "View Details" button is visible

**Step 3:** Tap "View Details" button
- Expected: Navigates to full waitlist page

### Test 3: View Full Waitlist Page

**Step 1:** Navigate to waitlist page (via Appointments page or header button)
- Expected: Waitlist page loads with list of all waitlist entries

**Step 2:** Verify waitlist entry details
- Expected:
  - Doctor name and specialty displayed
  - Waitlist date shown
  - Status badge shows "Waiting"
  - Position displayed (e.g., "Position #3")
  - Message: "Position #3. You'll be notified when a slot opens."
  - "Leave Waitlist" button is visible
  - Time since joined is shown (e.g., "5m ago")

**Step 3:** Tap "Leave Waitlist" button
- Expected: Confirmation dialog appears

**Step 4:** Confirm leaving waitlist
- Expected:
  - Success snackbar: "Successfully left waitlist"
  - Waitlist entry is removed from the list
  - Badge on Appointments tab disappears (if no other waitlists)

### Test 4: Waitlist Promotion (Backend Simulation)

**Step 1:** Have an admin or secretary cancel an appointment for the same doctor and date
- Expected: Appointment is cancelled successfully

**Step 2:** Check backend logs or database
- Expected: Waitlist promotion service is called and updates the first waiting patient to OFFERED status

**Step 3:** Refresh the mobile app (pull-to-refresh on waitlist page)
- Expected:
  - Waitlist entry status changes to "You're Position #1!"
  - Status badge shows "You're Position #1!"
  - Message: "A slot is now available! Book within 24 hours to secure it."
  - Time remaining countdown appears (e.g., "23h 59m remaining")
  - "Book Now" button appears instead of "Leave Waitlist"

**Step 4:** Tap "Book Now" button
- Expected: Navigates to doctor schedule page with the date pre-selected

**Step 5:** Verify doctor schedule page
- Expected:
  - The date is already selected
  - Waitlist status is cleared
  - Availability is refreshed showing the slot is now available
  - Patient can proceed with booking

### Test 5: Waitlist Notification

**Step 1:** After waitlist promotion, check notifications
- Expected:
  - New notification appears with title "You're Next in Line!"
  - Message: "A slot is now available! You're position #1. Book within 24 hours to secure your appointment."
  - "Book Now" button is visible in the notification card

**Step 2:** Tap notification
- Expected: Opens the doctor's schedule page with the offered waitlist date preselected and the correct doctor details

**Step 3:** Tap "Book Now" button in notification
- Expected: Opens the doctor's schedule page with the offered waitlist date preselected and the correct doctor details

**Step 4:** Open the header notification dropdown and tap the same notification
- Expected:
  - The dropdown closes
  - The doctor's schedule page opens with the offered waitlist date preselected
  - The full notification message is visible in the dropdown without ellipsis truncation

### Test 6: Multiple Waitlists

**Step 1:** Join waitlist for another doctor and date
- Expected: Successfully joins with new position

**Step 2:** Check Appointments tab badge
- Expected: Badge shows count "2"

**Step 3:** Check Appointments page waitlist section
- Expected: Both waitlist entries are displayed

**Step 4:** Check full waitlist page
- Expected: Both entries listed ordered by date then position

### Test 7: Waitlist Expiration (Time-based)

**Step 1:** Manually set a waitlist entry's expires_at to past in database
- Expected: Entry status should update to EXPIRED

**Step 2:** Refresh waitlist page
- Expected:
  - Status shows "Offer Expired"
  - Message: "The offer has expired. The slot was offered to the next patient."
  - No action buttons available

### Test 8: Duplicate Prevention

**Step 1:** Try to join waitlist for same doctor and date again
- Expected: Error message "You already have an active waitlist entry for this doctor and date"

**Step 2:** Try to join waitlist for a date that is not FULL
- Expected: Error message "Cannot join waitlist: slots are still available"

### Test 9: Waitlist from Schedule Page After Navigation

**Step 1:** Navigate to doctor schedule from waitlist page via "Book Now"
- Expected: Schedule page loads with correct date selected

**Step 2:** Verify the date info section
- Expected: Shows available slot (not FULL status)

**Step 3:** Complete booking process
- Expected: Patient can successfully book the appointment

### Test 10: Backend API Endpoints

**Step 1:** Test POST /api/v1/waitlists (join waitlist)
- Expected: Returns success with waitlistId and position

**Step 2:** Test GET /api/v1/waitlists/me (get my waitlists)
- Expected: Returns array of waitlist entries with doctor details

**Step 3:** Test GET /api/v1/waitlists/check (check status)
- Expected: Returns waitlist entry if exists, null otherwise

**Step 4:** Test GET /api/v1/waitlists/count (get count)
- Expected: Returns count of active waitlists

**Step 5:** Test DELETE /api/v1/waitlists/:id (leave waitlist)
- Expected: Returns success, status updated to CANCELLED

## Expected Output:

### For Each Action:
- API calls return appropriate success/error responses
- UI updates immediately reflect changes
- State is correctly maintained across navigation
- Badges update when waitlist count changes
- Notifications are sent for promotions
- Time remaining countdown displays correctly
- All validation rules are enforced (no duplicates, FULL check, etc.)

### Expected Behavior of the Feature:
- Patients can easily discover they have active waitlists via badge indicator
- Patients can view waitlist status directly on the schedule page after joining
- Patients can manage all waitlists from the Appointments page
- Patients are notified when promoted and can book immediately
- Waitlist status is consistently displayed across all relevant screens
- All edge cases are handled (duplicates, non-FULL dates, expiration, etc.)
- The feature provides a smooth user experience with clear feedback

## Additional Notes:
- Ensure push notifications are configured for waitlist promotion alerts
- Test with different time zones to verify date handling
- Verify position recalculation when patients leave waitlist
- Test concurrent joins to ensure position assignment is correct
- Verify database transaction integrity for all operations
