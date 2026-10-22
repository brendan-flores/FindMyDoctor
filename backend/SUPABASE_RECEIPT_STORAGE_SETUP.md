# Supabase Storage Setup for Payment Receipts

## Overview

The payment receipt feature uses Supabase Storage with a private bucket configuration for secure storage and access. Patients upload GCash receipt images for secretary verification using server-side generated signed URLs.

## Changes Made

### 1. New Storage Service Functions
**File:** `backend/src/services/storageService.ts`

Added functions to handle payment receipt storage operations:
- `uploadPaymentReceipt()` - Upload receipt images to Supabase Storage (returns file path)
- `validatePaymentReceiptFile()` - Validate PNG and JPEG files with signature checking
- `generateSignedReceiptUrl()` - Generate short-lived signed URLs for secure receipt viewing

### 2. Updated Backend Configuration
**File:** `backend/src/config/index.ts`

Added Supabase Storage bucket configuration for receipts:
```typescript
supabase: {
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  functionSecret: process.env.FUNCTION_SECRET || '',
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'doctor-photos',
  gcashStorageBucket: process.env.SUPABASE_GCASH_BUCKET || 'gcash-qr-codes',
  receiptStorageBucket: process.env.SUPABASE_RECEIPT_BUCKET || 'payment-receipts',
}
```

### 3. Updated Receipt Upload Endpoint
**File:** `backend/src/api/payments.ts`

Updated `POST /api/v1/payments/:appointmentId/receipt`:
- Changed from JSON body with URL to multipart file upload ( multer.memoryStorage() )
- Uploads to Supabase Storage instead of using placeholder URLs
- Validates PNG and JPEG signatures to prevent renamed non-image files
- Returns file path (not public URL) for storage in database
- Creates or updates payment record with `PENDING_VERIFICATION` status
- Uses transaction to ensure atomic payment creation/update

### 4. New Signed URL Endpoint
**File:** `backend/src/api/payments.ts`

Added `GET /api/v1/payments/:id/receipt-url`:
- Secretary-only endpoint with assigned-doctor authorization check
- Generates short-lived signed URL (60-second expiration)
- Verifies payment belongs to secretary's assigned doctor before generating URL
- Returns signed URL for secure receipt preview

### 5. Updated Secretary API
**File:** `web/src/lib/api/secretaryApi.ts`

Added method to fetch signed receipt URL:
- `getSignedReceiptUrl(id)` - Fetch signed URL for payment ID

### 6. Updated Secretary Payments Page
**File:** `web/src/app/secretary/payments/page.tsx`

Updated receipt viewing logic:
- Fetches signed URL when "View Receipt" is clicked
- Displays receipt using short-lived signed URL
- Handles loading and error states for signed URL generation

### 7. Updated Mobile API Service
**File:** `mobile/lib/core/services/api_service.dart`

Added multipart file upload support:
- New `postMultipart()` method for file uploads
- Updated `uploadPaymentReceipt()` to accept File instead of URL

### 8. Updated Mobile Payment Screen
**File:** `mobile/lib/features/payments/presentation/payment_screen.dart`

Updated receipt upload logic:
- Removed placeholder URL
- Now uploads actual image file via multipart request
- Clears selected image after successful upload

### 9. Updated Environment Configuration
**File:** `backend/.env.example`

Added Supabase Storage bucket configuration for receipts:
```env
SUPABASE_RECEIPT_BUCKET=payment-receipts
```

## Setup Instructions

### Step 1: Configure Environment Variables

Add or update the following in your `backend/.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=doctor-photos
SUPABASE_GCASH_BUCKET=gcash-qr-codes
SUPABASE_RECEIPT_BUCKET=payment-receipts
```

### Step 2: Create Supabase Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** > **Buckets**
3. Click **New Bucket**
4. Enter bucket name: `payment-receipts`
5. Configure as **Private** bucket (not public - security requirement)
6. Click **Create Bucket**

### Step 3: Configure Bucket Policies

Configure bucket policies in Supabase for secure access:

1. Go to **Storage** > **Policies**
2. Add a policy for the `payment-receipts` bucket:
   - **Operation:** SELECT
   - **Target:** Service role only (backend generates signed URLs)
   - **Operation:** INSERT
   - **Target:** Service role only (backend-only uploads)
   - **Operation:** DELETE
   - **Target:** Service role only (backend-only deletions, if needed in future)

**Important:** Do not make the bucket public. All access must go through the backend signed URL endpoint with proper authorization checks.

### Step 4: Test the Implementation

The backend has been updated to support multipart file uploads and signed URL generation. To test the receipt upload functionality:

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Test upload via API (with a patient JWT token):
   ```bash
   curl -X POST http://localhost:3000/api/v1/payments/<appointment_id>/receipt \
     -H "Authorization: Bearer YOUR_PATIENT_JWT_TOKEN" \
     -F "receipt=@/path/to/your/receipt.jpg"
   ```

3. Test signed URL generation via API (with a secretary JWT token):
   ```bash
   curl -X GET http://localhost:3000/api/v1/payments/<payment_id>/receipt-url \
     -H "Authorization: Bearer YOUR_SECRETARY_JWT_TOKEN"
   ```

4. Test payment list via API (with a secretary JWT token):
   ```bash
   curl -X GET http://localhost:3000/api/v1/payments?status=PENDING_VERIFICATION \
     -H "Authorization: Bearer YOUR_SECRETARY_JWT_TOKEN"
   ```

## Validation Rules

The system enforces the following validation rules:

1. **File Type:** Only PNG and JPEG files are allowed
2. **File Size:** Maximum 5MB
3. **PNG Signature:** Validates actual PNG magic number to prevent renamed files
4. **JPEG Signature:** Validates actual JPEG magic number to prevent renamed files
5. **MIME Type:** Server-side validation of `image/png`, `image/jpeg`, or `image/jpg`

## Workflow

The payment receipt workflow works as follows:

1. **Patient uploads receipt:**
   - Patient selects receipt image from gallery
   - Mobile app validates file size (5MB max)
   - Mobile app uploads file via multipart POST to backend
   - Backend validates file type and signature
   - Backend uploads to Supabase Storage `payment-receipts` bucket (private)
   - Backend creates/updates payment record with `PENDING_VERIFICATION` status
   - Backend stores file path (not public URL) in `payments.receipt_url`
   - Backend returns success confirmation

2. **Secretary reviews payment:**
   - Secretary views payments with `PENDING_VERIFICATION` status
   - Secretary clicks "View Receipt" to open modal
   - Web app calls `GET /api/v1/payments/:id/receipt-url`
   - Backend verifies secretary is assigned to the payment's doctor
   - Backend generates short-lived signed URL (60-second expiration)
   - Web app displays receipt using signed URL
   - Secretary verifies or rejects payment

## Security Considerations

1. **Private Bucket:** The `payment-receipts` bucket is private - no public access
2. **Backend-Only Credentials:** Supabase service role key is never exposed to frontend
3. **Signed URLs:** Short-lived signed URLs (60 seconds) generated server-side after authorization
4. **Role-Based Access:** Signed URL endpoint verifies secretary assignment to payment's doctor
5. **File Validation:** Server-side validation prevents malicious file uploads
6. **Unique Filenames:** Receipts are stored with unique names to prevent conflicts
7. **Atomic Upload:** Payment creation/update and file upload are transactional - if upload fails, payment is not created/updated

## Error Handling

The system handles the following error scenarios:

- Missing Supabase configuration: Returns clear error message
- Missing storage bucket: Returns clear error message
- Invalid file type: Returns validation error
- File too large: Returns validation error
- Invalid file signature: Returns validation error
- Upload failure: Returns error with details, rolls back payment transaction
- Appointment not found: Returns 404 error
- Unauthorized secretary access to receipt: Returns 403 error
- No receipt uploaded: Returns 404 error on signed URL request
- Signed URL generation failure: Returns 500 error

## Testing

Validation has been added to the storage service and backend API:
- ✓ Valid PNG/JPEG file passes validation
- ✓ Invalid PNG signature is rejected
- ✓ Invalid JPEG signature is rejected
- ✓ Non-image MIME type is rejected
- ✓ Large file (>5MB) is rejected
- ✓ Signed URL endpoint enforces secretary authorization
- ✓ Signed URL endpoint verifies assigned-doctor scope
- ✓ Signed URL endpoint returns 404 for missing receipts
- ✓ Upload transaction rolls back on storage failure

For full integration testing, use the mobile app with actual Supabase credentials configured.

## Web Application Impact

The web application (Next.js) has been updated:

- Added `getSignedReceiptUrl()` method to secretary API
- Updated `/secretary/payments` page to fetch signed URL before displaying receipt
- Receipt modal now uses short-lived signed URL instead of stored public URL
- Added loading and error states for signed URL generation

## Mobile Application Impact

The mobile application (Flutter) has been updated:

- Added multipart file upload support to `ApiService`
- Updated `uploadPaymentReceipt()` to upload actual file instead of placeholder URL
- Updated payment screen to use file upload instead of URL
- File size validation remains on mobile client (5MB max)
- No changes needed for viewing receipts (secretary viewing is web-only)
