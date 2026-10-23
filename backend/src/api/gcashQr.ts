import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requireSecretaryPasswordChange, requireSecretaryProfileCompletion } from '../middleware/auth';
import multer from 'multer';
import { uploadGcashQr, deleteGcashQr, validateGcashQrFile } from '../services/storageService';

const router = Router();

// Configure multer for QR code upload (memory storage for Supabase)
const storage = multer.memoryStorage();

// File filter - accept PNG and JPEG for QR codes
// Note: Images will be converted to PNG during upload for consistency
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG and JPEG files are allowed for QR codes'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

// Get GCash QR code for a doctor (secretary only)
router.get('/doctor/:doctorId', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId } = req.params;
    const secretaryId = req.user!.id;

    // Verify secretary is assigned to this doctor
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [secretaryId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Secretary profile not found'));
    }

    const secretaryDoctorId = secretaryResult.rows[0].doctor_id;

    if (secretaryDoctorId !== doctorId) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only manage QR codes for your assigned doctor'));
    }

    // Get the doctor's GCash QR URL and its last-updated timestamp
    const doctorResult = await query(
      'SELECT gcash_qr_url, gcash_qr_updated_at FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    const gcashQrUrl = doctorResult.rows[0].gcash_qr_url;
    const gcashQrUpdatedAt = doctorResult.rows[0].gcash_qr_updated_at;

    res.json(success({ gcashQrUrl, gcashQrUpdatedAt }, 'GCash QR code retrieved'));
  } catch (err: any) {
    console.error('Error fetching GCash QR code:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch GCash QR code'));
  }
});

// Upload GCash QR code for a doctor (secretary only)
router.post('/doctor/:doctorId/upload', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), upload.single('qrCode'), async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId } = req.params;
    const secretaryId = req.user!.id;

    if (!req.file) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'QR code file is required'));
    }

    // Verify secretary is assigned to this doctor
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [secretaryId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Secretary profile not found'));
    }

    const secretaryDoctorId = secretaryResult.rows[0].doctor_id;

    if (secretaryDoctorId !== doctorId) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only manage QR codes for your assigned doctor'));
    }

    // Validate file
    const validation = validateGcashQrFile(req.file.buffer, req.file.mimetype);
    if (!validation.valid) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, validation.error));
    }

    // Get current QR URL if exists
    const doctorResult = await query(
      'SELECT gcash_qr_url FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    const currentQrUrl = doctorResult.rows[0].gcash_qr_url;

    // Generate unique filename: gcash_qr_<doctor_id>_<timestamp>.png
    // Always use PNG since sharp converts to PNG for quality and compatibility
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `gcash_qr_${doctorId}_${uniqueSuffix}.png`;

    // Upload to Supabase Storage
    const uploadResult = await uploadGcashQr(req.file.buffer, fileName, 'image/png');

    if (!uploadResult.success) {
      return res.status(500).json(error(ErrorCodes.SERVER_ERROR, uploadResult.error || 'Failed to upload QR code'));
    }

    // Delete old QR code if exists
    if (currentQrUrl) {
      await deleteGcashQr(currentQrUrl);
    }

    // Update database with new QR URL and its upload timestamp
    const result = await query(
      `UPDATE doctors
       SET gcash_qr_url = $1, gcash_qr_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING gcash_qr_url, gcash_qr_updated_at`,
      [uploadResult.url, doctorId]
    );

    res.json(success({
      gcashQrUrl: result.rows[0].gcash_qr_url,
      gcashQrUpdatedAt: result.rows[0].gcash_qr_updated_at
    }, 'GCash QR code uploaded successfully'));
  } catch (err: any) {
    console.error('Error uploading GCash QR code:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to upload GCash QR code'));
  }
});

// Delete GCash QR code for a doctor (secretary only)
router.delete('/doctor/:doctorId', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId } = req.params;
    const secretaryId = req.user!.id;

    // Verify secretary is assigned to this doctor
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [secretaryId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Secretary profile not found'));
    }

    const secretaryDoctorId = secretaryResult.rows[0].doctor_id;

    if (secretaryDoctorId !== doctorId) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only manage QR codes for your assigned doctor'));
    }

    // Get current QR URL
    const doctorResult = await query(
      'SELECT gcash_qr_url FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    const currentQrUrl = doctorResult.rows[0].gcash_qr_url;

    if (!currentQrUrl) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'No GCash QR code found for this doctor'));
    }

    // Delete from Supabase Storage
    const deleteResult = await deleteGcashQr(currentQrUrl);

    if (!deleteResult.success) {
      return res.status(500).json(error(ErrorCodes.SERVER_ERROR, deleteResult.error || 'Failed to delete QR code'));
    }

    // Clear database field and the QR upload timestamp
    await query(
      'UPDATE doctors SET gcash_qr_url = NULL, gcash_qr_updated_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [doctorId]
    );

    res.json(success(null, 'GCash QR code deleted successfully'));
  } catch (err: any) {
    console.error('Error deleting GCash QR code:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete GCash QR code'));
  }
});

export default router;
