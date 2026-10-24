import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'findmydoctor',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  },

  // Application
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000'),
    apiVersion: process.env.API_VERSION || 'v1',
    timezone: process.env.TIMEZONE || 'Asia/Manila',
  },

  // AI
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    apiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
  },

  // File Upload
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '4194304'), // 4MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/png').split(','),
  },

  // Rate Limiting
  //
  // The general limit is sized for normal dashboard navigation, including a
  // reasonable burst when a user clicks through several pages quickly:
  //   - With client-side request de-duplication/caching a page navigation
  //     costs roughly 1-3 API calls.
  //   - 300 requests per minute allows a burst of ~100 page views in one
  //     minute, which is well above normal navigation, while still stopping
  //     scripted abuse (thousands of requests per minute).
  // Sensitive authentication endpoints keep a separate, much stricter
  // budget (login, OTP, registration, password change).
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300'),
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000'),
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '30'),
  },

  // Short-lived server-side caches for read-heavy, rarely changing data.
  cache: {
    // Availability queries are expensive (batched schedule/capacity lookups)
    // and only change when schedules, breaks or appointments change. Any write
    // through the scheduling/appointment routers clears this cache explicitly,
    // so the TTL only acts as a backstop for writes made outside the API.
    availabilityTtlMs: parseInt(process.env.AVAILABILITY_CACHE_TTL_MS || '20000'),
  },

  // CORS
  cors: {
    origin: (process.env.CORS_ORIGIN || '*').split(','),
  },

  // Supabase (for OTP email verification, Edge Functions, and Storage)
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    functionSecret: process.env.FUNCTION_SECRET || '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'doctor-photos',
    gcashStorageBucket: process.env.SUPABASE_GCASH_BUCKET || 'gcash-qr-codes',
    receiptStorageBucket: process.env.SUPABASE_RECEIPT_BUCKET || 'payment-receipts',
  },

  // Push notifications (FCM / APNs credentials remain backend-only)
  push: {
    // FCM HTTP v1 (service account JSON contents or raw credential)
    fcmServiceAccountJson: process.env.FCM_SERVICE_ACCOUNT_JSON || '',
    fcmProjectId: process.env.FCM_PROJECT_ID || '',
    // Legacy FCM server key fallback (used when no service account is configured)
    fcmServerKey: process.env.FCM_SERVER_KEY || '',
    // APNs token-based authentication (contents of the .p8 key)
    apnsKeyId: process.env.APNS_KEY_ID || '',
    apnsTeamId: process.env.APNS_TEAM_ID || '',
    apnsPrivateKey: process.env.APNS_PRIVATE_KEY || '',
    apnsTopic: process.env.APNS_TOPIC || '',
    apnsHost: process.env.APNS_HOST || 'api.publish.push.apple.com',
  },

  // Frontend URL for email links
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3001',
  },
};