import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('runtime hooks shared core', () => {
  it('provides shared emit/skip/error helpers and a reusable inject core', async () => {
    const corePath = path.join(root, '_bmad', 'runtime', 'hooks', 'runtime-policy-inject-core.cjs');
    const runEmitPath = path.join(root, '_bmad', 'runtime', 'hooks', 'run-emit-runtime-policy.cjs');
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
    const { runEmitRuntimePolicy } = require(runEmitPath);

    expect(typeof runtimePolicyInjectCore).toBe('function');
    expect(typeof shouldSkipRuntimePolicy).toBe('function');
    expect(typeof buildRuntimeErrorMessage).toBe('function');
    expect(typeof runEmitRuntimePolicy).toBe('function');

    expect(shouldSkipRuntimePolicy({ cursorHost: true, root: path.join(root, '..', 'not-bmad') })).toBe(true);
    expect(buildRuntimeErrorMessage({ stderr: 'x', stdout: '' })).toContain('[emit-runtime-policy FAILED]');
  });
});
