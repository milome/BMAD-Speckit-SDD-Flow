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

export interface RequirementsContractShadowLogicalProjection {
  trace: unknown;
  prompt: unknown;
  target: unknown;
  oracle: unknown;
  acceptance: unknown;
  gate: unknown;
}

export function evaluateRequirementsContractShadowParity(input: {
  v1: RequirementsContractShadowLogicalProjection;
  v2: RequirementsContractShadowLogicalProjection;
}) {
  const dimensions = [
    'trace',
    'prompt',
    'target',
    'oracle',
    'acceptance',
    'gate',
  ] as const;
  const issues = dimensions.flatMap((dimension) =>
    canonicalJson(input.v1[dimension]) === canonicalJson(input.v2[dimension])
      ? []
      : [`shadow_${dimension}_parity_mismatch`]
  );
  return {
    schemaVersion: 'requirements-contract-shadow-parity/v1',
    authority: 'none' as const,
    shadowProductionReadCount: 0,
    parityCaseCount: dimensions.length,
    mismatchCount: issues.length,
    issues,
    decision: issues.length === 0 ? ('pass' as const) : ('block' as const),
  };
}

export interface AutomaticResolutionEvaluationCase {
  caseRef: string;
  eligibleForAutomaticResolution: boolean;
  expectedAuthorized: boolean;
  actualAuthorized: boolean;
  unresolved: boolean;
  requiresHumanDecision: boolean;
}

export interface GrillEvaluationCase {
  caseRef: string;
  unresolvedCandidate: boolean;
  requiresHumanDecision: boolean;
  explicitSelection: boolean;
  decisionReceiptIssued: boolean;
  decisionChanged: boolean;
}

export interface BmadDiscoveryEvaluationCase {
  caseRef: string;
  transcriptValid: boolean;
  candidateBatchValid: boolean;
  unboundCandidateCount: number;
  advisoryAuthorityPromotionCount: number;
  directPrdWriteCount: number;
}

export interface MultiPrdRoutingEvaluationCase {
  caseRef: string;
  productPath: string;
  requirementPaths: string[];
  identityValidationOk: boolean;
  basenameDerivedRequirementIdentityCount: number;
  sourceIdentityCollisionCount: number;
  ambiguousPrdAutoSelectionCount: number;
  directPlanningPathConstructionCount: number;
  duplicatePrdAuthorityCount: number;
  runtimeSourceHashMismatchCount: number;
}

export interface LegacyPrdMigrationEvaluationCase {
  caseRef: string;
  receiptValid: boolean;
  oldAuthorityActive: boolean;
  newAuthorityActive: boolean;
  downstreamBindingMismatchCount: number;
}

export interface InteractionCompilerEvaluationCase {
  caseRef: string;
  expectedAuthorizedCount: number;
  actualAuthorizedCount: number;
  expectedUnresolvedCount: number;
  actualUnresolvedCount: number;
  sequenceHashBeforeValid: boolean;
  sequenceHashAfterValid: boolean;
  projectionAuthorityMutationCount: number;
}

export interface DiagramGoldenCorpusEvaluationCase {
  caseRef: string;
  diagramSetValid: boolean;
  sourceCoverageRate: number;
  blockingChildCoverageRate: number;
  projectionHashMismatchCount: number;
  duplicateDiagramCount: number;
  syntheticParticipantCount: number;
  inapplicableDiagramCount: number;
}

export interface ObservedSequenceEvaluationCase {
  caseRef: string;
  receiptValid: boolean;
  currentAttemptBound: boolean;
  criticalStepCoverageRate: number;
  criticalBranchCoverageRate: number;
  oracleCoverageRate: number;
  unexpectedStepCount: number;
  orderingViolationCount: number;
  temporalViolationCount: number;
  sideEffectViolationCount: number;
  compensationViolationCount: number;
  untrustedEvidenceCount: number;
}

export interface SourceRootOmissionEvaluationCase {
  caseRef: string;
  rootClass: string;
  mutationDetected: boolean;
}

export interface LintProfileMutationEvaluationCase {
  caseRef: string;
  mutationKind: string;
  mutationDetected: boolean;
}

export interface SourcePrdSurfaceEvaluationCase {
  caseRef: string;
  canonicalDiscoveryEnvelopePresent: boolean;
  sourcePrdLintPassed: boolean;
  discoveryEnvelopeAuthorityMutationCount: number;
  discoveryEnvelopeForbiddenProjectionCount: number;
  installedSurfaceMismatchCount: number;
  canonicalRendererBypassCount: number;
  postCutoverV1OutputCount: number;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function evaluateAutomaticResolutionCases(
  cases: AutomaticResolutionEvaluationCase[]
) {
  const eligibleCases = cases.filter((item) => item.eligibleForAutomaticResolution);
  const authorizedCases = cases.filter((item) => item.actualAuthorized);
  const invalidCases = cases.filter((item) => !item.expectedAuthorized);
  const unresolvedCases = cases.filter((item) => item.unresolved);
  const correctlyAuthorizedCount = authorizedCases.filter(
    (item) => item.expectedAuthorized
  ).length;
  const falseAcceptCount = invalidCases.filter((item) => item.actualAuthorized).length;
  const falseBlockCount = cases.filter(
    (item) => item.expectedAuthorized && !item.actualAuthorized
  ).length;
  const humanEscalationCount = unresolvedCases.filter(
    (item) => item.requiresHumanDecision
  ).length;
  return {
    caseCount: cases.length,
    autoResolutionCoverage: ratio(
      eligibleCases.filter((item) => item.actualAuthorized).length,
      eligibleCases.length
    ),
    autoResolutionPrecision: ratio(correctlyAuthorizedCount, authorizedCases.length),
    autoResolutionFalseAcceptRate: ratio(falseAcceptCount, invalidCases.length),
    humanEscalationRate: ratio(humanEscalationCount, unresolvedCases.length),
    falseAcceptCount,
    falseBlockCount,
    decision: falseAcceptCount === 0 && falseBlockCount === 0 ? 'pass' : 'block',
  };
}

export function evaluateGrillCases(cases: GrillEvaluationCase[]) {
  const unresolvedCases = cases.filter((item) => item.unresolvedCandidate);
  const issuedDecisions = cases.filter((item) => item.decisionReceiptIssued);
  const invalidDecisionReceiptCount = cases.filter(
    (item) => item.decisionReceiptIssued && !item.explicitSelection
  ).length;
  const missingDecisionReceiptCount = cases.filter(
    (item) => item.explicitSelection && !item.decisionReceiptIssued
  ).length;
  return {
    caseCount: cases.length,
    humanEscalationRate: ratio(
      unresolvedCases.filter((item) => item.requiresHumanDecision).length,
      unresolvedCases.length
    ),
    decisionReworkRate: ratio(
      issuedDecisions.filter((item) => item.decisionChanged).length,
      issuedDecisions.length
    ),
    invalidDecisionReceiptCount,
    missingDecisionReceiptCount,
    decision:
      invalidDecisionReceiptCount === 0 && missingDecisionReceiptCount === 0
        ? 'pass'
        : 'block',
  };
}

export function evaluateBmadDiscoveryCases(cases: BmadDiscoveryEvaluationCase[]) {
  const invalidTranscriptCount = cases.filter((item) => !item.transcriptValid).length;
  const invalidCandidateBatchCount = cases.filter(
    (item) => !item.candidateBatchValid
  ).length;
  const unboundCandidateCount = cases.reduce(
    (total, item) => total + item.unboundCandidateCount,
    0
  );
  const advisoryAuthorityPromotionCount = cases.reduce(
    (total, item) => total + item.advisoryAuthorityPromotionCount,
    0
  );
  const directPrdWriteCount = cases.reduce(
    (total, item) => total + item.directPrdWriteCount,
    0
  );
  const issueCount =
    invalidTranscriptCount +
    invalidCandidateBatchCount +
    unboundCandidateCount +
    advisoryAuthorityPromotionCount +
    directPrdWriteCount;
  return {
    caseCount: cases.length,
    invalidTranscriptCount,
    invalidCandidateBatchCount,
    unboundCandidateCount,
    advisoryAuthorityPromotionCount,
    directPrdWriteCount,
    decision: issueCount === 0 ? 'pass' : 'block',
  };
}

export function evaluateMultiPrdRoutingCases(cases: MultiPrdRoutingEvaluationCase[]) {
  const invalidIdentitySetCount = cases.filter(
    (item) => !item.identityValidationOk
  ).length;
  const totals = cases.reduce(
    (result, item) => ({
      basenameDerivedRequirementIdentityCount:
        result.basenameDerivedRequirementIdentityCount +
        item.basenameDerivedRequirementIdentityCount,
      sourceIdentityCollisionCount:
        result.sourceIdentityCollisionCount + item.sourceIdentityCollisionCount,
      ambiguousPrdAutoSelectionCount:
        result.ambiguousPrdAutoSelectionCount + item.ambiguousPrdAutoSelectionCount,
      directPlanningPathConstructionCount:
        result.directPlanningPathConstructionCount +
        item.directPlanningPathConstructionCount,
      duplicatePrdAuthorityCount:
        result.duplicatePrdAuthorityCount + item.duplicatePrdAuthorityCount,
      runtimeSourceHashMismatchCount:
        result.runtimeSourceHashMismatchCount + item.runtimeSourceHashMismatchCount,
    }),
    {
      basenameDerivedRequirementIdentityCount: 0,
      sourceIdentityCollisionCount: 0,
      ambiguousPrdAutoSelectionCount: 0,
      directPlanningPathConstructionCount: 0,
      duplicatePrdAuthorityCount: 0,
      runtimeSourceHashMismatchCount: 0,
    }
  );
  const issueCount =
    invalidIdentitySetCount +
    totals.basenameDerivedRequirementIdentityCount +
    totals.sourceIdentityCollisionCount +
    totals.ambiguousPrdAutoSelectionCount +
    totals.directPlanningPathConstructionCount +
    totals.duplicatePrdAuthorityCount +
    totals.runtimeSourceHashMismatchCount;
  return {
    caseCount: cases.length,
    invalidIdentitySetCount,
    ...totals,
    issueCount,
    decision: issueCount === 0 ? 'pass' : 'block',
  };
}

export function evaluateLegacyPrdMigrationCases(
  cases: LegacyPrdMigrationEvaluationCase[]
) {
  const invalidReceiptCount = cases.filter((item) => !item.receiptValid).length;
  const duplicatePrdAuthorityCount = cases.filter(
    (item) => item.oldAuthorityActive && item.newAuthorityActive
  ).length;
  const missingCanonicalAuthorityCount = cases.filter(
    (item) => !item.newAuthorityActive
  ).length;
  const downstreamBindingMismatchCount = cases.reduce(
    (total, item) => total + item.downstreamBindingMismatchCount,
    0
  );
  const issueCount =
    invalidReceiptCount +
    duplicatePrdAuthorityCount +
    missingCanonicalAuthorityCount +
    downstreamBindingMismatchCount;
  return {
    caseCount: cases.length,
    invalidReceiptCount,
    duplicatePrdAuthorityCount,
    missingCanonicalAuthorityCount,
    downstreamBindingMismatchCount,
    issueCount,
    decision: issueCount === 0 ? 'pass' : 'block',
  };
}

export function evaluateInteractionCompilerCases(
  cases: InteractionCompilerEvaluationCase[]
) {
  const falseAcceptCount = cases.reduce(
    (total, item) =>
      total + Math.max(0, item.actualAuthorizedCount - item.expectedAuthorizedCount),
    0
  );
  const falseBlockCount = cases.reduce(
    (total, item) =>
      total + Math.max(0, item.expectedAuthorizedCount - item.actualAuthorizedCount),
    0
  );
  const unresolvedParityMismatchCount = cases.filter(
    (item) => item.expectedUnresolvedCount !== item.actualUnresolvedCount
  ).length;
  const sequenceHashMismatchCount = cases.filter(
    (item) => !item.sequenceHashBeforeValid || !item.sequenceHashAfterValid
  ).length;
  const projectionAuthorityMutationCount = cases.reduce(
    (total, item) => total + item.projectionAuthorityMutationCount,
    0
  );
  const issueCount =
    falseAcceptCount +
    falseBlockCount +
    unresolvedParityMismatchCount +
    sequenceHashMismatchCount +
    projectionAuthorityMutationCount;
  return {
    caseCount: cases.length,
    falseAcceptCount,
    falseBlockCount,
    unresolvedParityMismatchCount,
    sequenceHashMismatchCount,
    projectionAuthorityMutationCount,
    issueCount,
    decision: issueCount === 0 ? 'pass' : 'block',
  };
}

export function evaluateDiagramGoldenCorpusCases(
  cases: DiagramGoldenCorpusEvaluationCase[]
) {
  const invalidDiagramSetCount = cases.filter((item) => !item.diagramSetValid).length;
  const minimumSourceCoverageRate =
    cases.length === 0 ? 0 : Math.min(...cases.map((item) => item.sourceCoverageRate));
  const minimumBlockingChildCoverageRate =
    cases.length === 0
      ? 0
      : Math.min(...cases.map((item) => item.blockingChildCoverageRate));
  const projectionHashMismatchCount = cases.reduce(
    (total, item) => total + item.projectionHashMismatchCount,
    0
  );
  const duplicateDiagramCount = cases.reduce(
    (total, item) => total + item.duplicateDiagramCount,
    0
  );
  const syntheticParticipantCount = cases.reduce(
    (total, item) => total + item.syntheticParticipantCount,
    0
  );
  const inapplicableDiagramCount = cases.reduce(
    (total, item) => total + item.inapplicableDiagramCount,
    0
  );
  const coverageIssueCount =
    Number(minimumSourceCoverageRate !== 1) +
    Number(minimumBlockingChildCoverageRate !== 1);
  const issueCount =
    invalidDiagramSetCount +
    coverageIssueCount +
    projectionHashMismatchCount +
    duplicateDiagramCount +
    syntheticParticipantCount +
    inapplicableDiagramCount;
  return {
    caseCount: cases.length,
    invalidDiagramSetCount,
    minimumSourceCoverageRate,
    minimumBlockingChildCoverageRate,
    projectionHashMismatchCount,
    duplicateDiagramCount,
    syntheticParticipantCount,
    inapplicableDiagramCount,
    issueCount,
    decision: issueCount === 0 ? 'pass' : 'block',
  };
}

export function evaluateObservedSequenceCases(
  cases: ObservedSequenceEvaluationCase[]
) {
  const invalidReceiptCount = cases.filter((item) => !item.receiptValid).length;
  const currentAttemptMismatchCount = cases.filter(
    (item) => !item.currentAttemptBound
  ).length;
  const minimumCriticalStepCoverageRate =
    cases.length === 0
      ? 0
      : Math.min(...cases.map((item) => item.criticalStepCoverageRate));
  const minimumCriticalBranchCoverageRate =
    cases.length === 0
      ? 0
      : Math.min(...cases.map((item) => item.criticalBranchCoverageRate));
  const minimumOracleCoverageRate =
    cases.length === 0 ? 0 : Math.min(...cases.map((item) => item.oracleCoverageRate));
  const unexpectedStepCount = cases.reduce(
    (total, item) => total + item.unexpectedStepCount,
    0
  );
  const orderingViolationCount = cases.reduce(
    (total, item) => total + item.orderingViolationCount,
    0
  );
  const temporalViolationCount = cases.reduce(
    (total, item) => total + item.temporalViolationCount,
    0
  );
  const sideEffectViolationCount = cases.reduce(
    (total, item) => total + item.sideEffectViolationCount,
    0
  );
  const compensationViolationCount = cases.reduce(
    (total, item) => total + item.compensationViolationCount,
    0
  );
  const untrustedEvidenceCount = cases.reduce(
    (total, item) => total + item.untrustedEvidenceCount,
    0
  );
  const violationCount =
    unexpectedStepCount +
    orderingViolationCount +
    temporalViolationCount +
    sideEffectViolationCount +
    compensationViolationCount;
  const coverageIssueCount =
    Number(minimumCriticalStepCoverageRate !== 1) +
    Number(minimumCriticalBranchCoverageRate !== 1) +
    Number(minimumOracleCoverageRate !== 1);
  const issueCount =
    invalidReceiptCount +
    currentAttemptMismatchCount +
    coverageIssueCount +
    violationCount +
    untrustedEvidenceCount;
  return {
    caseCount: cases.length,
    invalidReceiptCount,
    currentAttemptMismatchCount,
    minimumCriticalStepCoverageRate,
    minimumCriticalBranchCoverageRate,
    minimumOracleCoverageRate,
    unexpectedStepCount,
    orderingViolationCount,
    temporalViolationCount,
    sideEffectViolationCount,
    compensationViolationCount,
    violationCount,
    untrustedEvidenceCount,
    issueCount,
    decision: issueCount === 0 ? 'pass' : 'block',
  };
}

export function evaluateSourceRootOmissionCases(
  cases: SourceRootOmissionEvaluationCase[]
) {
  const rateFor = (rootClasses: Set<string>) => {
    const selected = cases.filter((item) => rootClasses.has(item.rootClass));
    return ratio(
      selected.filter((item) => item.mutationDetected).length,
      selected.length
    );
  };
  const requirementRootOmissionDetectionRate = rateFor(
    new Set(['functional_requirement', 'non_functional_requirement'])
  );
  const negativeRootOmissionDetectionRate = rateFor(
    new Set(['negative_requirement'])
  );
  const acceptanceRootOmissionDetectionRate = rateFor(new Set(['acceptance']));
  const undetectedMutationCount = cases.filter(
    (item) => !item.mutationDetected
  ).length;
  const issueCount =
    undetectedMutationCount +
    Number(requirementRootOmissionDetectionRate !== 1) +
    Number(negativeRootOmissionDetectionRate !== 1) +
    Number(acceptanceRootOmissionDetectionRate !== 1);
  return {
    caseCount: cases.length,
    requirementRootOmissionDetectionRate,
    negativeRootOmissionDetectionRate,
    acceptanceRootOmissionDetectionRate,
    undetectedMutationCount,
    issueCount,
    decision: issueCount === 0 ? 'pass' : 'block',
  };
}

export function evaluateLintProfileMutationCases(
  cases: LintProfileMutationEvaluationCase[]
) {
  const detectedMutationCount = cases.filter(
    (item) => item.mutationDetected
  ).length;
  const undetectedMutationCount = cases.length - detectedMutationCount;
  const mutationDetectionRate = ratio(detectedMutationCount, cases.length);
  const issueCount =
    undetectedMutationCount + Number(mutationDetectionRate !== 1);
  return {
    caseCount: cases.length,
    detectedMutationCount,
    undetectedMutationCount,
    mutationDetectionRate,
    issueCount,
    decision: issueCount === 0 ? 'pass' : 'block',
  };
}

export function evaluateSourcePrdSurfaceCases(
  cases: SourcePrdSurfaceEvaluationCase[]
) {
  const missingCanonicalSurfaceCount = cases.filter(
    (item) => !item.canonicalDiscoveryEnvelopePresent
  ).length;
  const sourcePrdLintFailureCount = cases.filter(
    (item) => !item.sourcePrdLintPassed
  ).length;
  const totals = cases.reduce(
    (result, item) => ({
      discoveryEnvelopeAuthorityMutationCount:
        result.discoveryEnvelopeAuthorityMutationCount +
        item.discoveryEnvelopeAuthorityMutationCount,
      discoveryEnvelopeForbiddenProjectionCount:
        result.discoveryEnvelopeForbiddenProjectionCount +
        item.discoveryEnvelopeForbiddenProjectionCount,
      installedSurfaceMismatchCount:
        result.installedSurfaceMismatchCount + item.installedSurfaceMismatchCount,
      canonicalRendererBypassCount:
        result.canonicalRendererBypassCount + item.canonicalRendererBypassCount,
      postCutoverV1OutputCount:
        result.postCutoverV1OutputCount + item.postCutoverV1OutputCount,
    }),
    {
      discoveryEnvelopeAuthorityMutationCount: 0,
      discoveryEnvelopeForbiddenProjectionCount: 0,
      installedSurfaceMismatchCount: 0,
      canonicalRendererBypassCount: 0,
      postCutoverV1OutputCount: 0,
    }
  );
  const issueCount =
    missingCanonicalSurfaceCount +
    sourcePrdLintFailureCount +
    totals.discoveryEnvelopeAuthorityMutationCount +
    totals.discoveryEnvelopeForbiddenProjectionCount +
    totals.installedSurfaceMismatchCount +
    totals.canonicalRendererBypassCount +
    totals.postCutoverV1OutputCount;
  return {
    caseCount: cases.length,
    missingCanonicalSurfaceCount,
    sourcePrdLintFailureCount,
    ...totals,
    issueCount,
    decision: issueCount === 0 ? 'pass' : 'block',
  };
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
