import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:  './e2e',
  timeout:  30000,
  retries:  process.env.CI ? 1 : 0,
  workers:  process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { outputFolder: 'playwright-report' }], ['list']] : 'list',

  use: {
    baseURL:       process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    headless:      true,
    screenshot:    'only-on-failure',
    video:         'retain-on-failure',
    trace:         'retain-on-failure',
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],
});
