import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4174' },
  webServer: {
    command: 'npm run build && npm run web:start',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
});
