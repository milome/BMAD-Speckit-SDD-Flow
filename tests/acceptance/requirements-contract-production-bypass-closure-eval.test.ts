import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  injectProductionBypassMetric,
  METRIC_SOURCE_FILES,
  writePassingProductionBypassEvidence,
} from './helpers/requirements-contract-production-bypass-fixture';

const ROOT = process.cwd();
const SOURCE = path.join(
  ROOT,
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-bypass-verifier.ts'
);
const SCHEMA = path.join(
  ROOT,
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-production-bypass-closure-report.schema.json'
);
const TSX = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const CORPUS = path.join(
  ROOT,
  'tests/fixtures/requirements-contract/production-bypass-closure-corpus.v1.json'
);

function runCommand(
  projectRoot: string,
  evidenceRoot: string,
  corpusPath: string | null = CORPUS
): Record<string, any> {
  expect(existsSync(SOURCE), 'production bypass verifier source is missing').toBe(true);
  expect(existsSync(SCHEMA), 'production bypass report schema is missing').toBe(true);
  if (!existsSync(SOURCE) || !existsSync(SCHEMA)) return {};
  const script = [
    `import { requirementsContractProductionBypassVerifyCommand } from ${JSON.stringify(
      pathToFileURL(SOURCE).href
    )};`,
    `requirementsContractProductionBypassVerifyCommand(${JSON.stringify({
      cwd: projectRoot,
      evidenceRoot,
      ...(corpusPath ? { corpusPath } : {}),
      json: false,
    })});`,
  ].join('\n');
  execFileSync(process.execPath, [TSX, '--eval', script], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(
    readFileSync(path.join(evidenceRoot, 'production-bypass-closure-report.json'), 'utf8')
  ) as Record<string, any>;
}

describe('requirements contract production bypass closure evaluation', () => {
  it('publishes PASS only when every zero-count and coverage gate is exact', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'production-bypass-pass-'));
    const evidenceRoot = path.join(projectRoot, 'evidence');
    try {
      writePassingProductionBypassEvidence({ projectRoot, evidenceRoot });

      const report = runCommand(projectRoot, evidenceRoot);

      expect(report.schemaVersion).toBe(
        'requirements-contract-production-bypass-closure-report/v1'
      );
      expect(report.correctnessDecision).toBe('PASS');
      expect(report.efficiencyMetricsApplicable).toBe(true);
      expect(report.productionBypassClosureIssueCount).toBe(0);
      expect(report.issues).toEqual([]);
      expect(report.evidenceRefs).toHaveLength(new Set(Object.values(METRIC_SOURCE_FILES)).size);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when a canonical upstream artifact is missing', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'production-bypass-missing-'));
    const evidenceRoot = path.join(projectRoot, 'evidence');
    try {
      writePassingProductionBypassEvidence({ projectRoot, evidenceRoot });
      rmSync(path.join(evidenceRoot, 'command-execution-receipt-bundle.json'));

      const report = runCommand(projectRoot, evidenceRoot);

      expect(report.correctnessDecision).toBe('BLOCK');
      expect(report.efficiencyMetricsApplicable).toBe(false);
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'production_bypass_evidence_missing',
            sourcePath: 'command-execution-receipt-bundle.json',
          }),
        ])
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('uses the packaged frozen corpus when the project does not provide one', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'production-bypass-package-'));
    const evidenceRoot = path.join(projectRoot, 'evidence');
    try {
      writePassingProductionBypassEvidence({ projectRoot, evidenceRoot });

      const report = runCommand(projectRoot, evidenceRoot, null);

      expect(report.correctnessDecision).toBe('PASS');
      expect(report.corpusRef.sourcePath).toContain(
        'packages/bmad-speckit/tests/fixtures/requirements-contract/production-bypass-closure-corpus.v1.json'
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it.each([
    ['taskReportRequirementClosureCount', -1],
    ['commandReceiptCoverage', 2],
  ])('writes an auditable BLOCK report for out-of-domain %s=%s', (metric, value) => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'production-bypass-domain-'));
    const evidenceRoot = path.join(projectRoot, 'evidence');
    try {
      const roots = { projectRoot, evidenceRoot };
      writePassingProductionBypassEvidence(roots);
      injectProductionBypassMetric(roots, metric, value);

      const report = runCommand(projectRoot, evidenceRoot);

      expect(report.correctnessDecision).toBe('BLOCK');
      expect(report[metric]).toBe(value);
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'production_bypass_metric_failed',
            metric,
          }),
        ])
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('blocks a corpus whose frozen attack labels were rewritten', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'production-bypass-corpus-id-'));
    const evidenceRoot = path.join(projectRoot, 'evidence');
    const tamperedCorpusPath = path.join(projectRoot, 'tampered-corpus.json');
    try {
      writePassingProductionBypassEvidence({ projectRoot, evidenceRoot });
      const corpus = JSON.parse(readFileSync(CORPUS, 'utf8')) as {
        cases: Array<Record<string, unknown>>;
      };
      corpus.cases[0].caseId = 'forged-checkpoint-label';
      writeFileSync(tamperedCorpusPath, `${JSON.stringify(corpus, null, 2)}\n`, 'utf8');

      const report = runCommand(projectRoot, evidenceRoot, tamperedCorpusPath);

      expect(report.correctnessDecision).toBe('BLOCK');
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'production_bypass_corpus_invalid',
          }),
        ])
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
