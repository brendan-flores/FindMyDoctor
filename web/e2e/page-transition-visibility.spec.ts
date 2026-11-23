import { test, expect, type Page } from '@playwright/test';

async function setDocumentVisibility(page: Page, state: 'hidden' | 'visible') {
  // Deterministic simulation of a document visibility change. This overrides
  // the reported visibilityState/hidden values and dispatches the same
  // visibilitychange event handled by PageTransition. It is NOT a genuine
  // browser backgrounding; Chromium did not report a hidden state for inactive
  // Playwright pages in this environment, so genuine backgrounding is not used.
  await page.evaluate((nextState) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get() {
        return nextState;
      },
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get() {
        return nextState !== 'visible';
      },
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
  await page.waitForTimeout(50);
}

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

function forbiddenErrors(errors: string[]): string[] {
  return errors.filter((error) =>
    /hydrat|mismatch|document hidden|view transition|aborted/i.test(error)
  );
}

test.describe('PageTransition visibility preservation', () => {
  test('input value survives hidden -> visible', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/doctor-signup');
    const value = `VisibilityTest${Date.now()}`;
    await page.locator('#firstName').fill(value);
    await expect(page.locator('#firstName')).toHaveValue(value);

    await setDocumentVisibility(page, 'hidden');
    await setDocumentVisibility(page, 'visible');

    await expect(page.locator('#firstName')).toHaveValue(value);
    expect(forbiddenErrors(errors)).toEqual([]);
  });

  test('client-side route navigation still works', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/doctor-signup');
    await expect(page.getByRole('heading', { name: 'Create Doctor Account' })).toBeVisible();

    // Use the application's own link so this exercises client-side routing and
    // the PageTransition route change, not a full document navigation.
    await page.getByRole('link', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/doctor-login/);

    expect(forbiddenErrors(errors)).toEqual([]);
  });

  test('Doctor Sign-Up OTP step survives visibility changes', async ({ page }) => {
    const errors = collectPageErrors(page);
    const email = `doctor${Date.now()}@example.com`;

    await page.route('**/api/v1/auth/otp/send', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null }),
      });
    });

    await page.goto('/doctor-signup');

    await page.locator('#firstName').fill('Test');
    await page.locator('#lastName').fill('Doctor');
    await page.locator('#email').fill(email);
    await page.locator('#contactNumber').fill('09171234567');
    await page.locator('#password').fill('Password123!');
    await page.locator('#confirmPassword').fill('Password123!');

    await page.getByRole('button', { name: 'Create Doctor Account' }).click();

    await expect(page.getByText('Verify Your Email')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(email)).toBeVisible();

    const otpInputs = page.locator('input[inputmode="numeric"]');
    await expect(otpInputs).toHaveCount(6);

    await setDocumentVisibility(page, 'hidden');
    await setDocumentVisibility(page, 'visible');

    await expect(page.getByText('Verify Your Email')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(otpInputs).toHaveCount(6);
    await expect(page.getByText('Create Doctor Account')).not.toBeVisible();

    expect(forbiddenErrors(errors)).toEqual([]);
  });
});