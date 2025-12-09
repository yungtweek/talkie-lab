/// <reference types="@playwright/test" />
import { expect, test } from '@playwright/test';

test.describe('Home page', () => {
  test('renders README content', async ({ page }) => {
    await page.route('**/api/auth/session', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      }),
    );

    await page.goto('/');

    await expect(page.getByRole('heading', { name: '🧪 Talkie-Lab' })).toBeVisible();
    await expect(page.getByText('Next.js 16 + React 19 workspace')).toBeVisible();
  });
});
