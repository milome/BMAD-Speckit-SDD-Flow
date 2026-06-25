import crypto from 'node:crypto';
import cp from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTempRoot, removeTempRoot } from './helpers/requirements-contract-authoring-fixture';

const guard = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/verify-requirements-contract-source-writes.ts'
);

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function runGuard(root: string, args: string[] = [], env: Record<string, string> = {}) {
  const childEnv = { ...process.env };
  delete childEnv.GITHUB_BASE_REF;
  delete childEnv.GITHUB_EVENT_NAME;
  delete childEnv.GITHUB_HEAD_REF;
  delete childEnv.GITHUB_REF;
  delete childEnv.REQUIREMENTS_CONTRACT_SOURCE_WRITE_BASE;
  return cp.spawnSync('npx', ['tsx', guard, '--cwd', root, '--json', ...args], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    env: { ...childEnv, ...env },
    shell: process.platform === 'win32',
  });
}

function runGit(root: string, args: string[]): void {
  cp.execFileSync('git', args, { cwd: root, stdio: 'pipe' });
}

function initRepo(root: string): void {
  try {
    runGit(root, ['init', '--initial-branch=master']);
  } catch {
    runGit(root, ['init']);
    runGit(root, ['checkout', '-B', 'master']);
  }
  runGit(root, ['config', 'user.email', 'guard@example.invalid']);
  runGit(root, ['config', 'user.name', 'Guard Test']);
  writeFileSync(path.join(root, 'README.md'), '# Guard test\n', 'utf8');
  runGit(root, ['add', 'README.md']);
  runGit(root, ['commit', '-m', 'base']);
}

function writeRequirement(root: string, relativePath = 'docs/plans/guarded.md'): string {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(
    target,
    ['# Guarded', '', 'implementationConfirmation:', '  status: draft', ''].join('\n'),
    'utf8'
  );
  return target;
}

function writeReceipt(root: string, targetRelative: string, overrides: Record<string, unknown> = {}) {
  const targetText = ['# Guarded', '', 'implementationConfirmation:', '  status: draft', ''].join('\n');
  const receiptPath = path.join(
    root,
    '_bmad-output/runtime/requirement-records/REQ-GUARD/authoring/promotion-receipt.json'
  );
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        ok: true,
        promotionStage: 'authoring-draft',
        targetPath: targetRelative,
        targetHash: sha256Text(targetText),
        authoringPromotionGate: { ok: true },
        ...overrides,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

describe('requirements contract source write guard', () => {
  it('passes when no docs/plans diff and no explicit paths exist', () => {
    const root = createTempRoot('requirements-contract-guard-empty-');
    try {
      const result = runGuard(root);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"ok": true');
      expect(result.stdout).toContain('"checkedPaths": []');
    } finally {
      removeTempRoot(root);
    }
  });

  it('detects local untracked docs/plans implementationConfirmation paths', () => {
    const root = createTempRoot('requirements-contract-guard-untracked-');
    try {
      initRepo(root);
      writeRequirement(root);
      const result = runGuard(root);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('requirements_contract_promotion_receipt_missing');
    } finally {
      removeTempRoot(root);
    }
  });

  it('uses pull request base diff when a base ref is available', () => {
    const root = createTempRoot('requirements-contract-guard-base-');
    try {
      initRepo(root);
      runGit(root, ['checkout', '-b', 'feature']);
      writeRequirement(root);
      runGit(root, ['add', 'docs/plans/guarded.md']);
      runGit(root, ['commit', '-m', 'add guarded contract']);

      const result = runGuard(root, [], {
        GITHUB_BASE_REF: 'master',
        GITHUB_EVENT_NAME: 'pull_request',
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('requirements_contract_promotion_receipt_missing');
    } finally {
      removeTempRoot(root);
    }
  });

  it('passes pull request base diff when docs/plans is unchanged', () => {
    const root = createTempRoot('requirements-contract-guard-base-empty-');
    try {
      initRepo(root);
      runGit(root, ['checkout', '-b', 'feature']);
      writeFileSync(path.join(root, 'README.md'), '# Guard test\n\nchanged\n', 'utf8');
      runGit(root, ['add', 'README.md']);
      runGit(root, ['commit', '-m', 'change readme']);

      const result = runGuard(root, [], {
        GITHUB_BASE_REF: 'master',
        GITHUB_EVENT_NAME: 'pull_request',
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"ok": true');
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails explicit docs/plans implementationConfirmation without receipt', () => {
    const root = createTempRoot('requirements-contract-guard-missing-');
    try {
      writeRequirement(root);
      const result = runGuard(root, ['--paths', 'docs/plans/guarded.md']);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('requirements_contract_promotion_receipt_missing');
    } finally {
      removeTempRoot(root);
    }
  });

  it('fails stale and mismatched receipts', () => {
    const root = createTempRoot('requirements-contract-guard-stale-');
    try {
      writeRequirement(root);
      writeReceipt(root, 'docs/plans/wrong.md');
      const wrongPath = runGuard(root, ['--paths', 'docs/plans/guarded.md']);
      expect(wrongPath.status).toBe(1);
      expect(wrongPath.stdout).toContain('requirements_contract_promotion_receipt_missing');

      writeReceipt(root, 'docs/plans/guarded.md', { targetHash: 'sha256:stale' });
      const staleHash = runGuard(root, ['--paths', 'docs/plans/guarded.md']);
      expect(staleHash.status).toBe(1);
      expect(staleHash.stdout).toContain('requirements_contract_promotion_receipt_target_hash_stale');

      writeReceipt(root, 'docs/plans/guarded.md', { promotionStage: 'confirmation-ready' });
      const badStage = runGuard(root, ['--paths', 'docs/plans/guarded.md']);
      expect(badStage.status).toBe(1);
      expect(badStage.stdout).toContain('requirements_contract_promotion_receipt_stage_invalid');

      writeReceipt(root, 'docs/plans/guarded.md', { authoringPromotionGate: { ok: false } });
      const badGate = runGuard(root, ['--paths', 'docs/plans/guarded.md']);
      expect(badGate.status).toBe(1);
      expect(badGate.stdout).toContain(
        'requirements_contract_promotion_receipt_authoring_gate_not_ok'
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('passes when an explicit docs/plans path has a matching authoring-draft receipt', () => {
    const root = createTempRoot('requirements-contract-guard-valid-');
    try {
      writeRequirement(root);
      writeReceipt(root, 'docs/plans/guarded.md');
      const result = runGuard(root, ['--paths', 'docs/plans/guarded.md']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"ok": true');
    } finally {
      removeTempRoot(root);
    }
  });
});
