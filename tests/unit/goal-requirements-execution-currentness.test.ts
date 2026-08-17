import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  classifyExecutionReadinessDrift,
  resolveExecutionInputMembershipForCurrentness,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-adapter';
import { executionResumeAuthorizedOwnedPaths } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/frozen-goal-activation';

const roots: string[] = [];

function write(root: string, relativePath: string, value: string): void {
  const target = path.join(root, ...relativePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('requirements-backed execution currentness classification', () => {
  it('classifies normalized command identity before other readiness drift', () => {
    expect(
      classifyExecutionReadinessDrift({
        commandIdentityMatches: false,
        inputMembershipMatches: false,
        currentScopedInputDigest: null,
        permittedScopedInputDigest: null,
      })
    ).toBe('readiness_recheck_required:command_identity');
  });

  it('classifies input membership before readiness policy drift', () => {
    expect(
      classifyExecutionReadinessDrift({
        commandIdentityMatches: true,
        inputMembershipMatches: false,
        currentScopedInputDigest: null,
        permittedScopedInputDigest: null,
      })
    ).toBe('readiness_recheck_required:input_set');
  });

  it('classifies the residual full-digest mismatch as readiness policy', () => {
    expect(
      classifyExecutionReadinessDrift({
        commandIdentityMatches: true,
        inputMembershipMatches: true,
        currentScopedInputDigest: `sha256:${'a'.repeat(64)}`,
        permittedScopedInputDigest: `sha256:${'b'.repeat(64)}`,
      })
    ).toBe('readiness_recheck_required:readiness_policy');
  });

  it('matches readiness module resolution for package exports/imports, TS aliases, and Bun builtins', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'goal-currentness-resolver-'));
    roots.push(root);
    write(
      root,
      'package.json',
      JSON.stringify({ name: 'fixture', imports: { '#internal': './src/internal.ts' } })
    );
    write(
      root,
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@app/*': ['src/*'] } } })
    );
    write(
      root,
      'node_modules/local-package/package.json',
      JSON.stringify({ name: 'local-package', exports: { './feature': './feature.js' } })
    );
    write(root, 'node_modules/local-package/feature.js', 'module.exports = true;\n');
    write(root, 'src/internal.ts', 'export const internal = true;\n');
    write(root, 'src/tool.ts', 'export const tool = true;\n');
    write(
      root,
      'tests/currentness.test.ts',
      [
        "import 'local-package/feature';",
        "import '#internal';",
        "import '@app/tool';",
        "import 'bun:test';",
        '',
      ].join('\n')
    );
    const artifacts = [
      ['test', 'tests/currentness.test.ts'],
      ['test', 'node_modules/local-package/feature.js'],
      ['test', 'src/internal.ts'],
      ['test', 'src/tool.ts'],
      ['config', 'package.json'],
      ['config', 'tsconfig.json'],
      ['config', 'node_modules/local-package/package.json'],
    ].map(([role, logicalPath]) => ({ role, logicalPath }));

    expect(
      resolveExecutionInputMembershipForCurrentness({
        projectRoot: root,
        readinessCandidate: {
          normalizedCommands: [{ executable: 'bun', args: ['test', 'tests/currentness.test.ts'] }],
          inputArtifacts: artifacts,
        },
      })
    ).toEqual(artifacts.map(({ role, logicalPath }) => `${role}:${logicalPath}`).sort());
  });

  it('matches producer JSONC extends, inherited baseUrl, and ranked overlapping aliases', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'goal-currentness-jsonc-'));
    roots.push(root);
    write(root, 'package.json', JSON.stringify({ name: 'fixture' }));
    write(
      root,
      'configs/base.json',
      [
        '{',
        '  // inherited source root',
        '  "compilerOptions": { "baseUrl": "../src", },',
        '}',
        '',
      ].join('\n')
    );
    write(
      root,
      'tsconfig.json',
      [
        '{',
        '  "extends": "./configs/base.json",',
        '  "compilerOptions": {',
        '    "paths": {',
        '      "@app/*": ["general/*"],',
        '      "@app/special/*": ["special/*"],',
        '    },',
        '  },',
        '}',
        '',
      ].join('\n')
    );
    write(root, 'src/general/special/tool.ts', 'export const wrong = true;\n');
    write(root, 'src/special/tool.ts', 'export const selected = true;\n');
    write(root, 'src/base-only.ts', 'export const baseOnly = true;\n');
    write(
      root,
      'tests/currentness.test.ts',
      ["import '@app/special/tool';", "import 'base-only';", ''].join('\n')
    );
    const artifacts = [
      ['test', 'tests/currentness.test.ts'],
      ['test', 'src/special/tool.ts'],
      ['test', 'src/base-only.ts'],
      ['config', 'package.json'],
      ['config', 'tsconfig.json'],
      ['config', 'configs/base.json'],
    ].map(([role, logicalPath]) => ({ role, logicalPath }));

    expect(
      resolveExecutionInputMembershipForCurrentness({
        projectRoot: root,
        readinessCandidate: {
          normalizedCommands: [
            { executable: 'node', args: ['--test', 'tests/currentness.test.ts'] },
          ],
          inputArtifacts: artifacts,
        },
      })
    ).toEqual(artifacts.map(({ role, logicalPath }) => `${role}:${logicalPath}`).sort());
  });

  it('authorizes only closed authorities and the current next authority during resume', () => {
    expect(
      executionResumeAuthorizedOwnedPaths(
        {
          executionStarted: true,
          phase: 'executing',
          nextExecutionAuthorityId: 'AUTH-002',
          validClosureRefs: [{ executionAuthorityId: 'AUTH-001' }],
        },
        [
          { executionAuthorityId: 'AUTH-001', ownedPaths: ['src/one.ts'] },
          { executionAuthorityId: 'AUTH-002', ownedPaths: ['src/two.ts'] },
          { executionAuthorityId: 'AUTH-003', ownedPaths: ['src/three.ts'] },
        ]
      )
    ).toEqual(['src/one.ts', 'src/two.ts']);
  });

  it('preserves authorized owned target membership when execution deleted the file', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'goal-currentness-tombstone-'));
    roots.push(root);
    write(root, 'package.json', JSON.stringify({ name: 'fixture' }));
    write(root, 'tests/currentness.test.cjs', "require('node:test').test('ok', () => {});\n");

    expect(
      resolveExecutionInputMembershipForCurrentness({
        projectRoot: root,
        authorizedOwnedPaths: ['src/deleted.cjs'],
        readinessCandidate: {
          normalizedCommands: [
            { executable: 'node', args: ['--test', 'tests/currentness.test.cjs'] },
          ],
          inputArtifacts: [
            { role: 'pre_implementation_target', logicalPath: 'src/deleted.cjs' },
            { role: 'test', logicalPath: 'tests/currentness.test.cjs' },
            { role: 'config', logicalPath: 'package.json' },
          ],
        },
      })
    ).toEqual([
      'config:package.json',
      'pre_implementation_target:src/deleted.cjs',
      'test:tests/currentness.test.cjs',
    ]);
  });
});
