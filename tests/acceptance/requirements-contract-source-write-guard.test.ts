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

function runGuard(root: string, args: string[] = []) {
  return cp.spawnSync('npx', ['tsx', guard, '--cwd', root, '--json', ...args], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
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
  it('fails when no tracked docs/plans diff and no explicit paths exist', () => {
    const root = createTempRoot('requirements-contract-guard-empty-');
    try {
      const result = runGuard(root);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('requirements_contract_source_write_path_required');
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
