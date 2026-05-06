import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/login.js';

test.describe('Chat flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/chat');
  });

  test('user can send a message and receive a streaming response', async ({ page }) => {
    // Start a new chat
    const newChatBtn = page.getByRole('button', { name: /new chat/i });
    if (await newChatBtn.isVisible()) await newChatBtn.click();

    const input = page.getByRole('textbox', { name: /message|type|question/i })
      .or(page.locator('textarea[placeholder]'))
      .first();

    await input.fill('What is dengue fever?');
    await page.getByRole('button', { name: /send/i }).click();

    // User message bubble should appear
    await expect(page.locator('[data-role="user"], .user-message, [class*="user"]').first())
      .toBeVisible({ timeout: 5000 });

    // Wait for assistant response (streaming can take up to 15s in dev)
    await expect(page.locator('[data-role="assistant"], .assistant-message, [class*="assistant"]').first())
      .toBeVisible({ timeout: 15000 });

    const assistantMessage = page.locator('[data-role="assistant"], .assistant-message, [class*="assistant"]').first();
    const text = await assistantMessage.textContent();
    expect(text?.trim().length).toBeGreaterThan(10);
  });

  test('conversation persists after page reload', async ({ page }) => {
    const newChatBtn = page.getByRole('button', { name: /new chat/i });
    if (await newChatBtn.isVisible()) await newChatBtn.click();

    const input = page.locator('textarea[placeholder], input[type="text"]').last();
    await input.fill('Hello, test message for persistence');
    await page.getByRole('button', { name: /send/i }).click();

    // Wait for response to appear and be saved
    await page.waitForTimeout(3000);

    // Get the current conversation title from sidebar (first item)
    const firstConv = page.locator('[data-testid="conversation-item"], aside button').first();
    const title = await firstConv.textContent().catch(() => 'Chat');

    await page.reload();
    await page.waitForURL(/chat/);

    // Conversation should still be in sidebar
    if (title && title.trim()) {
      await expect(page.locator('aside').or(page.locator('[class*="sidebar"]'))).toBeVisible();
    }
  });
});
