# Supabase Storage Setup for Doctor Professional Photos

## Overview

The doctor professional photo feature has been updated to use Supabase Storage instead of the local `./uploads` folder. This provides better scalability, CDN support, and eliminates the need for local file management.

## Changes Made

### 1. New Storage Service
**File:** `backend/src/services/storageService.ts`

Created a new service to handle all Supabase Storage operations:
- `uploadDoctorPhoto()` - Upload photos to Supabase Storage
- `deleteDoctorPhoto()` - Delete photos from Supabase Storage (or legacy local files)
- `replaceDoctorPhoto()` - Replace photos (delete old, upload new)
- `validateImageFile()` - Validate PNG files with signature checking

### 2. Updated Backend Configuration
**File:** `backend/src/config/index.ts`

Added Supabase Storage bucket configuration:
```typescript
supabase: {
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  functionSecret: process.env.FUNCTION_SECRET || '',
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'doctor-photos',
}
```

### 3. Updated Photo Upload Endpoint
**File:** `backend/src/api/doctors.ts`

Updated `POST /api/v1/doctors/me/photo`:
- Changed from disk storage to memory storage ( multer.memoryStorage() )
- Uploads to Supabase Storage instead of local filesystem
- Handles replacement of existing photos automatically
- Validates PNG signature to prevent renamed non-PNG files
- Returns Supabase public URL instead of local path

### 4. Updated Photo Deletion Endpoint
**File:** `backend/src/api/doctors.ts`

Updated `DELETE /api/v1/doctors/me/photo`:
- Deletes from Supabase Storage for new photos
- Handles legacy local files (supports existing `/uploads/` URLs)
- Gracefully handles missing files

### 5. Updated Environment Configuration
**File:** `backend/.env.example`

Added Supabase Storage bucket configuration:
```env
SUPABASE_STORAGE_BUCKET=doctor-photos
```

### 6. Removed Dependencies
- Removed `fs` and `path` from doctor photo endpoint imports (kept in storageService for legacy support)
- Simplified multer configuration to use memory storage

## Setup Instructions

### Step 1: Configure Environment Variables

Add or update the following in your `backend/.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=doctor-photos
```

### Step 2: Create Supabase Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** > **Buckets**
3. Click **New Bucket**
4. Enter bucket name: `doctor-photos`
5. Configure as **Public** bucket (required for public photo display)
6. Click **Create Bucket**

### Step 3: Configure Bucket Policies (Optional but Recommended)

For enhanced security, you can configure bucket policies in Supabase:

1. Go to **Storage** > **Policies**
2. Add a policy for the `doctor-photos` bucket:
   - **Operation:** SELECT
   - **Target:** Public
   - **Allowed:** Everyone (for public access)
   - **Operation:** INSERT
   - **Target:** Authenticated
   - **Allowed:** Service role only (backend-only uploads)
   - **Operation:** DELETE
   - **Target:** Authenticated
   - **Allowed:** Service role only (backend-only deletions)

### Step 4: Test the Implementation

The backend has been successfully built and tested. To test the photo upload functionality:

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Test upload via API:
   ```bash
   curl -X POST http://localhost:3000/api/v1/doctors/me/photo \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "photo=@/path/to/your/photo.png"
   ```

3. Test display via API:
   ```bash
   curl -X GET http://localhost:3000/api/v1/doctors/me \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

4. Test deletion via API:
   ```bash
   curl -X DELETE http://localhost:3000/api/v1/doctors/me/photo \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## Validation Rules

The system enforces the following validation rules:

1. **File Type:** Only PNG files are allowed (per architecture requirements)
2. **File Size:** Maximum 4MB
3. **PNG Signature:** Validates actual PNG magic number to prevent renamed files
4. **MIME Type:** Server-side validation of `image/png`

## Backward Compatibility

The implementation maintains backward compatibility:

- Legacy `/uploads/` URLs are still served via the existing static file route
- The `deleteDoctorPhoto()` function handles both Supabase URLs and legacy local paths
- Existing photos in the local `./uploads` folder continue to work
- New uploads go to Supabase Storage

## Security Considerations

1. **Backend-Only Credentials:** Supabase service role key is never exposed to frontend
2. **Public URLs:** Photos are served via Supabase public URLs (CDN-backed)
3. **File Validation:** Server-side validation prevents malicious file uploads
4. **Unique Filenames:** Photos are stored with unique names to prevent conflicts
5. **Orphan Prevention:** Old photos are deleted when replacing

## Error Handling

The system handles the following error scenarios:

- Missing Supabase configuration: Returns clear error message
- Missing storage bucket: Returns clear error message
- Invalid file type: Returns validation error
- File too large: Returns validation error
- Invalid PNG signature: Returns validation error
- Upload failure: Deletes uploaded file, returns error
- Deletion failure: Logs error, continues with database update

## Testing

Validation tests have been run successfully:
- ✓ Valid PNG file passed validation
- ✓ Invalid PNG signature was rejected
- ✓ Non-PNG MIME type was rejected
- ✓ Large file (>4MB) was rejected
- ✓ File too small was rejected

For full integration testing, use the API endpoints with actual Supabase credentials configured.

## Web Application Impact

The web application (Next.js) does not require changes:

- The API endpoints remain the same
- Photo URLs are now Supabase public URLs instead of local paths
- The frontend continues to display photos using the returned URLs
- Both `/doctor-profile` and `/admin/doctors` pages will work without modification

## Mobile Application Impact

The mobile application (Flutter) does not require changes:

- The API endpoints remain the same
- Photo URLs are now Supabase public URLs instead of local paths
- The mobile app continues to display photos using the returned URLs
- No changes to `doctor_service.dart` or `api_constants.dart` needed
