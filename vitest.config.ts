import { configDefaults, defineConfig } from 'vitest/config';
/** Exclude bmad-speckit tests (use node:test); they run via test:bmad-speckit, invoked after vitest in npm test */
export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      'packages/bmad-speckit/tests/**/*',
      // Source errors must be fixed at source; root Vitest only skips generated dist artifacts.
      // The package runtime/replay gates validate these artifacts after build.
      'packages/bmad-speckit/dist/**/*',
      '.worktrees/**/*',
      // Real wall-clock long-run evidence must be executed explicitly, not by default CI aggregation.
      'tests/acceptance/main-agent-long-run-soak-wall-clock.test.ts',
    ],
    /** Reduce flaky timeout failures for integration tests (parse-and-write, dashboard-epic-aggregate, hash) */
    testTimeout: 20000,
    /** Heavy npm pack/install and detached-worker acceptance tests are unstable under high parallelism on Windows. */
    maxWorkers: 2,
  },
});
