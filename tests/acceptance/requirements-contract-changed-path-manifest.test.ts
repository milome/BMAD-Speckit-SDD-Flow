import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractChangedPathManifestCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-changed-path-manifest';

const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

function git(root: string, ...args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function write(root: string, relativePath: string, value: string) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-changed-path-'));
  const transactionId = `TX-${randomUUID()}`;
  const implementationAttemptId = `IMP-${randomUUID()}`;
  git(root, 'init');
  git(root, 'config', 'core.autocrlf', 'false');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  write(root, 'src/product.ts', 'export const value = 1;\n');
  write(root, 'tests/product.test.ts', 'export const testValue = 1;\n');
  write(
    root,
    'contract.md',
    [
      '# Contract',
      '## S001',
      '- `src/product.ts`',
      '- `tests/product.test.ts`',
      '- `docs/behavior.md`',
      '- AC-01',
      '- TR-01',
      '',
    ].join('\n')
  );
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'baseline');
  const entries = ['contract.md', 'src/product.ts', 'tests/product.test.ts'].map((entryPath) => {
    const value = readFileSync(path.join(root, entryPath), 'utf8');
    return {
      path: entryPath,
      pathRole: entryPath.startsWith('tests/') ? 'test' : 'implementation',
      tracked: true,
      exists: true,
      sha256: sha256(value),
    };
  });
  write(
    root,
    'baseline-index.json',
    `${JSON.stringify({ schemaVersion: 'requirements-contract-g00-baseline-file-index/v1', entries })}\n`
  );
  const baselineIndexHash = sha256(readFileSync(path.join(root, 'baseline-index.json'), 'utf8'));
  write(
    root,
    'baseline.json',
    `${JSON.stringify({
      schemaVersion: 'requirements-contract-g00-baseline-fixture/v1',
      transactionId,
      implementationAttemptId,
      baselineSnapshotHash: 'sha256:baseline',
      baselineFileIndexRef: {
        path: 'baseline-index.json',
        hash: baselineIndexHash,
      },
      preExistingDirtyPaths: [],
    })}\n`
  );
  return root;
}

describe('requirements contract changed-path manifest', () => {
  it('derives a complete authorized candidate snapshot from the frozen baseline', async () => {
    const root = fixture();
    try {
      write(root, 'src/product.ts', 'export const value = 2;\n');
      write(root, 'docs/behavior.md', '# Behavior\n');
      rmSync(path.join(root, 'tests/product.test.ts'));

      const manifest = await requirementsContractChangedPathManifestCommand({
        cwd: root,
        contract: 'contract.md',
        baseline: 'baseline.json',
        snapshotBeforeWrite: true,
        out: 'audit/changed-path-manifest.json',
        json: false,
      });

      expect(manifest.schemaVersion).toBe('requirements-contract-changed-path-manifest/v1');
      expect(manifest.candidateSnapshotCapturedBefore).toBe('CMD-21');
      expect(manifest.changedPaths.map((entry) => [entry.path, entry.changeType])).toEqual([
        ['docs/behavior.md', 'added'],
        ['src/product.ts', 'modified'],
        ['tests/product.test.ts', 'deleted'],
      ]);
      expect(manifest.candidateFileIndex.map((entry) => entry.path)).not.toContain(
        'audit/changed-path-manifest.json'
      );
      expect(manifest.unauthorizedPathCount).toBe(0);
      expect(manifest.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
