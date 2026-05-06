/**
 * Shared login helper for E2E tests.
 * Uses environment variables so credentials are not hard-coded in test files.
 */

export const TEST_USER_EMAIL    = process.env.E2E_USER_EMAIL    || 'demo@healthguide.app';
export const TEST_USER_PASSWORD = process.env.E2E_USER_PASSWORD || 'Demo1234!';
export const TEST_ADMIN_EMAIL   = process.env.E2E_ADMIN_EMAIL   || 'admin@healthguide.app';
export const TEST_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin1234!';

export async function loginAs(page, email, password) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/dashboard|chat/, { timeout: 10000 });
}

export async function loginAsUser(page) {
  return loginAs(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
}

export async function loginAsAdmin(page) {
  return loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
}
