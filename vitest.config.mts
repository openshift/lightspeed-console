import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['unit-tests/**/*.test.ts'],
    // Limit the number of workers to avoid OOM errors in CI
    maxWorkers: 8,
  },
});
