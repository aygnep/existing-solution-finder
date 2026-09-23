import { expect, test } from '@playwright/test';
import type { DiscoveryResult } from '../src/types/discovery';

const deterministicResult = {
  request: { problem: 'reasoning_content error with Claude Code', stack: [], constraints: [], providers: ['github', 'npm', 'web'], mode: 'real', maxResults: 10 },
  parsedProblem: { raw: 'reasoning_content error with Claude Code', errorTokens: [], stackNames: [], versions: [], constraints: [], keywords: ['reasoning_content', 'Claude Code'] },
  searchPlan: [{ query: 'reasoning_content error with Claude Code', category: 'exact-error', providers: ['github', 'npm', 'web'] }],
  providerStatus: [
    { provider: 'github', state: 'complete', resultCount: 1 },
    { provider: 'npm', state: 'empty', resultCount: 0 },
    { provider: 'web', state: 'skipped', resultCount: 0, message: 'Not configured' },
  ],
  candidates: [],
  completedAt: '2026-08-28T00:00:00.000Z',
} satisfies DiscoveryResult;

test('shows loading and provider state with a deterministic gateway response', async ({ page }) => {
  await page.route('**/api/discover', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: deterministicResult });
  });
  await page.goto('/');
  await page.getByLabel('Describe the problem').fill('reasoning_content error with Claude Code');
  const request = page.waitForRequest('**/api/discover');
  await page.getByRole('button', { name: 'Search solutions' }).click();

  await expect(page.getByRole('status')).toContainText('Searching providers');
  await expect(page.getByLabel('Describe the problem')).toBeDisabled();
  await expect(page.locator('[aria-label="Provider status"]')).toBeVisible();
  await expect(page.getByText(/GitHub：/)).toBeVisible();
  expect((await request).postDataJSON()).toMatchObject({ mode: 'real' });
});

test('makes Jev an explicit browser opt-in and shows fallback state', async ({ page }) => {
  await page.route('**/api/discover', async (route) => {
    await route.fulfill({ json: {
      ...deterministicResult,
      request: { ...deterministicResult.request, reranker: 'jev' },
      reranking: { provider: 'jev', state: 'skipped', evaluatedCount: 0, message: 'TYPESAFE_API_KEY is not configured; rule ranking was retained.' },
      handoff: [],
    } });
  });
  await page.goto('/');
  await page.getByLabel('Describe the problem').fill('reasoning_content error with Claude Code');
  await page.getByLabel('Use Jev to rerank the handoff').check();
  const request = page.waitForRequest('**/api/discover');
  await page.getByRole('button', { name: 'Search solutions' }).click();

  expect((await request).postDataJSON()).toMatchObject({ reranker: 'jev' });
  await expect(page.getByText(/Jev: skipped/)).toBeVisible();
});

test('real-provider smoke returns provider state', async ({ page }) => {
  test.skip(process.env.FIXSEEK_REAL_E2E !== '1', 'Set FIXSEEK_REAL_E2E=1 to run the external-provider smoke test.');
  test.setTimeout(240_000);

  await page.goto('/');
  await page.getByLabel('Describe the problem').fill('reasoning_content error with Claude Code');
  await page.getByRole('button', { name: 'Search solutions' }).click();

  await expect(page.getByRole('status')).toContainText('Searching providers');
  await expect(page.locator('[aria-label="Provider status"]')).toBeVisible({ timeout: 210_000 });
  await expect(page.getByText(/GitHub：/)).toBeVisible();
});
