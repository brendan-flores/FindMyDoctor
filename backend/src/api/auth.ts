import { Router, Request, Response } from 'express';
import { register, login, changePassword } from '../modules/auth/authService';
import { success, error, ErrorCodes } from '../utils/response';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, role, firstName, lastName } = req.body;

    // Basic validation
    if (!email || !password || !role) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Email, password, and role are required')
      );
    }

    if (!['PATIENT', 'DOCTOR', 'SECRETARY', 'ADMIN'].includes(role)) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid role')
      );
    }

    if (role === 'PATIENT' && (!firstName || !lastName)) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'First name and last name are required for patients')
      );
    }

    const result = await register({ email, password, role, firstName, lastName });

    res.status(201).json(
      success(result, 'Registration successful')
    );
  } catch (err: any) {
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Registration failed';
    
    if (errorCode === ErrorCodes.EMAIL_ALREADY_EXISTS) {
      return res.status(409).json(error(errorCode, errorMessage));
    }
    
    res.status(500).json(error(errorCode, errorMessage));
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Email and password are required')
      );
    }

    const result = await login({ email, password });

    res.json(
      success(result, 'Login successful')
    );
  } catch (err: any) {
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Login failed';
    
    if (errorCode === ErrorCodes.INVALID_CREDENTIALS) {
      return res.status(401).json(error(errorCode, errorMessage));
    }
    
    res.status(500).json(error(errorCode, errorMessage));
  }
});

// Refresh token
router.post('/refresh', (req: Request, res: Response) => {
  // For MVP, we'll just require re-login
  // In production, implement proper refresh token validation
  res.status(501).json(
    error(ErrorCodes.SERVER_ERROR, 'Token refresh not implemented')
  );
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  // For MVP, logout is client-side (remove token)
  // In production, implement token blacklisting
  res.json(
    success(null, 'Logout successful')
  );
});

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'Current password and new password are required')
      );
    }

    if (newPassword.length < 8) {
      return res.status(400).json(
        error(ErrorCodes.VALIDATION_ERROR, 'New password must be at least 8 characters')
      );
    }

    await changePassword(userId, currentPassword, newPassword);

    res.json(
      success(null, 'Password changed successfully')
    );
  } catch (err: any) {
    const errorCode = err.code || ErrorCodes.SERVER_ERROR;
    const errorMessage = err.message || 'Password change failed';
    
    if (errorCode === ErrorCodes.INVALID_CREDENTIALS) {
      return res.status(401).json(error(errorCode, errorMessage));
    }
    
    if (errorCode === ErrorCodes.NOT_FOUND) {
      return res.status(404).json(error(errorCode, errorMessage));
    }
    
    res.status(500).json(error(errorCode, errorMessage));
  }
});

export default router;