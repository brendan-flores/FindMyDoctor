# Registered Count Synchronization

This document tracks all operations that affect `registered_count` in the `daily_capacities` table.

## Operations that INCREMENT registered_count (+1)

### 1. Patient Online Appointment Booking
- **Endpoint:** `POST /api/v1/appointments`
- **File:** `src/api/appointments.ts` (line 348)
- **Status:** ✅ IMPLEMENTED - Increments registered_count after creating appointment and queue entry

### 2. Secretary Walk-in Registration (with existing patient)
- **Endpoint:** `POST /api/v1/walk-ins`
- **File:** `src/api/walk-ins.ts` (line 387)
- **Status:** ✅ IMPLEMENTED - Increments registered_count after creating appointment and queue entry

### 3. Secretary Direct Walk-in Registration (creates new account)
- **Endpoint:** `POST /api/v1/walk-ins/direct-register`
- **File:** `src/api/walk-ins.ts` (line 993)
- **Status:** ✅ IMPLEMENTED - Increments registered_count after creating appointment and queue entry

### 4. Patient Appointment Reschedule (new date)
- **Endpoint:** `PATCH /api/v1/appointments/:id/reschedule`
- **File:** `src/api/appointments.ts` (line 682)
- **Status:** ✅ IMPLEMENTED - Increments registered_count for new date

## Operations that DECREMENT registered_count (-1)

### 1. Patient Appointment Cancellation (mobile)
- **Endpoint:** `PATCH /api/v1/appointments/:id/cancel`
- **File:** `src/api/appointments.ts` (line 600)
- **Status:** ✅ IMPLEMENTED - Decrements registered_count after cancelling appointment

### 2. Secretary/Doctor Queue Status Update to CANCELLED
- **Endpoint:** `PATCH /api/v1/queue/:id/status`
- **File:** `src/api/queue.ts` (line 247)
- **Status:** ✅ IMPLEMENTED - Decrements registered_count when status changed to CANCELLED or NO_SHOW

### 3. Patient Appointment Reschedule (old date)
- **Endpoint:** `PATCH /api/v1/appointments/:id/reschedule`
- **File:** `src/api/appointments.ts` (line 676)
- **Status:** ✅ IMPLEMENTED - Decrements registered_count for old date

## Operations that SHOULD NOT affect registered_count

### 1. Queue Status Changes (non-cancellation)
- **Status:** WAITING → CALLED → IN_CHECKUP → COMPLETED
- **Reason:** These are status transitions within the same day, not cancellations
- **Status:** ✅ CORRECT - Does not modify registered_count

### 2. Queue Skip / Not Present
- **Status:** WAITING → SKIPPED or NOT_PRESENT
- **Reason:** Patient is still in the queue, just temporarily unavailable
- **Status:** ✅ CORRECT - Does not modify registered_count

## Data Integrity

### Synchronization Endpoint
- **Endpoint:** `POST /api/v1/secretaries/fix-registered-count`
- **File:** `src/api/secretaries.ts` (line 1138)
- **Purpose:** Recalculates registered_count to match actual active queue entries (excluding CANCELLED and NO_SHOW)
- **Status:** ✅ IMPLEMENTED - For fixing historical data inconsistencies

## Summary

All operations that affect the daily capacity now properly synchronize the `registered_count` field:

✅ **Increment operations:**
- Online appointment booking
- Walk-in registration (both methods)
- Reschedule to new date

✅ **Decrement operations:**
- Patient cancellation (mobile)
- Secretary/doctor cancellation via queue status
- Reschedule from old date

✅ **No-change operations:**
- Queue status transitions (WAITING → CALLED → IN_CHECKUP → COMPLETED)
- Skip / Not Present

The system is now fully synchronized. Any future cancellations (whether via mobile app or secretary/doctor queue management) will properly update the capacity.
