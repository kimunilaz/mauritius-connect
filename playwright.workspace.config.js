import { defineConfig, devices } from '@playwright/test';

// Isolated UI checks: every Auth/API response is a fixture, with no hosted writes.
export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'workspace.spec.js',
    'color-system.spec.js',
    'operations.spec.js',
    'agents.spec.js',
  ],
  outputDir: 'test-results/workspace',
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5180',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    cwd: './frontend',
    command:
      'node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
    env: {
      VITE_API_BASE_URL: 'http://127.0.0.1:5180/api/v1',
      VITE_SUPABASE_URL: 'https://workspace-qa.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'workspace-ui-fixture-key',
    },
  },
});
