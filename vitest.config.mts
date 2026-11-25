import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@openshift-console/dynamic-plugin-sdk': fileURLToPath(
        new URL('./unit-tests/__mocks__/dynamic-plugin-sdk.ts', import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      exclude: ['unit-tests/**'],
      include: ['src/**/*.{ts,tsx}'],
      provider: 'v8',
      reporter: ['text', 'cobertura'],
      reportsDirectory: './coverage',
    },
    environment: 'node',
    // Testing Library only cleans up the DOM after each test automatically when globals are on
    globals: true,
    include: ['unit-tests/**/*.test.{ts,tsx}'],
    // Limit the number of workers to avoid OOM errors in CI
    maxWorkers: 8,
    setupFiles: ['./unit-tests/setup.ts'],
  },
});
