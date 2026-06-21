import { configDefaults, defineConfig } from 'vitest/config';
/** Exclude bmad-speckit tests (use node:test); they run via test:bmad-speckit, invoked after vitest in npm test */
export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      'packages/bmad-speckit/tests/**/*',
      // Generated dist artifacts are validated by package runtime/replay gates after build.
      // Maintained source under packages/bmad-speckit/src remains linted and must be fixed at source.
      'packages/bmad-speckit/dist/**/*',
      '.worktrees/**/*',
      // Real wall-clock long-run evidence must be executed explicitly, not by default CI aggregation.
      'tests/acceptance/main-agent-long-run-soak-wall-clock.test.ts',
    ],
    /** Reduce flaky timeout failures for integration tests (parse-and-write, dashboard-epic-aggregate, hash) */
    testTimeout: 20000,
    /** Several acceptance files rebuild repo-global dist/pack/registry artifacts; file-level parallelism corrupts those proofs. */
    fileParallelism: false,
  },
});
