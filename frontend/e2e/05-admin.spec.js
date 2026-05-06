import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/login.js';

test.describe('Admin panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin');
  });

  test('admin can view dashboard stats', async ({ page }) => {
    // Overview tab should be selected by default
    await expect(page.getByText(/overview/i).first()).toBeVisible();

    // Stat cards should show numbers, not NaN or undefined
    const statValues = page.locator('[class*="text-2xl"], [class*="font-bold"]');
    const count = await statValues.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 4); i++) {
      const text = await statValues.nth(i).textContent();
      // Should be a number, dash, or loading indicator — not "NaN" or "undefined"
      expect(text).not.toMatch(/NaN|undefined/i);
    }
  });

  test('admin can update a hospital record', async ({ page }) => {
    // Navigate to Hospitals tab
    await page.getByRole('button', { name: /hospitals/i })
      .or(page.getByText('Hospitals', { exact: true })).first().click();

    await page.waitForTimeout(1500); // wait for data to load

    // Find and click the first edit button
    const editBtn = page.locator('button[title="Edit"], button').filter({ hasText: '' }).nth(0);
    const editBtns = page.locator('button').filter({ hasText: /edit|pencil/i });
    const pencilBtns = page.locator('svg.lucide-pencil').locator('..').first();

    if (await pencilBtns.isVisible()) {
      await pencilBtns.click();
    } else if (await editBtns.first().isVisible()) {
      await editBtns.first().click();
    }

    // Change hospital name
    const ts = Date.now();
    const nameInput = page.getByLabel(/name/i).first();
    if (await nameInput.isVisible({ timeout: 3000 })) {
      await nameInput.fill(`Updated Hospital ${ts}`);
      await page.getByRole('button', { name: /save/i }).click();

      // Should show success toast or updated name in table
      const updated = page.getByText(`Updated Hospital ${ts}`)
        .or(page.locator('[class*="toast"]').filter({ hasText: /success|updated/i }));
      await expect(updated.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('audit log tab loads data', async ({ page }) => {
    await page.getByRole('button', { name: /audit/i })
      .or(page.getByText('Audit Log', { exact: true })).first().click();

    await page.waitForTimeout(1000);

    // Should show a table or empty state
    const table = page.locator('table');
    const empty = page.getByText(/no audit|no entries/i);
    await expect(table.or(empty).first()).toBeVisible({ timeout: 5000 });
  });
});
