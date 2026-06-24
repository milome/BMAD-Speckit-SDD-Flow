import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
