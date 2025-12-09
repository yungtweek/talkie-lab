/// <reference types="@playwright/test" />
import { expect, test } from '@playwright/test';

test.describe('Chat page', () => {
  test('sends a message and renders stubbed assistant output', async ({ page }) => {
    await page.route('**/api/auth/session', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      }),
    );

    await page.route('**/api/chat', async route => {
      const events = [
        { type: 'init' },
        { type: 'delta', role: 'assistant', content: 'stubbed ' },
        { type: 'complete', outputText: 'stubbed response' },
      ];

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: events.map(evt => JSON.stringify(evt)).join('\n'),
      });
    });

    await page.goto('/chat');
    await page.getByPlaceholder('Ask, Search or Chat...').fill('hello world');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('hello world')).toBeVisible();
    await expect(page.getByText('stubbed response')).toBeVisible();
  });
});
