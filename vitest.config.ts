import { configDefaults, defineConfig } from 'vitest/config';

/** Exclude bmad-speckit tests (use node:test); they run via test:bmad-speckit, invoked after vitest in npm test */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'packages/bmad-speckit/tests/**/*', '.worktrees/**/*'],
    /** Reduce flaky timeout failures for integration tests (parse-and-write, dashboard-epic-aggregate, hash) */
    testTimeout: 20000,
  },
});
