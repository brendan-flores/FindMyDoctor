import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'secretary');
  await page.goto('/secretary/queue');
});

test('queue date filter allows past and future dates', async ({ page }) => {
  const trigger = page.getByText(/\d{4}-\d{2}-\d{2}|Select date/).first();
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Next month' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.locator('div.grid.grid-cols-7 button:not([disabled])').first().click();
});