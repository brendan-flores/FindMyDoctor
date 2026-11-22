import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'secretary');
  await page.goto('/secretary/walk-ins');
});

test('DOB prevents future dates', async ({ page }) => {
  await page.getByText('Select date').first().click();
  // Future day buttons in current month are disabled when maxDate=today.
  // At least the Today button is disabled only if today is disabled; check next month arrow disabled.
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});

test('DOB accepts a past date value', async ({ page }) => {
  await page.getByText('Select date').first().click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  // Click first enabled day.
  const day = page.locator('div.grid.grid-cols-7 button:not([disabled])').first();
  await day.click();
  await expect(page.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeVisible();
});