import { Page } from '@playwright/test';

export type Role = 'superadmin' | 'doctor' | 'secretary';

export function credentials(role: Role) {
  if (role === 'superadmin') {
    return {
      email: process.env.E2E_SUPERADMIN_EMAIL || '',
      password: process.env.E2E_SUPERADMIN_PASSWORD || '',
      path: '/auth/admin-login',
    };
  }
  if (role === 'doctor') {
    return {
      email: process.env.E2E_DOCTOR_EMAIL || '',
      password: process.env.E2E_DOCTOR_PASSWORD || '',
      path: '/doctor-login',
    };
  }
  return {
    email: process.env.E2E_SECRETARY_EMAIL || '',
    password: process.env.E2E_SECRETARY_PASSWORD || '',
    path: '/secretary-login',
  };
}

export async function loginAs(page: Page, role: Role) {
  const c = credentials(role);
  if (!c.email || !c.password) {
    throw new Error(`Missing E2E credentials for ${role}`);
  }

  await page.goto(c.path);
  await page.getByPlaceholder(/example\.com|email/i).first().fill(c.email);
  await page.getByPlaceholder(/password|•/i).first().fill(c.password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();

  if (role === 'superadmin') {
    await page.waitForURL(/\/admin\//, { timeout: 15000 });
  } else if (role === 'doctor') {
    await page.waitForURL(/\/doctor\//, { timeout: 15000 });
  } else {
    await page.waitForURL(/\/secretary\//, { timeout: 15000 });
  }
}