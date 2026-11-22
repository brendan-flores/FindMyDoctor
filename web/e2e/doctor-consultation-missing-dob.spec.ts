import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'doctor');
  const appointmentId = process.env.E2E_APPOINTMENT_ID;
  if (!appointmentId) throw new Error('Missing E2E_APPOINTMENT_ID');
  await page.goto(`/doctor/appointments/${appointmentId}`);
});

test('missing DOB picker prevents future dates', async ({ page }) => {
  await expect(page.getByText('Date of birth')).toBeVisible({ timeout: 15000 });
  await page.getByText('Select date').first().click();
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});