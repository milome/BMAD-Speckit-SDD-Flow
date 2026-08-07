import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { runMainAgentPreConfirmationDrilldown } from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  criticalAuditorIndependentProviderRunHash,
  type CriticalAuditorIndependentProviderExpectation,
} from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence';
import {
  renderStaleImplementationConfirmation,
  type StaleImplementationConfirmationDescriptor,
} from './requirements-contract-source-fixture';

export {
  createSourceAuthorityProjectionDescriptor,
  createStaleImplementationConfirmationDescriptor,
  renderSourceAuthorityProjection,
  writeSourceAuthorityProjection,
  type SourceAuthorityProjectionDescriptor,
  type SourceAuthorityProjectionOptions,
  type StaleImplementationConfirmationDescriptor,
} from './requirements-contract-source-fixture';

type JsonObject = Record<string, unknown>;

interface CriticalAuditorFixtureInput {
  roundIndex: number;
  independentProviderExpectation: CriticalAuditorIndependentProviderExpectation;
  gateDryRun: {
    hash: string;
    reconciliation: { issueCount: number };
    reportPath: string;
    actionableBlockingIssues?: Array<{ code?: string }>;
  };
  packetProjectionSummary: {
    projectionGroups: string[];
    projectionRefs: string[];
  };
}

export interface MinimalConsumerRequirementDescriptor {
  seedHash: string;
  refs: {
    functionalRequirementId: string;
    mustRequirementId: string;
    negativeRequirementId: string;
    failureId: string;
    acceptanceId: string;
    negativeAcceptanceId: string;
    commandId: string;
    negativeCommandId: string;
    endToEndId: string;
    mustTraceId: string;
    negativeTraceId: string;
    pathId: string;
    outOfScopeId: string;
  };
  target: {
    path: string;
    owner: string;
  };
  verification: {
    testPath: string;
    requiredCommand: string;
  };
  session: {
    sessionId: string;
    turnId: string;
    messageId: string;
    actorIdentityClass: string;
    branch: string;
    capturedAt: string;
  };
  attempt: {
    implementationAttemptId: string;
  };
  semantics: {
    language: string;
    title: string;
    requirement: string;
    negativeAssertion: string;
    failureCondition: string;
    safeFailureBehavior: string;
    oracle: string;
    outOfScope: string;
  };
}

export interface MinimalConsumerRequirementMaterialization {
  sourcePath: string;
  descriptor: MinimalConsumerRequirementDescriptor;
  authoringOptions: {
    targetPath: string;
    requiredCommand: string;
    sessionId: string;
    sessionTurnId: string;
    sessionMessageId: string;
    sessionActorIdentityClass: string;
    sessionBranch: string;
    sessionCapturedAt: string;
    confirmationLanguage: string;
    implementationAttemptId: string;
  };
}

export interface MinimalConsumerRequirementWriteOptions {
  staleImplementationConfirmation?: StaleImplementationConfirmationDescriptor;
}

export function createTempRoot(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function installJudgeRuntimeConfig(root: string): string {
  const source = path.join(process.cwd(), '_bmad', '_config', 'governance-remediation.yaml');
  if (!existsSync(source)) {
    throw new Error(`canonical Judge runtime config is missing: ${source}`);
  }
  return writeText(
    root,
    path.join('_bmad', '_config', 'governance-remediation.yaml'),
    readFileSync(source, 'utf8')
  );
}

export function removeTempRoot(root: string): void {
  rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

export function writeText(root: string, relativePath: string, text: string): string {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
  return target;
}

export function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function sha256File(filePath: string): string {
  return sha256Text(readFileSync(filePath, 'utf8'));
}

export function createTestAuthoringExecutionOptions(seed: string): {
  sessionId: string;
  sessionTurnId: string;
  sessionMessageId: string;
  sessionActorIdentityClass: string;
  sessionBranch: string;
  sessionCapturedAt: string;
  implementationAttemptId: string;
} {
  const normalizedSeed = seed.trim();
  if (!normalizedSeed) throw new Error('test authoring execution seed must be non-empty');
  const digest = createHash('sha256').update(normalizedSeed, 'utf8').digest('hex');
  const token = digest.slice(0, 12);
  const capturedSecond = String(Number.parseInt(digest.slice(12, 14), 16) % 60).padStart(2, '0');
  return {
    sessionId: `session-${token}`,
    sessionTurnId: `turn-${token}`,
    sessionMessageId: `message-${token}`,
    sessionActorIdentityClass: 'test_fixture',
    sessionBranch: `fixture-${token}`,
    sessionCapturedAt: `2026-01-01T00:00:${capturedSecond}.000Z`,
    implementationAttemptId: `IMPL-ATTEMPT-${token.toUpperCase()}`,
  };
}

export function createMinimalConsumerRequirementDescriptor(
  seed: string
): MinimalConsumerRequirementDescriptor {
  const normalizedSeed = seed.trim();
  if (!normalizedSeed) {
    throw new Error('minimal Consumer Requirement fixture seed must be non-empty');
  }
  const digest = createHash('sha256').update(normalizedSeed, 'utf8').digest('hex');
  const token = digest.slice(0, 12);
  const ordinal = String((Number.parseInt(digest.slice(0, 8), 16) % 900) + 100);
  const secondaryOrdinal = String(((Number(ordinal) - 99) % 900) + 100).padStart(3, '0');
  const testPath = `tests/consumer-fixtures/consumer-${token}.test.ts`;
  const capturedSecond = String(Number.parseInt(digest.slice(8, 10), 16) % 60).padStart(2, '0');

  return {
    seedHash: `sha256:${digest}`,
    refs: {
      functionalRequirementId: `FR-${ordinal}`,
      mustRequirementId: `MUST-FR-${ordinal}`,
      negativeRequirementId: `NEG-${secondaryOrdinal}`,
      failureId: `FAIL-${secondaryOrdinal}`,
      acceptanceId: `ACC-${ordinal}`,
      negativeAcceptanceId: `ACC-${secondaryOrdinal}`,
      commandId: `CMD-${ordinal}`,
      negativeCommandId: `CMD-${secondaryOrdinal}`,
      endToEndId: `E2E-${ordinal}`,
      mustTraceId: `TRACE-${ordinal}`,
      negativeTraceId: `TRACE-${secondaryOrdinal}`,
      pathId: `PATH-${ordinal}`,
      outOfScopeId: `OUT-${secondaryOrdinal}`,
    },
    target: {
      path: `src/consumer-fixtures/consumer-${token}.ts`,
      owner: `consumer-${token}-owner`,
    },
    verification: {
      testPath,
      requiredCommand: `npx vitest run ${testPath}`,
    },
    session: {
      sessionId: `session-${token}`,
      turnId: `turn-${token}`,
      messageId: `message-${token}`,
      actorIdentityClass: 'requesting_user',
      branch: `fixture-${token}`,
      capturedAt: `2026-01-01T00:00:${capturedSecond}.000Z`,
    },
    attempt: {
      implementationAttemptId: `IMPL-ATTEMPT-${token}`,
    },
    semantics: {
      language: 'en-US',
      title: `Seed Derived Consumer Requirement ${token}`,
      requirement: 'The Consumer must publish the complete source-authorized result.',
      negativeAssertion:
        'The Consumer must not publish a partial result when source validation fails.',
      failureCondition: 'The source-authorized operation cannot complete safely.',
      safeFailureBehavior:
        'Keep the prior valid result and expose a recoverable failure without partial publication.',
      oracle:
        'The complete result is published exactly once, or the prior valid result remains unchanged.',
      outOfScope: 'The fixture does not change unrelated Consumer execution behavior.',
    },
  };
}

export function artifacts(root: string, recordId: string, requirementSetId = recordId) {
  const authoring = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring'
  );
  const confirmation = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'confirmation'
  );
  return {
    authoring,
    confirmation,
    controlledMustCandidates: path.join(authoring, 'controlled-must-candidates.json'),
    requirementCoverageLedger: path.join(authoring, 'requirement-coverage-ledger.json'),
    targetAuthorityReport: path.join(authoring, 'target-authority-report.json'),
    validationAuthorityReport: path.join(authoring, 'validation-authority-report.json'),
    projectionDomainSanityReport: path.join(authoring, 'projection-domain-sanity-report.json'),
    sourceMutationDecision: path.join(authoring, 'source-mutation-decision.json'),
    authoringTransaction: path.join(authoring, 'authoring-transaction.json'),
    semanticIr: path.join(authoring, 'semantic-ir.json'),
    semanticResolutionDir: path.join(authoring, 'resolution', 'semantic'),
    interactionResolution: path.join(authoring, 'interaction-resolution.json'),
    intakeReceipt: path.join(authoring, 'intake', 'intake-receipt.json'),
    invocationAuthorityReceipt: path.join(authoring, 'intake', 'invocation-authority-receipt.json'),
    intentLineageLedger: path.join(authoring, 'intake', 'intent-lineage-ledger.json'),
    semanticConservationManifest: path.join(
      authoring,
      'proofs',
      'semantic-conservation-manifest.json'
    ),
    renderRoundTripReport: path.join(
      authoring,
      'proofs',
      'render-roundtrip-report.json'
    ),
    promotionReadbackRoundTripReport: path.join(
      authoring,
      'proofs',
      'promotion-readback-roundtrip-report.json'
    ),
    compiledModel: path.join(authoring, 'requirement-contract-model.json'),
    compilerClosureReport: path.join(authoring, 'compiler-closure-report.json'),
    draftSourcePreview: path.join(authoring, 'draft-source-preview.md'),
    promotionReceipt: path.join(authoring, 'promotion-receipt.json'),
    draftImplementationConfirmation: path.join(authoring, 'draft-implementation-confirmation.json'),
    encodingReport: path.join(authoring, 'encoding-report.json'),
    receipt1: path.join(authoring, 'critical-auditor-receipt-round-1.json'),
    receipt2: path.join(authoring, 'critical-auditor-receipt-round-2.json'),
    receipt3: path.join(authoring, 'critical-auditor-receipt-round-3.json'),
    scaleAssessmentInitial: path.join(authoring, 'scale-assessment-initial.json'),
    scaleRoutingDecision: path.join(authoring, 'scale-routing-decision.json'),
    checkpointPersistenceEvidence: path.join(authoring, 'checkpoint-persistence-evidence.json'),
    checkpointReceiptPaths: Array.from({ length: 9 }, (_item, index) =>
      path.join(authoring, `checkpoint-receipt-cp-${String(index).padStart(2, '0')}.json`)
    ),
    progress: path.join(authoring, 'semantic-checkpoint-progress.json'),
    reconciliationReport: path.join(authoring, 'must_packet_source_reconciliation_report.json'),
    preRenderMustGate: path.join(authoring, 'pre-render-must-decomposition-gate-report.json'),
    preRenderGlobalConsistency: path.join(authoring, 'pre-render-global-consistency-report.json'),
    sourceMaterializationReceipt: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requirementSetId,
      'authoring',
      'source-materialization-receipt.json'
    ),
    html: path.join(confirmation, 'confirmation.html'),
    confirmationSummary: path.join(confirmation, 'confirmation-summary.json'),
    confirmationRenderReport: path.join(confirmation, 'confirmation-render-report.json'),
  };
}

export function readJson<T = JsonObject>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

export function stagingTransactionDir(root: string, recordId: string): string {
  const stagingRoot = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring',
    'staging'
  );
  const entries = existsSync(stagingRoot)
    ? readdirSync(stagingRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(stagingRoot, entry.name))
    : [];
  if (entries.length === 0) {
    throw new Error(`expected at least one staging transaction under ${stagingRoot}, found 0`);
  }
  const committedNext = (transactionDir: string): string | null => {
    for (const fileName of ['audit-source-transition.json', 'staging-repair-commit.json']) {
      const commitPath = path.join(transactionDir, fileName);
      if (!existsSync(commitPath)) continue;
      const commit = readJson<Record<string, unknown>>(commitPath);
      if (commit.status === 'committed' && typeof commit.nextTransactionId === 'string') {
        return commit.nextTransactionId;
      }
    }
    return null;
  };
  const leaves = entries.filter((transactionDir) => committedNext(transactionDir) === null);
  const candidates = leaves.length > 0 ? leaves : entries;
  return candidates.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
}

export function roundArtifact(
  root: string,
  recordId: string,
  kind: 'request' | 'response' | 'receipt',
  roundIndex = 1
): string {
  const base = stagingTransactionDir(root, recordId);
  const file =
    kind === 'request'
      ? `critical-auditor-round-request-${roundIndex}.json`
      : kind === 'response'
        ? `critical-auditor-round-response-${roundIndex}.json`
        : `critical-auditor-receipt-round-${roundIndex}.json`;
  return path.join(base, file);
}

export function sourcePromotionDecisionPath(root: string, recordId: string): string {
  return path.join(stagingTransactionDir(root, recordId), 'source-promotion-decision.json');
}

export function writeCheckpointPersistenceEvidence(root: string, recordId: string): string {
  const paths = artifacts(root, recordId, `${recordId}-SET`);
  const route = readJson<Record<string, unknown>>(paths.scaleRoutingDecision);
  const progress = readJson<Record<string, unknown>>(paths.progress);
  const checkpointIds = Array.isArray(progress.checkpoints)
    ? (progress.checkpoints as Array<Record<string, unknown>>)
        .filter((checkpoint) => checkpoint.status === 'passed')
        .map((checkpoint) => String(checkpoint.id))
    : [];
  const evidence = {
    ok: true,
    status: 'satisfied',
    routeDecisionPath: paths.scaleRoutingDecision,
    routeDecisionHash: route.routeDecisionHash,
    checkpointPersistenceSatisfiedCandidate: true,
    checkpointPersistenceRef: {
      routeDecisionHash: route.routeDecisionHash,
      progressPath: paths.progress,
      progressHash: sha256File(paths.progress),
      completedCheckpointIds: checkpointIds,
      preRenderMustDecompositionGateHash: sha256File(paths.preRenderMustGate),
      preRenderGlobalConsistencyHash: sha256File(paths.preRenderGlobalConsistency),
      packetSourceReconciliationHash: sha256File(paths.reconciliationReport),
    },
    progressHash: sha256File(paths.progress),
    preRenderMustDecompositionGateHash: sha256File(paths.preRenderMustGate),
    preRenderGlobalConsistencyHash: sha256File(paths.preRenderGlobalConsistency),
    packetSourceReconciliationHash: sha256File(paths.reconciliationReport),
  };
  const evidencePath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring',
    'checkpoint-persistence-evidence.external.json'
  );
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidencePath;
}

export function stagingMustDecompositionPacket(
  root: string,
  recordId: string
): Record<string, unknown> {
  const packetFile = path.join(
    stagingTransactionDir(root, recordId),
    'must_decomposition_packet.json'
  );
  const parsed = readJson<{ must_decomposition_packet?: Record<string, unknown> }>(packetFile);
  if (!parsed.must_decomposition_packet) {
    throw new Error(`must_decomposition_packet missing from ${packetFile}`);
  }
  return parsed.must_decomposition_packet;
}

export function firstProjectionRef(packet: Record<string, unknown>): string {
  const packets = Array.isArray(packet.mustPackets) ? packet.mustPackets : [];
  for (const mustPacket of packets) {
    if (!mustPacket || typeof mustPacket !== 'object' || Array.isArray(mustPacket)) {
      continue;
    }
    for (const value of Object.values(mustPacket as Record<string, unknown>)) {
      if (!Array.isArray(value)) {
        continue;
      }
      for (const row of value) {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          const id = String((row as Record<string, unknown>).id ?? '').trim();
          if (id) {
            return id;
          }
        }
      }
    }
  }
  throw new Error('projection ref not found in packet');
}

function findingRef(value: Record<string, unknown>): string {
  for (const key of ['findingRef', 'gapId', 'id', 'code', 'blockerCode']) {
    const candidate = String(value[key] ?? '').trim();
    if (candidate) {
      return candidate;
    }
  }
  return '';
}

function priorFindingsDispositionFromRequest(
  request: Record<string, unknown>,
  gateDryRun: Record<string, unknown>
): Record<string, unknown>[] {
  const dispositions = new Map<string, Record<string, unknown>>();
  const addDisposition = (
    value: Record<string, unknown>,
    disposition: 'resolved' | 'unchanged' | 'rejected',
    evidenceRef: string
  ) => {
    const ref = findingRef(value);
    if (!ref || dispositions.has(ref)) {
      return;
    }
    dispositions.set(ref, {
      findingRef: ref,
      disposition,
      evidenceRefs: evidenceRef ? [evidenceRef] : [],
    });
  };

  const previousReceipts = Array.isArray(request.previousReceipts)
    ? (request.previousReceipts as Array<Record<string, unknown>>)
    : [];
  for (const envelope of previousReceipts) {
    const receipt =
      envelope.criticalAuditorReceipt &&
      typeof envelope.criticalAuditorReceipt === 'object' &&
      !Array.isArray(envelope.criticalAuditorReceipt)
        ? (envelope.criticalAuditorReceipt as Record<string, unknown>)
        : envelope;
    const evidenceRef = String(receipt.receiptHash ?? receipt.responseHash ?? '').trim();
    for (const key of [
      'gapCandidates',
      'validatedGaps',
      'mutationPressureFindings',
      'overBroadTaskFindings',
      'missingProjectionFindings',
      'invalidProofFindings',
      'legacyBypassFindings',
      'sourceMaterializationFindings',
    ]) {
      const findings = Array.isArray(receipt[key])
        ? (receipt[key] as Array<Record<string, unknown>>)
        : [];
      for (const finding of findings) {
        addDisposition(finding, 'unchanged', evidenceRef);
      }
    }
    const rejectedFindings = Array.isArray(receipt.rejectedGapCandidates)
      ? (receipt.rejectedGapCandidates as Array<Record<string, unknown>>)
      : [];
    for (const finding of rejectedFindings) {
      addDisposition(finding, 'rejected', evidenceRef);
    }
  }

  const gateEvidenceRef = String(gateDryRun.reportPath ?? '').trim();
  const actionableBlockingIssues = Array.isArray(gateDryRun.actionableBlockingIssues)
    ? (gateDryRun.actionableBlockingIssues as Array<Record<string, unknown>>)
    : [];
  for (const issue of actionableBlockingIssues) {
    addDisposition(issue, 'unchanged', gateEvidenceRef);
  }
  return [...dispositions.values()];
}

export function buildValidResponseFromRequest(
  request: Record<string, unknown>,
  packet: Record<string, unknown>
): Record<string, unknown> {
  const gateDryRun = request.gateDryRun as Record<string, unknown>;
  const actionableBlockingIssues = Array.isArray(gateDryRun.actionableBlockingIssues)
    ? (gateDryRun.actionableBlockingIssues as Array<Record<string, unknown>>)
    : [];
  const reviewedMustRefs = Array.isArray(request.mustRefs) ? (request.mustRefs as string[]) : [];
  const projectionSummary = request.packetProjectionSummary as Record<string, unknown> | undefined;
  const projectionRefs = Array.isArray(projectionSummary?.projectionRefs)
    ? (projectionSummary.projectionRefs as string[])
    : [];
  const projectionQualityGate = request.projectionQualityGate as
    | Record<string, unknown>
    | undefined;
  const checkedProjectionQualityRuleCodes = Array.isArray(projectionQualityGate?.requiredRuleCodes)
    ? (projectionQualityGate.requiredRuleCodes as string[])
    : [];
  const response = {
    schemaVersion: 'critical-auditor-round-response/v1',
    verdict: 'no_new_valid_gap',
    roundIndex: request.roundIndex,
    transactionId: request.transactionId,
    namespaceVersion: request.namespaceVersion,
    requestHash: request.requestHash,
    sourceHash: request.sourceHash,
    sourceDocumentHash: request.sourceDocumentHash,
    sourceBytesHash: request.sourceBytesHash,
    semanticModelHash: request.semanticModelHash,
    implementationConfirmationHash: request.implementationConfirmationHash,
    packetHash: request.packetHash,
    projectionSetHash: request.projectionSetHash,
    gateDryRunHash: gateDryRun.gateDryRunHash ?? gateDryRun.hash,
    reconciliationIssueCount: (gateDryRun.reconciliation as Record<string, unknown>).issueCount,
    checkedProjectionGroups: request.packetProjectionSummary
      ? (request.packetProjectionSummary as Record<string, unknown>).projectionGroups
      : [
          'semantic_kernel',
          'must_decomposition_packet',
          'source_materialization_receipt',
          'packet_source_reconciliation',
          'pre_render_must_decomposition_gate',
        ],
    checkedProjectionQualityRuleCodes,
    reviewedMustRefs,
    reviewedProjectionRefs: [projectionRefs[0] ?? firstProjectionRef(packet)],
    priorFindingsDisposition: priorFindingsDispositionFromRequest(request, gateDryRun),
    rejectedGapCandidates: [{ id: 'REJ-1', reason: 'no new valid gap detected' }],
    falsePositiveProofs: actionableBlockingIssues.map((issue) => ({
      blockerCode: String(issue.code ?? ''),
      proofType: 'current_source_packet_hash_match',
      evidenceRefs: [String(gateDryRun.reportPath ?? 'gate-dry-run')],
    })),
    rationale: 'No new valid gap detected in the current staging transaction.',
  };
  const binding = request.independentProviderBinding as Record<string, unknown> | undefined;
  if (!binding) {
    throw new Error('critical auditor request does not contain independentProviderBinding');
  }
  const evidenceWithoutRunHash = {
    ...binding,
    requestedModel: binding.model,
    model:
      typeof binding.model === 'string' && binding.model.trim()
        ? binding.model
        : 'fixture-main-session-judge',
    transactionId: request.transactionId,
    auditAttemptId: request.auditAttemptId,
    providerRunId: `critical-auditor-run/${String(request.requestHash).slice(-24)}`,
    requestHash: request.requestHash,
    responseHash: sha256Text(JSON.stringify(response)),
    sourceDocumentHash: request.sourceDocumentHash,
    semanticModelHash: request.semanticModelHash,
    projectionSetHash: request.projectionSetHash,
  };
  return {
    ...response,
    independentProviderEvidence: {
      ...evidenceWithoutRunHash,
      runHash: criticalAuditorIndependentProviderRunHash(evidenceWithoutRunHash),
    },
  };
}

export function withIndependentProviderEvidence<T extends Record<string, unknown>>(
  input: Pick<CriticalAuditorFixtureInput, 'roundIndex' | 'independentProviderExpectation'>,
  result: T
): T & { independentProviderEvidence: Record<string, unknown> } {
  const expectation = input.independentProviderExpectation;
  const evidenceWithoutRunHash = {
    ...expectation,
    requestedModel: expectation.model,
    model: expectation.model ?? 'fixture-main-session-judge',
    providerRunId: `critical-auditor-run/${input.roundIndex}/${expectation.requestHash.slice(-16)}`,
    responseHash: sha256Text(JSON.stringify(result)),
  };
  return {
    ...result,
    independentProviderEvidence: {
      ...evidenceWithoutRunHash,
      runHash: criticalAuditorIndependentProviderRunHash(evidenceWithoutRunHash),
    },
  };
}

export function readImplementationConfirmation(filePath: string): JsonObject {
  const text = readFileSync(filePath, 'utf8');
  const match = text.match(/^implementationConfirmation:\n[\s\S]*$/m);
  if (!match) {
    throw new Error(`implementationConfirmation block not found: ${filePath}`);
  }
  const parsed = yaml.load(match[0]) as { implementationConfirmation?: JsonObject } | null;
  if (!parsed?.implementationConfirmation) {
    throw new Error(`implementationConfirmation block is invalid: ${filePath}`);
  }
  return parsed.implementationConfirmation;
}

export function cleanCriticalAuditorRound(input: CriticalAuditorFixtureInput) {
  const { roundIndex, gateDryRun, packetProjectionSummary } = input;
  return withIndependentProviderEvidence(input, {
    verdict: 'no_new_valid_gap' as const,
    gateDryRunHash: gateDryRun.hash,
    reconciliationIssueCount: gateDryRun.reconciliation.issueCount,
    checkedProjectionGroups: packetProjectionSummary.projectionGroups,
    checkedProjectionQualityRuleCodes: [
      'projection_per_must_acceptance_not_independent',
      'projection_shared_evidence_without_per_must_oracle',
      'required_command_all_cover_all_without_per_must_assertions',
      'target_modification_path_all_cover_all',
      'current_target_map_not_product_specific',
      'business_visual_generic_or_compressed',
    ],
    reviewedProjectionRefs: packetProjectionSummary.projectionRefs.slice(0, 1),
    priorFindingsDisposition: [
      {
        findingRef: `ROUND-${roundIndex}-BASELINE`,
        disposition: roundIndex === 1 ? 'new' : 'unchanged',
        evidenceRefs: [gateDryRun.reportPath],
      },
    ],
    rejectedGapCandidates: [{ id: `REJ-${roundIndex}`, reason: 'no new valid gap detected' }],
    falsePositiveProofs: (gateDryRun.actionableBlockingIssues ?? []).map((issue) => ({
      blockerCode: String(issue.code ?? ''),
      proofType: 'current_source_packet_hash_match',
      evidenceRefs: [gateDryRun.reportPath],
    })),
    rationale: `Round ${roundIndex} found no new valid gap.`,
  });
}

function withGovernedCriticalAuditorFixture<T>(
  root: string,
  seed: string,
  options: Record<string, unknown>,
  invoke: (forwardedOptions: Record<string, unknown>) => T
): T {
  const judgeRuntimeConfig = path.join(
    root,
    '_bmad',
    '_config',
    'governance-remediation.yaml'
  );
  if (!existsSync(judgeRuntimeConfig)) {
    installJudgeRuntimeConfig(root);
  }
  if (options.criticalAuditorRound !== cleanCriticalAuditorRound) {
    return invoke(options);
  }
  const forwardedOptions = {
    ...createTestAuthoringExecutionOptions(seed),
    criticalAuditorProviderMode: 'main_session_inline',
    ...options,
  };
  delete forwardedOptions.criticalAuditorRound;
  let result = invoke(forwardedOptions);
  const seenRequestHashes = new Set<string>();
  const maxFixtureResponseCount = 12;
  for (
    let responseCount = 0;
    responseCount < maxFixtureResponseCount;
    responseCount += 1
  ) {
    const continuation = (
      result as {
        criticalAuditorContinuation?: Record<string, unknown> | null;
      }
    ).criticalAuditorContinuation;
    if (
      continuation?.providerMode !== 'main_session_inline' ||
      continuation.nextRequiredAction !== 'run_main_session_critical_auditor_round'
    ) {
      return result;
    }
    const continuationPath = (field: 'requestPath' | 'responsePath'): string => {
      const pathRef = String(continuation[field] ?? '').trim();
      if (!pathRef) {
        throw new Error(`critical auditor fixture continuation ${field} is missing`);
      }
      const resolved = path.isAbsolute(pathRef)
        ? path.resolve(pathRef)
        : path.resolve(root, pathRef);
      const relative = path.relative(path.resolve(root), resolved);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`critical auditor fixture continuation ${field} escapes the project root`);
      }
      return resolved;
    };
    const requestPath = continuationPath('requestPath');
    const responsePath = continuationPath('responsePath');
    const request = readJson<Record<string, unknown>>(requestPath);
    const requestHash = String(request.requestHash ?? '').trim();
    if (!/^sha256:[a-f0-9]{64}$/u.test(requestHash)) {
      throw new Error('critical auditor fixture continuation requestHash is invalid');
    }
    if (seenRequestHashes.has(requestHash)) {
      throw new Error(`critical auditor fixture repeated continuation request ${requestHash}`);
    }
    seenRequestHashes.add(requestHash);
    const packet = stagingMustDecompositionPacket(root, seed);
    mkdirSync(path.dirname(responsePath), { recursive: true });
    writeFileSync(
      responsePath,
      `${JSON.stringify(buildValidResponseFromRequest(request, packet), null, 2)}\n`,
      'utf8'
    );
    result = invoke(forwardedOptions);
  }
  const exhaustedContinuation = (
    result as {
      criticalAuditorContinuation?: Record<string, unknown> | null;
    }
  ).criticalAuditorContinuation;
  if (
    exhaustedContinuation?.providerMode === 'main_session_inline' &&
    exhaustedContinuation.nextRequiredAction === 'run_main_session_critical_auditor_round'
  ) {
    throw new Error(
      `critical auditor fixture exceeded ${maxFixtureResponseCount} continuation responses`
    );
  }
  return result;
}

export function runPreConfirmationWithGovernedCriticalAuditorFixture(
  root: string,
  seed: string,
  options: Record<string, unknown>
) {
  return withGovernedCriticalAuditorFixture(root, seed, options, (forwardedOptions) =>
    runMainAgentPreConfirmationDrilldown(root, forwardedOptions)
  );
}

export function runAuthoring(
  root: string,
  source: string,
  recordId: string,
  options: Record<string, unknown> = {}
) {
  return withGovernedCriticalAuditorFixture(root, recordId, options, (forwardedOptions) =>
    runMainAgentPreConfirmationDrilldown(root, {
      source,
      recordId,
      requirementSetId: `${recordId}-SET`,
      ...forwardedOptions,
    })
  );
}

export function writeTestLocalizationResponse(
  root: string,
  recordId: string,
  relativePath = 'localization-response.test.json'
): string {
  const requestPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'authoring',
    'localization-request.json'
  );
  const request = readJson<{
    requestHash: string;
    sourceDocumentHash: string;
    confirmationLanguage: string;
    entries: Array<{
      key: string;
      rowId: string;
      field: string;
      sourceTextHash: string;
    }>;
  }>(requestPath);
  return writeText(
    root,
    relativePath,
    `${JSON.stringify(
      {
        schemaVersion: 'requirements-contract-localization-response/v1',
        requestHash: request.requestHash,
        sourceDocumentHash: request.sourceDocumentHash,
        confirmationLanguage: request.confirmationLanguage,
        providerMode: 'main_session_authoring_agent',
        semanticEquivalenceAttested: true,
        translations: request.entries.map((entry) => ({
          key: entry.key,
          sourceTextHash: entry.sourceTextHash,
          translatedText: `${entry.rowId} 的${entry.field}中文语义译文`,
        })),
      },
      null,
      2
    )}\n`
  );
}

export function runAuthoringWithTestLocalization(
  root: string,
  source: string,
  recordId: string,
  options: Record<string, unknown> = {}
) {
  const first = runAuthoring(root, source, recordId, options);
  if (first.substate !== 'localization_translation_required') {
    return first;
  }
  return runAuthoring(root, source, recordId, {
    ...options,
    localizationResponseFile: writeTestLocalizationResponse(root, recordId),
  });
}

export function runIntakeAuthoring(
  root: string,
  intakeSource: string,
  targetSource: string,
  recordId: string,
  options: Record<string, unknown> = {}
) {
  return withGovernedCriticalAuditorFixture(root, recordId, options, (forwardedOptions) =>
    runMainAgentPreConfirmationDrilldown(root, {
      intakeSource,
      targetSource,
      recordId,
      requirementSetId: `${recordId}-SET`,
      ...forwardedOptions,
    })
  );
}

export function issueCodes(result: { blockingIssues?: Array<{ code: string }> }): string[] {
  return (result.blockingIssues ?? []).map((issue) => issue.code);
}

export function writeConsumerRequirement(
  root: string,
  relativePath = 'docs/requirements/multi-timeframe.md'
) {
  const fixturePath = path.resolve(
    'tests/acceptance/fixtures/requirements-contract/multi-timeframe-display-settings.authority.md'
  );
  return writeText(root, relativePath, readFileSync(fixturePath, 'utf8'));
}

export function writeMinimalConsumerRequirement(
  root: string,
  relativePath: string,
  descriptor: MinimalConsumerRequirementDescriptor,
  options: MinimalConsumerRequirementWriteOptions = {}
): MinimalConsumerRequirementMaterialization {
  const { refs, semantics, target, verification } = descriptor;
  const fixtureExportName = `consumerFixture${descriptor.seedHash.slice('sha256:'.length, 19)}`;
  const testAbsolutePath = path.join(root, verification.testPath);
  const targetModulePath = path
    .relative(path.dirname(testAbsolutePath), path.join(root, target.path))
    .replace(/\\/gu, '/')
    .replace(/\.[cm]?[jt]sx?$/u, '');
  const targetImportPath = targetModulePath.startsWith('.')
    ? targetModulePath
    : `./${targetModulePath}`;
  writeText(root, target.path, `export const ${fixtureExportName} = true;\n`);
  writeText(
    root,
    verification.testPath,
    [
      `import { describe, expect, it } from 'vitest';`,
      `import { ${fixtureExportName} } from '${targetImportPath}';`,
      '',
      `describe('${fixtureExportName}', () => {`,
      `  it('exposes the source-authorized Consumer fixture', () => {`,
      `    expect(${fixtureExportName}).toBe(true);`,
      '  });',
      '});',
      '',
    ].join('\n')
  );
  const sourcePath = writeText(
    root,
    relativePath,
    [
      `# ${semantics.title}`,
      '',
      `Target file: \`${target.path}\``,
      '',
      '## Functional Requirements',
      '',
      '| ID | Requirement | Acceptance link |',
      '| --- | --- | --- |',
      `| ${refs.functionalRequirementId} | ${semantics.requirement} | ${refs.acceptanceId} |`,
      '',
      '## Negative Requirements And Not Done Conditions',
      '',
      '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
      '| --- | --- | --- | --- | --- | --- |',
      `| ${refs.negativeRequirementId} | A partial or unverified result is not complete. | ${semantics.negativeAssertion} | The Consumer publishes a partial result or reports success after validation failure. | ${refs.failureId} | ${refs.negativeAcceptanceId} ${refs.negativeCommandId} |`,
      '',
      '## Failure Matrix',
      '',
      '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
      '| --- | --- | --- | --- | --- | --- |',
      `| ${refs.failureId} | ${semantics.failureCondition} | ${semantics.safeFailureBehavior} | ${refs.negativeRequirementId} | ${refs.acceptanceId} ${refs.negativeAcceptanceId} ${refs.endToEndId} | ${refs.mustRequirementId} |`,
      '',
      '## Acceptance Evidence',
      '',
      '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      `| ${refs.acceptanceId} | Source-authorized Consumer result | ${refs.mustRequirementId} | ${verification.requiredCommand} | ${semantics.oracle} | ${refs.commandId} ${refs.mustTraceId} | ${refs.pathId} owns remediation. |`,
      `| ${refs.negativeAcceptanceId} | Source-authorized Consumer negative control | ${refs.negativeRequirementId} | ${verification.requiredCommand} | ${semantics.negativeAssertion} | ${refs.negativeCommandId} ${refs.negativeTraceId} | ${refs.pathId} owns remediation. |`,
      '',
      '## Test And Verification Paths',
      '',
      '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      `| ${refs.commandId} | delivery-evidence | ${refs.mustRequirementId} | ${verification.requiredCommand} | Exit code 0. | ${semantics.oracle} | ${refs.acceptanceId} ${refs.endToEndId} ${refs.mustTraceId} | ${refs.pathId} owns remediation. | ${verification.testPath} ${target.path} |`,
      `| ${refs.negativeCommandId} | delivery-evidence | ${refs.negativeRequirementId} | ${verification.requiredCommand} | Exit code 0. | ${semantics.negativeAssertion} | ${refs.negativeAcceptanceId} ${refs.endToEndId} ${refs.negativeTraceId} | ${refs.pathId} owns remediation. | ${verification.testPath} ${target.path} |`,
      `| ${refs.endToEndId} | e2e | ${refs.mustRequirementId} ${refs.negativeRequirementId} | ${verification.requiredCommand} | Exit code 0. | ${semantics.oracle} | ${refs.acceptanceId} ${refs.negativeAcceptanceId} ${refs.commandId} ${refs.negativeCommandId} ${refs.mustTraceId} ${refs.negativeTraceId} | ${refs.pathId} owns remediation. | ${verification.testPath} ${target.path} |`,
      '',
      '## Trace Matrix Source',
      '',
      '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      `| ${refs.mustTraceId} | ${refs.mustRequirementId} | ${refs.acceptanceId} | ${refs.acceptanceId} ${refs.endToEndId} | ${refs.commandId} | ${refs.commandId} | none | ${refs.pathId} | ${refs.outOfScopeId} | ${semantics.oracle} | ${refs.mustRequirementId} closes through ${refs.acceptanceId} and ${refs.mustTraceId}. | ${refs.pathId} owns remediation. |`,
      `| ${refs.negativeTraceId} | ${refs.negativeRequirementId} | ${refs.negativeAcceptanceId} | ${refs.negativeAcceptanceId} ${refs.endToEndId} | ${refs.commandId} | ${refs.negativeCommandId} | none | ${refs.pathId} | none | ${semantics.negativeAssertion} | ${refs.negativeRequirementId} closes through ${refs.negativeAcceptanceId} and ${refs.negativeTraceId}. | ${refs.pathId} owns remediation. |`,
      '',
      '## Implementation Path Map',
      '',
      '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      `| ${refs.pathId} | \`${target.path}\` | ${target.owner} | Implement the source-authorized result and safe failure behavior. | ${refs.mustRequirementId} ${refs.negativeRequirementId} | ${refs.acceptanceId} and ${refs.negativeAcceptanceId} pass. | ${refs.acceptanceId} ${refs.negativeAcceptanceId} ${refs.commandId} ${refs.negativeCommandId} ${refs.mustTraceId} ${refs.negativeTraceId} | ${target.owner} owns implementation and rollback. |`,
      '',
      '## Out Of Scope',
      '',
      '| ID | Forbidden scope | Boundary assertion | Evidence |',
      '| --- | --- | --- | --- |',
      `| ${refs.outOfScopeId} | ${semantics.outOfScope} | Preserve unrelated behavior. | ${refs.acceptanceId} |`,
      '',
      ...(options.staleImplementationConfirmation
        ? [renderStaleImplementationConfirmation(options.staleImplementationConfirmation), '']
        : []),
    ].join('\n')
  );
  return {
    sourcePath,
    descriptor,
    authoringOptions: {
      targetPath: target.path,
      requiredCommand: verification.requiredCommand,
      sessionId: descriptor.session.sessionId,
      sessionTurnId: descriptor.session.turnId,
      sessionMessageId: descriptor.session.messageId,
      sessionActorIdentityClass: descriptor.session.actorIdentityClass,
      sessionBranch: descriptor.session.branch,
      sessionCapturedAt: descriptor.session.capturedAt,
      confirmationLanguage: descriptor.semantics.language,
      implementationAttemptId: descriptor.attempt.implementationAttemptId,
    },
  };
}

export function writeLintReadyMinimalConsumerRequirement(
  root: string,
  relativePath: string,
  descriptor: MinimalConsumerRequirementDescriptor,
  options: MinimalConsumerRequirementWriteOptions = {}
): MinimalConsumerRequirementMaterialization {
  const materialized = writeMinimalConsumerRequirement(root, relativePath, descriptor, options);
  const { refs, semantics, target, verification } = descriptor;
  const legacyBody = readFileSync(materialized.sourcePath, 'utf8').replace(
    /^# [^\n]+\r?\n\r?\n/u,
    ''
  );
  const sourceWithCompleteRequirements = legacyBody.replace(
    /## Functional Requirements[\s\S]*?(?=## Negative Requirements And Not Done Conditions)/u,
    [
      '## Functional Requirements',
      '',
      '| ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      `| ${refs.functionalRequirementId} | ${semantics.requirement} | Preserve the source-authorized Consumer result. | ${refs.acceptanceId} | ${semantics.oracle} | ${refs.acceptanceId} ${refs.commandId} ${refs.mustTraceId} | ${refs.pathId} owns implementation and remediation. |`,
      '',
      '## Non-Functional Requirements',
      '',
      '| ID | Category | Requirement | Threshold and evidence | Per-MUST oracle | Assertion source | Responsibility mapping |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      `| NFR-001 | Auditability | The authoring flow must preserve current-attempt checkpoint evidence. | ACC-001, E2E-001, CMD-001, and TRACE-001 prove current checkpoint Receipts. | ${semantics.oracle} | ACC-001 E2E-001 CMD-001 TRACE-001 | ${refs.pathId} owns checkpoint evidence. |`,
      '',
    ].join('\n')
  );
  const sourceWithNfrFailureAuthority = sourceWithCompleteRequirements.replace(
    `| ${refs.acceptanceId} ${refs.negativeAcceptanceId} ${refs.endToEndId} | ${refs.mustRequirementId} |`,
    `| ${refs.acceptanceId} ${refs.negativeAcceptanceId} ${refs.endToEndId} | ${refs.mustRequirementId} MUST-NFR-001 |`
  );
  const sourceWithNfrAcceptance = sourceWithNfrFailureAuthority.replace(
    '\n\n## Test And Verification Paths',
    [
      `\n| ACC-001 | Current-attempt checkpoint Receipt set | MUST-NFR-001 | ${verification.requiredCommand} | ${semantics.oracle} | CMD-001 TRACE-001 | ${refs.pathId} owns checkpoint evidence. |`,
      '',
      '## Test And Verification Paths',
    ].join('\n')
  );
  const sourceWithNfrCommand = sourceWithNfrAcceptance.replace(
    '\n\n## Trace Matrix Source',
    [
      `\n| CMD-001 | contract-validation | MUST-NFR-001 | ${verification.requiredCommand} | Exit code 0 and current checkpoint Receipts. | ${semantics.oracle} | ACC-001 TRACE-001 | ${refs.pathId} owns execution and remediation. | ${verification.testPath} ${target.path} |`,
      `| E2E-001 | e2e | MUST-NFR-001 | ${verification.requiredCommand} | Exit code 0 and current checkpoint Receipts. | ${semantics.oracle} | ACC-001 CMD-001 TRACE-001 | ${refs.pathId} owns execution and remediation. | ${verification.testPath} ${target.path} |`,
      '',
      '## Trace Matrix Source',
    ].join('\n')
  );
  const sourceWithNfrTrace = sourceWithNfrCommand.replace(
    '\n\n## Implementation Path Map',
    [
      `\n| TRACE-001 | MUST-NFR-001 | ACC-001 E2E-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | ${refs.pathId} | none | ${semantics.oracle} | MUST-NFR-001 closes through ACC-001, E2E-001, and TRACE-001. | ${refs.pathId} owns checkpoint remediation. |`,
      '',
      '## Implementation Path Map',
    ].join('\n')
  );
  const canonicalSourcePrd = [
    '---',
    `id: checkpoint-fixture-${descriptor.seedHash.slice('sha256:'.length, 24)}`,
    `title: ${semantics.title}`,
    'status: draft',
    'authoritativeImplementationSource: true',
    'sourceKind: requirements_contract_source_prd',
    'classification: test_fixture',
    'authoring:',
    '  mode: checkpoint_fixture',
    '---',
    '# Requirements Contract Source PRD Template',
    '',
    '## Template Authority',
    '',
    'This fixture exercises the canonical Source PRD authoring contract.',
    '',
    '## Source Metadata',
    '',
    `The source identity is checkpoint-fixture-${descriptor.seedHash.slice('sha256:'.length, 24)}.`,
    '',
    '## Requirement Extraction Boundary',
    '',
    'Only the ID-bound requirement tables are requirement-bearing.',
    '',
    '## Requirement Projection Authority',
    '',
    'Canonical projection preserves every source requirement and closure reference.',
    '',
    '## Renderer Field Source Schema',
    '',
    'Renderer fields derive from the ID-bound source tables.',
    '',
    '## Non-Requirement-Bearing Provenance Reference',
    '',
    'Fixture provenance text does not create requirements.',
    '',
    '## Product Context',
    '',
    sourceWithNfrTrace.trimEnd(),
    '',
    '## Success Criteria',
    '',
    `${refs.acceptanceId} proves checkpoint closure when the required verification command succeeds.`,
    '',
    '## In Scope',
    '',
    `Checkpoint persistence for ${target.path}.`,
    '',
    '## User Journeys',
    '',
    'The author receives current semantic checkpoint Receipts before progression.',
    '',
    '## Architecture Decision Records',
    '',
    'Checkpoint authority remains current-attempt and fail-closed.',
    '',
    '## Source Current State',
    '',
    '| ID | Current behavior | Current path | Limitation | Evidence |',
    '| --- | --- | --- | --- | --- |',
    `| CUR-001 | Checkpoint state requires current semantic evidence. | ${target.path} | Stale or missing Receipts block progress. | ${refs.acceptanceId} |`,
    '',
    '## Source Target State',
    '',
    '| ID | Target behavior | Target path | Acceptance state | Evidence |',
    '| --- | --- | --- | --- | --- |',
    `| TGT-001 | Every checkpoint publishes a current semantic Receipt. | ${target.path} | ${verification.requiredCommand} exits 0. | ${refs.acceptanceId} ${refs.commandId} |`,
    '',
    '## Current Target Map',
    '',
    '| ID | Current refs | Target refs | Transition | Invariant | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    `| CTM-001 | CUR-001 | TGT-001 | verify | Invalid checkpoint state never advances. | ${refs.functionalRequirementId} NFR-001 | ${semantics.oracle} | ${refs.acceptanceId} ${refs.commandId} ${refs.mustTraceId} TRACE-001 | ${refs.pathId} owns recovery. |`,
    '',
    '## Source-to-Contract Projection Map',
    '',
    'Source rows project without creating synthetic requirements.',
    '',
    '## Human-Readable ID-Bound Views',
    '',
    'Happy-path sequence view',
    'Failure-path sequence view',
    'State and flow view',
    'Edge-case view',
    'Business and governance boundary view',
    'Artifact automation plan',
    'Current-vs-target map',
    'aiTddContractExecutionManifestProjection',
    '',
    '## Revision History',
    '',
    'Initial checkpoint fixture revision.',
    '',
    '## Validation Provenance',
    '',
    verification.requiredCommand,
    '',
    '## Audit Findings',
    '',
    'No open fixture findings.',
    '',
    '## Comments',
    '',
    'Generated only for checkpoint acceptance tests.',
    '',
    '## Change Log',
    '',
    `Fixture seed ${descriptor.seedHash}.`,
    '',
  ].join('\n');
  writeFileSync(materialized.sourcePath, canonicalSourcePrd, 'utf8');
  return materialized;
}

export function writeCanonicalizableDirectIntakeRequirement(
  root: string,
  relativePath: string,
  descriptor: MinimalConsumerRequirementDescriptor,
  options: MinimalConsumerRequirementWriteOptions = {}
): MinimalConsumerRequirementMaterialization {
  const materialized = writeLintReadyMinimalConsumerRequirement(
    root,
    relativePath,
    descriptor,
    options
  );
  const canonicalSource = readFileSync(materialized.sourcePath, 'utf8');
  const semanticStart = canonicalSource.indexOf('## Product Context');
  const semanticEnd = canonicalSource.indexOf('## Revision History');
  if (semanticStart < 0 || semanticEnd <= semanticStart) {
    throw new Error('canonicalizable direct intake fixture boundaries are missing');
  }
  const directIntake = [
    `# ${descriptor.semantics.title}`,
    '',
    `Target file: \`${descriptor.target.path}\``,
    '',
    canonicalSource.slice(semanticStart, semanticEnd).trim(),
    '',
  ].join('\n');
  writeFileSync(materialized.sourcePath, directIntake, 'utf8');
  return materialized;
}

export function expectSourceHashUnchanged(source: string, beforeHash: string): void {
  if (!existsSync(source)) {
    throw new Error(`source disappeared: ${source}`);
  }
  const afterHash = sha256File(source);
  if (afterHash !== beforeHash) {
    throw new Error(`source hash changed: before=${beforeHash} after=${afterHash}`);
  }
}
