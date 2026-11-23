import { defineConfig, devices } from '@playwright/test';

/**
 * Focused configuration for `e2e/page-transition-visibility.spec.ts`.
 *
 * These tests mock the Doctor Sign-Up OTP endpoint and do not require the
 * dedicated E2E backend/database or credentials used by the standard
 * `playwright.config.ts` global setup. The standard configuration is
 * intentionally left unchanged.
 *
 * The Next.js frontend must already be running before invoking this config.
 * By default it is expected at http://localhost:3001; override with
 * E2E_BASE_URL when needed.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/page-transition-visibility.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
