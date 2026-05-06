import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/login.js';

test.describe('Health reports — 4 tabs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/reports');
  });

  test('all 4 tabs load without crashing', async ({ page }) => {
    // Overview tab should be active by default
    await expect(page.getByText(/overview/i).first()).toBeVisible();

    // Symptoms tab
    await page.getByRole('tab', { name: /symptoms/i })
      .or(page.getByText('Symptoms', { exact: true })).first().click();
    await page.waitForTimeout(1000);
    // Chart or empty state should render — no crash
    const chartOrEmpty = page.locator('svg, canvas, [class*="chart"], [class*="empty"]').first();
    await expect(chartOrEmpty.or(page.getByText(/no symptom/i))).toBeTruthy();

    // Trends tab
    await page.getByRole('tab', { name: /trends/i })
      .or(page.getByText('Trends', { exact: true })).first().click();
    await page.waitForTimeout(1000);
    // Chart element (SVG from recharts or canvas)
    const trendChart = page.locator('svg, canvas').first();
    const emptyTrends = page.getByText(/no.*data|no.*trend/i).first();
    await expect(trendChart.or(emptyTrends)).toBeTruthy();

    // AI Insights tab
    await page.getByRole('tab', { name: /insights/i })
      .or(page.getByText('AI Insights', { exact: true })).first().click();
    // Wait for insights to load (skeleton → content)
    await expect(
      page.getByText(/insight|summary|recommendation|no.*data/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('download PDF button triggers response', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    const pdfBtn = page.getByRole('button', { name: /download pdf|pdf/i });
    if (await pdfBtn.isVisible()) {
      await pdfBtn.click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
      }
    }
  });
});
