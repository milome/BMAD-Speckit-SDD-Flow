import { defineConfig } from 'vitest/config';

/** Scoring package vitest config — run tests independently from package dir */
export default defineConfig({
  test: {
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
