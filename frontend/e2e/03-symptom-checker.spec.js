import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/login.js';

test.describe('Symptom checker — 5-step wizard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('user can complete full 5-step symptom check and continue in chat', async ({ page }) => {
    await page.goto('/symptom-checker');

    // Step 1 — Select primary symptoms
    await page.getByText('Fever', { exact: true }).click();
    await page.getByText('Cough', { exact: true }).click();
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2 — Duration & severity
    await page.getByText('2-3 days', { exact: true }).click();
    // Severity slider: find and set to ~6 (may vary by implementation)
    const slider = page.locator('input[type="range"]');
    if (await slider.isVisible()) {
      await slider.evaluate((el) => {
        el.value = '6';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3 — Associated symptoms (select "None of these")
    const noneBtn = page.getByText(/none of these/i);
    if (await noneBtn.isVisible({ timeout: 5000 })) await noneBtn.click();
    await page.getByRole('button', { name: /next/i }).click();

    // Step 4 — Health profile snapshot
    await page.getByRole('button', { name: /next/i }).click();

    // Step 5 — Result (wait up to 10s for AI response)
    await expect(page.locator('[data-testid="risk-badge"], .risk-badge, [class*="risk"]').first())
      .toBeVisible({ timeout: 15000 });

    // "Continue in Chat" button should be visible
    const continueBtn = page.getByRole('button', { name: /continue in chat/i });
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await continueBtn.click();

    // Should redirect to /chat
    await expect(page).toHaveURL(/chat/, { timeout: 10000 });
  });
});
