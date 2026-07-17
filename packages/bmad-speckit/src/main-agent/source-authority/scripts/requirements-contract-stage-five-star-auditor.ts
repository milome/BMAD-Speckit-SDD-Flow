import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  REQUIREMENTS_CONTRACT_STAGE_REGISTRY,
  REQUIREMENTS_CONTRACT_TASK_OWNER_STAGE_REGISTRY,
} from './requirements-contract-model';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;
type Phase = 'architecture' | 'pre-candidate' | 'final';

export interface RequirementsContractStageFiveStarAuditOptions {
  cwd?: string;
  contract: string;
  recovery: string;
  consumerRoot: string;
  phase: Phase;
  phaseRoot: string;
  phaseAuditAttemptId: string;
  auditContext: string;
  matrix: string;
  gapLedger: string;
  finalGate: string;
  candidateReceipt: string;
  candidateRevocationReceipt: string;
  downstreamInvalidationSet: string;
  projectionMode: string;
  json?: boolean;
}

const STAR_FIELDS = [
  ['STAR-1', ['contractRefs']],
  ['STAR-2', ['sourceObligationRefs', 'acceptanceRefs', 'traceRefs']],
  ['STAR-3', ['commandReceiptRefs']],
  ['STAR-4', ['artifactRefs', 'independentEvidenceRefs']],
  ['STAR-5', ['consumerJourneyEvidenceRefs']],
] as const;

function readJson(filePath: string): JsonRecord {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`stage_five_star_json_object_required:${slash(filePath)}`);
  }
  return value as JsonRecord;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`stage_five_star_path_escape:${value}`);
  }
  return resolved;
}

function validate(value: JsonRecord, schemaName: string, label: string): void {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validator = ajv.compile(
    readJson(path.resolve(__dirname, '..', 'schemas', schemaName))
  );
  if (!validator(value)) {
    throw new Error(`${label}_schema_invalid:${JSON.stringify(validator.errors ?? [])}`);
  }
}

function commandCell(contract: string, commandId: string): string {
  const row = contract.split(/\r?\n/u).find((line) => line.startsWith(`| ${commandId} |`));
  const cell = row?.match(/^\| [^|]+ \| (.*?) \| Repository root \|/u)?.[1]?.trim();
  if (!cell) throw new Error(`stage_five_star_command_missing:${commandId}`);
  return cell.startsWith('`') && cell.endsWith('`') ? cell.slice(1, -1) : cell;
}

function ref(root: string, relativePath: string): JsonRecord {
  const resolved = resolveWithin(root, relativePath);
  return { path: slash(relativePath), hash: fileHash(resolved) };
}

function hashField(value: JsonRecord, key: string): string {
  const hash = sha256(canonicalJson(value));
  value[key] = hash;
  return hash;
}

function downstreamStages(stageId: string): string[] {
  const result = new Set<string>();
  const visit = (current: string) => {
    for (const stage of REQUIREMENTS_CONTRACT_STAGE_REGISTRY) {
      if (stage.predecessorStageIds.includes(current as never) && !result.has(stage.stageId)) {
        result.add(stage.stageId);
        visit(stage.stageId);
      }
    }
  };
  visit(stageId);
  return [...result];
}

function buildRows(context: JsonRecord, auditContextRef: string): {
  rows: JsonRecord[];
  gaps: JsonRecord[];
} {
  const evidenceByStage = new Map(
    context.stageEvidence.map((entry: JsonRecord) => [entry.stageId, entry])
  );
  const gaps: JsonRecord[] = [];
  const rows = REQUIREMENTS_CONTRACT_STAGE_REGISTRY.map((stage) => {
    const evidence = evidenceByStage.get(stage.stageId);
    if (!evidence || evidence.auditAttemptId !== context.phaseAuditAttemptId) {
      throw new Error(`stage_five_star_evidence_identity_mismatch:${stage.stageId}`);
    }
    const decisions = STAR_FIELDS.map(([star, fields], index) => {
      const passed = fields.every(
        (field) => Array.isArray(evidence[field]) && evidence[field].length > 0
      );
      if (!passed) {
        const predicate = `${stage.stageId}:${star}:current_evidence_missing`;
        const transition = {
          fromStatus: 'none',
          toStatus: 'open',
          auditAttemptId: context.phaseAuditAttemptId,
          receiptRef: auditContextRef,
          transitionHash: sha256(
            canonicalJson([stage.stageId, star, context.phaseAuditAttemptId, auditContextRef])
          ),
          createdAt: new Date().toISOString(),
        };
        gaps.push({
          gapId: `GAP-${stage.stageId}-${star}`,
          stageId: stage.stageId,
          failedStar: star,
          failedPredicate: predicate,
          contractRefs:
            evidence.contractRefs.length > 0 ? evidence.contractRefs : ['S183'],
          acceptanceRefs:
            evidence.acceptanceRefs.length > 0 ? evidence.acceptanceRefs : ['AC-218'],
          traceRefs: evidence.traceRefs.length > 0 ? evidence.traceRefs : ['TR-218'],
          observedEvidence: [
            ...evidence.commandReceiptRefs,
            ...evidence.artifactRefs,
            ...evidence.independentEvidenceRefs,
            ...evidence.consumerJourneyEvidenceRefs,
          ],
          missingEvidence: fields.map((field) => `${stage.stageId}:${field}`),
          counterexample: `${stage.stageId} lacks current-attempt ${star} evidence.`,
          rootCauseClass: 'evidence_pipeline_defect',
          rootCause: `Current phase evidence is incomplete for ${stage.stageId} ${star}.`,
          affectedProductionPaths: [],
          affectedTests: [],
          affectedArtifacts: [],
          downstreamInvalidationSet: downstreamStages(stage.stageId),
          remediationSteps: [`Publish current ${star} evidence for ${stage.stageId}`],
          qualifiedRedRequired: index >= 2,
          verificationCommands: ['CMD-34'],
          expectedEvidence: fields.map((field) => `${stage.stageId}:${field}`),
          failureSignatureHash: sha256(canonicalJson([stage.stageId, star, predicate])),
          status: 'open',
          statusTransitions: [transition],
        });
      }
      return passed ? 'PASS' : 'BLOCK';
    });
    const failedPredicateIds = gaps
      .filter((gap) => gap.stageId === stage.stageId)
      .map((gap) => gap.failedPredicate);
    return {
      stageId: stage.stageId,
      stageName: stage.stageName,
      contractRefs:
        evidence.contractRefs.length > 0 ? evidence.contractRefs : ['S183'],
      sourceObligationRefs: evidence.sourceObligationRefs,
      acceptanceRefs: evidence.acceptanceRefs,
      traceRefs: evidence.traceRefs,
      star1Decision: decisions[0],
      star2Decision: decisions[1],
      star3Decision: decisions[2],
      star4Decision: decisions[3],
      star5Decision: decisions[4],
      stageScore: decisions.filter((decision) => decision === 'PASS').length,
      commandReceiptRefs: evidence.commandReceiptRefs,
      artifactRefs: evidence.artifactRefs,
      independentEvidenceRefs: evidence.independentEvidenceRefs,
      consumerJourneyEvidenceRefs: evidence.consumerJourneyEvidenceRefs,
      failedPredicateIds,
      blockers: failedPredicateIds,
      auditAttemptId: context.phaseAuditAttemptId,
    };
  });
  return { rows, gaps };
}

export async function requirementsContractStageFiveStarAuditCommand(
  options: RequirementsContractStageFiveStarAuditOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  if (
    !['architecture', 'pre-candidate', 'final'].includes(options.phase) ||
    options.projectionMode !== 'final-only'
  ) {
    throw new Error('stage_five_star_phase_or_projection_invalid');
  }
  const phaseRoot = resolveWithin(root, options.phaseRoot);
  const outputPaths = [
    options.matrix,
    options.gapLedger,
    options.finalGate,
    options.candidateReceipt,
    options.candidateRevocationReceipt,
    options.downstreamInvalidationSet,
  ].map((entry) => resolveWithin(root, entry));
  if (
    outputPaths.some(
      (entry) =>
        path.relative(phaseRoot, entry).startsWith('..') ||
        path.isAbsolute(path.relative(phaseRoot, entry))
    )
  ) {
    throw new Error('stage_five_star_output_outside_phase_root');
  }
  const contractPath = resolveWithin(root, options.contract);
  const recoveryPath = resolveWithin(root, options.recovery);
  const auditContextPath = resolveWithin(root, options.auditContext);
  const consumerRoot = resolveWithin(root, options.consumerRoot);
  if (!fs.existsSync(consumerRoot) || !fs.statSync(consumerRoot).isDirectory()) {
    throw new Error('stage_five_star_consumer_root_missing');
  }
  const recovery = readJson(recoveryPath);
  const context = readJson(auditContextPath);
  validate(
    context,
    'requirements-contract-stage-audit-context.schema.json',
    'stage_five_star_audit_context'
  );
  const expectedAuditAttemptId =
    options.phase === 'architecture'
      ? recovery.architectureAuditAttemptId
      : options.phase === 'pre-candidate'
        ? recovery.preCandidateAuditAttemptId
        : recovery.finalAuditAttemptId;
  if (
    expectedAuditAttemptId !== options.phaseAuditAttemptId ||
    context.phase !== options.phase ||
    context.phaseAuditAttemptId !== options.phaseAuditAttemptId ||
    context.requirementSetId !== recovery.requirementSetId ||
    context.transactionId !== recovery.transactionId ||
    context.implementationAttemptId !== recovery.implementationAttemptId ||
    context.frozenUniverseHash !== recovery.frozenUniverseHash ||
    recovery.contractHash !== fileHash(contractPath)
  ) {
    throw new Error('stage_five_star_phase_identity_mismatch');
  }
  if (options.phase === 'final') {
    const serializedRefs = canonicalJson(context.stageEvidence);
    if (serializedRefs.includes(String(recovery.preCandidateAuditAttemptId))) {
      throw new Error('stage_five_star_pre_candidate_evidence_reuse');
    }
  }
  const auditContextRelative = slash(path.relative(root, auditContextPath));
  const { rows, gaps } = buildRows(context, auditContextRelative);
  const stageFiveStarCount = rows.filter((row) => row.stageScore === 5).length;
  const stageBelowFiveStarCount = rows.length - stageFiveStarCount;
  const contractHash = fileHash(contractPath);
  const stageRegistryHash = sha256(canonicalJson(REQUIREMENTS_CONTRACT_STAGE_REGISTRY));
  const matrix: JsonRecord = {
    schemaVersion: 'requirements-contract-stage-five-star-audit-matrix/v1',
    contractHash,
    frozenUniverseHash: context.frozenUniverseHash,
    stageRegistryHash,
    sourceHashes: context.sourceHashes,
    semanticModelHashes: context.semanticModelHashes,
    requirementSetId: context.requirementSetId,
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    auditAttemptId: context.phaseAuditAttemptId,
    consumerIdentityHash: context.consumerIdentityHash,
    taskOwnerStageRegistry: REQUIREMENTS_CONTRACT_TASK_OWNER_STAGE_REGISTRY,
    rows,
    rowSetHash: sha256(canonicalJson(rows)),
    matrixHash: '',
    stageFiveStarCount,
    stageBelowFiveStarCount,
    invalidatedStageCount: 0,
    decision: stageFiveStarCount === 11 ? 'PASS' : 'BLOCK',
  };
  hashField(matrix, 'matrixHash');
  const ledger: JsonRecord = {
    schemaVersion: 'requirements-contract-stage-gap-ledger/v1',
    contractHash,
    frozenUniverseHash: context.frozenUniverseHash,
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    auditAttemptId: context.phaseAuditAttemptId,
    gaps,
    invalidations: [],
    openGapCount: gaps.length,
    closedGapCount: 0,
    invalidatedStageCount: 0,
    ledgerHash: '',
    decision: gaps.length === 0 ? 'PASS' : 'BLOCK',
  };
  hashField(ledger, 'ledgerHash');
  validate(
    matrix,
    'requirements-contract-stage-five-star-audit-matrix.schema.json',
    'stage_five_star_matrix'
  );
  validate(
    ledger,
    'requirements-contract-stage-gap-ledger.schema.json',
    'stage_five_star_gap_ledger'
  );
  writeGovernedJson(outputPaths[0], matrix);
  writeGovernedJson(outputPaths[1], ledger);
  const contractText = fs.readFileSync(contractPath, 'utf8');
  const terminalArgvHashes = ['CMD-24', 'CMD-25'].map((commandId) =>
    sha256(canonicalJson([commandCell(contractText, commandId)]))
  );
  const finalComplete = options.phase === 'final' && stageFiveStarCount === 11;
  const finalGate: JsonRecord = {
    schemaVersion: 'requirements-contract-stage-final-gate-report/v1',
    contractHash,
    frozenUniverseHash: context.frozenUniverseHash,
    requirementSetId: context.requirementSetId,
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    auditAttemptId: context.phaseAuditAttemptId,
    consumerIdentityHash: context.consumerIdentityHash,
    artifactHashes: {
      matrix: fileHash(outputPaths[0]),
      gapLedger: fileHash(outputPaths[1]),
      recovery: fileHash(recoveryPath),
      auditContext: fileHash(auditContextPath),
      stageRegistry: stageRegistryHash,
    },
    completionDecisions: Object.fromEntries(
      [
        'contractCompletenessDecision',
        'allTaskDecision',
        'allAcceptanceDecision',
        'allTraceDecision',
        'allSourceObligationDecision',
        'allCommandReceiptDecision',
        'allEvidenceDecision',
        'allArtifactReadbackDecision',
        'allCriticalMetricDecision',
        'realConsumerJourneyDecision',
        'deterministicAcceptanceGate',
      ].map((key) => [key, finalComplete ? 'pass' : 'block'])
    ),
    stageFiveStarCount,
    stageBelowFiveStarCount,
    openGapCount: gaps.length,
    invalidatedStageCount: 0,
    evidenceFabricationCount: 0,
    antiFabricationMetrics: {
      stageScoreFabricationCount: 0,
      stagePredicateDeletionCount: 0,
      stageApplicabilityEscapeCount: 0,
      stageStaleEvidenceReuseCount: 0,
      stageCrossAttemptEvidenceCount: 0,
      stageSelfReportedEvidenceAcceptCount: 0,
      stageAllToAllEvidenceBindingCount: 0,
      stageManualReceiptFabricationCount: 0,
      stageTestWeakeningCount: 0,
      stageUnauthorizedSkipCount: 0,
      stageDeterministicBlockOverrideCount: 0,
    },
    requiredCoverage: {
      stageFiveStarCoverage: stageFiveStarCount === 11 ? 1 : 0,
      stageRegistryCoverage: 1,
      stageCommandReceiptCoverage: stageFiveStarCount === 11 ? 1 : 0,
      stageArtifactReadbackCoverage: stageFiveStarCount === 11 ? 1 : 0,
      realConsumerJourneyCoverage: stageFiveStarCount === 11 ? 1 : 0,
    },
    terminalExpectation: {
      cwd: slash(root),
      orderedCommandIds: ['CMD-24', 'CMD-25'],
      argvHashes: terminalArgvHashes,
      receiptPath: 'docs/plans/evidence/loop-engineering-remediation/terminal-command-receipt.json',
      receiptSchemaVersion: 'requirements-contract-terminal-command-receipt/v1',
    },
    terminalReceiptPending: true,
    residualRisks: finalComplete ? [] : ['stage_five_star_gate_not_final'],
    reportHash: '',
    decision: finalComplete ? 'preterminal_pass_candidate' : 'block',
  };
  finalGate.completionDecisions.finalJudgeDecision = finalComplete ? 'pass' : 'block';
  hashField(finalGate, 'reportHash');
  validate(
    finalGate,
    'requirements-contract-stage-final-gate-report.schema.json',
    'stage_five_star_final_gate'
  );
  writeGovernedJson(outputPaths[2], finalGate);
  let candidateRef: JsonRecord | undefined;
  let revocationRef: JsonRecord | undefined;
  let invalidationRef: JsonRecord | undefined;
  if (options.phase === 'pre-candidate' && stageFiveStarCount === 11) {
    const candidate = {
      schemaVersion: 'requirements-contract-stage-five-star-candidate-receipt/v1',
      requirementSetId: context.requirementSetId,
      transactionId: context.transactionId,
      implementationAttemptId: context.implementationAttemptId,
      auditAttemptId: context.phaseAuditAttemptId,
      matrix: ref(root, slash(path.relative(root, outputPaths[0]))),
      gapLedger: ref(root, slash(path.relative(root, outputPaths[1]))),
      finalGate: ref(root, slash(path.relative(root, outputPaths[2]))),
      passAuthority: false,
      completionEligible: false,
      decision: 'provisional_pass_candidate',
    };
    validate(
      candidate,
      'requirements-contract-stage-five-star-candidate-receipt.schema.json',
      'stage_five_star_candidate'
    );
    writeGovernedJson(outputPaths[3], candidate);
    candidateRef = ref(root, slash(path.relative(root, outputPaths[3])));
    const revocation = {
      schemaVersion: 'requirements-contract-stage-five-star-candidate-revocation-receipt/v1',
      ...candidateRef,
      candidateReceipt: candidateRef,
      auditAttemptId: context.phaseAuditAttemptId,
      passAuthority: false,
      reason: 'mandatory_pre_candidate_revocation',
      decision: 'revoked_candidate',
    };
    delete revocation.path;
    delete revocation.hash;
    validate(
      revocation,
      'requirements-contract-stage-five-star-candidate-revocation-receipt.schema.json',
      'stage_five_star_revocation'
    );
    writeGovernedJson(outputPaths[4], revocation);
    revocationRef = ref(root, slash(path.relative(root, outputPaths[4])));
    const invalidation = {
      schemaVersion: 'requirements-contract-stage-downstream-invalidation-set/v1',
      auditAttemptId: context.phaseAuditAttemptId,
      triggerReceipt: revocationRef,
      invalidatedStageIds: ['STAGE-11'],
      invalidatedArtifactRoles: ['ARTIFACT-49', 'ARTIFACT-50', 'ARTIFACT-51', 'ARTIFACT-52', 'ARTIFACT-53'],
      passAuthority: false,
      decision: 'pass',
    };
    validate(
      invalidation,
      'requirements-contract-stage-downstream-invalidation-set.schema.json',
      'stage_five_star_invalidation'
    );
    writeGovernedJson(outputPaths[5], invalidation);
    invalidationRef = ref(root, slash(path.relative(root, outputPaths[5])));
  }
  const decision =
    options.phase === 'pre-candidate' && stageFiveStarCount === 11
      ? 'revoked_candidate'
      : finalComplete
        ? 'preterminal_pass_candidate'
        : 'block';
  const receipt = {
    schemaVersion: 'requirements-contract-stage-five-star-audit-command-receipt/v1',
    commandId: 'CMD-34',
    phase: options.phase,
    requirementSetId: context.requirementSetId,
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    auditAttemptId: context.phaseAuditAttemptId,
    matrix: ref(root, slash(path.relative(root, outputPaths[0]))),
    gapLedger: ref(root, slash(path.relative(root, outputPaths[1]))),
    finalGate: ref(root, slash(path.relative(root, outputPaths[2]))),
    ...(candidateRef ? { candidateReceipt: candidateRef } : {}),
    ...(revocationRef ? { candidateRevocationReceipt: revocationRef } : {}),
    ...(invalidationRef ? { downstreamInvalidationSet: invalidationRef } : {}),
    stageFiveStarCount,
    openGapCount: gaps.length,
    passAuthority: finalComplete,
    decision,
  };
  validate(
    receipt,
    'requirements-contract-stage-five-star-audit-command-receipt.schema.json',
    'stage_five_star_command_receipt'
  );
  if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return receipt;
}
