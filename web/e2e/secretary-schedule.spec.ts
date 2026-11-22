import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'secretary');
  await page.goto('/secretary/schedule');
});

test('capacity date picker supports clear and today', async ({ page }) => {
  await page.getByText('Select date').first().click();
  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
});