import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'doctor');
  await page.goto('/doctor/patients');
});

test('doctor patient DOB picker prevents future dates', async ({ page }) => {
  await page.getByRole('button', { name: /add patient/i }).click();
  await page.getByText('Select date').first().click();
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});