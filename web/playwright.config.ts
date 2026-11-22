import { defineConfig, devices } from '@playwright/test';

// E2E environment variables are required by global-setup.ts:
//   E2E_BASE_URL, E2E_API_URL, E2E_BACKEND_URL, NEXT_PUBLIC_API_URL,
//   E2E_DATABASE_NAME, and the E2E_* credentials/ids.
// NEXT_PUBLIC_API_URL is baked into the Next.js build/dev server at startup.
// The Next.js dev server or build must be started with the same
// NEXT_PUBLIC_API_URL value as E2E_API_URL; Playwright cannot change it
// retroactively for an already-running server.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3001';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    timezoneId: 'Asia/Manila',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});