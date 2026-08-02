import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractEvalCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';

const CORPUS_PATH = path.resolve(
  'tests/acceptance/fixtures/requirements-contract-evaluation/corpus.json'
);

function readCorpus(): any {
  return JSON.parse(readFileSync(CORPUS_PATH, 'utf8'));
}

describe('requirements contract independent Judge evaluation', () => {
  it('derives false-accept and false-block rates from independent blocker labels', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-eval-'));
    try {
      const corpus = readCorpus();
      const judgeCases = corpus.cases.filter((item: any) => item.kind === 'judge_decision');
      expect(judgeCases.some((item: any) => item.blocker === true)).toBe(true);
      expect(judgeCases.some((item: any) => item.blocker === false)).toBe(true);

      const report = await requirementsContractEvalCommand({
        cwd: process.cwd(),
        corpus: CORPUS_PATH,
        out: path.join(root, 'report.json'),
      });

      expect(report.judgeCaseCount).toBe(judgeCases.length);
      expect(report.judgeFalseAcceptRate).toBe(0);
      expect(report.judgeFalseBlockRate).toBe(0);
      expect(report.judgeInconclusiveRate).toBe(0);
      expect(report.judgeChallengeYield).toBe(1);
      expect(report.correctnessGateDecision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks a Judge decision that contradicts the independent blocker label', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-false-accept-'));
    try {
      const corpus = readCorpus();
      const blockerCase = corpus.cases.find(
        (item: any) => item.kind === 'judge_decision' && item.blocker === true
      );
      expect(blockerCase).toBeDefined();
      blockerCase.judgeDecision = 'pass';
      const corpusPath = path.join(root, 'corpus.json');
      writeFileSync(corpusPath, `${JSON.stringify(corpus)}\n`, 'utf8');

      await expect(
        requirementsContractEvalCommand({
          cwd: root,
          corpus: corpusPath,
          out: path.join(root, 'report.json'),
        })
      ).rejects.toThrow('requirements_contract_evaluation_blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
