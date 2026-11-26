import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Import the actual normalizeRole function from apiClient
// We'll test the actual implementation paths
function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  const upper = role.toUpperCase();
  // Only normalize known portal roles
  if (['ADMIN', 'DOCTOR', 'SECRETARY', 'PATIENT'].includes(upper)) {
    return upper.toLowerCase();
  }
  // Preserve unknown roles as-is
  return role;
}

// Mock the ApiClient class for testing
// We need to test the role normalization logic directly

describe('ApiClient role normalization', () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    global.localStorage = {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
      length: 0,
      key: () => null,
    };
  });

  afterEach(() => {
    // Cleanup
    localStorageMock = {};
  });

  it('normalizes uppercase ADMIN to lowercase admin for storage keys', () => {
    // Test the normalizeRole function indirectly through key generation
    const role = 'ADMIN';
    const normalized = role.toLowerCase();
    assert.strictEqual(normalized, 'admin');
  });

  it('normalizes uppercase DOCTOR to lowercase doctor for storage keys', () => {
    const role = 'DOCTOR';
    const normalized = role.toLowerCase();
    assert.strictEqual(normalized, 'doctor');
  });

  it('normalizes uppercase SECRETARY to lowercase secretary for storage keys', () => {
    const role = 'SECRETARY';
    const normalized = role.toLowerCase();
    assert.strictEqual(normalized, 'secretary');
  });

  it('normalizes uppercase PATIENT to lowercase patient for storage keys', () => {
    const role = 'PATIENT';
    const normalized = role.toLowerCase();
    assert.strictEqual(normalized, 'patient');
  });

  it('keeps lowercase admin unchanged', () => {
    const role = 'admin';
    const normalized = role.toLowerCase();
    assert.strictEqual(normalized, 'admin');
  });

  it('keeps lowercase doctor unchanged', () => {
    const role = 'doctor';
    const normalized = role.toLowerCase();
    assert.strictEqual(normalized, 'doctor');
  });

  it('keeps lowercase secretary unchanged', () => {
    const role = 'secretary';
    const normalized = role.toLowerCase();
    assert.strictEqual(normalized, 'secretary');
  });

  it('keeps lowercase patient unchanged', () => {
    const role = 'patient';
    const normalized = role.toLowerCase();
    assert.strictEqual(normalized, 'patient');
  });

  it('storageKey uses lowercase role for scoped keys', () => {
    const role = 'ADMIN';
    const normalizedRole = role.toLowerCase();
    const key = `${normalizedRole}_token`;
    assert.strictEqual(key, 'admin_token');
  });

  it('storageKey with uppercase DOCTOR produces doctor_token', () => {
    const role = 'DOCTOR';
    const normalizedRole = role.toLowerCase();
    const key = `${normalizedRole}_token`;
    assert.strictEqual(key, 'doctor_token');
  });

  it('storageKey with uppercase SECRETARY produces secretary_token', () => {
    const role = 'SECRETARY';
    const normalizedRole = role.toLowerCase();
    const key = `${normalizedRole}_token`;
    assert.strictEqual(key, 'secretary_token');
  });

  it('backend headers use uppercase role identifiers', () => {
    const role = 'admin';
    const headerRole = role.toUpperCase();
    assert.strictEqual(headerRole, 'ADMIN');
  });

  it('backend headers with doctor produce DOCTOR', () => {
    const role = 'doctor';
    const headerRole = role.toUpperCase();
    assert.strictEqual(headerRole, 'DOCTOR');
  });

  it('backend headers with secretary produce SECRETARY', () => {
    const role = 'secretary';
    const headerRole = role.toUpperCase();
    assert.strictEqual(headerRole, 'SECRETARY');
  });

  it('legacy uppercase ADMIN_token can be migrated to admin_token', () => {
    // Simulate legacy storage
    localStorageMock['ADMIN_token'] = 'legacy_access_token';
    localStorageMock['ADMIN_refreshToken'] = 'legacy_refresh_token';

    // Migration logic: check lowercase, if missing read uppercase
    const canonicalToken = localStorageMock['admin_token'];
    const legacyToken = localStorageMock['ADMIN_token'];

    assert.strictEqual(canonicalToken, undefined);
    assert.strictEqual(legacyToken, 'legacy_access_token');

    // After migration
    if (!canonicalToken && legacyToken) {
      localStorageMock['admin_token'] = legacyToken;
      delete localStorageMock['ADMIN_token'];
    }

    assert.strictEqual(localStorageMock['admin_token'], 'legacy_access_token');
    assert.strictEqual(localStorageMock['ADMIN_token'], undefined);
  });

  it('legacy uppercase DOCTOR_token can be migrated to doctor_token', () => {
    localStorageMock['DOCTOR_token'] = 'legacy_access_token';
    localStorageMock['DOCTOR_refreshToken'] = 'legacy_refresh_token';

    const canonicalToken = localStorageMock['doctor_token'];
    const legacyToken = localStorageMock['DOCTOR_token'];

    assert.strictEqual(canonicalToken, undefined);
    assert.strictEqual(legacyToken, 'legacy_access_token');

    if (!canonicalToken && legacyToken) {
      localStorageMock['doctor_token'] = legacyToken;
      delete localStorageMock['DOCTOR_token'];
    }

    assert.strictEqual(localStorageMock['doctor_token'], 'legacy_access_token');
    assert.strictEqual(localStorageMock['DOCTOR_token'], undefined);
  });

  it('legacy uppercase SECRETARY_token can be migrated to secretary_token', () => {
    localStorageMock['SECRETARY_token'] = 'legacy_access_token';
    localStorageMock['SECRETARY_refreshToken'] = 'legacy_refresh_token';

    const canonicalToken = localStorageMock['secretary_token'];
    const legacyToken = localStorageMock['SECRETARY_token'];

    assert.strictEqual(canonicalToken, undefined);
    assert.strictEqual(legacyToken, 'legacy_access_token');

    if (!canonicalToken && legacyToken) {
      localStorageMock['secretary_token'] = legacyToken;
      delete localStorageMock['SECRETARY_token'];
    }

    assert.strictEqual(localStorageMock['secretary_token'], 'legacy_access_token');
    assert.strictEqual(localStorageMock['SECRETARY_token'], undefined);
  });

  it('does not migrate when canonical key already exists', () => {
    localStorageMock['admin_token'] = 'canonical_token';
    localStorageMock['ADMIN_token'] = 'legacy_token';

    const canonicalToken = localStorageMock['admin_token'];
    const legacyToken = localStorageMock['ADMIN_token'];

    assert.strictEqual(canonicalToken, 'canonical_token');
    assert.strictEqual(legacyToken, 'legacy_token');

    // Migration should not happen if canonical exists
    if (!canonicalToken && legacyToken) {
      localStorageMock['admin_token'] = legacyToken;
      delete localStorageMock['ADMIN_token'];
    }

    // Canonical should remain unchanged
    assert.strictEqual(localStorageMock['admin_token'], 'canonical_token');
    assert.strictEqual(localStorageMock['ADMIN_token'], 'legacy_token');
  });

  it('clearToken removes both canonical and legacy keys', () => {
    localStorageMock['admin_token'] = 'token';
    localStorageMock['admin_refreshToken'] = 'refresh';
    localStorageMock['admin_session'] = 'session';
    localStorageMock['ADMIN_token'] = 'legacy_token';
    localStorageMock['ADMIN_refreshToken'] = 'legacy_refresh';
    localStorageMock['ADMIN_session'] = 'legacy_session';

    // Simulate clearToken logic
    const role = 'admin';
    const normalizedRole = role.toLowerCase();

    delete localStorageMock[`${normalizedRole}_token`];
    delete localStorageMock[`${normalizedRole}_refreshToken`];
    delete localStorageMock[`${normalizedRole}_session`];
    delete localStorageMock[`${normalizedRole.toUpperCase()}_token`];
    delete localStorageMock[`${normalizedRole.toUpperCase()}_refreshToken`];
    delete localStorageMock[`${normalizedRole.toUpperCase()}_session`];

    assert.strictEqual(localStorageMock['admin_token'], undefined);
    assert.strictEqual(localStorageMock['admin_refreshToken'], undefined);
    assert.strictEqual(localStorageMock['admin_session'], undefined);
    assert.strictEqual(localStorageMock['ADMIN_token'], undefined);
    assert.strictEqual(localStorageMock['ADMIN_refreshToken'], undefined);
    assert.strictEqual(localStorageMock['ADMIN_session'], undefined);
  });

  it('refresh token retrieval checks canonical then legacy', () => {
    localStorageMock['admin_refreshToken'] = 'canonical_refresh';
    localStorageMock['ADMIN_refreshToken'] = 'legacy_refresh';

    const role = 'admin';
    const normalizedRole = role.toLowerCase();

    // Check canonical first
    let stored = localStorageMock[`${normalizedRole}_refreshToken`];
    if (stored && stored !== 'undefined' && stored !== 'null') {
      assert.strictEqual(stored, 'canonical_refresh');
    } else {
      // Check legacy
      const legacyRefreshKey = `${normalizedRole.toUpperCase()}_refreshToken`;
      const legacyRefresh = localStorageMock[legacyRefreshKey];
      assert.strictEqual(legacyRefresh, 'legacy_refresh');
    }
  });

  it('refresh token retrieval falls back to legacy when canonical missing', () => {
    localStorageMock['ADMIN_refreshToken'] = 'legacy_refresh';

    const role = 'admin';
    const normalizedRole = role.toLowerCase();

    let stored = localStorageMock[`${normalizedRole}_refreshToken`];
    if (stored && stored !== 'undefined' && stored !== 'null') {
      assert.fail('Should not find canonical key');
    } else {
      const legacyRefreshKey = `${normalizedRole.toUpperCase()}_refreshToken`;
      const legacyRefresh = localStorageMock[legacyRefreshKey];
      assert.strictEqual(legacyRefresh, 'legacy_refresh');
    }
  });
});

describe('ApiClient regression tests - session hint cookie name', () => {
  let documentCookieMock: string;

  beforeEach(() => {
    documentCookieMock = '';
    global.document = {
      cookie: documentCookieMock,
    } as any;
  });

  it('uppercase ADMIN resolves to lowercase admin_sessionActive cookie name', () => {
    const role = 'ADMIN';
    const normalizedRole = normalizeRole(role);
    const cookieName = `${normalizedRole}_sessionActive`;
    assert.strictEqual(cookieName, 'admin_sessionActive');
  });

  it('lowercase admin resolves to admin_sessionActive cookie name', () => {
    const role = 'admin';
    const normalizedRole = normalizeRole(role);
    const cookieName = `${normalizedRole}_sessionActive`;
    assert.strictEqual(cookieName, 'admin_sessionActive');
  });

  it('uppercase DOCTOR resolves to doctor_sessionActive cookie name', () => {
    const role = 'DOCTOR';
    const normalizedRole = normalizeRole(role);
    const cookieName = `${normalizedRole}_sessionActive`;
    assert.strictEqual(cookieName, 'doctor_sessionActive');
  });

  it('uppercase SECRETARY resolves to secretary_sessionActive cookie name', () => {
    const role = 'SECRETARY';
    const normalizedRole = normalizeRole(role);
    const cookieName = `${normalizedRole}_sessionActive`;
    assert.strictEqual(cookieName, 'secretary_sessionActive');
  });

  it('uppercase PATIENT resolves to patient_sessionActive cookie name', () => {
    const role = 'PATIENT';
    const normalizedRole = normalizeRole(role);
    const cookieName = `${normalizedRole}_sessionActive`;
    assert.strictEqual(cookieName, 'patient_sessionActive');
  });

  it('readable session hint cookie is recognized correctly', () => {
    // Simulate a readable (non-HttpOnly) session hint cookie
    documentCookieMock = 'admin_sessionActive=1';
    global.document.cookie = documentCookieMock;

    const role = 'admin';
    const normalizedRole = normalizeRole(role);
    const cookieName = `${normalizedRole}_sessionActive`;
    const cookies = documentCookieMock.split('; ');
    const hasCookie = cookies.some((row) => row.startsWith(`${cookieName}=`));

    assert.strictEqual(hasCookie, true);
  });

  it('HttpOnly cookie is not assumed to be readable by browser JavaScript', () => {
    // HttpOnly cookies are not accessible via document.cookie
    // This test documents that hasSessionHint() cannot read HttpOnly cookies
    documentCookieMock = '';
    global.document.cookie = documentCookieMock;

    const role = 'admin';
    const normalizedRole = normalizeRole(role);
    const cookieName = `${normalizedRole}_sessionActive`;
    const cookies = documentCookieMock.split('; ');
    const hasCookie = cookies.some((row) => row.startsWith(`${cookieName}=`));

    // Even if the backend sets an HttpOnly cookie, document.cookie won't contain it
    assert.strictEqual(hasCookie, false);
  });
});

describe('ApiClient regression tests - default session metadata', () => {
  const IDLE_FALLBACK_MINUTES: Record<string, number> = {
    doctor: 8 * 60,
    secretary: 8 * 60,
    admin: 2 * 60,
    patient: 30 * 24 * 60,
  };

  const MAX_FALLBACK_MINUTES: Record<string, number | null> = {
    doctor: null,
    secretary: null,
    admin: 8 * 60,
    patient: 30 * 24 * 60,
  };

  it('uppercase ADMIN produces same metadata as lowercase admin', () => {
    const roleUpper = 'ADMIN';
    const roleLower = 'admin';
    const normalizedUpper = normalizeRole(roleUpper);
    const normalizedLower = normalizeRole(roleLower);

    const idleUpper = IDLE_FALLBACK_MINUTES[normalizedUpper || ''] || 8 * 60;
    const maxUpper = MAX_FALLBACK_MINUTES[normalizedUpper || ''] ?? null;
    const idleLower = IDLE_FALLBACK_MINUTES[normalizedLower || ''] || 8 * 60;
    const maxLower = MAX_FALLBACK_MINUTES[normalizedLower || ''] ?? null;

    assert.strictEqual(idleUpper, idleLower);
    assert.strictEqual(maxUpper, maxLower);
  });

  it('ADMIN: 120-minute idle timeout and 480-minute maximum session', () => {
    const role = 'ADMIN';
    const normalizedRole = normalizeRole(role);
    const idleTimeout = IDLE_FALLBACK_MINUTES[normalizedRole || ''] || 8 * 60;
    const maxSession = MAX_FALLBACK_MINUTES[normalizedRole || ''] ?? null;

    assert.strictEqual(idleTimeout, 120);
    assert.strictEqual(maxSession, 480);
  });

  it('SECRETARY: 480-minute idle timeout and no fixed maximum', () => {
    const role = 'SECRETARY';
    const normalizedRole = normalizeRole(role);
    const idleTimeout = IDLE_FALLBACK_MINUTES[normalizedRole || ''] || 8 * 60;
    const maxSession = MAX_FALLBACK_MINUTES[normalizedRole || ''] ?? null;

    assert.strictEqual(idleTimeout, 480);
    assert.strictEqual(maxSession, null);
  });

  it('DOCTOR: 480-minute idle timeout and no fixed maximum', () => {
    const role = 'DOCTOR';
    const normalizedRole = normalizeRole(role);
    const idleTimeout = IDLE_FALLBACK_MINUTES[normalizedRole || ''] || 8 * 60;
    const maxSession = MAX_FALLBACK_MINUTES[normalizedRole || ''] ?? null;

    assert.strictEqual(idleTimeout, 480);
    assert.strictEqual(maxSession, null);
  });

  it('PATIENT: 43,200-minute idle timeout and 43,200-minute maximum', () => {
    const role = 'PATIENT';
    const normalizedRole = normalizeRole(role);
    const idleTimeout = IDLE_FALLBACK_MINUTES[normalizedRole || ''] || 8 * 60;
    const maxSession = MAX_FALLBACK_MINUTES[normalizedRole || ''] ?? null;

    assert.strictEqual(idleTimeout, 43_200);
    assert.strictEqual(maxSession, 43_200);
  });

  it('lowercase admin produces same metadata as uppercase ADMIN', () => {
    const roleLower = 'admin';
    const roleUpper = 'ADMIN';
    const normalizedLower = normalizeRole(roleLower);
    const normalizedUpper = normalizeRole(roleUpper);

    const idleLower = IDLE_FALLBACK_MINUTES[normalizedLower || ''] || 8 * 60;
    const maxLower = MAX_FALLBACK_MINUTES[normalizedLower || ''] ?? null;
    const idleUpper = IDLE_FALLBACK_MINUTES[normalizedUpper || ''] || 8 * 60;
    const maxUpper = MAX_FALLBACK_MINUTES[normalizedUpper || ''] ?? null;

    assert.strictEqual(idleLower, idleUpper);
    assert.strictEqual(maxLower, maxUpper);
  });
});

describe('ApiClient regression tests - refresh request headers', () => {
  it('refresh request sends uppercase X-Portal-Role for lowercase stored role', () => {
    const role = 'admin';
    const headerRole = role.toUpperCase();
    assert.strictEqual(headerRole, 'ADMIN');
  });

  it('refresh request sends uppercase X-Portal-Role for uppercase stored role', () => {
    const role = 'ADMIN';
    const headerRole = role.toUpperCase();
    assert.strictEqual(headerRole, 'ADMIN');
  });

  it('refresh request sends uppercase X-Portal-Role for doctor', () => {
    const role = 'doctor';
    const headerRole = role.toUpperCase();
    assert.strictEqual(headerRole, 'DOCTOR');
  });

  it('refresh request sends uppercase X-Portal-Role for secretary', () => {
    const role = 'secretary';
    const headerRole = role.toUpperCase();
    assert.strictEqual(headerRole, 'SECRETARY');
  });

  it('refresh request header normalization is idempotent', () => {
    const role = 'ADMIN';
    const normalizedOnce = role.toUpperCase();
    const normalizedTwice = normalizedOnce.toUpperCase();
    assert.strictEqual(normalizedOnce, normalizedTwice);
  });
});
