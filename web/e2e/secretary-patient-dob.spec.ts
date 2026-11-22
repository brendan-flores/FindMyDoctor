import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'secretary');
  const patientId = process.env.E2E_PATIENT_ID;
  if (!patientId) throw new Error('Missing E2E_PATIENT_ID');
  await page.goto(`/secretary/patients/${patientId}`);
});

test('patient DOB picker prevents future dates', async ({ page }) => {
  await expect(page.getByText('Date of Birth').first()).toBeVisible({ timeout: 15000 });
  await page.getByText('Select date').first().click();
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});