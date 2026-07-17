import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractEvalCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';

const CORPUS = path.resolve(
  'tests/acceptance/fixtures/requirements-contract-evaluation/corpus.json'
);

describe('requirements contract evaluation command', () => {
  it('derives correctness and Judge metrics from the labeled corpus', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-eval-'));
    try {
      const out = path.join(root, 'report.json');
      const report = await requirementsContractEvalCommand({
        cwd: process.cwd(),
        corpus: CORPUS,
        out,
        json: false,
      });

      expect(report.schemaVersion).toBe('requirements-contract-evaluation-report/v1');
      expect(report.correctnessGateDecision).toBe('pass');
      expect(report.criticalCorrectnessIssueCount).toBe(0);
      expect(report.criticalSemanticMutationDetectionRate).toBe(1);
      expect(report.judgeFalseAcceptRate).toBe(0);
      expect(report.judgeFalseBlockRate).toBe(0);
      expect(report.efficiencyMetricsReported).toBe(true);
      expect(JSON.parse(readFileSync(out, 'utf8'))).toMatchObject({
        corpusHash: report.corpusHash,
        decision: 'pass',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a blocker fixture is falsely accepted', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-eval-block-'));
    try {
      const corpus = JSON.parse(readFileSync(CORPUS, 'utf8'));
      corpus.cases.find((item: { id: string }) => item.id === 'JUDGE-BLOCKER').judgeDecision =
        'pass';
      const corpusPath = path.join(root, 'corpus.json');
      writeFileSync(corpusPath, `${JSON.stringify(corpus)}\n`, 'utf8');

      await expect(
        requirementsContractEvalCommand({
          cwd: root,
          corpus: corpusPath,
          out: path.join(root, 'report.json'),
          json: false,
        })
      ).rejects.toThrow('requirements_contract_evaluation_blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
