import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/acceptance/main-agent-long-run-soak-wall-clock.test.ts'],
    testTimeout: 20000,
    maxWorkers: 1,
  },
});
