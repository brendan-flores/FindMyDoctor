import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';

// Import routers
import authRouter from './api/auth';
import usersRouter from './api/users';
import doctorsRouter from './api/doctors';
import clinicsRouter from './api/clinics';
import appointmentsRouter from './api/appointments';
import queueRouter from './api/queue';
import walkInsRouter from './api/walk-ins';
import conversationsRouter from './api/conversations';
import aiChatRouter from './api/ai-chat';
import paymentsRouter from './api/payments';
import visitsRouter from './api/visits';
import prescriptionsRouter from './api/prescriptions';
import notificationsRouter from './api/notifications';
import adminRouter from './api/admin';

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
const apiVersion = config.app.apiVersion;
app.use(`/api/${apiVersion}/auth`, authRouter);
app.use(`/api/${apiVersion}/users`, authenticate, usersRouter);
app.use(`/api/${apiVersion}/doctors`, doctorsRouter);
app.use(`/api/${apiVersion}/clinics`, clinicsRouter);
app.use(`/api/${apiVersion}/appointments`, authenticate, appointmentsRouter);
app.use(`/api/${apiVersion}/queue`, authenticate, queueRouter);
app.use(`/api/${apiVersion}/walk-ins`, authenticate, walkInsRouter);
app.use(`/api/${apiVersion}/conversations`, authenticate, conversationsRouter);
app.use(`/api/${apiVersion}/ai`, authenticate, aiChatRouter);
app.use(`/api/${apiVersion}/payments`, authenticate, paymentsRouter);
app.use(`/api/${apiVersion}/visits`, authenticate, visitsRouter);
app.use(`/api/${apiVersion}/prescriptions`, authenticate, prescriptionsRouter);
app.use(`/api/${apiVersion}/notifications`, authenticate, notificationsRouter);
app.use(`/api/${apiVersion}/admin`, authenticate, adminRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.app.port;
app.listen(PORT, () => {
  console.log(`FindMyDoctor API server running on port ${PORT}`);
  console.log(`Environment: ${config.app.env}`);
  console.log(`API version: ${apiVersion}`);
});

export default app;