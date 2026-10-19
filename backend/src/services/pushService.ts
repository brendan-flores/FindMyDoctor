import crypto from 'crypto';
import http2 from 'http2';
import axios from 'axios';
import { config } from '../config';
import { query } from '../database/connection';

/**
 * Push notification delivery service.
 *
 * Delivers push notifications to a user's registered device tokens
 * (device_tokens table) through FCM and/or APNs. All provider credentials
 * are read from the backend environment only and are never exposed to the
 * mobile or web applications.
 *
 * Push delivery is best-effort: failures are logged and never block the
 * operation that triggered the notification (for example saving a chat
 * message). Message content must never be included in push payloads.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Additional key/value data. Values must be strings for FCM/APNs data payloads. */
  data?: Record<string, string>;
}

interface FcmAccessToken {
  token: string;
  expiresAt: number;
}

let fcmAccessToken: FcmAccessToken | null = null;
let warnedNotConfigured = false;

interface FcmServiceAccount {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
}

function parseFcmServiceAccount(): FcmServiceAccount | null {
  const raw = config.push.fcmServiceAccountJson;
  if (!raw) {
    return null;
  }
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (
      parsed &&
      parsed.private_key &&
      parsed.client_email &&
      parsed.project_id
    ) {
      return parsed as FcmServiceAccount;
    }
    console.error(
      'Invalid FCM service account configuration: missing project_id, private_key or client_email'
    );
    return null;
  } catch (err) {
    console.error('Failed to parse FCM service account JSON', err);
    return null;
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input as unknown as string)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function ensureLineBreaks(key: string): string {
  return key.replace(/\\n/g, '\n');
}

/**
 * Exchanges a service-account JWT for an FCM HTTP v1 OAuth access token.
 * Tokens are cached until close to expiry.
 */
async function getFcmAccessToken(serviceAccount: FcmServiceAccount): Promise<string | null> {
  if (fcmAccessToken && Date.now() < fcmAccessToken.expiresAt) {
    return fcmAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signatureInput = `${header}.${claims}`;
  const signature = base64url(
    crypto
      .createSign('RSA-SHA256')
      .update(signatureInput)
      .sign(ensureLineBreaks(serviceAccount.private_key))
  );
  const assertion = `${signatureInput}.${signature}`;

  try {
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      }
    );

    if (response.data && response.data.access_token) {
      fcmAccessToken = {
        token: response.data.access_token,
        expiresAt: Date.now() + (response.data.expires_in >= 60 ? response.data.expires_in - 60 : 3000) * 1000,
      };
      return fcmAccessToken.token;
    }
    return null;
  } catch (err: any) {
    console.error('Failed to obtain FCM access token:', err?.response?.status || err?.message || err);
    return null;
  }
}

// FCM v1 error reasons that indicate the device token is no longer valid
const FCM_INVALID_TOKEN_REASONS = new Set([
  'UNREGISTERED',
  'INVALID_ARGUMENT',
  'SENDER_ID_MISMATCH',
]);

/** Send a push via FCM HTTP v1. Returns false when the token must be removed. */
async function sendFcmV1(
  serviceAccount: FcmServiceAccount,
  deviceToken: string,
  payload: PushPayload
): Promise<boolean> {
  const projectId = serviceAccount.project_id;
  const accessToken = await getFcmAccessToken(serviceAccount);
  if (!accessToken) {
    return true; // Not a token problem - do not delete the device token
  }

  const message: Record<string, unknown> = {
    message: {
      token: deviceToken,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    },
  };

  try {
    const response = await axios.post(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      message,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status === 200) {
      return true;
    }

    // The v1 API embeds the FCM error code (for example UNREGISTERED) in the
    // serialized error details; a 404/410 without one is also invalid.
    const detailText = JSON.stringify(response.data || '').toUpperCase();
    let tokenInvalid = response.status === 404 || response.status === 410;
    for (const reason of FCM_INVALID_TOKEN_REASONS) {
      if (detailText.includes(reason)) {
        tokenInvalid = true;
        break;
      }
    }
    if (tokenInvalid) {
      return false;
    }

    console.error(
      `FCM v1 push rejected with status ${response.status}: ${
        String(response.data?.error?.message || 'unknown')
      }`
    );
    return true;
  } catch (err: any) {
    console.error('FCM v1 push error:', err?.message || err);
    return true;
  }
}

/** Legacy FCM HTTP API fallback using a server key. */
async function sendFcmLegacy(deviceToken: string, payload: PushPayload): Promise<boolean> {
  try {
    const response = await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to: deviceToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      },
      {
        headers: {
          Authorization: `key=${config.push.fcmServerKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
        validateStatus: (status) => status < 500,
      }
    );
    // 401 = sender mismatch, 404/410 = token invalid or unregistered
    const status = response.status;
    if (status >= 200 && status < 300) {
      // Legacy result object instead of HTTP failure status
      const failure = Number(response.data?.failure || 0);
      if (failure > 0) {
        const result = response.data?.results?.[0];
        const err = String(result?.error || '');
        if (['NotRegistered', 'MismatchSenderId', 'InvalidRegistration'].includes(err)) {
          return false;
        }
      }
      return true;
    }
    if (status === 400 || status === 401 || status === 404 || status === 410) {
      return status !== 401; // 401 is a credentials problem, not a token problem
    }
    return true;
  } catch (err: any) {
    console.error('FCM legacy push error:', err?.message || err);
    return true;
  }
}

/** Send a push via APNs token-based (JWT) authentication over HTTP/2. */
async function sendApns(deviceToken: string, payload: PushPayload): Promise<boolean> {
  const { apnsKeyId, apnsTeamId, apnsPrivateKey, apnsTopic, apnsHost } = config.push;
  if (!apnsKeyId || !apnsTeamId || !apnsPrivateKey || !apnsTopic) {
    return true;
  }

  // Cache the APNs provider token; Apple allows up to 1 hour, refresh every 30 minutes
  let providerToken: string | null = (globalThis as any).__apnsTokenCache ?? null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const issuedAt = (globalThis as any).__apnsTokenCacheIssued ?? 0;
  if (
    !providerToken ||
    nowSeconds - issuedAt > 1800
  ) {
    const header = base64url(JSON.stringify({ alg: 'ES256', kid: apnsKeyId }));
    const claims = base64url(
      JSON.stringify({ iss: apnsTeamId, iat: nowSeconds })
    );
    const signatureInput = `${header}.${claims}`;
    let signature = '';
    // ES256 signing with the p8 key (SEC1) via crypto with keyObject
    try {
      const keyObject = crypto.createPrivateKey({
        key: ensureLineBreaks(apnsPrivateKey),
        format: 'pem',
        type: 'pkcs8',
      });
      const signatureBuffer = crypto.sign('sha256', Buffer.from(signatureInput), {
        key: keyObject,
        dsaEncoding: 'ieee-p1363',
      });
      signature = base64url(signatureBuffer);
    } catch (err) {
      console.error('Failed to sign APNs provider token', err);
      return true;
    }
    providerToken = `${signatureInput}.${signature}`;
    (globalThis as any).__apnsTokenCache = providerToken;
    (globalThis as any).__apnsTokenCacheIssued = nowSeconds;
  }

  return new Promise<boolean>((resolve) => {
    const client = http2.connect(`https://${apnsHost}`);
    let settled = false;
    const finish = (value: boolean) => {
      if (!settled) {
        settled = true;
        try {
          client.close();
        } catch {
          // ignore
        }
        resolve(value);
      }
    };

    client.on('error', (err) => {
      console.error('APNs connection error:', err.message);
      finish(true);
    });

    const body = JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: 'default',
      },
      ...(payload.data ? payload.data : {}),
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/2/device/${encodeURIComponent(deviceToken)}`,
      authorization: `bearer ${providerToken}`,
      'apns-topic': apnsTopic,
      'apns-expiration': '0',
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    });

    req.setTimeout(10000, () => {
      console.error('APNs push timed out');
      req.close(http2.constants.NGHTTP2_CANCEL);
      finish(true);
    });

    req.on('response', (headers) => {
      const status = Number(headers[':status']);
      const reason = String(headers['apns-reason'] || '');
      if (status === 200) {
        finish(true);
        return;
      }
      if (
        (status === 404 || status === 410) &&
        ['Unregistered', 'BadDeviceToken'].includes(reason)
      ) {
        finish(false);
        return;
      }
      console.error(`APNs push rejected with status ${status} (${reason})`);
      finish(true);
    });

    req.on('error', (err) => {
      console.error('APNs push error:', err.message);
      finish(true);
    });

    req.write(body);
    req.end();
  });
}

function isFcmConfigured(): boolean {
  return Boolean(config.push.fcmServiceAccountJson || config.push.fcmServerKey);
}

function isApnsConfigured(): boolean {
  const { apnsKeyId, apnsTeamId, apnsPrivateKey, apnsTopic } = config.push;
  return Boolean(apnsKeyId && apnsTeamId && apnsPrivateKey && apnsTopic);
}

/**
 * Deliver a push to all device tokens registered for the given user.
 * Invalid tokens (unregistered on the provider side) are removed from the
 * device_tokens table. Never throws - callers do not need to await failure
 * handling beyond logging.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!isFcmConfigured() && !isApnsConfigured()) {
      if (!warnedNotConfigured) {
        console.warn(
          'Push delivery skipped: no FCM/APNs credentials configured on the backend'
        );
        warnedNotConfigured = true;
      }
      return;
    }

    const result = await query(
      'SELECT id, provider, token FROM device_tokens WHERE user_id = $1',
      [userId]
    );

    for (const row of result.rows) {
      let keep = true;
      if (row.provider === 'APNS' && isApnsConfigured()) {
        keep = await sendApns(row.token, payload);
      } else if (row.provider === 'FCM') {
        const serviceAccount = parseFcmServiceAccount();
        if (serviceAccount) {
          keep = await sendFcmV1(serviceAccount, row.token, payload);
        } else if (config.push.fcmServerKey) {
          keep = await sendFcmLegacy(row.token, payload);
        }
      }

      if (!keep) {
        await query('DELETE FROM device_tokens WHERE id = $1', [row.id]);
      }
    }
  } catch (err) {
    console.error('Push delivery failed:', err);
  }
}
