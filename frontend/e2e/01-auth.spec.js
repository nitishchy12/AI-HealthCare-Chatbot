import { test, expect } from '@playwright/test';

test.describe('Authentication flows', () => {
  test('user can register with email and password', async ({ page }) => {
    const ts = Date.now();
    await page.goto('/register');

    await page.getByLabel(/first name/i).fill('Test');
    await page.getByLabel(/last name/i).fill('User');
    await page.getByLabel(/email/i).fill(`test+${ts}@example.com`);
    // Some forms use a single password field and a confirm field
    const passwordFields = page.getByLabel(/password/i);
    await passwordFields.first().fill('TestPass123!');
    if (await passwordFields.count() > 1) {
      await passwordFields.nth(1).fill('TestPass123!');
    }
    await page.getByRole('button', { name: /register/i }).click();

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    // Avatar or user initials in navbar
    const navbar = page.getByRole('navigation');
    await expect(navbar).toBeVisible();
  });

  test('invalid login shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nobody@does-not-exist.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    // Error toast or inline error should appear
    const error = page.locator('[role="alert"], .text-danger, .text-red-500').first();
    await expect(error).toBeVisible({ timeout: 6000 });
    await expect(page).toHaveURL(/login/);
  });
});
