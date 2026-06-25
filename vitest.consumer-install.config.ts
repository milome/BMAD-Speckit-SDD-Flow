import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/register-package-ts-source.cjs'],
    exclude: [
      ...configDefaults.exclude,
      'packages/bmad-speckit/tests/**/*',
      'packages/bmad-speckit/dist/**/*',
      '.worktrees/**/*',
    ],
    fileParallelism: false,
    testTimeout: 900_000,
  },
});
