import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// E2E fixtures use the same local backend configuration as the application.
// dotenv stays quiet so credentials can never leak into test output.
dotenv.config({ path: 'backend/.env', quiet: true });
dotenv.config({ path: 'backend/.env.integration', quiet: true });

const backendPort = process.env.E2E_BACKEND_PORT ?? '3100';
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '5174';
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
process.env.E2E_API_URL ??= `${backendUrl}/api/v1`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm.cmd run dev --workspace backend',
      url: `${backendUrl}/api/v1/health`,
      env: {
        ...process.env,
        PORT: backendPort,
        FRONTEND_URL: frontendUrl,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm.cmd run dev --workspace frontend -- --host 127.0.0.1 --port ${frontendPort}`,
      url: frontendUrl,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `${backendUrl}/api/v1`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
