import { configDefaults, defineConfig } from 'vitest/config';

/** Exclude bmad-speckit tests that use node:test (node --test) - run via `cd packages/bmad-speckit && npm test` */
export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      'packages/bmad-speckit/tests/**/*',
    ],
  },
});
