import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'doctor');
  await page.goto('/doctor/schedule');
});

test('doctor schedule date picker supports month navigation', async ({ page }) => {
  await page.getByText('Select date').first().click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('button', { name: 'Next month' })).toBeEnabled();
});