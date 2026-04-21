import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const runEmitPath = path.join(root, '_bmad', 'runtime', 'hooks', 'run-emit-runtime-policy.cjs');

describe('runtime hooks shared core', () => {
  it('provides shared emit/skip/error helpers and a reusable inject core', async () => {
    const corePath = path.join(root, '_bmad', 'runtime', 'hooks', 'runtime-policy-inject-core.cjs');
    const skipPath = path.join(root, '_bmad', 'runtime', 'hooks', 'should-skip-runtime-policy.cjs');
    const errorPath = path.join(root, '_bmad', 'runtime', 'hooks', 'build-runtime-error-message.cjs');

    expect(existsSync(corePath)).toBe(true);
    expect(existsSync(runEmitPath)).toBe(true);
    expect(existsSync(skipPath)).toBe(true);
    expect(existsSync(errorPath)).toBe(true);

    /* eslint-disable @typescript-eslint/no-require-imports */
    const { runtimePolicyInjectCore } = require(corePath);
    const { shouldSkipRuntimePolicy } = require(skipPath);
    const { buildRuntimeErrorMessage } = require(errorPath);
    const { emitCliPath, runEmitRuntimePolicy } = require(runEmitPath);

    expect(typeof runtimePolicyInjectCore).toBe('function');
    expect(typeof shouldSkipRuntimePolicy).toBe('function');
    expect(typeof buildRuntimeErrorMessage).toBe('function');
    expect(typeof emitCliPath).toBe('function');
    expect(typeof runEmitRuntimePolicy).toBe('function');

    expect(shouldSkipRuntimePolicy({ cursorHost: true, root: path.join(root, '..', 'not-bmad') })).toBe(true);
    expect(buildRuntimeErrorMessage({ stderr: 'x', stdout: '' })).toContain('[emit-runtime-policy FAILED]');
  });

  it('prefers deployed hook-local emit launchers over canonical _bmad hook wrappers', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'run-emit-priority-'));
    try {
      mkdirSync(path.join(tempRoot, '_bmad', 'claude', 'hooks'), { recursive: true });
      mkdirSync(path.join(tempRoot, '.claude', 'hooks'), { recursive: true });
      writeFileSync(
        path.join(tempRoot, '_bmad', 'claude', 'hooks', 'emit-runtime-policy-cli.cjs'),
        '// canonical wrapper',
        'utf8'
      );
      writeFileSync(
        path.join(tempRoot, '.claude', 'hooks', 'emit-runtime-policy-cli.cjs'),
        '// deployed wrapper',
        'utf8'
      );

      /* eslint-disable @typescript-eslint/no-require-imports */
      const { emitCliPath } = require(runEmitPath);
      expect(emitCliPath(tempRoot).replace(/\\/g, '/')).toBe(
        path.join(tempRoot, '.claude', 'hooks', 'emit-runtime-policy-cli.cjs').replace(/\\/g, '/')
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
