import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveScoringPolicy } from '../../packages/scoring/policy';

const repoRoot = process.cwd();

function copyPolicyFixture(root: string): void {
  fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages', 'scoring', 'rules'), { recursive: true });
  fs.cpSync(
    path.join(repoRoot, '_bmad', '_config', 'scoring-policy.contract.yaml'),
    path.join(root, '_bmad', '_config', 'scoring-policy.contract.yaml')
  );
  fs.cpSync(
    path.join(repoRoot, 'packages', 'scoring', 'rules'),
    path.join(root, 'packages', 'scoring', 'rules'),
    {
      recursive: true,
    }
  );
}

describe('resolveScoringPolicy', () => {
  it('resolves the single authoritative scoring contract and hashes every referenced rule fragment', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scoring-policy-resolution-'));
    try {
      copyPolicyFixture(root);
      const policy = resolveScoringPolicy({ root });
      expect(policy.schemaVersion).toBe('resolved-scoring-policy/v1');
      expect(policy.contractPath).toBe('_bmad/_config/scoring-policy.contract.yaml');
      expect(policy.contractHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(policy.scoringPolicyHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(policy.stageRuleRefs.length).toBeGreaterThanOrEqual(7);
      expect(policy.stageRuleRefs.every((ref) => /^sha256:[a-f0-9]{64}$/.test(ref.hash))).toBe(
        true
      );
      expect(policy.requiredScoreArtifactKinds).toContain('score_record');
      expect(policy.scoreMaterializationPolicy.requireScoreWriteResultOk).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the contract is missing or a referenced rule fragment is absent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scoring-policy-missing-'));
    try {
      expect(() => resolveScoringPolicy({ root })).toThrow(/scoring policy contract missing/);
      copyPolicyFixture(root);
      fs.rmSync(path.join(root, 'packages', 'scoring', 'rules', 'tasks-scoring.yaml'));
      expect(() => resolveScoringPolicy({ root })).toThrow(/rule fragment missing/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
