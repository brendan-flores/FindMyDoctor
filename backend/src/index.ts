import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';
import { apiLimiter, authLimiter } from './middleware/rateLimit';
import { pool } from './database/connection';
import path from 'path';

// Import routers
import authRouter from './api/auth.js';
import otpRouter from './api/otp.js';
import patientOtpRouter from './api/patientOtp.js';
import passwordResetRouter from './api/passwordReset.js';
import usersRouter from './api/users.js';
import patientsRouter from './api/patients.js';
import doctorsRouter from './api/doctors.js';
import secretariesRouter from './api/secretaries.js';
import appointmentsRouter from './api/appointments.js';
import queueRouter from './api/queue.js';
import walkInsRouter from './api/walk-ins.js';
import conversationsRouter from './api/conversations.js';
import aiChatRouter from './api/ai-chat.js';
import paymentsRouter, { publicPaymentsRouter } from './api/payments.js';
import visitsRouter from './api/visits.js';
import prescriptionsRouter from './api/prescriptions.js';
import notificationsRouter from './api/notifications.js';
import adminRouter from './api/admin.js';
import gcashQrRouter from './api/gcashQr.js';
import invoicesRouter from './api/invoices.js';
import patientDoctorsRouter from './api/patientDoctors.js';

const app = express();
const apiVersion = config.app.apiVersion;

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Rate limiting
// 1. General API budget for normal dashboard navigation.
// 2. Stricter budget for login/OTP/registration/password-change routes.
// Health checks and static files are mounted outside /api, so they are not
// counted against either budget.
app.use('/api/', apiLimiter);
app.use(`/api/${apiVersion}`, authLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// Serve static files from uploads directory (before API routes)
const uploadsDir = path.resolve(process.cwd(), config.upload.dir);
app.use('/uploads', cors(config.cors));
app.use('/uploads', express.static(uploadsDir));

// Serve static files from public directory (GCash QR, etc.)
const publicDir = path.resolve(process.cwd(), 'public');
app.use('/public', cors(config.cors));
app.use('/public', express.static(publicDir));

// Request logging
// Passwords and tokens are never logged (see ARCHITECTURE-ESSENTIALS.md section 41)
const SENSITIVE_FIELDS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'aiApiKey',
  'AI_API_KEY',
]);

function redactSensitiveValues(payload: Record<string, any>): Record<string, any> {
  const redacted: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    redacted[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
  }

  return redacted;
}

app.use((req, _res, next) => {
  console.log(`🟢 ${req.method} ${req.path}`);
  console.log(`🟢 Headers: ${JSON.stringify(redactSensitiveValues(req.headers))}`);
  console.log(`🟢 Body: ${JSON.stringify(redactSensitiveValues(req.body || {}))}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use(`/api/${apiVersion}/auth`, authRouter);
app.use(`/api/${apiVersion}/auth/otp`, otpRouter);
app.use(`/api/${apiVersion}/auth/patient/otp`, patientOtpRouter);
app.use(`/api/${apiVersion}/auth/password-reset`, passwordResetRouter);
app.use(`/api/${apiVersion}/users`, authenticate, usersRouter);
app.use(`/api/${apiVersion}/patients`, authenticate, patientsRouter);
app.use(`/api/${apiVersion}/patient`, authenticate, patientDoctorsRouter);
app.use(`/api/${apiVersion}/doctors`, doctorsRouter);
app.use(`/api/${apiVersion}/secretaries`, authenticate, secretariesRouter);
app.use(`/api/${apiVersion}/appointments`, authenticate, appointmentsRouter);
app.use(`/api/${apiVersion}/queue`, authenticate, queueRouter);
app.use(`/api/${apiVersion}/walk-ins`, authenticate, walkInsRouter);
app.use(`/api/${apiVersion}/conversations`, authenticate, conversationsRouter);
app.use(`/api/${apiVersion}/ai`, authenticate, aiChatRouter);
// Public payment routes (GCash QR - no authentication)
app.use(`/api/${apiVersion}/payments`, publicPaymentsRouter);
// Authenticated payment routes
app.use(`/api/${apiVersion}/payments`, authenticate, paymentsRouter);
app.use(`/api/${apiVersion}/visits`, authenticate, visitsRouter);
app.use(`/api/${apiVersion}/prescriptions`, authenticate, prescriptionsRouter);
app.use(`/api/${apiVersion}/notifications`, authenticate, notificationsRouter);
app.use(`/api/${apiVersion}/gcash-qr`, authenticate, gcashQrRouter);
app.use(`/api/${apiVersion}/invoices`, authenticate, invoicesRouter);
app.use(`/api/${apiVersion}/admin`, authenticate, adminRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.app.port;

// Test database connection before starting server
async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Connected to PostgreSQL database');
    return true;
  } catch (error) {
    console.error('Failed to connect to PostgreSQL database:', error);
    console.error('Please check your database configuration in .env file');
    return false;
  }
}

// Start server only after database connection test
testDatabaseConnection().then((connected) => {
  if (connected) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`FindMyDoctor API server running on port ${PORT}`);
      console.log(`Environment: ${config.app.env}`);
      console.log(`API version: ${apiVersion}`);
      console.log(`Accepting connections from all network interfaces`);
    });
  } else {
    console.error('Server not started due to database connection failure');
    process.exit(1);
  }
});

export default app;