import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: { timeout: 60000 },
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: {
    command: 'npm run build && npm run web:dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
  },
});
