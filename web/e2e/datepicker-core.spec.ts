import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'secretary');
  await page.goto('/secretary/walk-ins');
});

test('opens picker and closes without changing value', async ({ page }) => {
  const trigger = page.getByText('Select date').first();
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible();
  await page.locator('.fixed.inset-0').click();
  await expect(page.getByText('Select date').first()).toBeVisible();
});

test('selecting a date closes and keeps the selected value', async ({ page }) => {
  const trigger = page.getByText('Select date').first();
  await trigger.click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.locator('div.grid.grid-cols-7 button:not([disabled])').first().click();
  await expect(page.getByText(/\d{2}\/\d{2}\/\d{4}/).first()).toBeVisible();
});

test('reopening and closing without selecting keeps the previous value', async ({ page }) => {
  const trigger = page.getByText('Select date').first();
  await trigger.click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.locator('div.grid.grid-cols-7 button:not([disabled])').first().click();
  const selected = page.getByText(/\d{2}\/\d{2}\/\d{4}/).first();
  await expect(selected).toBeVisible();
  await selected.click();
  await page.locator('.fixed.inset-0').click();
  await expect(selected).toBeVisible();
});

test('backward then forward re-enables forward arrow', async ({ page }) => {
  await page.getByText('Select date').first().click();
  const prev = page.getByRole('button', { name: 'Previous month' });
  const next = page.getByRole('button', { name: 'Next month' });
  await prev.click();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(prev).toBeEnabled();
});

test('stops at maximum month', async ({ page }) => {
  await page.getByText('Select date').first().click();
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});

test('future day buttons are disabled for DOB fields', async ({ page }) => {
  await page.getByText('Select date').first().click();
  const disabledDays = page.locator('div.grid.grid-cols-7 button[disabled]');
  await expect(disabledDays.first()).toBeVisible();
});