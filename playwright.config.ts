import * as fs from 'fs';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:9000';
const authStateFile = 'tests/.auth/state.json';
const hasGlobalSetup = !process.env.SKIP_OLS_SETUP;
const storageState = hasGlobalSetup || fs.existsSync(authStateFile) ? authStateFile : undefined;

if (!storageState) {
  // eslint-disable-next-line no-console
  console.warn(
    `Warning: Auth state file "${authStateFile}" not found. Tests will run without stored authentication.`,
  );
}

export default defineConfig({
  testDir: './tests/tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'gui_test_screenshots/playwright-report' }],
    ['junit', { outputFile: 'gui_test_screenshots/junit_playwright.xml' }],
  ],
  outputDir: 'gui_test_screenshots/test-results',
  globalSetup: process.env.SKIP_OLS_SETUP ? undefined : './tests/support/global-setup.ts',
  globalTeardown: process.env.SKIP_OLS_SETUP ? undefined : './tests/support/global-teardown.ts',
  use: {
    baseURL,
    storageState,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1080 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
