import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  injectProductionBypassMetric,
  writePassingProductionBypassEvidence,
} from './helpers/requirements-contract-production-bypass-fixture';

const ROOT = process.cwd();
const SOURCE = path.join(
  ROOT,
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-bypass-verifier.ts'
);
const TSX = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const CORPUS = path.join(
  ROOT,
  'tests/fixtures/requirements-contract/production-bypass-closure-corpus.v1.json'
);
const PACKAGE_CORPUS = path.join(
  ROOT,
  'packages/bmad-speckit/tests/fixtures/requirements-contract/production-bypass-closure-corpus.v1.json'
);

type CorpusCase = {
  caseId: string;
  metric: string;
  kind: 'zero_count' | 'coverage';
  injectedValue: number;
};

function evaluate(projectRoot: string, evidenceRoot: string): Record<string, any> {
  expect(existsSync(SOURCE), 'production bypass verifier source is missing').toBe(true);
  if (!existsSync(SOURCE)) return {};
  const script = [
    `import { evaluateProductionBypassClosure } from ${JSON.stringify(
      pathToFileURL(SOURCE).href
    )};`,
    `const report = evaluateProductionBypassClosure(${JSON.stringify({
      cwd: projectRoot,
      evidenceRoot,
      corpusPath: CORPUS,
    })});`,
    'process.stdout.write(JSON.stringify(report));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, [TSX, '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    })
  ) as Record<string, any>;
}

describe('requirements contract production bypass attack corpus', () => {
  const corpus = JSON.parse(readFileSync(CORPUS, 'utf8')) as {
    schemaVersion: string;
    cases: CorpusCase[];
  };

  it('freezes one independently labeled case for every DSA-14 metric', () => {
    expect(corpus.schemaVersion).toBe(
      'requirements-contract-production-bypass-closure-corpus/v1'
    );
    expect(corpus.cases).toHaveLength(23);
    expect(new Set(corpus.cases.map((row) => row.metric)).size).toBe(23);
    expect(readFileSync(PACKAGE_CORPUS, 'utf8')).toBe(readFileSync(CORPUS, 'utf8'));
  });

  it.each(corpus.cases)('detects $caseId through $metric', (testCase) => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'production-bypass-corpus-'));
    const evidenceRoot = path.join(projectRoot, 'evidence');
    try {
      const roots = { projectRoot, evidenceRoot };
      writePassingProductionBypassEvidence(roots);
      injectProductionBypassMetric(
        roots,
        testCase.metric,
        testCase.injectedValue
      );

      const report = evaluate(projectRoot, evidenceRoot);

      expect(report.correctnessDecision).toBe('BLOCK');
      expect(report.efficiencyMetricsApplicable).toBe(false);
      expect(report.productionBypassClosureIssueCount).toBeGreaterThan(0);
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'production_bypass_metric_failed',
            metric: testCase.metric,
          }),
        ])
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
