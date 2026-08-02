const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

describe('canonical Kernel typecheck contract', () => {
  it('keeps strict typecheck on typed production roots and explicit type contracts', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'tsconfig.json'), 'utf8')
    );

    assert.equal(tsconfig.compilerOptions.strict, true);
    assert.deepEqual(tsconfig.include, [
      'packages/scoring/**/*.ts',
      'scripts/**/*.d.cts',
      'tests/typecheck/**/*.ts',
    ]);
    assert.deepEqual(tsconfig.exclude, [
      'node_modules',
      'dist',
      'packages/scoring/**/__tests__/**',
      'packages/scoring/**/*.test.ts',
      'packages/scoring/**/*.spec.ts',
    ]);
  });
});
