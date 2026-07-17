import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  canonicalJson,
  fileHash,
  sha256,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

export interface RequirementsContractEvalOptions {
  cwd?: string;
  corpus: string;
  out: string;
  json?: boolean;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function sourceRevision(root: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unavailable';
  }
}

function validateReport(report: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-evaluation-report.schema.json'
  );
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(readJson(schemaPath));
  if (!validate(report)) {
    throw new Error(`requirements_contract_evaluation_schema_invalid:${JSON.stringify(
      validate.errors ?? []
    )}`);
  }
}

export async function requirementsContractEvalCommand(
  options: RequirementsContractEvalOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  const corpusPath = path.resolve(root, options.corpus);
  const outputPath = path.resolve(root, options.out);
  const corpus = readJson(corpusPath);
  if (corpus.schemaVersion !== 'requirements-contract-evaluation-corpus/v1') {
    throw new Error('requirements_contract_evaluation_corpus_invalid');
  }
  const semanticCases = (corpus.cases as JsonRecord[]).filter(
    (item) => item.kind === 'semantic_equivalence'
  );
  const judgeCases = (corpus.cases as JsonRecord[]).filter(
    (item) => item.kind === 'judge_decision'
  );
  const semanticResults = semanticCases.map((item) => {
    const actualEquivalent = canonicalJson(item.source) === canonicalJson(item.projection);
    return {
      id: item.id,
      expectedEquivalent: item.expectedEquivalent,
      actualEquivalent,
      decision: actualEquivalent === item.expectedEquivalent ? 'pass' : 'block',
    };
  });
  const semanticMismatchCount = semanticResults.filter((item) => item.decision === 'block').length;
  const mutationCases = semanticResults.filter((item) => item.expectedEquivalent === false);
  const detectedMutationCount = mutationCases.filter((item) => item.actualEquivalent === false).length;
  const falseAcceptCount = judgeCases.filter(
    (item) => item.blocker === true && item.judgeDecision === 'pass'
  ).length;
  const falseBlockCount = judgeCases.filter(
    (item) => item.blocker === false && item.judgeDecision === 'block'
  ).length;
  const inconclusiveCount = judgeCases.filter(
    (item) => item.judgeDecision === 'inconclusive'
  ).length;
  const blockerCases = judgeCases.filter((item) => item.blocker === true);
  const challengeYieldCount = blockerCases.filter((item) => item.challengeRequested === true).length;
  const criticalCorrectnessIssueCount =
    semanticMismatchCount + falseAcceptCount + falseBlockCount + inconclusiveCount;
  const criticalSemanticMutationDetectionRate = ratio(
    detectedMutationCount,
    mutationCases.length
  );
  const correctnessGateDecision =
    criticalCorrectnessIssueCount === 0 && criticalSemanticMutationDetectionRate === 1
      ? 'pass'
      : 'block';
  const report = {
    schemaVersion: 'requirements-contract-evaluation-report/v1',
    corpusRef: { path: path.relative(root, corpusPath).replace(/\\/gu, '/'), hash: fileHash(corpusPath) },
    corpusHash: fileHash(corpusPath),
    evaluatorVersion: 'requirements-contract-evaluator/v1',
    sourceRevision: sourceRevision(root),
    caseCount: corpus.cases.length,
    semanticCaseCount: semanticCases.length,
    judgeCaseCount: judgeCases.length,
    semanticMismatchCount,
    criticalCorrectnessIssueCount,
    criticalSemanticMutationDetectionRate,
    judgeFalseAcceptRate: ratio(falseAcceptCount, blockerCases.length),
    judgeFalseBlockRate: ratio(
      falseBlockCount,
      judgeCases.filter((item) => item.blocker === false).length
    ),
    judgeInconclusiveRate: ratio(inconclusiveCount, judgeCases.length),
    judgeChallengeYield: ratio(challengeYieldCount, blockerCases.length),
    correctnessGateDecision,
    efficiencyMetricsReported: correctnessGateDecision === 'pass',
    efficiencyMetrics:
      correctnessGateDecision === 'pass'
        ? {
            evaluationCaseCount: corpus.cases.length,
            deterministicWorkUnits: semanticCases.length * 2 + judgeCases.length,
          }
        : null,
    resultSetHash: sha256(canonicalJson(semanticResults)),
    semanticResults,
    decision: correctnessGateDecision,
  };
  validateReport(report);
  writeGovernedJson(outputPath, report);
  if (options.json) process.stdout.write(`${JSON.stringify(report)}\n`);
  if (correctnessGateDecision !== 'pass') {
    throw new Error('requirements_contract_evaluation_blocked');
  }
  return report;
}
