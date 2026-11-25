import { test, expect, type Route } from '@playwright/test';
import { loginAs } from './fixtures/auth';

/**
 * Reusable ConfirmDialog (confirm + info modes) focus lifecycle and the
 * admin-management message ordering.
 *
 * The `/admin/admins` API is mocked so the dialog behaviour can be exercised
 * deterministically and no real admin account is created or deleted.
 */

const ADMINS_ENDPOINT = '**/api/v1/admin/admins**';

const SAMPLE_ADMIN = {
  id: 'admin-1',
  email: 'existing-admin@example.com',
  role: 'ADMIN',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

function respond(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function openAdminManagement(page: Parameters<typeof loginAs>[0]) {
  await loginAs(page, 'superadmin');
  await page.goto('/admin/admin');
  await expect(
    page.getByRole('cell', { name: SAMPLE_ADMIN.email }),
  ).toBeVisible();
}

test.describe('reusable dialog - focus lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(ADMINS_ENDPOINT, async (route) => {
      if (route.request().method() === 'GET') {
        await respond(route, { success: true, data: [SAMPLE_ADMIN] });
        return;
      }
      await respond(route, { success: true, data: null });
    });
    await openAdminManagement(page);
  });

  test('confirmation dialog traps Tab and restores focus on close', async ({
    page,
  }) => {
    const trigger = page.getByRole('button', { name: 'Delete' });
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const confirm = dialog.getByRole('button', { name: 'Delete' });

    await expect(cancel).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(confirm).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(confirm).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('focus survives a quick close and reopen', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Delete' });
    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');

    // The dialog must stay mounted in its closed presence state while the
    // exit transition plays — it must not unmount immediately.
    await expect(dialog).toHaveAttribute('data-state', 'closed');
    await expect(dialog).toBeVisible();

    // Reopen while the dialog is still rendered during its exit transition.
    await trigger.dispatchEvent('click');

    await expect(dialog).toHaveAttribute('data-state', 'open');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Escape does not dismiss the dialog while busy', async ({ page }) => {
    let releaseDelete: () => void = () => {};
    const deleteReleased = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });

    await page.route('**/api/v1/admin/admins/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await deleteReleased;
      }
      await respond(route, { success: true, data: null });
    });

    await page.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(dialog.getByRole('button', { name: 'Working' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    releaseDelete();
    await expect(dialog).toBeHidden();
  });
});

test.describe('admin creation - success dialog ordering', () => {
  test('shows the success dialog before refreshing the list', async ({
    page,
  }) => {
    let getCalls = 0;
    await page.route(ADMINS_ENDPOINT, async (route) => {
      if (route.request().method() === 'GET') {
        getCalls += 1;
        await respond(route, { success: true, data: [SAMPLE_ADMIN] });
        return;
      }
      await respond(route, { success: true, data: null });
    });

    await openAdminManagement(page);
    expect(getCalls).toBe(1);

    await page.getByRole('button', { name: 'Create Admin' }).first().click();
    await page.getByPlaceholder('admin@example.com').fill('new-admin@example.com');
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: 'Create Admin' }).last().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Success' })).toBeVisible();
    await expect(
      dialog.getByText('Admin account created successfully!'),
    ).toBeVisible();

    // Information mode focuses its single OK action and has no Cancel.
    await expect(dialog.getByRole('button', { name: 'OK' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0);

    // No refresh may run while the success dialog is still open.
    await page.waitForTimeout(400);
    expect(getCalls).toBe(1);

    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => getCalls).toBe(2);
  });

  test('refresh error appears only after acknowledging success', async ({
    page,
  }) => {
    let getCalls = 0;
    await page.route(ADMINS_ENDPOINT, async (route) => {
      if (route.request().method() === 'GET') {
        getCalls += 1;
        if (getCalls === 1) {
          await respond(route, { success: true, data: [SAMPLE_ADMIN] });
          return;
        }
        await respond(route, { success: false, error: 'Refresh failed' }, 500);
        return;
      }
      await respond(route, { success: true, data: null });
    });

    await openAdminManagement(page);

    await page.getByRole('button', { name: 'Create Admin' }).first().click();
    await page.getByPlaceholder('admin@example.com').fill('new-admin@example.com');
    await page.locator('input[type="password"]').fill('Password123!');
    await page.getByRole('button', { name: 'Create Admin' }).last().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Success' })).toBeVisible();

    // The refresh error must not replace the unacknowledged success dialog.
    await page.waitForTimeout(400);
    await expect(dialog.getByRole('heading', { name: 'Success' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Error' })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(dialog.getByRole('heading', { name: 'Error' })).toBeVisible();
    await expect(
      dialog.getByText('Failed to fetch admins: Refresh failed'),
    ).toBeVisible();
  });
});
