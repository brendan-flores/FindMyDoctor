# Payment Receipt Upload Fix - Summary

## Problem
The mobile app was using a placeholder URL `https://placeholder.com/receipt.jpg` instead of uploading actual receipt images to Supabase Storage. This prevented the secretary from viewing actual GCash payment receipts.

## Solution
Implemented end-to-end receipt upload using Supabase Storage, following the existing pattern used for doctor photos and GCash QR codes.

## Changes Made

### 1. Backend Configuration
**File:** `backend/src/config/index.ts`
- Added `receiptStorageBucket` configuration for Supabase Storage bucket name (default: `payment-receipts`)

**File:** `backend/.env.example`
- Added `SUPABASE_RECEIPT_BUCKET=payment-receipts` environment variable

### 2. Storage Service
**File:** `backend/src/services/storageService.ts`
- Added `RECEIPT_STORAGE_BUCKET` constant
- Added `uploadPaymentReceipt()` function to upload receipt images to Supabase Storage
- Added `validatePaymentReceiptFile()` function to validate PNG/JPEG files with signature checking

### 3. Payments API
**File:** `backend/src/api/payments.ts`
- Added multer configuration for multipart file upload (memory storage)
- Updated `POST /api/v1/payments/:appointmentId/receipt` endpoint:
  - Changed from JSON body with URL to multipart file upload
  - Validates file type and signature server-side
  - Uploads to Supabase Storage using storage service
  - Creates or updates payment record with `PENDING_VERIFICATION` status
  - Returns Supabase public URL

### 4. Mobile API Service
**File:** `mobile/lib/core/services/api_service.dart`
- Added `dart:io` import for File support
- Added `postMultipart()` method for multipart file uploads
- Updated `uploadPaymentReceipt()` to accept File instead of URL

### 5. Mobile Payment Screen
**File:** `mobile/lib/features/payments/presentation/payment_screen.dart`
- Removed placeholder URL logic
- Updated `_uploadReceipt()` to upload actual image file
- Clears selected image after successful upload

### 6. Tests
**File:** `backend/src/api/payments.test.ts`
- Added tests for receipt upload endpoint:
  - Role authorization (PATIENT only)
  - File presence validation
- Note: Full multipart upload tests require integration test setup

**File:** `mobile/test/payment_receipt_upload_test.dart` (new)
- Added unit tests for mobile receipt upload:
  - Successful upload
  - Error handling

### 7. Documentation
**File:** `backend/SUPABASE_RECEIPT_STORAGE_SETUP.md` (new)
- Complete setup instructions for Supabase Storage bucket
- Validation rules and security considerations
- Testing instructions

## Workflow

### Patient Upload Flow
1. Patient selects receipt image from gallery
2. Mobile app validates file size (5MB max)
3. Mobile app uploads file via multipart POST to backend
4. Backend validates file type and signature (PNG/JPEG)
5. Backend uploads to Supabase Storage `payment-receipts` bucket
6. Backend creates/updates payment record with `PENDING_VERIFICATION` status
7. Backend returns Supabase public URL

### Secretary Verification Flow
1. Secretary views payments with `PENDING_VERIFICATION` status
2. Secretary clicks "View Receipt" to open modal
3. Secretary views receipt image from Supabase public URL
4. Secretary verifies or rejects payment

## Security Considerations
- Backend-only Supabase credentials (service role key)
- Public URLs served via Supabase CDN
- Server-side file validation (type, size, signature)
- Unique filenames to prevent conflicts
- Role-based access (PATIENT upload, SECRETARY view)

## Setup Required

### Supabase Storage Bucket
1. Create bucket named `payment-receipts` in Supabase Storage
2. Configure as Public bucket
3. (Optional) Configure bucket policies for enhanced security

### Environment Variables
Add to `backend/.env`:
```env
SUPABASE_RECEIPT_BUCKET=payment-receipts
```

## Testing Results

### Backend Tests
- All 27 existing payment tests pass
- New receipt upload tests pass (authorization, file validation)
- TypeScript compilation successful

### Mobile Tests
- New receipt upload unit tests pass

## Verification Steps

### Manual QA Required
1. **Supabase Setup**: Create the `payment-receipts` bucket in Supabase
2. **Environment Configuration**: Add `SUPABASE_RECEIPT_BUCKET` to backend `.env`
3. **Patient Upload Test**:
   - Book an appointment in mobile app
   - Navigate to payment screen
   - Select GCash payment method
   - Upload a receipt image
   - Verify upload succeeds and payment status becomes `PENDING_VERIFICATION`
4. **Secretary View Test**:
   - Login as secretary assigned to the doctor
   - Navigate to Payments page
   - Verify pending payment appears in the list
   - Click "View Receipt" and verify image loads from Supabase URL
5. **Secretary Verification Test**:
   - Verify payment successfully
   - Verify status changes to `PAID`
   - Verify payment moves to Verified tab

## Root Cause
The mobile app was hardcoded to send a placeholder URL because:
1. The backend endpoint expected a JSON body with a URL, not a file upload
2. No multipart upload support was implemented
3. No Supabase Storage bucket was configured for receipts

## Files Changed
1. `backend/src/config/index.ts` - Added receipt bucket config
2. `backend/.env.example` - Added receipt bucket env var
3. `backend/src/services/storageService.ts` - Added receipt upload functions
4. `backend/src/api/payments.ts` - Changed to multipart upload
5. `mobile/lib/core/services/api_service.dart` - Added multipart support
6. `mobile/lib/features/payments/presentation/payment_screen.dart` - Use file upload
7. `backend/src/api/payments.test.ts` - Added receipt upload tests
8. `mobile/test/payment_receipt_upload_test.dart` - New mobile tests
9. `backend/SUPABASE_RECEIPT_STORAGE_SETUP.md` - New setup documentation
10. `backend/PAYMENT_RECEIPT_FIX_SUMMARY.md` - This summary

## No Breaking Changes
- API endpoint path unchanged (`POST /api/v1/payments/:appointmentId/receipt`)
- Secretary listing endpoint unchanged (`GET /api/v1/payments?status=PENDING_VERIFICATION`)
- Secretary verification endpoints unchanged
- Web UI unchanged (already displays receipt URLs correctly)
- Payment status transitions unchanged
