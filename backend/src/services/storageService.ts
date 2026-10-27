import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErrorCodes } from '../utils/response';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Supabase Storage Service for Doctor Professional Photos and GCash QR Codes
 *
 * This service handles all storage operations for doctor professional photos and GCash QR codes using
 * Supabase Storage instead of local file system. All credentials remain backend-only.
 *
 * Configuration required in .env:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_STORAGE_BUCKET (bucket name for doctor photos)
 * - SUPABASE_GCASH_BUCKET (bucket name for GCash QR codes, defaults to 'gcash-qr-codes')
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
const GCASH_STORAGE_BUCKET = config.supabase.gcashStorageBucket || 'gcash-qr-codes';
const RECEIPT_STORAGE_BUCKET = config.supabase.receiptStorageBucket || 'payment-receipts';
const PRESCRIPTION_STORAGE_BUCKET = config.supabase.prescriptionStorageBucket || 'prescription-pdfs';

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

/**
 * Upload a GCash QR code to Supabase Storage
 *
 * @param fileBuffer - Buffer containing the file data
 * @param fileName - Unique filename for the upload
 * @param mimeType - MIME type of the file (e.g., 'image/png', 'image/jpeg')
 * @returns Object with success status, public URL, or error
 */
export async function uploadGcashQr(
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

    console.log(`Uploading GCash QR code to Supabase Storage: ${fileName}`);

    // Resize image to 200x200 with aspect ratio preserved (fit: contain)
    // This ensures QR codes remain scannable without distortion or cropping
    const resizedBuffer = await sharp(fileBuffer)
      .resize(200, 200, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
      })
      .toBuffer();

    // Upload file to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(GCASH_STORAGE_BUCKET)
      .upload(fileName, resizedBuffer, {
        contentType: mimeType,
        upsert: true, // Allow overwriting for QR code replacement
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload QR code to storage'
      };
    }

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(GCASH_STORAGE_BUCKET)
      .getPublicUrl(fileName);

    console.log(`GCash QR code uploaded successfully: ${publicUrl}`);
    return {
      success: true,
      url: publicUrl
    };
  } catch (err: any) {
    console.error('Error uploading GCash QR code:', err);
    return {
      success: false,
      error: err.message || 'QR code upload failed'
    };
  }
}

/**
 * Delete a GCash QR code from Supabase Storage
 *
 * @param qrUrl - Public URL of the QR code to delete
 * @returns Object with success status or error
 */
export async function deleteGcashQr(qrUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!supabaseAdmin) {
      return {
        success: false,
        error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.'
      };
    }

    // Extract filename from URL
    // Expected URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<filename>
    const urlParts = qrUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    if (!fileName) {
      return {
        success: false,
        error: 'Invalid QR code URL format'
      };
    }

    console.log(`Deleting GCash QR code from Supabase Storage: ${fileName}`);

    // Delete file from Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from(GCASH_STORAGE_BUCKET)
      .remove([fileName]);

    if (error) {
      console.error('Supabase Storage delete error:', error);
      // Don't fail if file doesn't exist - it may have already been deleted
      if (error.message?.includes('not found') || error.message?.includes('No such file')) {
        console.log('QR code file not found in storage (may have been already deleted)');
        return { success: true };
      }
      return {
        success: false,
        error: error.message || 'Failed to delete QR code from storage'
      };
    }

    console.log(`GCash QR code deleted successfully: ${fileName}`);
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting GCash QR code:', err);
    return {
      success: false,
      error: err.message || 'QR code deletion failed'
    };
  }
}

/**
 * Validate GCash QR code file type and size
 *
 * @param fileBuffer - Buffer containing the file data
 * @param mimeType - Declared MIME type of the file
 * @returns Object with validity status and error if invalid
 */
export function validateGcashQrFile(
  fileBuffer: Buffer,
  mimeType: string
): { valid: boolean; error?: string } {
  // Check MIME type - accept PNG and JPEG for QR codes
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: 'Only PNG and JPEG files are allowed for QR codes'
    };
  }

  // Check file size (5MB max for QR codes)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (fileBuffer.length > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit'
    };
  }

  // For PNG files, check PNG signature to prevent renamed non-PNG files
  if (mimeType === 'image/png' && fileBuffer.length >= 8) {
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) {
      if (fileBuffer[i] !== pngSignature[i]) {
        return {
          valid: false,
          error: 'Invalid PNG file signature'
        };
      }
    }
  }

  // For JPEG files, check JPEG signature
  if ((mimeType === 'image/jpeg' || mimeType === 'image/jpg') && fileBuffer.length >= 2) {
    const jpegSignature = [0xFF, 0xD8];
    if (fileBuffer[0] !== jpegSignature[0] || fileBuffer[1] !== jpegSignature[1]) {
      return {
        valid: false,
        error: 'Invalid JPEG file signature'
      };
    }
  }

  return { valid: true };
}

/**
 * Upload a payment receipt to Supabase Storage
 *
 * @param fileBuffer - Buffer containing the file data
 * @param fileName - Unique filename for the upload
 * @param mimeType - MIME type of the file (e.g., 'image/png', 'image/jpeg')
 * @returns Object with success status, file path (for storage in database), or error
 */
export async function uploadPaymentReceipt(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    if (!supabaseAdmin) {
      return {
        success: false,
        error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.'
      };
    }

    console.log(`Uploading payment receipt to Supabase Storage`);
    console.log(`Supabase URL: ${config.supabase.url}`);
    console.log(`Bucket: ${RECEIPT_STORAGE_BUCKET}`);
    console.log(`File: ${fileName}`);

    // Upload file to Supabase Storage (no folder prefix)
    const { data, error } = await supabaseAdmin.storage
      .from(RECEIPT_STORAGE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: mimeType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload receipt to storage'
      };
    }

    console.log(`Payment receipt uploaded successfully: ${fileName}`);
    return {
      success: true,
      path: fileName // Return the file path for storage in database
    };
  } catch (err: any) {
    console.error('Error uploading payment receipt:', err);
    return {
      success: false,
      error: err.message || 'Receipt upload failed'
    };
  }
}

/**
 * Validate payment receipt file type and size
 *
 * @param fileBuffer - Buffer containing the file data
 * @param mimeType - Declared MIME type of the file
 * @returns Object with validity status and error if invalid
 */
export function validatePaymentReceiptFile(
  fileBuffer: Buffer,
  mimeType: string
): { valid: boolean; error?: string } {
  // Check MIME type - accept PNG and JPEG for receipts
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: 'Only PNG and JPEG files are allowed for receipts'
    };
  }

  // Check file size (5MB max for receipts)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (fileBuffer.length > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit'
    };
  }

  // For PNG files, check PNG signature to prevent renamed non-PNG files
  if (mimeType === 'image/png' && fileBuffer.length >= 8) {
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) {
      if (fileBuffer[i] !== pngSignature[i]) {
        return {
          valid: false,
          error: 'Invalid PNG file signature'
        };
      }
    }
  }

  // For JPEG files, check JPEG signature
  if ((mimeType === 'image/jpeg' || mimeType === 'image/jpg') && fileBuffer.length >= 2) {
    const jpegSignature = [0xFF, 0xD8];
    if (fileBuffer[0] !== jpegSignature[0] || fileBuffer[1] !== jpegSignature[1]) {
      return {
        valid: false,
        error: 'Invalid JPEG file signature'
      };
    }
  }

  return { valid: true };
}

/**
 * Generate a signed URL for a payment receipt
 *
 * @param filePath - Path of the file in Supabase Storage (filename, not full URL)
 * @param expiresIn - Expiration time in seconds (default: 60 seconds)
 * @returns Object with success status, signed URL, or error
 */
export async function generateSignedReceiptUrl(
  filePath: string,
  expiresIn: number = 60
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    if (!supabaseAdmin) {
      return {
        success: false,
        error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.'
      };
    }

    // Detect legacy HTTP(S) URLs - these are not supported and cannot be converted to signed URLs
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      console.error(`Legacy HTTP(S) URL detected in receipt_url: ${filePath}. Legacy receipts are not supported.`);
      return {
        success: false,
        error: 'Legacy receipt format not supported. Please re-upload the receipt.'
      };
    }

    console.log(`Generating signed URL for receipt: ${filePath}`);

    // Generate signed URL with expiration
    const { data, error } = await supabaseAdmin.storage
      .from(RECEIPT_STORAGE_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Supabase Storage signed URL error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate signed URL'
      };
    }

    console.log(`Signed URL generated successfully for: ${filePath}`);
    return {
      success: true,
      signedUrl: data.signedUrl
    };
  } catch (err: any) {
    console.error('Error generating signed URL:', err);
    return {
      success: false,
      error: err.message || 'Signed URL generation failed'
    };
  }
}

/**
 * Upload a prescription PDF to Supabase Storage
 *
 * @param fileBuffer - Buffer containing the PDF data
 * @param fileName - Unique filename for the upload
 * @returns Object with success status, file path (for storage in database), or error
 */
export async function uploadPrescriptionPdf(
  fileBuffer: Buffer,
  fileName: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    if (!supabaseAdmin) {
      return {
        success: false,
        error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.'
      };
    }

    console.log(`Uploading prescription PDF to Supabase Storage: ${fileName}`);

    // Upload file to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(PRESCRIPTION_STORAGE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true, // Allow overwriting for PDF regeneration
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload PDF to storage'
      };
    }

    console.log(`Prescription PDF uploaded successfully: ${fileName}`);
    return {
      success: true,
      path: fileName // Return the file path for storage in database
    };
  } catch (err: any) {
    console.error('Error uploading prescription PDF:', err);
    return {
      success: false,
      error: err.message || 'PDF upload failed'
    };
  }
}

/**
 * Generate a signed URL for a prescription PDF
 *
 * @param filePath - Path of the file in Supabase Storage (filename, not full URL)
 * @param expiresIn - Expiration time in seconds (default: 60 seconds)
 * @returns Object with success status, signed URL, or error
 */
export async function generateSignedPrescriptionUrl(
  filePath: string,
  expiresIn: number = 60
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    if (!supabaseAdmin) {
      return {
        success: false,
        error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.'
      };
    }

    // Detect legacy HTTP(S) URLs - these are not supported and cannot be converted to signed URLs
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      console.error(`Legacy HTTP(S) URL detected in pdf_url: ${filePath}. Legacy PDFs are not supported.`);
      return {
        success: false,
        error: 'Legacy PDF format not supported. Please regenerate the PDF.'
      };
    }

    console.log(`Generating signed URL for prescription PDF: ${filePath}`);

    // Generate signed URL with expiration
    const { data, error } = await supabaseAdmin.storage
      .from(PRESCRIPTION_STORAGE_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Supabase Storage signed URL error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate signed URL'
      };
    }

    console.log(`Signed URL generated successfully for: ${filePath}`);
    return {
      success: true,
      signedUrl: data.signedUrl
    };
  } catch (err: any) {
    console.error('Error generating signed URL:', err);
    return {
      success: false,
      error: err.message || 'Signed URL generation failed'
    };
  }
}
