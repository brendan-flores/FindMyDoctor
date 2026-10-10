import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErrorCodes } from '../utils/response';
import fs from 'fs';
import path from 'path';

/**
 * Supabase Storage Service for Doctor Professional Photos
 *
 * This service handles all storage operations for doctor professional photos using
 * Supabase Storage instead of local file system. All credentials remain backend-only.
 *
 * Configuration required in .env:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_STORAGE_BUCKET (bucket name for doctor photos)
 */

const supabaseAdmin = config.supabase.url && config.supabase.serviceRoleKey
  ? createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null;

const STORAGE_BUCKET = config.supabase.storageBucket || 'doctor-photos';

/**
 * Upload a doctor professional photo to Supabase Storage
 *
 * @param fileBuffer - Buffer containing the file data
 * @param fileName - Unique filename for the upload
 * @param mimeType - MIME type of the file (e.g., 'image/png')
 * @returns Object with success status, public URL, or error
 */
export async function uploadDoctorPhoto(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!supabaseAdmin) {
      return {
        success: false,
        error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.'
      };
    }

    if (!config.supabase.storageBucket) {
      return {
        success: false,
        error: 'Supabase Storage bucket not configured. Add SUPABASE_STORAGE_BUCKET to backend/.env.'
      };
    }

    console.log(`Uploading doctor photo to Supabase Storage: ${fileName}`);

    // Upload file to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: mimeType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload photo to storage'
      };
    }

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    console.log(`Doctor photo uploaded successfully: ${publicUrl}`);
    return {
      success: true,
      url: publicUrl
    };
  } catch (err: any) {
    console.error('Error uploading doctor photo:', err);
    return {
      success: false,
      error: err.message || 'Photo upload failed'
    };
  }
}

/**
 * Delete a doctor professional photo from Supabase Storage or local filesystem
 *
 * @param photoUrl - Public URL of the photo to delete
 * @returns Object with success status or error
 */
export async function deleteDoctorPhoto(photoUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if it's a legacy local file (/uploads/...)
    if (photoUrl.startsWith('/uploads/')) {
      const filename = photoUrl.split('/').pop();
      if (filename) {
        const filePath = path.join(config.upload.dir, filename);
        const resolvedUploadDir = path.resolve(config.upload.dir);
        const resolvedFilePath = path.resolve(filePath);

        if (resolvedFilePath.startsWith(resolvedUploadDir) && fs.existsSync(resolvedFilePath)) {
          fs.unlinkSync(resolvedFilePath);
          console.log(`Legacy local photo deleted: ${filename}`);
        }
      }
      return { success: true };
    }

    // Otherwise, it's a Supabase Storage URL
    if (!supabaseAdmin) {
      return {
        success: false,
        error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.'
      };
    }

    if (!config.supabase.storageBucket) {
      return {
        success: false,
        error: 'Supabase Storage bucket not configured. Add SUPABASE_STORAGE_BUCKET to backend/.env.'
      };
    }

    // Extract filename from URL
    // Expected URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<filename>
    const urlParts = photoUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    if (!fileName) {
      return {
        success: false,
        error: 'Invalid photo URL format'
      };
    }

    console.log(`Deleting doctor photo from Supabase Storage: ${fileName}`);

    // Delete file from Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([fileName]);

    if (error) {
      console.error('Supabase Storage delete error:', error);
      // Don't fail if file doesn't exist - it may have already been deleted
      if (error.message?.includes('not found') || error.message?.includes('No such file')) {
        console.log('Photo file not found in storage (may have been already deleted)');
        return { success: true };
      }
      return {
        success: false,
        error: error.message || 'Failed to delete photo from storage'
      };
    }

    console.log(`Doctor photo deleted successfully: ${fileName}`);
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting doctor photo:', err);
    return {
      success: false,
      error: err.message || 'Photo deletion failed'
    };
  }
}

/**
 * Replace a doctor professional photo (delete old, upload new)
 *
 * @param oldPhotoUrl - Public URL of the old photo to delete (can be legacy /uploads/ or Supabase URL)
 * @param newFileBuffer - Buffer containing the new file data
 * @param newFileName - Unique filename for the new upload
 * @param newMimeType - MIME type of the new file
 * @returns Object with success status, new public URL, or error
 */
export async function replaceDoctorPhoto(
  oldPhotoUrl: string | null,
  newFileBuffer: Buffer,
  newFileName: string,
  newMimeType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Delete old photo if it exists (handles both legacy /uploads/ and Supabase URLs)
    if (oldPhotoUrl) {
      const deleteResult = await deleteDoctorPhoto(oldPhotoUrl);
      if (!deleteResult.success) {
        console.error('Failed to delete old photo during replacement:', deleteResult.error);
        // Continue with upload even if delete fails
      }
    }

    // Upload new photo to Supabase Storage
    return await uploadDoctorPhoto(newFileBuffer, newFileName, newMimeType);
  } catch (err: any) {
    console.error('Error replacing doctor photo:', err);
    return {
      success: false,
      error: err.message || 'Photo replacement failed'
    };
  }
}

/**
 * Validate image file type and check PNG signature
 *
 * @param fileBuffer - Buffer containing the file data
 * @param mimeType - Declared MIME type of the file
 * @returns Object with validity status and error if invalid
 */
export function validateImageFile(
  fileBuffer: Buffer,
  mimeType: string
): { valid: boolean; error?: string } {
  // Check MIME type - only PNG allowed per architecture requirements
  if (mimeType !== 'image/png') {
    return {
      valid: false,
      error: 'Only PNG files are allowed'
    };
  }

  // Check file size (4MB max)
  const maxSize = 4 * 1024 * 1024; // 4MB
  if (fileBuffer.length > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 4MB limit'
    };
  }

  // Check PNG signature to prevent renamed non-PNG files
  if (fileBuffer.length >= 8) {
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) {
      if (fileBuffer[i] !== pngSignature[i]) {
        return {
          valid: false,
          error: 'Invalid PNG file signature'
        };
      }
    }
  } else {
    return {
      valid: false,
      error: 'File is too small to be a valid PNG'
    };
  }

  return { valid: true };
}
