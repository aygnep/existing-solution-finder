import { expect, test } from '@playwright/test';

test('runs a real-mode discovery and keeps provider state visible', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Describe the problem').fill('reasoning_content error with Claude Code');
  await page.getByRole('button', { name: 'Search solutions' }).click();

  await expect(page.locator('[aria-label="Provider status"]')).toBeVisible();
  await expect(page.getByText(/GitHub：/)).toBeVisible();
});
