import { expect, test } from '@playwright/test';

test('runs mock discovery and selects a sourced solution', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Describe the problem').fill('reasoning_content error with Claude Code');
  await page.getByRole('button', { name: 'Create search plan' }).click();
  await page.getByRole('button', { name: 'Run discovery' }).click();

  await expect(page.getByRole('heading', { name: 'oc-go-cc' })).toBeVisible();
  const ocGoCard = page.locator('article').filter({ has: page.getByRole('heading', { name: 'oc-go-cc' }) });
  await expect(ocGoCard.getByRole('heading', { name: 'Evidence' })).toBeVisible();
  await page.getByLabel(/Select oc-go-cc/).check();
  await expect(page.getByText('Exports retain selected evidence and safety warnings.')).toBeVisible();
});
