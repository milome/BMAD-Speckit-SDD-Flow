import { configDefaults, defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { preflightArchitectureWaveSelectors, preflightCmd31Selectors } = require(
  './tests/contract-command-selector-preflight.cjs'
);

preflightArchitectureWaveSelectors({
  root: process.cwd(),
  argv: process.argv,
});
preflightCmd31Selectors({
  root: process.cwd(),
  argv: process.argv,
});

const explicitArgs = new Set(process.argv.map((arg) => arg.replace(/\\/g, '/')));
const consumerInstallFinalTests = [
  'tests/acceptance/accept-install-consumer-cli.test.ts',
  'tests/acceptance/accept-pack-bmad-speckit.test.ts',
  'tests/acceptance/accept-root-package-bmad-speckit-bin.test.ts',
  'tests/acceptance/accept-consumer-governance-zero-scripts.test.ts',
  'tests/acceptance/main-agent-dist-consumer-runtime.test.ts',
];
const explicitlyRequested = (file: string) =>
  explicitArgs.has(file) || [...explicitArgs].some((arg) => arg.endsWith(`/${file}`));

/** Exclude bmad-speckit tests (use node:test); they run via test:bmad-speckit, invoked after vitest in npm test */
export default defineConfig({
  test: {
    setupFiles: ['tests/register-package-ts-source.cjs'],
    exclude: [
      ...configDefaults.exclude,
      'packages/bmad-speckit/tests/**/*',
      // Generated dist artifacts are validated by package runtime/replay gates after build.
      // Maintained source under packages/bmad-speckit/src remains linted and must be fixed at source.
      'packages/bmad-speckit/dist/**/*',
      '.worktrees/**/*',
      '.codex-tmp/**/*',
      // Real wall-clock long-run evidence must be executed explicitly, not by default CI aggregation.
      'tests/acceptance/main-agent-long-run-soak-wall-clock.test.ts',
      // Consumer install/package final-state tests stay out of default discovery,
      // but exact file commands must still be runnable for contract evidence.
      ...consumerInstallFinalTests.filter((file) => !explicitlyRequested(file)),
    ],
    /** Reduce flaky timeout failures for integration tests (parse-and-write, dashboard-epic-aggregate, hash) */
    testTimeout: 20000,
    /** Several acceptance files rebuild repo-global dist/pack/registry artifacts; file-level parallelism corrupts those proofs. */
    fileParallelism: false,
  },
});
