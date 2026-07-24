import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/runner-only.check.ts'],
    exclude: ['tests/candidate-only.test.ts'],
  },
});
