import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { implementationReadinessGateAction } from '../../packages/bmad-speckit/src/main-agent/actions/implementation-readiness-gate';
import { produceImplementationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-implementation-readiness-gate';
import * as controlStore from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-control-store';
import { assertRuntimeBuildAuthorityCurrent } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-build-authority';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  materializeImplementationReadinessFixture,
  readinessActionContext,
} from '../helpers/implementation-readiness-fixture';

function snapshot(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const target = path.join(current, name);
      const relative = path.relative(root, target).replace(/\\/gu, '/');
      const stat = statSync(target);
      if (stat.isDirectory()) visit(target);
      else result[relative] = `${stat.mtimeMs}:${readFileSync(target).toString('base64')}`;
    }
  };
  visit(root);
  return result;
}

function waitForExisting(paths: string[], timeoutMs = 10_000): string {
  const waitCell = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = paths.find((candidate) => existsSync(candidate));
    if (found) return found;
    Atomics.wait(waitCell, 0, 0, 10);
  }
  throw new Error(`timed_out_waiting_for:${paths.join(',')}`);
}

const PACKAGE_ROOT = path.join(process.cwd(), 'packages', 'bmad-speckit');
const DIST_READINESS_MODULE = path.join(
  PACKAGE_ROOT,
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'main-agent-implementation-readiness-gate.js'
);

function assertCurrentDistBuild(): void {
  const receiptPath = path.join(
    PACKAGE_ROOT,
    'dist',
    'main-agent',
    'runtime-build-authority-receipt.json'
  );
  assertRuntimeBuildAuthorityCurrent({
    receipt: JSON.parse(readFileSync(receiptPath, 'utf8')),
    packageRoot: PACKAGE_ROOT,
    runtimeAssetManifestPath: path.join(
      PACKAGE_ROOT,
      'dist',
      'main-agent',
      'runtime-asset-manifest.json'
    ),
    buildScriptPath: path.join(PACKAGE_ROOT, 'scripts', 'build-main-agent-dist.cjs'),
    dependencyLockPath: path.join(process.cwd(), 'package-lock.json'),
  });
}

assertCurrentDistBuild();

describe('Main Agent implementation readiness replay and recovery', () => {
  it('reuses a published aggregate with zero command execution and zero writes', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const first = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;
      const bundleRoot = path.dirname(
        path.join(fixture.root, ...first.result.candidateRef.path.split('/'))
      );
      const before = snapshot(bundleRoot);
      const second = implementationReadinessGateAction(readinessActionContext(fixture)) as Record<
        string,
        any
      >;

      expect(second).toMatchObject({
        status: 'implementation_readiness_reused',
        exitCode: 0,
        result: {
          status: 'implementation_readiness_reused',
          commandExecutionCount: 0,
          writeCount: 0,
        },
      });
      expect(snapshot(bundleRoot)).toEqual(before);
    } finally {
      fixture.cleanup();
    }
  });

  it('invalidates readiness when an imported RED dependency changes', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'tests/refund-helper.cjs': "module.exports = { expectedStatus: 'accepted' };\n",
      },
    });
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          "const { expectedStatus } = require('./refund-helper.cjs');",
          "// require('./missing-commented-dependency.cjs');",
          'const dependencyExample = "import \'./missing-string-dependency.cjs\'";',
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
          '  void dependencyExample;',
          `  assert.equal(refundStatus(), expectedStatus, '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        path.join(fixture.root, 'tests', 'refund-helper.cjs'),
        "module.exports = { expectedStatus: 'accepted', revision: 2 };\n",
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
      expect(second.implementationReadinessCandidateHash).not.toBe(
        first.implementationReadinessCandidateHash
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('invalidates readiness when a package imports alias dependency changes', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'tests/refund-helper.cjs': "module.exports = { expectedStatus: 'accepted' };\n",
      },
    });
    try {
      writeFileSync(
        fixture.configPath,
        JSON.stringify(
          {
            name: 'readiness-fixture',
            private: true,
            version: '1.0.0',
            imports: { '#refund-helper': './tests/refund-helper.cjs' },
          },
          null,
          2
        ) + '\n',
        'utf8'
      );
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          "const { expectedStatus } = require('#refund-helper');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
          `  assert.equal(refundStatus(), expectedStatus, '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        path.join(fixture.root, 'tests', 'refund-helper.cjs'),
        "module.exports = { expectedStatus: 'accepted', revision: 2 };\n",
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it('invalidates readiness when a conditional package imports dependency changes', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'tests/import-esm.mjs': "export const expectedStatus = 'accepted';\n",
        'tests/import-cjs.cjs': "module.exports = { expectedStatus: 'accepted' };\n",
      },
    });
    try {
      writeFileSync(
        fixture.configPath,
        `${JSON.stringify(
          {
            name: 'readiness-fixture',
            private: true,
            version: '1.0.0',
            imports: {
              '#refund-helper': {
                import: './tests/import-esm.mjs',
                require: './tests/import-cjs.cjs',
              },
            },
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', async () => {`,
          "  const { expectedStatus } = await import('#refund-helper');",
          `  assert.equal(refundStatus(), expectedStatus, '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        path.join(fixture.root, 'tests', 'import-esm.mjs'),
        "export const expectedStatus = 'accepted'; export const revision = 2;\n",
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it('invalidates readiness when an external conditional imports target changes', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'node_modules/esm-helper/package.json': `${JSON.stringify(
          { name: 'esm-helper', version: '1.0.0', type: 'module', main: './index.mjs' },
          null,
          2
        )}\n`,
        'node_modules/esm-helper/index.mjs': "export const expectedStatus = 'accepted';\n",
        'node_modules/cjs-helper/package.json': `${JSON.stringify(
          { name: 'cjs-helper', version: '1.0.0', main: './index.cjs' },
          null,
          2
        )}\n`,
        'node_modules/cjs-helper/index.cjs': "module.exports = { expectedStatus: 'accepted' };\n",
        'tests/node_modules/esm-helper/package.json': `${JSON.stringify(
          { name: 'esm-helper', version: '9.0.0', type: 'module', main: './index.mjs' },
          null,
          2
        )}\n`,
        'tests/node_modules/esm-helper/index.mjs':
          "export const expectedStatus = 'accepted'; export const shadow = true;\n",
      },
    });
    try {
      writeFileSync(
        fixture.configPath,
        `${JSON.stringify(
          {
            name: 'readiness-fixture',
            private: true,
            version: '1.0.0',
            imports: {
              '#refund-helper': { import: 'esm-helper', require: 'cjs-helper' },
            },
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', async () => {`,
          "  const { expectedStatus } = await import('#refund-helper');",
          `  assert.equal(refundStatus(), expectedStatus, '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        path.join(fixture.root, 'node_modules', 'esm-helper', 'index.mjs'),
        "export const expectedStatus = 'accepted'; export const revision = 2;\n",
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it('invalidates readiness when a package self-reference dependency changes', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'tests/refund-helper.cjs': "module.exports = { expectedStatus: 'accepted' };\n",
      },
    });
    try {
      writeFileSync(
        fixture.configPath,
        `${JSON.stringify(
          {
            name: 'readiness-fixture',
            private: true,
            version: '1.0.0',
            exports: { './refund-helper': './tests/refund-helper.cjs' },
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          "const { expectedStatus } = require('readiness-fixture/refund-helper');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
          `  assert.equal(refundStatus(), expectedStatus, '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        path.join(fixture.root, 'tests', 'refund-helper.cjs'),
        "module.exports = { expectedStatus: 'accepted', revision: 2 };\n",
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it('invalidates readiness when a conditional exports import dependency changes', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'node_modules/dual-pkg/package.json': `${JSON.stringify(
          {
            name: 'dual-pkg',
            version: '1.0.0',
            exports: { '.': { import: './esm.mjs', require: './require/cjs.cjs' } },
          },
          null,
          2
        )}\n`,
        'node_modules/dual-pkg/esm.mjs': "export const expectedStatus = 'accepted';\n",
        'node_modules/dual-pkg/require/package.json': `${JSON.stringify(
          {
            name: 'dual-pkg',
            version: '9.0.0',
            exports: { '.': { import: './decoy.mjs', require: './cjs.cjs' } },
          },
          null,
          2
        )}\n`,
        'node_modules/dual-pkg/require/decoy.mjs':
          "export const expectedStatus = 'accepted'; export const shadow = true;\n",
        'node_modules/dual-pkg/require/cjs.cjs':
          "module.exports = { expectedStatus: 'accepted' };\n",
      },
    });
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', async () => {`,
          "  const { expectedStatus } = await import('dual-pkg');",
          `  assert.equal(refundStatus(), expectedStatus, '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        path.join(fixture.root, 'node_modules', 'dual-pkg', 'esm.mjs'),
        "export const expectedStatus = 'accepted'; export const revision = 2;\n",
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it('uses the nearest conditional exports package instance', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'node_modules/z/package.json': `${JSON.stringify(
          { name: 'z', version: '1.0.0', main: './index.cjs' },
          null,
          2
        )}\n`,
        'node_modules/z/index.cjs':
          "module.exports = { expectedStatus: async () => (await import('dep')).expectedStatus };\n",
        'node_modules/dep/package.json': `${JSON.stringify(
          {
            name: 'dep',
            version: '1.0.0',
            exports: { '.': { import: './esm.mjs', require: './cjs.cjs' } },
          },
          null,
          2
        )}\n`,
        'node_modules/dep/esm.mjs': "export const expectedStatus = 'accepted';\n",
        'node_modules/dep/cjs.cjs': "module.exports = { expectedStatus: 'accepted' };\n",
        'node_modules/z/node_modules/dep/package.json': `${JSON.stringify(
          {
            name: 'dep',
            version: '2.0.0',
            exports: { '.': { import: './esm.mjs', require: './cjs.cjs' } },
          },
          null,
          2
        )}\n`,
        'node_modules/z/node_modules/dep/esm.mjs': "export const expectedStatus = 'accepted';\n",
        'node_modules/z/node_modules/dep/cjs.cjs':
          "module.exports = { expectedStatus: 'accepted' };\n",
      },
    });
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          "const { expectedStatus } = require('z');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', async () => {`,
          `  assert.equal(refundStatus(), await expectedStatus(), '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        path.join(fixture.root, 'node_modules', 'z', 'node_modules', 'dep', 'esm.mjs'),
        "export const expectedStatus = 'accepted'; export const revision = 2;\n",
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it('does not use an outer same-name package as nested self-reference', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'outer.mjs': "export const expectedStatus = 'accepted';\n",
        'node_modules/z/package.json': `${JSON.stringify(
          { name: 'z', version: '1.0.0', main: './index.cjs' },
          null,
          2
        )}\n`,
        'node_modules/z/index.cjs':
          "module.exports = { expectedStatus: async () => (await import('dep')).expectedStatus };\n",
        'node_modules/z/node_modules/dep/package.json': `${JSON.stringify(
          {
            name: 'dep',
            version: '2.0.0',
            exports: { '.': { import: './esm.mjs' } },
          },
          null,
          2
        )}\n`,
        'node_modules/z/node_modules/dep/esm.mjs': "export const expectedStatus = 'accepted';\n",
      },
    });
    try {
      writeFileSync(
        fixture.configPath,
        `${JSON.stringify(
          {
            name: 'dep',
            private: true,
            version: '1.0.0',
            exports: { '.': { import: './outer.mjs' } },
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          "const { expectedStatus } = require('z');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', async () => {`,
          `  assert.equal(refundStatus(), await expectedStatus(), '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        path.join(fixture.root, 'node_modules', 'z', 'node_modules', 'dep', 'esm.mjs'),
        "export const expectedStatus = 'accepted'; export const revision = 2;\n",
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it('allows Bun builtins for a Bun readiness command', () => {
    const fixture = materializeImplementationReadinessFixture({
      invocation: 'bun test tests/refund-worker.test.cjs',
    });
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const fs = require('fs');",
          "if (false) require('bun');",
          "if (false) require('bun:test');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
          '  void fs;',
          `  assert.equal(refundStatus(), 'accepted', '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );

      expect(
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            runCommand: (command) => ({
              status: 1,
              signal: null,
              stdout: [
                'TAP version 13',
                `not ok 1 - ${command.commandIds.join(' ')}`,
                '  ---',
                `  error: ${fixture.oracle}`,
                '  ...',
                '1..1',
                '',
              ].join('\n'),
              stderr: '',
            }),
          }
        )
      ).toMatchObject({ status: 'implementation_readiness_pass' });
    } finally {
      fixture.cleanup();
    }
  });

  it('does not ignore Bun builtins for a Node readiness command', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "if (false) require('bun:test');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
          `  assert.equal(refundStatus(), 'accepted', '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );

      expect(() =>
        produceImplementationReadiness({
          projectRoot: fixture.root,
          requestId: fixture.requestId,
        })
      ).toThrowError('implementation_readiness_input_missing:bun:test');
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    [
      'Node then Bun',
      ['node --test tests/refund-worker.test.cjs', 'bun test tests/refund-worker.test.cjs'],
    ],
    [
      'Bun then Node',
      ['bun test tests/refund-worker.test.cjs', 'node --test tests/refund-worker.test.cjs'],
    ],
  ] as const)('keeps Node fail-closed for a shared test path in %s order', (_case, invocations) => {
    const fixture = materializeImplementationReadinessFixture({
      invocations: [...invocations],
    });
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "if (false) require('bun:test');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
          `  assert.equal(refundStatus(), 'accepted', '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );

      expect(() =>
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            runCommand: (command) => ({
              status: 1,
              signal: null,
              stdout: [
                'TAP version 13',
                `not ok 1 - ${command.commandIds.join(' ')}`,
                '  ---',
                `  error: ${fixture.oracle}`,
                '  ...',
                '1..1',
                '',
              ].join('\n'),
              stderr: '',
            }),
          }
        )
      ).toThrowError('implementation_readiness_input_missing:bun:test');
    } finally {
      fixture.cleanup();
    }
  });

  it('allows Bun builtins in an explicit Bun config dependency graph', () => {
    const fixture = materializeImplementationReadinessFixture({
      invocation: 'bun test --config config/bun.config.ts tests/refund-worker.test.cjs',
      additionalFiles: {
        'config/bun.config.ts': "if (false) require('bun'); export default {};\n",
      },
    });
    try {
      expect(
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            runCommand: (command) => ({
              status: 1,
              signal: null,
              stdout: [
                'TAP version 13',
                `not ok 1 - ${command.commandIds.join(' ')}`,
                '  ---',
                `  error: ${fixture.oracle}`,
                '  ...',
                '1..1',
                '',
              ].join('\n'),
              stderr: '',
            }),
          }
        )
      ).toMatchObject({ status: 'implementation_readiness_pass' });
    } finally {
      fixture.cleanup();
    }
  });

  it('invalidates readiness when a resolved main package descriptor changes', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'node_modules/main-pkg/package.json': `${JSON.stringify(
          {
            name: 'main-pkg',
            version: '1.0.0',
            type: 'commonjs',
            main: './index.js',
          },
          null,
          2
        )}\n`,
        'node_modules/main-pkg/index.js': 'globalThis.__mainPkgLoaded = true;\n',
      },
    });
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', async () => {`,
          "  await import('main-pkg');",
          '  assert.equal(globalThis.__mainPkgLoaded, true);',
          `  assert.equal(refundStatus(), 'accepted', '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        path.join(fixture.root, 'node_modules', 'main-pkg', 'package.json'),
        `${JSON.stringify(
          {
            name: 'main-pkg',
            version: '1.0.0',
            type: 'module',
            main: './index.js',
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it('invalidates readiness for a JSONC tsconfig alias inherited through extends', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'src/refund-helper.cjs': 'module.exports = { revision: 1 };\n',
        'tsconfig.base.json': [
          '{',
          '  // JSONC comment',
          '  "compilerOptions": {',
          '    "baseUrl": ".",',
          '    "paths": { "@app/*": ["src/*"] },',
          '  },',
          '}',
          '',
        ].join('\n'),
      },
    });
    try {
      writeFileSync(
        fixture.configPath,
        `${JSON.stringify(
          {
            name: 'readiness-fixture',
            private: true,
            version: '1.0.0',
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      writeFileSync(
        path.join(fixture.root, 'tsconfig.json'),
        '{ "extends": "./tsconfig.base.json" }\n',
        'utf8'
      );
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          "if (false) require('@app/refund-helper');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
          `  assert.equal(refundStatus(), 'accepted', '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      const firstCandidate = JSON.parse(
        readFileSync(path.join(fixture.root, ...first.candidateRef.path.split('/')), 'utf8')
      );
      expect(
        firstCandidate.inputArtifacts.map((entry: { logicalPath: string }) => entry.logicalPath)
      ).toEqual(expect.arrayContaining(['src/refund-helper.cjs', 'tsconfig.base.json']));
      writeFileSync(
        path.join(fixture.root, 'src', 'refund-helper.cjs'),
        'module.exports = { revision: 2 };\n',
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it('invalidates readiness for a bare module resolved through pure tsconfig baseUrl', () => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'src/refund-helper.cjs': 'module.exports = { revision: 1 };\n',
        'tsconfig.json': '{ "compilerOptions": { "baseUrl": "." } }\n',
      },
    });
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          "if (false) require('src/refund-helper.cjs');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
          `  assert.equal(refundStatus(), 'accepted', '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      const firstCandidate = JSON.parse(
        readFileSync(path.join(fixture.root, ...first.candidateRef.path.split('/')), 'utf8')
      );
      expect(
        firstCandidate.inputArtifacts.map((entry: { logicalPath: string }) => entry.logicalPath)
      ).toContain('src/refund-helper.cjs');
      writeFileSync(
        path.join(fixture.root, 'src', 'refund-helper.cjs'),
        'module.exports = { revision: 2 };\n',
        'utf8'
      );

      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;

      expect(second.status).toBe('implementation_readiness_pass');
      expect(second.commandExecutionCount).toBe(1);
      expect(second.readinessScopedInputDigest).not.toBe(first.readinessScopedInputDigest);
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    [
      'an unresolved runtime-loader bare alias',
      {
        'src/runtime-helper.cjs': 'module.exports = { revision: 1 };\n',
        'alias-loader.cjs': [
          "const Module = require('node:module');",
          "const path = require('node:path');",
          'const original = Module._resolveFilename;',
          'Module._resolveFilename = function (request, parent, isMain, options) {',
          "  if (request === 'runtime-helper') return path.join(__dirname, 'src', 'runtime-helper.cjs');",
          '  return original.call(this, request, parent, isMain, options);',
          '};',
          '',
        ].join('\n'),
      },
      'node --require ./alias-loader.cjs --test tests/refund-worker.test.cjs',
      "const helper = require('runtime-helper');",
      'implementation_readiness_input_missing:runtime-helper',
    ],
  ] as const)(
    'fails closed for %s',
    (_case, additionalFiles, invocation, dependencyLine, issueCode) => {
      const fixture = materializeImplementationReadinessFixture({ additionalFiles, invocation });
      try {
        writeFileSync(
          fixture.testPath,
          [
            "const test = require('node:test');",
            "const assert = require('node:assert/strict');",
            "const { refundStatus } = require('../src/refund-worker.cjs');",
            dependencyLine,
            `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
            '  void helper;',
            `  assert.equal(refundStatus(), 'accepted', '${fixture.oracle}');`,
            '});',
            '',
          ].join('\n'),
          'utf8'
        );

        expect(() =>
          produceImplementationReadiness({
            projectRoot: fixture.root,
            requestId: fixture.requestId,
          })
        ).toThrowError(issueCode);
      } finally {
        fixture.cleanup();
      }
    }
  );

  it.each([
    [
      'exact alias before wildcard',
      { '@app/*': ['broad/*'], '@app/helper': ['exact/helper'] },
      'exact/helper.cjs',
    ],
    [
      'longest prefix wildcard',
      { '@*': ['broad/*'], '@app/*': ['specific/*'] },
      'specific/helper.cjs',
    ],
  ] as const)('uses TypeScript paths precedence for %s', (_case, paths, expectedDependency) => {
    const fixture = materializeImplementationReadinessFixture({
      additionalFiles: {
        'broad/app/helper.cjs': 'module.exports = { revision: 1 };\n',
        'broad/helper.cjs': 'module.exports = { revision: 1 };\n',
        'exact/helper.cjs': 'module.exports = { revision: 1 };\n',
        'specific/helper.cjs': 'module.exports = { revision: 1 };\n',
        'tsconfig.json': `${JSON.stringify({ compilerOptions: { baseUrl: '.', paths } }, null, 2)}\n`,
      },
    });
    try {
      writeFileSync(
        fixture.testPath,
        [
          "const test = require('node:test');",
          "const assert = require('node:assert/strict');",
          "const { refundStatus } = require('../src/refund-worker.cjs');",
          "if (false) require('@app/helper');",
          `test('${fixture.commandIds.join(' ')} ${fixture.oracle}', () => {`,
          `  assert.equal(refundStatus(), 'accepted', '${fixture.oracle}');`,
          '});',
          '',
        ].join('\n'),
        'utf8'
      );
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      const firstCandidate = JSON.parse(
        readFileSync(path.join(fixture.root, ...first.candidateRef.path.split('/')), 'utf8')
      );
      const logicalPaths = firstCandidate.inputArtifacts.map(
        (entry: { logicalPath: string }) => entry.logicalPath
      );

      expect(logicalPaths).toContain(expectedDependency);
    } finally {
      fixture.cleanup();
    }
  });

  it('rebinds an intact A bundle after A-B-A scoped-input restoration', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const originalTarget = readFileSync(fixture.targetPath);
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        fixture.targetPath,
        "module.exports = { refundStatus: () => 'pending' }; // readiness B\n",
        'utf8'
      );
      const second = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      expect(second.implementationReadinessCandidateHash).not.toBe(
        first.implementationReadinessCandidateHash
      );
      writeFileSync(fixture.targetPath, originalTarget);
      let executions = 0;

      const restored = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        {
          onCommandExecuted: () => {
            executions += 1;
          },
        }
      ) as Record<string, any>;
      const runtimeRecord = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      const projection = runtimeRecord.sixModelResults.implementation_readiness;

      expect(restored).toMatchObject({
        status: 'implementation_readiness_reused',
        implementationReadinessCandidateHash: first.implementationReadinessCandidateHash,
        readinessScopedInputDigest: first.readinessScopedInputDigest,
        commandExecutionCount: 0,
        writeCount: 1,
      });
      expect(executions).toBe(0);
      expect(projection.currentHashes.implementationReadinessCandidateHash).toBe(
        first.implementationReadinessCandidateHash
      );
      expect(projection.currentHashes.readinessScopedInputDigest).toBe(
        first.readinessScopedInputDigest
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects an A-B-A bundle after an immutable candidate byte mutation', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      const candidatePath = path.join(fixture.root, ...first.candidateRef.path.split('/'));
      const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
      candidate.unexpectedMutableField = 'tampered';
      writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');

      expect(() =>
        produceImplementationReadiness({
          projectRoot: fixture.root,
          requestId: fixture.requestId,
        })
      ).toThrowError('implementation_readiness_published_candidate_invalid');
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects reuse after an immutable readiness report byte mutation', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      const reportPath = path.join(fixture.root, ...first.reportRef.path.split('/'));
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      report.status = 'blocked';
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

      expect(() =>
        produceImplementationReadiness({
          projectRoot: fixture.root,
          requestId: fixture.requestId,
        })
      ).toThrowError('implementation_readiness_published_report_invalid');
    } finally {
      fixture.cleanup();
    }
  });

  it.each([
    ['duplicate candidate role', 'implementation_readiness_candidate', 'duplicate'],
    ['duplicate report role', 'implementation_readiness_report', 'duplicate'],
    ['candidate path substitution', 'implementation_readiness_candidate', 'path'],
  ] as const)('rejects reuse after receipt %s', (_case, role, mutation) => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      const receiptPath = path.join(fixture.root, ...first.decisionReceiptRef.path.split('/'));
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
      const output = receipt.deterministicGateOutputs.find(
        (entry: { role: string }) => entry.role === role
      );
      if (mutation === 'duplicate') receipt.deterministicGateOutputs.push({ ...output });
      else output.path = 'readiness/evaluations/forged/candidate.json';
      const payload = { ...receipt };
      delete payload.receiptHash;
      receipt.receiptHash = sha256Stable(payload);
      writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

      expect(() =>
        produceImplementationReadiness({
          projectRoot: fixture.root,
          requestId: fixture.requestId,
        })
      ).toThrowError('implementation_readiness_published_receipt_lineage_invalid');
    } finally {
      fixture.cleanup();
    }
  });

  it('reruns the bounded command set after a pre-publication crash without publishing a receipt', () => {
    const fixture = materializeImplementationReadinessFixture({ duplicateCommand: true });
    let executions = 0;
    try {
      expect(() =>
        produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            onCommandExecuted: () => {
              executions += 1;
            },
            beforePublish: () => {
              throw new Error('simulated_pre_publication_crash');
            },
          }
        )
      ).toThrow('simulated_pre_publication_crash');
      expect(executions).toBe(1);
      const evaluationsRoot = path.join(fixture.recordRoot, 'record', 'readiness', 'evaluations');
      expect(
        existsSync(evaluationsRoot)
          ? readdirSync(evaluationsRoot).filter((name) => !name.startsWith('.staging-'))
          : []
      ).toEqual([]);

      const recovered = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        {
          onCommandExecuted: () => {
            executions += 1;
          },
        }
      );
      expect(recovered).toMatchObject({
        status: 'implementation_readiness_pass',
        commandExecutionCount: 1,
      });
      expect(executions).toBe(2);
    } finally {
      fixture.cleanup();
    }
  });

  it('returns the committed pass when a post-publication observer throws', () => {
    const fixture = materializeImplementationReadinessFixture();
    let executions = 0;
    try {
      const committed = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        {
          onCommandExecuted: () => {
            executions += 1;
          },
          afterAtomicPublish: () => {
            throw new Error('simulated_post_publication_failure');
          },
        }
      );
      expect(committed).toMatchObject({
        status: 'implementation_readiness_pass',
        commandExecutionCount: 1,
        writeCount: 5,
      });
      expect(executions).toBe(1);
      const interrupted = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      expect(interrupted.sixModelResults.implementation_readiness.status).toBe('pass');

      const recovered = produceImplementationReadiness(
        { projectRoot: fixture.root, requestId: fixture.requestId },
        {
          onCommandExecuted: () => {
            executions += 1;
          },
        }
      );
      expect(recovered).toMatchObject({
        status: 'implementation_readiness_reused',
        commandExecutionCount: 0,
        writeCount: 0,
      });
      expect(executions).toBe(1);
      const promoted = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
      expect(promoted.sixModelResults.implementation_readiness.status).toBe('pass');

      expect(
        produceImplementationReadiness({
          projectRoot: fixture.root,
          requestId: fixture.requestId,
        })
      ).toMatchObject({
        status: 'implementation_readiness_reused',
        commandExecutionCount: 0,
        writeCount: 0,
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('counts the stale transition before publishing a replacement readiness pass', () => {
    const fixture = materializeImplementationReadinessFixture();
    try {
      const first = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      }) as Record<string, any>;
      writeFileSync(
        fixture.targetPath,
        "module.exports = { refundStatus: () => 'pending' }; // scoped input changed\n",
        'utf8'
      );

      const replacement = produceImplementationReadiness({
        projectRoot: fixture.root,
        requestId: fixture.requestId,
      });

      expect(replacement).toMatchObject({
        status: 'implementation_readiness_pass',
        commandExecutionCount: 1,
        writeCount: first.writeCount + 1,
      });
    } finally {
      fixture.cleanup();
    }
  });

  it.each(['before_commit_boundary', 'after_transaction_promotion'])(
    'recovers an uncommitted readiness publication after a real child-process crash at %s',
    (boundary) => {
      const fixture = materializeImplementationReadinessFixture();
      const childPath = path.join(fixture.root, 'crash-readiness-publication.cjs');
      writeFileSync(
        childPath,
        [
          "'use strict';",
          'const [modulePath, projectRoot, requestId, boundary] = process.argv.slice(2);',
          'const { produceImplementationReadiness } = require(modulePath);',
          'produceImplementationReadiness(',
          '  { projectRoot, requestId },',
          '  {',
          '    controlStoreCommitDeps: {',
          '      beforeBoundary(current) {',
          '        if (current === boundary) process.exit(86);',
          '      },',
          '    },',
          '  }',
          ');',
          '',
        ].join('\n'),
        'utf8'
      );
      try {
        const crashed = spawnSync(
          process.execPath,
          [childPath, DIST_READINESS_MODULE, fixture.root, fixture.requestId, boundary],
          {
            cwd: process.cwd(),
            encoding: 'utf8',
            shell: false,
            timeout: 120_000,
            env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
          }
        );
        expect(crashed.status, `${crashed.stdout}\n${crashed.stderr}`).toBe(86);
        expect(
          JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8')).sixModelResults
            .implementation_readiness.status
        ).toBe('pass');

        let executions = 0;
        const recovered = produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            onCommandExecuted: () => {
              executions += 1;
            },
          }
        );

        expect(recovered).toMatchObject({
          status: 'implementation_readiness_pass',
          commandExecutionCount: 1,
        });
        expect(executions).toBe(1);
        expect(existsSync(path.join(fixture.recordRoot, 'events', 'control-store', '.lock'))).toBe(
          false
        );
      } finally {
        fixture.cleanup();
      }
    }
  );

  it('recovers an uncommitted pass before entering an authoritative read callback', () => {
    const fixture = materializeImplementationReadinessFixture();
    const childPath = path.join(fixture.root, 'race-readiness-publication.cjs');
    writeFileSync(
      childPath,
      [
        "'use strict';",
        'const [modulePath, projectRoot, requestId] = process.argv.slice(2);',
        'const { produceImplementationReadiness } = require(modulePath);',
        'produceImplementationReadiness(',
        '  { projectRoot, requestId },',
        '  {',
        '    controlStoreCommitDeps: {',
        "      beforeBoundary(current) { if (current === 'after_transaction_promotion') process.exit(86); },",
        '    },',
        '  }',
        ');',
        '',
      ].join('\n'),
      'utf8'
    );
    try {
      const readAuthoritatively = (
        controlStore as typeof controlStore & {
          readControlStoreAuthoritatively?: <T>(recordPath: string, read: () => T) => T;
        }
      ).readControlStoreAuthoritatively;
      expect(typeof readAuthoritatively).toBe('function');
      if (!readAuthoritatively) return;

      const crashed = spawnSync(
        process.execPath,
        [childPath, DIST_READINESS_MODULE, fixture.root, fixture.requestId],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          shell: false,
          timeout: 120_000,
          env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
        }
      );
      expect(crashed.status, `${crashed.stdout}\n${crashed.stderr}`).toBe(86);
      expect(
        JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8')).sixModelResults
          .implementation_readiness.status
      ).toBe('pass');

      let readAttempts = 0;
      const finalStatus = readAuthoritatively(fixture.runtimeRecordPath, () => {
        readAttempts += 1;
        const record = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
        return record.sixModelResults?.implementation_readiness?.status ?? 'absent';
      });

      expect(readAttempts).toBe(1);
      expect(finalStatus).not.toBe('pass');
      expect(existsSync(path.join(fixture.recordRoot, 'events', 'control-store', '.lock'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('prevents a writer rollback from exposing a transient pass to an authoritative read', () => {
    const fixture = materializeImplementationReadinessFixture();
    const childPath = path.join(fixture.root, 'rollback-readiness-publication.cjs');
    const readyPath = path.join(fixture.root, 'rollback-writer-ready');
    const releasePath = path.join(fixture.root, 'rollback-writer-release');
    const donePath = path.join(fixture.root, 'rollback-writer-done.json');
    writeFileSync(
      childPath,
      [
        "'use strict';",
        "const fs = require('node:fs');",
        'const [modulePath, projectRoot, requestId, readyPath, releasePath, donePath] = process.argv.slice(2);',
        'const { produceImplementationReadiness } = require(modulePath);',
        'const waitCell = new Int32Array(new SharedArrayBuffer(4));',
        'try {',
        '  produceImplementationReadiness(',
        '    { projectRoot, requestId },',
        '    {',
        '      controlStoreCommitDeps: {',
        '        beforeBoundary(current) {',
        "          if (current !== 'before_commit_boundary') return;",
        "          fs.writeFileSync(readyPath, 'ready', 'utf8');",
        '          const deadline = Date.now() + 10000;',
        '          while (!fs.existsSync(releasePath) && Date.now() < deadline) {',
        '            Atomics.wait(waitCell, 0, 0, 10);',
        '          }',
        "          throw new Error('simulated_controlled_rollback');",
        '        },',
        '      },',
        '    }',
        '  );',
        '} catch (error) {',
        "  fs.writeFileSync(donePath, JSON.stringify({ error: String(error && error.message) }), 'utf8');",
        '}',
        '',
      ].join('\n'),
      'utf8'
    );
    try {
      const readAuthoritatively = (
        controlStore as typeof controlStore & {
          readControlStoreAuthoritatively?: <T>(recordPath: string, read: () => T) => T;
        }
      ).readControlStoreAuthoritatively;
      expect(typeof readAuthoritatively).toBe('function');
      if (!readAuthoritatively) return;

      const finalStatus = readAuthoritatively(fixture.runtimeRecordPath, () => {
        spawn(
          process.execPath,
          [
            childPath,
            DIST_READINESS_MODULE,
            fixture.root,
            fixture.requestId,
            readyPath,
            releasePath,
            donePath,
          ],
          {
            cwd: process.cwd(),
            windowsHide: true,
            stdio: 'ignore',
            env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
          }
        );
        const firstSignal = waitForExisting([readyPath, donePath]);
        const record = JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8'));
        const status = record.sixModelResults?.implementation_readiness?.status ?? 'absent';
        if (firstSignal === readyPath) {
          writeFileSync(releasePath, 'release', 'utf8');
          waitForExisting([donePath]);
        }
        return status;
      });

      const childResult = JSON.parse(readFileSync(donePath, 'utf8')) as { error: string };
      expect(finalStatus).not.toBe('pass');
      expect(childResult.error).toMatch(/control_store_lock_held|simulated_controlled_rollback/u);
      expect(existsSync(path.join(fixture.recordRoot, 'events', 'control-store', '.lock'))).toBe(
        false
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('does not recover a transient pass from a competing writer before commit', () => {
    const fixture = materializeImplementationReadinessFixture();
    const childPath = path.join(fixture.root, 'transient-readiness-publication.cjs');
    const readyPath = path.join(fixture.root, 'transient-writer-ready');
    const donePath = path.join(fixture.root, 'transient-writer-done.json');
    writeFileSync(
      childPath,
      [
        "'use strict';",
        "const fs = require('node:fs');",
        'const [modulePath, projectRoot, requestId, readyPath, donePath] = process.argv.slice(2);',
        'const { produceImplementationReadiness } = require(modulePath);',
        'const waitCell = new Int32Array(new SharedArrayBuffer(4));',
        'try {',
        '  produceImplementationReadiness(',
        '    { projectRoot, requestId },',
        '    {',
        '      controlStoreCommitDeps: {',
        '        beforeBoundary(current) {',
        "          if (current !== 'before_commit_boundary') return;",
        "          fs.writeFileSync(readyPath, 'ready', 'utf8');",
        '          Atomics.wait(waitCell, 0, 0, 5000);',
        "          throw new Error('simulated_transient_pass_rollback');",
        '        },',
        '      },',
        '    }',
        '  );',
        '} catch (error) {',
        "  fs.writeFileSync(donePath, JSON.stringify({ error: String(error && error.message) }), 'utf8');",
        '}',
        '',
      ].join('\n'),
      'utf8'
    );
    let childStarted = false;
    let result: Record<string, any> | undefined;
    let failure: unknown;
    try {
      try {
        result = produceImplementationReadiness(
          { projectRoot: fixture.root, requestId: fixture.requestId },
          {
            beforePublish: () => {
              if (childStarted) return;
              childStarted = true;
              spawn(
                process.execPath,
                [
                  childPath,
                  DIST_READINESS_MODULE,
                  fixture.root,
                  fixture.requestId,
                  readyPath,
                  donePath,
                ],
                {
                  cwd: process.cwd(),
                  windowsHide: true,
                  stdio: 'ignore',
                  env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
                }
              );
              expect(waitForExisting([readyPath, donePath])).toBe(readyPath);
            },
          }
        ) as Record<string, any>;
      } catch (error) {
        failure = error;
      }
      waitForExisting([donePath]);

      expect(result).toBeUndefined();
      expect(failure).toMatchObject({ issueCode: 'control_store_lock_held', writeCount: 0 });
      expect(
        JSON.parse(readFileSync(fixture.runtimeRecordPath, 'utf8')).sixModelResults
          .implementation_readiness
      ).toMatchObject({ status: 'not_established' });
    } finally {
      fixture.cleanup();
    }
  });
});
