import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'secretary');
  await page.goto('/secretary/payments');
});

test('from and to date filters allow unrestricted dates', async ({ page }) => {
  const triggers = page.getByText(/Select date|\d{2}\/\d{2}\/\d{4}/);
  await triggers.nth(0).click();
  await expect(page.getByRole('button', { name: 'Next month' })).toBeEnabled();
  await page.locator('.fixed.inset-0').click();
  await triggers.nth(1).click();
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeEnabled();
});