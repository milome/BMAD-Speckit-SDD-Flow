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

describe('requirements contract semantic mutation evaluation', () => {
  it('detects every labeled non-equivalent projection through the production evaluator', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-semantic-mutation-eval-'));
    try {
      const corpus = readCorpus();
      const mutationCases = corpus.cases.filter(
        (item: any) =>
          item.kind === 'semantic_equivalence' && item.expectedEquivalent === false
      );
      expect(mutationCases.length).toBeGreaterThan(0);

      const report = await requirementsContractEvalCommand({
        cwd: process.cwd(),
        corpus: CORPUS_PATH,
        out: path.join(root, 'report.json'),
      });

      expect(report.semanticCaseCount).toBeGreaterThanOrEqual(mutationCases.length);
      expect(report.semanticMismatchCount).toBe(0);
      expect(report.criticalSemanticMutationDetectionRate).toBe(1);
      expect(report.correctnessGateDecision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when a labeled semantic mutation is no longer detected', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-semantic-mutation-missed-'));
    try {
      const corpus = readCorpus();
      const mutationCase = corpus.cases.find(
        (item: any) =>
          item.kind === 'semantic_equivalence' && item.expectedEquivalent === false
      );
      expect(mutationCase).toBeDefined();
      mutationCase.projection = structuredClone(mutationCase.source);
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
