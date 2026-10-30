import { Router, Response } from 'express';
import { AuthRequest, authorize } from '../middleware/auth';
import { success, error, ErrorCodes } from '../utils/response';
import { getPatientDoctorProfile } from '../modules/doctors/doctorProfileService';

const router = Router();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Patient-only public doctor profile. Authentication is applied by the mount
// in index.ts; authorize('PATIENT') rejects secretaries, doctors, and admins.
router.get(
  '/doctors/:id/profile',
  authorize('PATIENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Doctor ids are UUIDs. An unknown or malformed id is the same generic
      // not-found result as an inactive/unapproved doctor.
      if (!UUID_PATTERN.test(id)) {
        return res
          .status(404)
          .json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
      }

      const profile = await getPatientDoctorProfile(id);

      if (!profile) {
        return res
          .status(404)
          .json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
      }

      res.json(success(profile));
    } catch (err: any) {
      // Never include database or status details in the response.
      console.error('Failed to load patient doctor profile:', err);
      res
        .status(500)
        .json(error(ErrorCodes.SERVER_ERROR, 'Failed to load doctor profile'));
    }
  }
);

export default router;
