import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { validateGoalContractSchema } from '../../../utils/goal-contract/control-plane/schema-registry';
import {
  compileExecutionFinalCandidate,
  validateExecutionFinalCandidate,
  type ExecutionFinalCandidate,
} from './main-agent-execution-final-candidate';
import { compileControlledGoalCloseoutArtifacts } from './main-agent-delivery-closeout-gate';
import {
  compileExecutionFinalJudgeEffectivePass,
  executeMainAgentExecutionFinalJudgeCampaign,
  publishExecutionFinalAcceptedResult,
  validateMainAgentExecutionFinalJudgeCampaignArtifacts,
  type ExecutionFinalAcceptedResult,
  type MainAgentExecutionActorIsolationReceipt,
  type MainAgentExecutionFinalJudgeActorIntent,
  type MainAgentExecutionFinalJudgeResult,
  type MainAgentExecutionReviewerResult,
} from './main-agent-execution-final-judge-campaign';
import { compileMainAgentExecutionFinalJudgeCampaignInput } from './main-agent-execution-final-judge-campaign-input';
import { readGoalExecutionAttemptPointer } from './main-agent-goal-execution-attempt';
import {
  appendControlEventAndReplay,
  canonicalizeRequirementRecord,
  sha256Json,
} from './requirement-record-control-store';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionArtifactWrites,
  runtimeStatusProjectionRecordPatch,
  type RequirementsContractSixModelId,
  type RuntimeStatusBinding,
} from './requirements-contract-runtime-status-decision-receipt';
import {
  isRecord,
  stableHash,
  uniqueSorted,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';
import {
  canonicalGoalExecutionBytes,
  publishGoalExecutionImmutableArtifact,
  readGoalExecutionConfinedBytes,
} from './subcontract-evidence';
import {
  resolveVerifiedSixModelStatus,
  type VerifiedSixModelStatus,
} from './verified-six-model-status-facade';
import { validateRequirementsBackedGoalAdmissionCurrent } from '../../../utils/goal-contract/control-plane/goal-requirements-adapter';
import {
  acquireControlPlaneGenerationLock,
  releaseControlPlaneGenerationLock,
  type ControlPlaneGenerationLockHandle,
} from '../../../utils/goal-contract/control-plane/control-plane-generation-lock';

type ArtifactRef = { path: string; hash: string };

export type GoalFinalizationResult = {
  schemaVersion: 'main-agent-goal-finalization-result/v1';
  status: 'awaiting_user_acceptance' | 'finalization_reused' | 'blocked';
  issueCode: string | null;
  campaignClosureRef: Record<string, unknown> | null;
  candidateRef: Record<string, unknown> | null;
  acceptedResultRef: Record<string, unknown> | null;
  aggregateRef: Record<string, unknown> | null;
  effectivePassRef: Record<string, unknown> | null;
  deliveryGateReceiptRef: Record<string, unknown> | null;
  closeoutRequestRef: Record<string, unknown> | null;
  pageRef: Record<string, unknown> | null;
};

export type GoalFinalizationDependencies = {
  resolveProviderRef: () => string;
  invokeReviewer: (
    intent: MainAgentExecutionFinalJudgeActorIntent
  ) => Promise<MainAgentExecutionReviewerResult>;
  invokeFinalJudge: (
    intent: MainAgentExecutionFinalJudgeActorIntent
  ) => Promise<MainAgentExecutionFinalJudgeResult>;
  claimLeaseMs?: number;
  onStaleClaimObserved?: () => Promise<void>;
  onStaleClaimTakeoverCriticalSection?: () => Promise<void>;
};

type CampaignAuthority = {
  campaign: JsonRecord;
  campaignRef: ArtifactRef;
  admitted: JsonRecord;
  goalExecutionIr: JsonRecord;
  closures: Array<{ ref: ArtifactRef; record: JsonRecord; evidence: JsonRecord }>;
  projections: Array<{ role: string; path: string; hash: string }>;
};

type RequirementsRuntimeContext = {
  recordPath: string;
  record: JsonRecord;
  recordId: string;
  currentAttemptId: string;
};

type FinalizationRuntimeStatusSpec = {
  modelId: Extract<RequirementsContractSixModelId, 'execution_closure' | 'audit_review'>;
  stageInputs: RuntimeStatusBinding[];
  deterministicGateOutputs: RuntimeStatusBinding[];
};

const HASH = /^sha256:[0-9a-f]{64}$/u;

function fail(code = 'goal_finalization_integrity_invalid'): never {
  throw new Error(code);
}

function text(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : fail();
}

function hash(value: unknown): string {
  const result = text(value);
  return HASH.test(result) ? result : fail();
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) && value.every(isRecord) ? value : fail();
}

function artifactRef(value: unknown): ArtifactRef {
  if (!isRecord(value)) fail();
  return { path: confinedRelative(text(value.path)), hash: hash(value.hash) };
}

function confinedRelative(value: string): string {
  if (
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    fail('goal_finalization_path_invalid');
  }
  return value;
}

function targetPath(projectRoot: string, relativePath: string): string {
  return path.resolve(projectRoot, ...confinedRelative(relativePath).split('/'));
}

function canonicalProjectRoot(value: string): string {
  const resolved = path.resolve(value);
  if (process.platform !== 'win32') return resolved;
  if (resolved.startsWith('\\\\?\\UNC\\')) return `\\\\${resolved.slice(8)}`;
  return resolved.startsWith('\\\\?\\') ? resolved.slice(4) : resolved;
}

function projectRef(projectRoot: string, absolutePath: string): string {
  const relative = path
    .relative(path.resolve(projectRoot), path.resolve(absolutePath))
    .replace(/\\/gu, '/');
  return confinedRelative(relative);
}

function bytesHash(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function readCanonicalJson(
  projectRoot: string,
  relativePath: string
): {
  record: JsonRecord;
  bytes: Buffer;
} {
  const bytes = readGoalExecutionConfinedBytes({
    root: projectRoot,
    targetPath: targetPath(projectRoot, relativePath),
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  if (!isRecord(parsed) || !bytes.equals(canonicalGoalExecutionBytes(parsed))) fail();
  return { record: parsed, bytes };
}

function readJsonObjectFile(filePath: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fail('goal_finalization_requirement_record_invalid');
  }
  return isRecord(parsed) ? parsed : fail('goal_finalization_requirement_record_invalid');
}

function readHashedRecord(input: {
  projectRoot: string;
  ref: ArtifactRef;
  schemaName?: string;
  hashField: string;
}): JsonRecord {
  const { record } = readCanonicalJson(input.projectRoot, input.ref.path);
  if (input.schemaName) validateGoalContractSchema(input.schemaName, record);
  const payload = { ...record };
  delete payload[input.hashField];
  if (record[input.hashField] !== input.ref.hash || stableHash(payload) !== input.ref.hash) fail();
  return record;
}

function readSelfHashedRecord(input: {
  projectRoot: string;
  relativePath: string;
  schemaName: string;
  hashField: string;
}): JsonRecord {
  const record = readCanonicalJson(input.projectRoot, input.relativePath).record;
  return readHashedRecord({
    projectRoot: input.projectRoot,
    ref: { path: input.relativePath, hash: hash(record[input.hashField]) },
    schemaName: input.schemaName,
    hashField: input.hashField,
  });
}

function publishRecord(input: {
  projectRoot: string;
  relativePath: string;
  record: JsonRecord;
  hash: string;
}): ArtifactRef {
  const bytes = canonicalGoalExecutionBytes(input.record);
  const published = publishGoalExecutionImmutableArtifact({
    projectRoot: input.projectRoot,
    outRoot: input.projectRoot,
    targetPath: targetPath(input.projectRoot, input.relativePath),
    bytes,
    hash: input.hash,
  });
  return { path: published.projectRelativePath, hash: input.hash };
}

function sameAuthorityRows(left: unknown, right: unknown): boolean {
  const identity = (value: unknown) =>
    records(value).map((row) => ({
      executionAuthorityId: text(row.executionAuthorityId),
      hash: hash(row.hash),
    }));
  return stableHash(identity(left)) === stableHash(identity(right));
}

function verifyOwnedState(projectRoot: string, state: JsonRecord): void {
  const absolutePath = targetPath(projectRoot, text(state.path));
  const exists = fs.existsSync(absolutePath);
  if (exists !== Boolean(state.exists)) fail('goal_finalization_implementation_drift');
  if (exists && bytesHash(fs.readFileSync(absolutePath)) !== hash(state.hash)) {
    fail('goal_finalization_implementation_drift');
  }
}

function resolveCampaignAuthority(input: {
  projectRoot: string;
  campaignClosurePath: string;
}): CampaignAuthority {
  const projectRoot = path.resolve(input.projectRoot);
  const campaignPath = targetPath(projectRoot, input.campaignClosurePath);
  if (path.basename(campaignPath) !== 'campaign-closure.json') {
    fail('goal_finalization_path_invalid');
  }
  const campaignRefPath = projectRef(projectRoot, campaignPath);
  const campaignJson = readCanonicalJson(projectRoot, campaignRefPath).record;
  validateGoalContractSchema('goal-execution-campaign-closure.schema.json', campaignJson);
  const campaignPayload = { ...campaignJson };
  delete campaignPayload.campaignClosureHash;
  const campaignHash = hash(campaignJson.campaignClosureHash);
  if (stableHash(campaignPayload) !== campaignHash) fail();

  const attemptRoot = path.dirname(campaignPath);
  const executionRoot = path.dirname(attemptRoot);
  const runRoot = path.dirname(executionRoot);
  const runsRoot = path.dirname(runRoot);
  const runtimeRoot = path.dirname(runsRoot);
  if (
    path.basename(executionRoot) !== 'execution' ||
    path.basename(runsRoot) !== 'runs' ||
    path.basename(runtimeRoot) !== 'runtime' ||
    path.basename(runRoot) !== campaignJson.candidateRunId
  ) {
    fail('goal_finalization_path_invalid');
  }
  const outRoot = path.dirname(path.dirname(runtimeRoot));
  const activeRunPointerPath = path.join(runtimeRoot, 'active-run.json');
  const activeRunPointer = readSelfHashedRecord({
    projectRoot,
    relativePath: projectRef(projectRoot, activeRunPointerPath),
    schemaName: 'goal-contract-active-run-pointer.schema.json',
    hashField: 'activeRunPointerHash',
  });
  const candidateRun = readSelfHashedRecord({
    projectRoot,
    relativePath: projectRef(projectRoot, path.join(runRoot, 'candidate-run.json')),
    schemaName: 'goal-contract-candidate-run.schema.json',
    hashField: 'candidateRunHash',
  });
  const activationRecord = readSelfHashedRecord({
    projectRoot,
    relativePath: projectRef(projectRoot, path.join(runRoot, 'activation.json')),
    schemaName: 'goal-contract-activation-record.schema.json',
    hashField: 'activationRecordHash',
  });
  const goalExecutionAuthorityRef = artifactRef(candidateRun.goalExecutionAuthorityRef);
  const goalExecutionIrRef = {
    path: projectRef(
      projectRoot,
      path.resolve(outRoot, ...goalExecutionAuthorityRef.path.split('/'))
    ),
    hash: goalExecutionAuthorityRef.hash,
  };
  const goalExecutionIr = readHashedRecord({
    projectRoot,
    ref: goalExecutionIrRef,
    schemaName: 'goal-execution-ir.schema.json',
    hashField: 'goalExecutionIRHash',
  });
  const scalarBindings = [
    'candidateRunId',
    'profile',
    'goalId',
    'goalExecutionIRHash',
    'executionAdapterAuthorityHash',
    'executionMode',
    'partitionOutcome',
  ];
  const referenceBindings = [
    'goalExecutionAuthorityRef',
    'eligibilityRef',
    'executionPackageRefs',
    'selectedPartitionManifestRef',
  ];
  if (
    activeRunPointer.candidateRunId !== candidateRun.candidateRunId ||
    activeRunPointer.activationRecordHash !== activationRecord.activationRecordHash ||
    artifactRef(activationRecord.candidateRunRef).hash !== candidateRun.candidateRunHash ||
    scalarBindings.some((field) => candidateRun[field] !== activationRecord[field]) ||
    referenceBindings.some(
      (field) =>
        stableHash(candidateRun[field] ?? null) !== stableHash(activationRecord[field] ?? null)
    ) ||
    candidateRun.goalExecutionIRHash !== goalExecutionIr.goalExecutionIRHash ||
    candidateRun.profile !== goalExecutionIr.profile ||
    candidateRun.goalId !== goalExecutionIr.goalId ||
    campaignJson.profile !== candidateRun.profile ||
    campaignJson.goalId !== candidateRun.goalId ||
    campaignJson.goalExecutionIRHash !== candidateRun.goalExecutionIRHash ||
    campaignJson.candidateRunId !== candidateRun.candidateRunId ||
    campaignJson.activeRunPointerHash !== activeRunPointer.activeRunPointerHash ||
    campaignJson.activationRecordHash !== activationRecord.activationRecordHash
  ) {
    fail();
  }
  for (const rawPackageRef of records(candidateRun.executionPackageRefs)) {
    const packageRef = artifactRef(rawPackageRef);
    const executionMode = text(candidateRun.executionMode);
    const packageRecord = readHashedRecord({
      projectRoot,
      ref: {
        path: projectRef(projectRoot, path.resolve(runRoot, ...packageRef.path.split('/'))),
        hash: packageRef.hash,
      },
      schemaName:
        executionMode === 'direct_goal'
          ? 'goal-contract-direct-execution-package.schema.json'
          : 'goal-contract-child-execution-package.schema.json',
      hashField:
        executionMode === 'direct_goal'
          ? 'directExecutionPackageHash'
          : 'childExecutionPackageHash',
    });
    if (
      packageRecord.profile !== candidateRun.profile ||
      packageRecord.goalId !== candidateRun.goalId ||
      packageRecord.goalExecutionIRHash !== candidateRun.goalExecutionIRHash ||
      packageRecord.executionMode !== candidateRun.executionMode
    ) {
      fail();
    }
  }
  const attemptPointer = readGoalExecutionAttemptPointer({ outRoot });
  if (
    !attemptPointer ||
    attemptPointer.phase !== 'closed' ||
    attemptPointer.executionAttemptId !== path.basename(attemptRoot) ||
    attemptPointer.activeRunPointerHash !== campaignJson.activeRunPointerHash ||
    attemptPointer.activationRecordHash !== campaignJson.activationRecordHash ||
    !sameAuthorityRows(campaignJson.orderedClosureRefs, attemptPointer.validClosureRefs)
  ) {
    fail();
  }

  const admitted: JsonRecord = {
    projectRoot,
    outRoot,
    runRoot,
    goalExecutionIrPath: targetPath(projectRoot, goalExecutionIrRef.path),
    profile: candidateRun.profile,
    goalId: candidateRun.goalId,
    goalExecutionIRHash: candidateRun.goalExecutionIRHash,
    activeRunPointer,
    activationRecord,
    candidateRun,
    executionAuthorities: attemptPointer.executionAuthorities,
  };

  const authorityById = new Map(
    records(admitted.executionAuthorities).map((authority) => [
      text(authority.executionAuthorityId),
      authority,
    ])
  );
  const evidenceRefs = records(campaignJson.orderedEvidenceRefs).map(artifactRef);
  const closures = records(campaignJson.orderedClosureRefs).map((rawRef) => {
    const ref = artifactRef(rawRef);
    const closure = readHashedRecord({
      projectRoot,
      ref,
      schemaName: 'goal-execution-authority-closure.schema.json',
      hashField: 'closureHash',
    });
    const authorityId = text(closure.executionAuthorityId);
    const authority = authorityById.get(authorityId);
    const evidenceRef = artifactRef(closure.evidenceRef);
    if (
      !authority ||
      closure.profile !== campaignJson.profile ||
      closure.candidateRunId !== campaignJson.candidateRunId ||
      closure.activeRunPointerHash !== campaignJson.activeRunPointerHash ||
      closure.activationRecordHash !== campaignJson.activationRecordHash ||
      closure.executionAuthorityHash !== authority.executionAuthorityHash ||
      closure.executionPackageHash !== authority.executionPackageHash ||
      !evidenceRefs.some(
        (candidate) => candidate.path === evidenceRef.path && candidate.hash === evidenceRef.hash
      )
    ) {
      fail();
    }
    const evidence = readHashedRecord({
      projectRoot,
      ref: evidenceRef,
      schemaName: 'goal-execution-observed-evidence.schema.json',
      hashField: 'evidenceHash',
    });
    if (
      evidence.profile !== campaignJson.profile ||
      evidence.candidateRunId !== campaignJson.candidateRunId ||
      evidence.activeRunPointerHash !== campaignJson.activeRunPointerHash ||
      evidence.activationRecordHash !== campaignJson.activationRecordHash ||
      evidence.executionAuthorityId !== authorityId ||
      evidence.executionAuthorityHash !== authority.executionAuthorityHash ||
      evidence.executionPackageHash !== authority.executionPackageHash
    ) {
      fail();
    }
    records(evidence.ownedPathStates).forEach((state) => verifyOwnedState(projectRoot, state));
    return { ref, record: closure, evidence };
  });
  if (closures.length !== authorityById.size) fail();
  const projectionSpecs = [
    { role: 'campaign_report', fileName: 'campaign-report.md' },
    { role: 'final_execution_projection', fileName: 'final-execution.md' },
    { role: 'task_report', fileName: 'TaskReport.json' },
    { role: 'main_agent_handoff', fileName: 'main-agent-handoff.json' },
  ] as const;
  const projections = projectionSpecs.map(({ role, fileName }) => {
    const absolutePath = path.join(attemptRoot, 'projections', fileName);
    const projectionPath = projectRef(projectRoot, absolutePath);
    const bytes = readGoalExecutionConfinedBytes({ root: projectRoot, targetPath: absolutePath });
    return { role, path: projectionPath, hash: bytesHash(bytes) };
  });

  return {
    campaign: campaignJson,
    campaignRef: { path: campaignRefPath, hash: campaignHash },
    admitted,
    goalExecutionIr,
    closures,
    projections,
  };
}

function compileCandidate(authority: CampaignAuthority): ExecutionFinalCandidate {
  const artifactByPath = new Map<string, { path: string; hash: string }>();
  const observationByCommand = new Map<string, JsonRecord>();
  for (const closure of authority.closures) {
    for (const state of records(closure.evidence.ownedPathStates)) {
      const row = { path: text(state.path), hash: hash(state.hash) };
      const previous = artifactByPath.get(row.path);
      if (previous && previous.hash !== row.hash) fail();
      artifactByPath.set(row.path, row);
    }
    for (const observation of records(closure.evidence.commandObservations)) {
      const commandId = text(observation.commandId);
      const previous = observationByCommand.get(commandId);
      if (previous && previous.normalizedInvocation !== observation.normalizedInvocation) {
        fail();
      }
      observationByCommand.set(commandId, observation);
    }
  }
  const goalCommands = records(authority.goalExecutionIr.commands);
  if (
    goalCommands.length !== observationByCommand.size ||
    goalCommands.some((command) => !observationByCommand.has(text(command.commandId)))
  ) {
    fail('goal_finalization_command_coverage_invalid');
  }
  const projectRoot = text(authority.admitted.projectRoot);
  const evidence = authority.closures.map((closure) => {
    const ref = artifactRef(closure.record.evidenceRef);
    const bytes = readGoalExecutionConfinedBytes({
      root: projectRoot,
      targetPath: targetPath(projectRoot, ref.path),
    });
    return {
      evidenceId: `evidence:${text(closure.record.executionAuthorityId)}`,
      evidenceKind: 'execution_observation',
      path: ref.path,
      hash: bytesHash(bytes),
    };
  });
  const evidenceIds = evidence.map((row) => row.evidenceId);
  const evidenceContracts = records(authority.goalExecutionIr.evidenceContracts);
  const deliveryClaims =
    evidenceContracts.length > 0
      ? evidenceContracts.map((contract) => ({
          deliveryClaimId: text(contract.evidenceContractId),
          claimHash: stableHash(contract),
          evidenceIds,
        }))
      : [
          {
            deliveryClaimId: 'delivery-claim:campaign-closure',
            claimHash: authority.campaignRef.hash,
            evidenceIds,
          },
        ];
  const profile = authority.admitted.profile;
  const lineage =
    profile === 'requirements_backed'
      ? {
          requirementsLineage: {
            requirementsSemanticIRHash: hash(
              isRecord(authority.goalExecutionIr.requirementsLineage)
                ? authority.goalExecutionIr.requirementsLineage.scopeSemanticHash
                : null
            ),
            architecturePremiseAuthorityHash: hash(
              isRecord(authority.goalExecutionIr.technicalAuthority)
                ? authority.goalExecutionIr.technicalAuthority.architectureConfirmationCandidateHash
                : null
            ),
            readinessDecisionHash: hash(
              isRecord(authority.goalExecutionIr.technicalAuthority)
                ? authority.goalExecutionIr.technicalAuthority.implementationReadinessCandidateHash
                : null
            ),
          },
        }
      : { standaloneLineage: authority.goalExecutionIr.standaloneLineage };
  const artifacts = [...artifactByPath.values()].map((artifact) => ({
    artifactId: `artifact:${artifact.path}`,
    artifactKind: 'implementation_state',
    ...artifact,
  }));
  for (const projection of authority.projections) {
    artifacts.push({
      artifactId: `artifact:${projection.path}`,
      artifactKind: projection.role,
      path: projection.path,
      hash: projection.hash,
    });
  }
  const executionResults = authority.closures.map((closure) => ({
    executionResultId: `execution-result:${text(closure.record.executionAuthorityId)}`,
    executionAuthorityId: text(closure.record.executionAuthorityId),
    closureHash: hash(closure.record.closureHash),
  }));
  const commands = goalCommands.map((command) => {
    const commandId = text(command.commandId);
    return {
      commandId,
      normalizedInvocationHash: stableHash(
        text(observationByCommand.get(commandId)?.normalizedInvocation)
      ),
    };
  });
  return compileExecutionFinalCandidate({
    profile,
    goalId: authority.admitted.goalId,
    goalExecutionIRHash: authority.admitted.goalExecutionIRHash,
    ...lineage,
    activeRunPointerHash: (authority.admitted.activeRunPointer as JsonRecord).activeRunPointerHash,
    activationRecordHash: (authority.admitted.activationRecord as JsonRecord).activationRecordHash,
    executionPackageHashes: uniqueSorted(
      authority.closures.map((closure) => hash(closure.record.executionPackageHash))
    ),
    campaignClosureHash: authority.campaignRef.hash,
    implementationContextHash: stableHash({ artifacts, executionResults, evidence }),
    artifacts,
    obligationIds: records(authority.goalExecutionIr.obligations).map((row) =>
      text(row.obligationId)
    ),
    executionResults,
    commands,
    evidence,
    deliveryClaims,
  });
}

function finalizationRoot(candidate: ExecutionFinalCandidate): string {
  return `goal/runtime/execution-final/candidates/sha256-${candidate.executionFinalCandidateHash.slice(
    'sha256:'.length
  )}`;
}

function acceptedResultPath(candidate: ExecutionFinalCandidate): string {
  return `goal/runtime/execution-final/accepted/sha256-${candidate.executionFinalCandidateHash.slice(
    'sha256:'.length
  )}.json`;
}

function requirementsRuntimeContext(
  authority: CampaignAuthority
): RequirementsRuntimeContext | null {
  if (authority.admitted.profile !== 'requirements_backed') return null;
  const lineage = isRecord(authority.goalExecutionIr.requirementsLineage)
    ? authority.goalExecutionIr.requirementsLineage
    : fail('requirements_successor_required:semantic_authority');
  const recordId = text(lineage.recordId);
  if (!/^[A-Za-z0-9._-]+$/u.test(recordId)) {
    fail('requirements_successor_required:requirement_record');
  }
  const projectRoot = text(authority.admitted.projectRoot);
  const recordPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'requirement-record.json'
  );
  validateRequirementsBackedGoalAdmissionCurrent({
    projectRoot,
    requestId: recordId,
    requirementRecordPath: recordPath,
    expectedRequirementsLineage: lineage,
    phase: 'execution_resume',
    authorizedOwnedPaths: uniqueSorted(
      authority.closures.flatMap((closure) =>
        records(closure.evidence.ownedPathStates).map((state) => text(state.path))
      )
    ),
  });
  const record = readJsonObjectFile(recordPath);
  if (record.recordId !== recordId) fail('requirements_successor_required:requirement_record');
  return {
    recordPath,
    record,
    recordId,
    currentAttemptId: text(record.currentAttemptId),
  };
}

function runtimeDecisionReceipts(record: JsonRecord) {
  return records(record.runtimeStatusDecisionReceipts).map((entry) => ({
    path: text(entry.path),
    receipt: entry.receipt,
  }));
}

function verifiedRuntimeStatus(
  context: RequirementsRuntimeContext,
  modelId: RequirementsContractSixModelId
): VerifiedSixModelStatus {
  return resolveVerifiedSixModelStatus({
    record: context.record,
    modelId,
    currentImplementationAttemptId: context.currentAttemptId,
    decisionReceipts: runtimeDecisionReceipts(context.record),
  });
}

function normalizedStatusBindings(bindings: RuntimeStatusBinding[]) {
  return bindings
    .map((binding) => ({ ...binding, path: binding.path.replace(/\\/gu, '/') }))
    .sort((left, right) =>
      `${left.role}\u0000${left.path}`.localeCompare(`${right.role}\u0000${right.path}`, 'en')
    );
}

function statusReceiptMatches(
  context: RequirementsRuntimeContext,
  status: VerifiedSixModelStatus,
  spec: FinalizationRuntimeStatusSpec
): boolean {
  const receiptEntry = runtimeDecisionReceipts(context.record).find(
    (entry) => entry.path === status.decisionReceiptRef
  );
  if (!isRecord(receiptEntry?.receipt)) return false;
  const receipt = receiptEntry.receipt;
  return (
    receipt.authorityClass === 'deterministic_gate' &&
    receipt.decision === 'pass' &&
    stableHash(normalizedStatusBindings(records(receipt.stageInputs) as RuntimeStatusBinding[])) ===
      stableHash(normalizedStatusBindings(spec.stageInputs)) &&
    stableHash(
      normalizedStatusBindings(records(receipt.deterministicGateOutputs) as RuntimeStatusBinding[])
    ) === stableHash(normalizedStatusBindings(spec.deterministicGateOutputs))
  );
}

function ensureFinalizationRuntimeStatus(
  authority: CampaignAuthority,
  spec: FinalizationRuntimeStatusSpec
): VerifiedSixModelStatus | null {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const context = requirementsRuntimeContext(authority);
    if (!context) return null;
    const current = verifiedRuntimeStatus(context, spec.modelId);
    if (current.effectiveStatus === 'pass') {
      if (!statusReceiptMatches(context, current, spec)) {
        fail('goal_finalization_runtime_status_conflict');
      }
      return current;
    }
    if (!['not_established', 'stale'].includes(current.effectiveStatus)) {
      fail('goal_finalization_runtime_status_conflict');
    }
    const recordedAt = text(context.record.updatedAt);
    const receiptPath = `runtime/status-decisions/${context.currentAttemptId}/${spec.modelId}.json`;
    const update = createRuntimeStatusProjectionUpdate({
      recordId: context.recordId,
      requirementSetId: text(context.record.requirementSetId) || context.recordId,
      modelId: spec.modelId,
      implementationAttemptId: context.currentAttemptId,
      sourceDocumentHash: hash(context.record.sourceDocumentHash),
      implementationConfirmationHash: hash(context.record.implementationConfirmationHash),
      semanticModelHash: hash(context.record.semanticModelHash),
      stageInputs: spec.stageInputs,
      deterministicGateOutputs: spec.deterministicGateOutputs,
      blockerRefs: [],
      evidenceRefs: spec.deterministicGateOutputs.map((binding) => binding.path),
      authorityClass: 'deterministic_gate',
      decision: 'pass',
      effectiveStatus: 'pass',
      createdAt: recordedAt,
      receiptPath,
      projection: { blockingReasons: [] },
    });
    if (!update.authorityEstablished || !update.receiptRef) {
      fail('goal_finalization_runtime_status_invalid');
    }
    const eventType = `${spec.modelId}_result_recorded`;
    const fromModel =
      spec.modelId === 'execution_closure' ? 'implementation_readiness' : 'execution_closure';
    try {
      appendControlEventAndReplay({
        recordPath: context.recordPath,
        writerId:
          spec.modelId === 'execution_closure'
            ? 'execution-closure-gate-writer'
            : 'audit-review-gate-writer',
        eventType,
        recordedAt,
        expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(context.record)),
        payload: {
          modelId: spec.modelId,
          decision: 'pass',
          implementationAttemptId: context.currentAttemptId,
          stageInputs: spec.stageInputs,
          deterministicGateOutputs: spec.deterministicGateOutputs,
          runtimeStatusDecisionReceiptHash: update.receiptRef.receipt.receiptHash,
        },
        artifactWrites: runtimeStatusProjectionArtifactWrites(update),
        reduce: (record) => ({
          ...record,
          ...runtimeStatusProjectionRecordPatch({ record, modelId: spec.modelId, update }),
          currentMentalModel: spec.modelId,
          mentalModelTransitions: [
            ...records(record.mentalModelTransitions),
            {
              eventType: 'mental_model_transition_recorded',
              fromModel,
              toModel: spec.modelId,
              sourceRefs: [{ sourceType: 'model_result', id: fromModel }],
              recordedAt,
              recordedBy: 'main-agent-goal-run-finalizer',
            },
          ],
          lastEventType: eventType,
          updatedAt: recordedAt,
        }),
      });
    } catch (error) {
      if (!String(error).includes('control_store_compare_and_swap_failed')) throw error;
      continue;
    }
  }
  return fail('goal_finalization_runtime_status_cas_failed');
}

function taskReportArtifact(candidate: ExecutionFinalCandidate) {
  const matches = candidate.artifacts.filter((artifact) => artifact.artifactKind === 'task_report');
  return matches.length === 1 ? matches[0] : fail('goal_finalization_task_report_invalid');
}

function ensureExecutionClosureStatus(
  authority: CampaignAuthority,
  candidate: ExecutionFinalCandidate
): void {
  const taskReport = taskReportArtifact(candidate);
  const stageInputs = [
    ...records(authority.campaign.orderedClosureRefs).map((entry, index) => ({
      role: `execution_closure_${String(index + 1)}`,
      path: artifactRef(entry).path,
      hash: artifactRef(entry).hash,
    })),
    ...records(authority.campaign.orderedEvidenceRefs).map((entry, index) => ({
      role: `execution_evidence_${String(index + 1)}`,
      path: artifactRef(entry).path,
      hash: artifactRef(entry).hash,
    })),
    { role: 'task_report', path: taskReport.path, hash: taskReport.hash },
  ];
  ensureFinalizationRuntimeStatus(authority, {
    modelId: 'execution_closure',
    stageInputs,
    deterministicGateOutputs: [
      {
        role: 'campaign_closure',
        path: authority.campaignRef.path,
        hash: authority.campaignRef.hash,
      },
    ],
  });
}

type FinalizationClaim = { path: string; ownerId: string; leaseMs: number };
type ClaimSnapshot = { ownerId: string | null; mtimeMs: number };
type ClaimMutex = ControlPlaneGenerationLockHandle;

const CLAIM_LEASE_MS = 300_000;
const CLAIM_WAIT_MS = 10;
const CLAIM_WAIT_TIMEOUT_MS = 120_000;
const CLAIM_MUTEX_LEASE_MS = 30_000;

function claimPath(candidate: ExecutionFinalCandidate): string {
  return `goal/runtime/execution-final/claims/sha256-${candidate.executionFinalCandidateHash.slice(
    'sha256:'.length
  )}.lock`;
}

function isFileExistsError(error: unknown): boolean {
  return isRecord(error) && error.code === 'EEXIST';
}

function isFileMissingError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}

function readClaimSnapshot(absolutePath: string): ClaimSnapshot | null {
  try {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return {
      ownerId: isRecord(parsed) && typeof parsed.ownerId === 'string' ? parsed.ownerId : null,
      mtimeMs: fs.statSync(absolutePath).mtimeMs,
    };
  } catch (error) {
    if (isFileMissingError(error)) return null;
    try {
      return { ownerId: null, mtimeMs: fs.statSync(absolutePath).mtimeMs };
    } catch (statError) {
      if (isFileMissingError(statError)) return null;
      throw statError;
    }
  }
}

function claimIsStale(snapshot: ClaimSnapshot, now: number, leaseMs: number): boolean {
  return now - snapshot.mtimeMs >= leaseMs;
}

function safeOwnerSegment(ownerId: string | null): string {
  return ownerId && /^[a-zA-Z0-9_-]+$/u.test(ownerId) ? ownerId : randomBytes(8).toString('hex');
}

function restoreQuarantinedClaim(quarantinePath: string, claimPath: string): void {
  if (!fs.existsSync(quarantinePath)) return;
  if (fs.existsSync(claimPath)) fail('goal_finalization_claim_owner_conflict');
  fs.renameSync(quarantinePath, claimPath);
}

function deleteQuarantinedClaim(quarantinePath: string, expectedOwnerId: string | null): void {
  const snapshot = readClaimSnapshot(quarantinePath);
  if (!snapshot || snapshot.ownerId !== expectedOwnerId) {
    fail('goal_finalization_claim_owner_conflict');
  }
  fs.unlinkSync(quarantinePath);
}

function acquireClaimMutex(absoluteClaimPath: string): ClaimMutex {
  const resolvedClaimPath = path.resolve(absoluteClaimPath);
  const canonicalClaimParent = fs.realpathSync.native(path.dirname(resolvedClaimPath));
  const canonicalClaimPath = path.join(canonicalClaimParent, path.basename(resolvedClaimPath));
  const normalizedClaimPath =
    process.platform === 'win32' ? canonicalClaimPath.toLowerCase() : canonicalClaimPath;
  const lockKey = createHash('sha256')
    .update(normalizedClaimPath, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return acquireControlPlaneGenerationLock({
    lockPath: path.join(canonicalClaimParent, `.claim-mutex-${lockKey}`),
    lockSchemaVersion: 'main-agent-goal-finalization-claim-mutex/v2',
    timeoutMs: CLAIM_WAIT_TIMEOUT_MS,
    pollMs: CLAIM_WAIT_MS,
    leaseMs: CLAIM_MUTEX_LEASE_MS,
    conflictIssueCode: 'goal_finalization_claim_mutex_timeout',
  });
}

function releaseClaimMutex(mutex: ClaimMutex): void {
  releaseControlPlaneGenerationLock(mutex);
}

async function withClaimMutex<T>(
  absoluteClaimPath: string,
  operation: () => T | Promise<T>
): Promise<T> {
  const mutex = acquireClaimMutex(absoluteClaimPath);
  try {
    const result = operation();
    if (result instanceof Promise) fail('goal_finalization_claim_mutex_async_operation_forbidden');
    return result;
  } finally {
    releaseClaimMutex(mutex);
  }
}

function writeClaim(input: {
  absolutePath: string;
  candidate: ExecutionFinalCandidate;
  campaignClosureHash: string;
  ownerId: string;
  leaseMs: number;
  now: number;
}): boolean {
  let descriptor: number;
  try {
    descriptor = fs.openSync(input.absolutePath, 'wx');
  } catch (error) {
    if (isFileExistsError(error)) return false;
    throw error;
  }
  try {
    fs.writeFileSync(
      descriptor,
      canonicalGoalExecutionBytes({
        schemaVersion: 'main-agent-goal-finalization-claim/v1',
        executionFinalCandidateHash: input.candidate.executionFinalCandidateHash,
        campaignClosureHash: input.campaignClosureHash,
        ownerId: input.ownerId,
        acquiredAt: input.now,
        expiresAt: input.now + input.leaseMs,
      })
    );
  } finally {
    fs.closeSync(descriptor);
  }
  return true;
}

function takeoverStaleClaim(input: {
  absolutePath: string;
  observed: ClaimSnapshot;
  candidate: ExecutionFinalCandidate;
  campaignClosureHash: string;
  ownerId: string;
  now: number;
  leaseMs: number;
}): boolean {
  const current = readClaimSnapshot(input.absolutePath);
  if (
    !current ||
    current.ownerId !== input.observed.ownerId ||
    !claimIsStale(current, input.now, input.leaseMs)
  ) {
    return false;
  }
  const quarantinePath = `${input.absolutePath}.quarantine-${safeOwnerSegment(
    current.ownerId
  )}-${randomBytes(8).toString('hex')}`;
  try {
    fs.renameSync(input.absolutePath, quarantinePath);
  } catch (error) {
    if (isFileMissingError(error)) return false;
    throw error;
  }
  const quarantined = readClaimSnapshot(quarantinePath);
  if (
    !quarantined ||
    quarantined.ownerId !== current.ownerId ||
    !claimIsStale(quarantined, input.now, input.leaseMs)
  ) {
    restoreQuarantinedClaim(quarantinePath, input.absolutePath);
    return false;
  }
  try {
    if (
      !writeClaim({
        absolutePath: input.absolutePath,
        candidate: input.candidate,
        campaignClosureHash: input.campaignClosureHash,
        ownerId: input.ownerId,
        leaseMs: input.leaseMs,
        now: input.now,
      })
    ) {
      fail('goal_finalization_claim_owner_conflict');
    }
  } catch (error) {
    restoreQuarantinedClaim(quarantinePath, input.absolutePath);
    throw error;
  }
  deleteQuarantinedClaim(quarantinePath, current.ownerId);
  return true;
}

async function acquireFinalizationClaim(input: {
  projectRoot: string;
  candidate: ExecutionFinalCandidate;
  campaignClosureHash: string;
  leaseMs?: number;
  onStaleClaimObserved?: () => Promise<void>;
  onStaleClaimTakeoverCriticalSection?: () => Promise<void>;
}): Promise<FinalizationClaim | null> {
  const relativePath = claimPath(input.candidate);
  const absolutePath = targetPath(input.projectRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const ownerId = randomBytes(16).toString('hex');
  const leaseMs = input.leaseMs ?? CLAIM_LEASE_MS;
  if (!Number.isFinite(leaseMs) || leaseMs < 30) fail('goal_finalization_claim_lease_invalid');
  const startedAt = Date.now();
  for (;;) {
    const now = Date.now();
    const observed = readClaimSnapshot(absolutePath);
    const observedStale = observed !== null && claimIsStale(observed, now, leaseMs);
    if (observedStale) {
      await input.onStaleClaimObserved?.();
      await input.onStaleClaimTakeoverCriticalSection?.();
    }
    const outcome = await withClaimMutex(absolutePath, () => {
      if (fs.existsSync(targetPath(input.projectRoot, acceptedResultPath(input.candidate)))) {
        return 'accepted' as const;
      }
      const current = readClaimSnapshot(absolutePath);
      const lockedNow = Date.now();
      if (!current) {
        if (
          !writeClaim({
            absolutePath,
            candidate: input.candidate,
            campaignClosureHash: input.campaignClosureHash,
            ownerId,
            leaseMs,
            now: lockedNow,
          })
        ) {
          fail('goal_finalization_claim_owner_conflict');
        }
        return 'acquired' as const;
      }
      if (
        claimIsStale(current, lockedNow, leaseMs) &&
        takeoverStaleClaim({
          absolutePath,
          observed: current,
          candidate: input.candidate,
          campaignClosureHash: input.campaignClosureHash,
          ownerId,
          now: lockedNow,
          leaseMs,
        })
      ) {
        return 'acquired' as const;
      }
      return 'wait' as const;
    });
    if (outcome === 'accepted') return null;
    if (outcome === 'acquired') return { path: relativePath, ownerId, leaseMs };
    if (now - startedAt >= CLAIM_WAIT_TIMEOUT_MS) fail('goal_finalization_claim_timeout');
    await new Promise((resolve) => setTimeout(resolve, CLAIM_WAIT_MS));
  }
}

function startFinalizationClaimHeartbeat(projectRoot: string, claim: FinalizationClaim) {
  const absolutePath = targetPath(projectRoot, claim.path);
  let lost = false;
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const refresh = () => {
    if (stopped || lost || inFlight) return;
    const pending = withClaimMutex(absolutePath, () => {
      if (readClaimSnapshot(absolutePath)?.ownerId !== claim.ownerId) {
        lost = true;
        return;
      }
      const now = new Date(Date.now());
      fs.utimesSync(absolutePath, now, now);
    })
      .catch(() => {
        lost = true;
      })
      .finally(() => {
        if (inFlight === pending) inFlight = null;
      });
    inFlight = pending;
  };
  const interval = setInterval(refresh, Math.max(10, Math.floor(claim.leaseMs / 3)));
  interval.unref?.();
  return {
    async assertOwned() {
      if (inFlight) await inFlight;
      if (lost) fail('goal_finalization_claim_owner_lost');
      await withClaimMutex(absolutePath, () => {
        if (readClaimSnapshot(absolutePath)?.ownerId !== claim.ownerId) lost = true;
      });
      if (lost) {
        fail('goal_finalization_claim_owner_lost');
      }
    },
    async stop() {
      stopped = true;
      clearInterval(interval);
      if (inFlight) await inFlight;
    },
  };
}

async function releaseFinalizationClaim(
  projectRoot: string,
  claim: FinalizationClaim
): Promise<void> {
  const absolutePath = targetPath(projectRoot, claim.path);
  await withClaimMutex(absolutePath, () => {
    if (readClaimSnapshot(absolutePath)?.ownerId !== claim.ownerId) return;
    const quarantinePath = `${absolutePath}.release-${safeOwnerSegment(
      claim.ownerId
    )}-${randomBytes(8).toString('hex')}`;
    fs.renameSync(absolutePath, quarantinePath);
    const quarantined = readClaimSnapshot(quarantinePath);
    if (!quarantined || quarantined.ownerId !== claim.ownerId) {
      restoreQuarantinedClaim(quarantinePath, absolutePath);
      return;
    }
    deleteQuarantinedClaim(quarantinePath, claim.ownerId);
  });
}

function blockedResult(
  issueCode: string,
  campaignClosureRef: ArtifactRef,
  candidateRef: ArtifactRef
): GoalFinalizationResult {
  return {
    schemaVersion: 'main-agent-goal-finalization-result/v1',
    status: 'blocked',
    issueCode,
    campaignClosureRef,
    candidateRef,
    acceptedResultRef: null,
    aggregateRef: null,
    effectivePassRef: null,
    deliveryGateReceiptRef: null,
    closeoutRequestRef: null,
    pageRef: null,
  };
}

function readRefRecord(projectRoot: string, ref: ArtifactRef, hashField: string): JsonRecord {
  const record = readCanonicalJson(projectRoot, ref.path).record;
  if (record[hashField] !== ref.hash) fail();
  const payload = { ...record };
  delete payload[hashField];
  if (stableHash(payload) !== ref.hash) fail();
  return record;
}

function readActorIntentRef(projectRoot: string, ref: ArtifactRef): JsonRecord {
  const record = readCanonicalJson(projectRoot, ref.path).record;
  const { invocationIntentHash, blindInputHash, ...payload } = record;
  if (
    invocationIntentHash !== ref.hash ||
    stableHash(payload) !== ref.hash ||
    stableHash(record.blindInput) !== blindInputHash
  ) {
    fail();
  }
  return record;
}

function compileFinalizationCampaignInput(
  candidate: ExecutionFinalCandidate,
  campaignRef: ArtifactRef,
  providerRef: string
) {
  return compileMainAgentExecutionFinalJudgeCampaignInput({
    campaignId: `execution-final:${candidate.executionFinalCandidateHash}`,
    campaignLineageKey: stableHash({
      campaignClosureHash: campaignRef.hash,
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
    }),
    closureReceiptHash: campaignRef.hash,
    candidateBytesHash: bytesHash(canonicalGoalExecutionBytes(candidate)),
    currentImplementationHash: candidate.implementationContextHash,
    currentEvidenceHash: stableHash(candidate.evidence),
    initialReviewAttemptKey: stableHash({
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      attempt: 1,
    }),
    providerRef,
    executionFinalCandidate: candidate,
  });
}

function campaignBlindInput(
  campaignInput: ReturnType<typeof compileFinalizationCampaignInput>
): JsonRecord {
  return {
    campaignId: campaignInput.campaignId,
    campaignLineageKey: campaignInput.campaignLineageKey,
    closureReceiptHash: campaignInput.closureReceiptHash,
    candidateBytesHash: campaignInput.candidateBytesHash,
    currentImplementationHash: campaignInput.currentImplementationHash,
    currentEvidenceHash: campaignInput.currentEvidenceHash,
    initialReviewAttemptKey: campaignInput.initialReviewAttemptKey,
    executionFinalCandidate: campaignInput.executionFinalCandidate,
  };
}

function ensureAuditReviewStatus(
  authority: CampaignAuthority,
  refs: {
    candidateRef: ArtifactRef;
    acceptedResultRef: ArtifactRef;
    aggregateRef: ArtifactRef;
    effectivePassRef: ArtifactRef;
  }
): void {
  ensureFinalizationRuntimeStatus(authority, {
    modelId: 'audit_review',
    stageInputs: [
      { role: 'campaign_closure', ...authority.campaignRef },
      { role: 'execution_final_candidate', ...refs.candidateRef },
    ],
    deterministicGateOutputs: [
      { role: 'execution_final_accepted_result', ...refs.acceptedResultRef },
      { role: 'execution_final_aggregate', ...refs.aggregateRef },
      { role: 'execution_effective_pass', ...refs.effectivePassRef },
    ],
  });
}

function deliveryVerifiedStatuses(
  authority: CampaignAuthority,
  candidate: ExecutionFinalCandidate
): { currentAttemptId: string; recordId: string; statuses: VerifiedSixModelStatus[] } {
  const context = requirementsRuntimeContext(authority);
  if (!context) {
    const currentAttemptId = candidate.executionFinalCandidateHash;
    return {
      currentAttemptId,
      recordId: candidate.goalId,
      statuses: candidate.requiredDimensionIds
        .filter((modelId) => modelId !== 'delivery_confirmation')
        .map((modelId) => ({
          schemaVersion: 'requirements-contract-verified-six-model-status/v1' as const,
          recordId: candidate.goalId,
          requirementSetId: candidate.goalId,
          modelId: modelId as RequirementsContractSixModelId,
          effectiveStatus: 'pass' as const,
          projectionStatus: 'pass',
          projectionIntegrity: 'valid' as const,
          authorityClass: 'standalone_goal_authority',
          decisionReceiptRef: null,
          decisionReceiptHash: null,
          currentAttemptId,
          blockerRefs: [],
          evidenceRefs: [],
        })),
    };
  }
  const statuses = candidate.requiredDimensionIds
    .filter((modelId) => modelId !== 'delivery_confirmation')
    .map((modelId) => verifiedRuntimeStatus(context, modelId as RequirementsContractSixModelId));
  if (statuses.some((status) => status.effectiveStatus !== 'pass')) {
    fail('goal_finalization_six_model_currentness_invalid');
  }
  return {
    currentAttemptId: context.currentAttemptId,
    recordId: context.recordId,
    statuses,
  };
}

function controlledCloseoutRequestMatches(input: {
  context: RequirementsRuntimeContext;
  request: JsonRecord;
  requestRef: ArtifactRef;
  gateRef: ArtifactRef;
  pageRef: ArtifactRef;
}): boolean {
  const closeout = isRecord(input.context.record.closeout) ? input.context.record.closeout : {};
  const currentRequest = isRecord(closeout.acceptanceRequest) ? closeout.acceptanceRequest : {};
  return (
    input.context.record.status === 'awaiting_user_acceptance' &&
    closeout.currentAttemptId === input.request.requestId &&
    closeout.decision === 'pass' &&
    currentRequest.status === 'awaiting_user_acceptance' &&
    currentRequest.closeoutAttemptId === input.request.requestId &&
    currentRequest.requestId === input.request.requestId &&
    stableHash(currentRequest.requestRef) === stableHash(input.requestRef) &&
    stableHash(currentRequest.deliveryGateReceiptRef) === stableHash(input.gateRef) &&
    stableHash(currentRequest.pageRef) === stableHash(input.pageRef) &&
    currentRequest.executionFinalCandidateHash === input.request.executionFinalCandidateHash &&
    currentRequest.currentImplementationAttemptId === input.context.currentAttemptId &&
    currentRequest.expectedRecordRevision === input.context.record.recordRevision
  );
}

function registerControlledCloseoutRequest(input: {
  authority: CampaignAuthority;
  candidateRef: ArtifactRef;
  request: JsonRecord;
  requestRef: ArtifactRef;
  gateRef: ArtifactRef;
  pageRef: ArtifactRef;
}): void {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const context = requirementsRuntimeContext(input.authority);
    if (!context) return;
    const deliveryStatus = verifiedRuntimeStatus(context, 'delivery_confirmation');
    if (
      controlledCloseoutRequestMatches({
        context,
        request: input.request,
        requestRef: input.requestRef,
        gateRef: input.gateRef,
        pageRef: input.pageRef,
      }) &&
      deliveryStatus.effectiveStatus === 'awaiting_user_acceptance'
    ) {
      return;
    }
    const closeout = isRecord(context.record.closeout) ? context.record.closeout : {};
    const currentRequest = isRecord(closeout.acceptanceRequest) ? closeout.acceptanceRequest : {};
    if (
      Object.keys(currentRequest).length > 0 ||
      !['not_established', 'stale'].includes(deliveryStatus.effectiveStatus)
    ) {
      fail('goal_finalization_closeout_request_conflict');
    }
    const recordedAt = text(context.record.updatedAt);
    const currentRevision = Number(context.record.recordRevision);
    if (!recordedAt || !Number.isInteger(currentRevision) || currentRevision < 0) {
      fail('goal_finalization_closeout_record_invalid');
    }
    const nextRevision = currentRevision + 1;
    const update = createRuntimeStatusProjectionUpdate({
      recordId: context.recordId,
      requirementSetId: text(context.record.requirementSetId) || context.recordId,
      modelId: 'delivery_confirmation',
      implementationAttemptId: context.currentAttemptId,
      sourceDocumentHash: hash(context.record.sourceDocumentHash),
      implementationConfirmationHash: hash(context.record.implementationConfirmationHash),
      semanticModelHash: hash(context.record.semanticModelHash),
      stageInputs: [
        { role: 'execution_final_candidate', ...input.candidateRef },
        { role: 'delivery_closeout_gate', ...input.gateRef },
      ],
      deterministicGateOutputs: [
        { role: 'controlled_closeout_request', ...input.requestRef },
        { role: 'controlled_closeout_page', ...input.pageRef },
      ],
      blockerRefs: [],
      evidenceRefs: [input.gateRef.path, input.requestRef.path, input.pageRef.path],
      authorityClass: 'controlled_closeout',
      decision: 'pass',
      effectiveStatus: 'awaiting_user_acceptance',
      createdAt: recordedAt,
      receiptPath: `runtime/status-decisions/${context.currentAttemptId}/delivery_confirmation-awaiting.json`,
      projection: { blockingReasons: [] },
    });
    if (!update.authorityEstablished || !update.receiptRef) {
      fail('goal_finalization_closeout_runtime_status_invalid');
    }
    try {
      appendControlEventAndReplay({
        recordPath: context.recordPath,
        writerId: 'delivery-closeout-gate-writer',
        eventType: 'delivery_confirmation_user_acceptance_requested',
        recordedAt,
        expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(context.record)),
        payload: {
          schemaVersion: 'ControlledCloseoutRequestRegistration/v1',
          requestId: input.request.requestId,
          expectedRecordRevision: nextRevision,
          requestRef: input.requestRef,
          deliveryGateReceiptRef: input.gateRef,
          pageRef: input.pageRef,
          executionFinalCandidateHash: input.request.executionFinalCandidateHash,
        },
        artifactWrites: runtimeStatusProjectionArtifactWrites(update),
        reduce: (record) => {
          const existingCloseout = isRecord(record.closeout) ? record.closeout : {};
          return {
            ...record,
            ...runtimeStatusProjectionRecordPatch({
              record,
              modelId: 'delivery_confirmation',
              update,
            }),
            recordRevision: nextRevision,
            status: 'awaiting_user_acceptance',
            currentMentalModel: 'delivery_confirmation',
            currentStage: 'delivery_confirmation',
            closeout: {
              ...existingCloseout,
              currentAttemptId: input.request.requestId,
              decision: 'pass',
              updatedAt: recordedAt,
              attempts: [
                ...(existingCloseout.attempts === undefined
                  ? []
                  : records(existingCloseout.attempts)),
                {
                  eventType: 'closeout_check_recorded',
                  closeoutAttemptId: input.request.requestId,
                  decision: 'pass',
                  blockingReasons: [],
                  checks: [],
                  reportPath: input.gateRef.path,
                  evaluatedAt: recordedAt,
                  evaluatedBy: 'main-agent-goal-run-finalizer',
                },
              ],
              acceptanceRequest: {
                status: 'awaiting_user_acceptance',
                closeoutAttemptId: input.request.requestId,
                requestId: input.request.requestId,
                requestRef: input.requestRef,
                deliveryGateReceiptRef: input.gateRef,
                pageRef: input.pageRef,
                executionFinalCandidateHash: input.request.executionFinalCandidateHash,
                currentImplementationAttemptId: context.currentAttemptId,
                expectedRecordRevision: nextRevision,
                requestedAt: recordedAt,
                requestedBy: 'main-agent-goal-run-finalizer',
                htmlPath: input.pageRef.path,
                renderReportPath: input.gateRef.path,
                summaryPath: input.requestRef.path,
                closeoutConfirmationPageHash: input.pageRef.hash,
                deliveryCloseoutReportHash: input.gateRef.hash,
              },
            },
            lastEventType: 'delivery_confirmation_user_acceptance_requested',
            updatedAt: recordedAt,
          };
        },
      });
      return;
    } catch (error) {
      if (!String(error).includes('control_store_compare_and_swap_failed')) throw error;
    }
  }
  fail('goal_finalization_closeout_request_cas_failed');
}

function materializeControlledCloseout(input: {
  authority: CampaignAuthority;
  candidate: ExecutionFinalCandidate;
  candidateRef: ArtifactRef;
  acceptedResultRef: ArtifactRef;
  aggregate: JsonRecord;
  aggregateRef: ArtifactRef;
  effectivePass: JsonRecord;
  effectivePassRef: ArtifactRef;
}): {
  deliveryGateReceiptRef: ArtifactRef;
  closeoutRequestRef: ArtifactRef;
  pageRef: ArtifactRef;
} {
  ensureExecutionClosureStatus(input.authority, input.candidate);
  ensureAuditReviewStatus(input.authority, {
    candidateRef: input.candidateRef,
    acceptedResultRef: input.acceptedResultRef,
    aggregateRef: input.aggregateRef,
    effectivePassRef: input.effectivePassRef,
  });
  const current = deliveryVerifiedStatuses(input.authority, input.candidate);
  const taskReport = taskReportArtifact(input.candidate);
  const projectRoot = text(input.authority.admitted.projectRoot);
  const taskReportBytes = readGoalExecutionConfinedBytes({
    root: projectRoot,
    targetPath: targetPath(projectRoot, taskReport.path),
  });
  const closeoutAttemptId = `goal-closeout-${input.candidate.executionFinalCandidateHash
    .slice('sha256:'.length)
    .slice(0, 32)}`;
  const contextHash = stableHash({
    schemaVersion: 'GoalDeliveryCloseoutContext/v1',
    recordId: current.recordId,
    currentImplementationAttemptId: current.currentAttemptId,
    campaignClosureHash: input.authority.campaignRef.hash,
    executionFinalCandidateHash: input.candidate.executionFinalCandidateHash,
    aggregateHash: input.aggregateRef.hash,
    effectivePassReceiptHash: input.effectivePassRef.hash,
  });
  const closurePayload = {
    schemaVersion: 'GoalDeliveryClosureProof/v1',
    status: 'campaign_closed' as const,
    closeoutAttemptId,
    contextHash,
    taskReportArtifactHash: taskReport.hash,
    campaignClosureHash: input.authority.campaignRef.hash,
  };
  const compiled = compileControlledGoalCloseoutArtifacts({
    closeoutAttemptId,
    contextHash,
    taskReportArtifactHash: taskReport.hash,
    candidateBytes: canonicalGoalExecutionBytes(input.candidate),
    taskReportBytes,
    closureReceipt: { ...closurePayload, receiptHash: stableHash(closurePayload) },
    campaignClosureReceipt: input.authority.campaign,
    executionFinalCandidate: input.candidate,
    executionFinalJudgeCampaign: input.aggregate,
    effectivePassReceipt: input.effectivePass,
    verifiedSixModelStatuses: current.statuses,
    currentImplementationAttemptId: current.currentAttemptId,
    artifactRoot: finalizationRoot(input.candidate),
    recordId: current.recordId,
    taskReportRef: { path: taskReport.path, hash: taskReport.hash },
  });
  const deliveryGateReceiptRef = publishRecord({
    projectRoot,
    relativePath: compiled.gateReceiptRef.path,
    record: compiled.gateReceipt,
    hash: compiled.gateReceiptRef.hash,
  });
  const closeoutRequestRef = publishRecord({
    projectRoot,
    relativePath: compiled.requestRef.path,
    record: compiled.request,
    hash: compiled.requestRef.hash,
  });
  const pageBytes = Buffer.from(compiled.pageHtml, 'utf8');
  const publishedPage = publishGoalExecutionImmutableArtifact({
    projectRoot,
    outRoot: projectRoot,
    targetPath: targetPath(projectRoot, compiled.pageRef.path),
    bytes: pageBytes,
    hash: compiled.pageRef.hash,
  });
  const pageRef = { path: publishedPage.projectRelativePath, hash: publishedPage.hash };
  if (
    stableHash(deliveryGateReceiptRef) !== stableHash(compiled.gateReceiptRef) ||
    stableHash(closeoutRequestRef) !== stableHash(compiled.requestRef) ||
    stableHash(pageRef) !== stableHash(compiled.pageRef) ||
    bytesHash(pageBytes) !== pageRef.hash
  ) {
    fail('goal_finalization_closeout_publication_invalid');
  }
  registerControlledCloseoutRequest({
    authority: input.authority,
    candidateRef: input.candidateRef,
    request: compiled.request,
    requestRef: closeoutRequestRef,
    gateRef: deliveryGateReceiptRef,
    pageRef,
  });
  return { deliveryGateReceiptRef, closeoutRequestRef, pageRef };
}

function recoverAcceptedResult(input: {
  authority: CampaignAuthority;
  projectRoot: string;
  campaignRef: ArtifactRef;
  candidate: ExecutionFinalCandidate;
  candidateRef: ArtifactRef;
}): GoalFinalizationResult | null {
  const acceptedPath = acceptedResultPath(input.candidate);
  const absoluteAcceptedPath = targetPath(input.projectRoot, acceptedPath);
  if (!fs.existsSync(absoluteAcceptedPath)) return null;
  const publication = readCanonicalJson(input.projectRoot, acceptedPath);
  const accepted = publication.record as ExecutionFinalAcceptedResult;
  const aggregateRef = artifactRef(accepted.aggregateRef);
  const requestRef = artifactRef(accepted.requestRef);
  const responseRef = artifactRef(accepted.responseRef);
  if (
    accepted.schemaVersion !== 'ExecutionFinalAcceptedResult/v1' ||
    accepted.executionFinalCandidateHash !== input.candidate.executionFinalCandidateHash ||
    stableHash(accepted.candidateRef) !== stableHash(input.candidateRef) ||
    accepted.campaignClosureHash !== input.campaignRef.hash ||
    accepted.decision !== 'pass' ||
    accepted.coverageDisposition !== 'coverage_satisfied'
  ) {
    fail('execution_final_accepted_result_conflict');
  }
  const persistedCandidate = validateExecutionFinalCandidate(
    readCanonicalJson(input.projectRoot, input.candidateRef.path).record
  );
  if (
    persistedCandidate.executionFinalCandidateHash !== input.candidateRef.hash ||
    stableHash(persistedCandidate) !== stableHash(input.candidate)
  ) {
    fail();
  }
  const request = readActorIntentRef(input.projectRoot, requestRef);
  const response = readRefRecord(input.projectRoot, responseRef, 'responseHash');
  const aggregate = readRefRecord(input.projectRoot, aggregateRef, 'aggregateHash');
  const campaignInput = compileFinalizationCampaignInput(
    input.candidate,
    input.campaignRef,
    text(aggregate.providerRef)
  );
  const blindInput = campaignBlindInput(campaignInput);
  const actorReceipts = records(aggregate.actorReceipts);
  const reviewerReceipt = actorReceipts.find(
    (receipt) => receipt.actorClass === 'bounded_code_reviewer'
  );
  const finalJudgeReceipt = actorReceipts.find(
    (receipt) => receipt.actorClass === 'final_acceptance_judge'
  );
  const blindnessProof = isRecord(aggregate.blindnessProof) ? aggregate.blindnessProof : fail();
  const actorIsolationReceiptHashes = Array.isArray(blindnessProof.actorIsolationReceiptHashes)
    ? blindnessProof.actorIsolationReceiptHashes.map(text)
    : fail();
  const invocationCount = isRecord(aggregate.invocationCountReceipt)
    ? aggregate.invocationCountReceipt
    : fail();
  const aggregateInputPayload = {
    schemaVersion: campaignInput.schemaVersion,
    ...blindInput,
    reviewerActorClass: campaignInput.reviewerActorClass,
    finalJudgeActorClass: campaignInput.finalJudgeActorClass,
    providerRef: campaignInput.providerRef,
    actorBindingHash: campaignInput.actorBindingHash,
  };
  if (
    actorReceipts.length !== 2 ||
    !reviewerReceipt ||
    !finalJudgeReceipt ||
    actorReceipts.some((receipt) => {
      const payload = { ...receipt };
      delete payload.actorReceiptHash;
      return stableHash(payload) !== receipt.actorReceiptHash;
    }) ||
    request.actorClass !== 'final_acceptance_judge' ||
    stableHash(request.blindInput) !== stableHash(blindInput) ||
    finalJudgeReceipt.invocationIntentHash !== request.invocationIntentHash ||
    stableHash(response.requestRef) !== stableHash(requestRef) ||
    stableHash(response.actorReceipt) !== stableHash(finalJudgeReceipt) ||
    response.executionFinalCandidateHash !== input.candidate.executionFinalCandidateHash ||
    aggregate.campaignInputHash !== stableHash(aggregateInputPayload) ||
    aggregate.executionFinalCandidateHash !== input.candidate.executionFinalCandidateHash ||
    aggregate.campaignClosureHash !== input.campaignRef.hash ||
    stableHash(aggregate.executionFinalCandidate) !== stableHash(input.candidate) ||
    aggregate.decision !== 'pass' ||
    invocationCount.reviewerCalls !== 1 ||
    invocationCount.finalJudgeCalls !== 1 ||
    invocationCount.semanticInvocationCount !== 2 ||
    blindnessProof.identicalBlindInputHash !== stableHash(blindInput) ||
    blindnessProof.peerOutputMaterialization !== 'none' ||
    actorReceipts.some(
      (receipt) =>
        !isRecord(receipt.actorIsolationReceipt) ||
        receipt.actorIsolationReceiptHash !== receipt.actorIsolationReceipt.isolationReceiptHash
    ) ||
    stableHash(uniqueSorted(actorIsolationReceiptHashes)) !==
      stableHash(
        uniqueSorted(actorReceipts.map((receipt) => text(receipt.actorIsolationReceiptHash)))
      ) ||
    !Array.isArray(blindnessProof.preparedIntentHashes) ||
    stableHash(uniqueSorted(blindnessProof.preparedIntentHashes.map(text))) !==
      stableHash(uniqueSorted(actorReceipts.map((receipt) => text(receipt.invocationIntentHash))))
  ) {
    fail('goal_finalization_recovery_binding_invalid');
  }
  const finalJudge = response.result as MainAgentExecutionFinalJudgeResult;
  const reviewer: MainAgentExecutionReviewerResult = {
    sourceLedgerHash: hash(reviewerReceipt.sourceLedgerHash),
    actorIsolationReceipt:
      reviewerReceipt.actorIsolationReceipt as MainAgentExecutionActorIsolationReceipt,
    terminalOutcome:
      reviewerReceipt.terminalOutcome as MainAgentExecutionReviewerResult['terminalOutcome'],
    findingIds: Array.isArray(reviewerReceipt.findingIds)
      ? reviewerReceipt.findingIds.map(text)
      : [],
  };
  const campaignArtifacts = (() => {
    try {
      return validateMainAgentExecutionFinalJudgeCampaignArtifacts({
        campaignInput,
        reviewer,
        finalJudge,
        reviewerReceipt,
        finalJudgeReceipt,
        aggregate,
        finalJudgeIntent: request,
      });
    } catch {
      return fail('goal_finalization_recovery_binding_invalid');
    }
  })();
  if (campaignArtifacts.merge.status !== 'effective_pass_ready') {
    fail('goal_finalization_recovery_binding_invalid');
  }
  const effectivePass = compileExecutionFinalJudgeEffectivePass({
    acceptedResult: accepted,
    aggregateHash: aggregateRef.hash,
    campaignClosureHash: input.campaignRef.hash,
  });
  const effectivePassRef: ArtifactRef = {
    path: `${finalizationRoot(input.candidate)}/execution-effective-pass.json`,
    hash: effectivePass.effectivePassReceiptHash,
  };
  publishRecord({
    projectRoot: input.projectRoot,
    relativePath: effectivePassRef.path,
    record: effectivePass,
    hash: effectivePassRef.hash,
  });
  const persistedEffectivePass = readRefRecord(
    input.projectRoot,
    effectivePassRef,
    'effectivePassReceiptHash'
  );
  if (stableHash(persistedEffectivePass) !== stableHash(effectivePass)) fail();
  const acceptedResultRef = { path: acceptedPath, hash: bytesHash(publication.bytes) };
  const closeout = materializeControlledCloseout({
    authority: input.authority,
    candidate: input.candidate,
    candidateRef: input.candidateRef,
    acceptedResultRef,
    aggregate,
    aggregateRef,
    effectivePass,
    effectivePassRef,
  });
  return {
    schemaVersion: 'main-agent-goal-finalization-result/v1',
    status: 'finalization_reused',
    issueCode: null,
    campaignClosureRef: input.campaignRef,
    candidateRef: input.candidateRef,
    acceptedResultRef,
    aggregateRef,
    effectivePassRef,
    ...closeout,
  };
}

export async function finalizeCommittedGoalRun(
  input: { projectRoot: string; campaignClosurePath: string },
  dependencies?: GoalFinalizationDependencies
): Promise<GoalFinalizationResult> {
  const projectRoot = canonicalProjectRoot(input.projectRoot);
  const authority = resolveCampaignAuthority({ ...input, projectRoot });
  const candidate = validateExecutionFinalCandidate(compileCandidate(authority));
  const root = finalizationRoot(candidate);
  const candidateRef: ArtifactRef = {
    path: `${root}/execution-final-candidate.json`,
    hash: candidate.executionFinalCandidateHash,
  };
  const reused = recoverAcceptedResult({
    authority,
    projectRoot,
    campaignRef: authority.campaignRef,
    candidate,
    candidateRef,
  });
  if (reused) return reused;
  if (!dependencies) fail('goal_finalization_actor_adapters_required');
  const claim = await acquireFinalizationClaim({
    projectRoot,
    candidate,
    campaignClosureHash: authority.campaignRef.hash,
    leaseMs: dependencies.claimLeaseMs,
    onStaleClaimObserved: dependencies.onStaleClaimObserved,
    onStaleClaimTakeoverCriticalSection: dependencies.onStaleClaimTakeoverCriticalSection,
  });
  if (!claim) {
    return (
      recoverAcceptedResult({
        authority,
        projectRoot,
        campaignRef: authority.campaignRef,
        candidate,
        candidateRef,
      }) ?? fail('goal_finalization_claim_recovery_invalid')
    );
  }
  const heartbeat = startFinalizationClaimHeartbeat(projectRoot, claim);
  try {
    const acceptedAfterClaim = recoverAcceptedResult({
      authority,
      projectRoot,
      campaignRef: authority.campaignRef,
      candidate,
      candidateRef,
    });
    if (acceptedAfterClaim) return acceptedAfterClaim;
    ensureExecutionClosureStatus(authority, candidate);
    publishRecord({
      projectRoot,
      relativePath: candidateRef.path,
      record: candidate as unknown as JsonRecord,
      hash: candidateRef.hash,
    });
    const campaignInput = compileFinalizationCampaignInput(
      candidate,
      authority.campaignRef,
      dependencies.resolveProviderRef()
    );
    const campaignResult = await executeMainAgentExecutionFinalJudgeCampaign(
      { campaignInput },
      dependencies
    );
    await heartbeat.assertOwned();
    if (campaignResult.status === 'not_produced') {
      return blockedResult(
        'execution_final_judge_not_produced',
        authority.campaignRef,
        candidateRef
      );
    }
    if (campaignResult.status !== 'effective_pass_ready') {
      return blockedResult(
        campaignResult.status === 'remediation_required'
          ? 'execution_final_judge_findings_present'
          : 'execution_final_judge_coverage_invalid',
        authority.campaignRef,
        candidateRef
      );
    }
    const finalJudge = campaignResult.finalJudge;
    const finalJudgeIntent = campaignResult.finalJudgeIntent;
    const finalJudgeReceipt = campaignResult.finalJudgeReceipt;
    const aggregate = campaignResult.aggregate;
    const requestRef = publishRecord({
      projectRoot,
      relativePath: `${root}/final-judge-request.json`,
      record: finalJudgeIntent as unknown as JsonRecord,
      hash: finalJudgeIntent.invocationIntentHash,
    });
    const responsePayload = {
      schemaVersion: 'main-agent-execution-final-judge-response/v1',
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      requestRef,
      result: finalJudge,
      actorReceipt: finalJudgeReceipt,
    };
    const response = { ...responsePayload, responseHash: stableHash(responsePayload) };
    const responseRef = publishRecord({
      projectRoot,
      relativePath: `${root}/final-judge-response.json`,
      record: response,
      hash: response.responseHash,
    });
    const aggregateRef = publishRecord({
      projectRoot,
      relativePath: `${root}/execution-final-aggregate.json`,
      record: aggregate,
      hash: aggregate.aggregateHash,
    });
    await heartbeat.assertOwned();
    const accepted = publishExecutionFinalAcceptedResult({
      projectRoot,
      artifactRoot: 'goal/runtime/execution-final',
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      candidateRef,
      requestRef,
      responseRef,
      aggregateRef,
      campaignClosureHash: authority.campaignRef.hash,
      decision: 'pass',
      coverageDisposition: 'coverage_satisfied',
    });
    const effectivePass = compileExecutionFinalJudgeEffectivePass({
      acceptedResult: accepted.acceptedResult,
      aggregateHash: aggregateRef.hash,
      campaignClosureHash: authority.campaignRef.hash,
    });
    const effectivePassRef = publishRecord({
      projectRoot,
      relativePath: `${root}/execution-effective-pass.json`,
      record: effectivePass,
      hash: effectivePass.effectivePassReceiptHash,
    });
    const closeout = materializeControlledCloseout({
      authority,
      candidate,
      candidateRef,
      acceptedResultRef: { path: accepted.path, hash: accepted.hash },
      aggregate: aggregate as unknown as JsonRecord,
      aggregateRef,
      effectivePass: effectivePass as unknown as JsonRecord,
      effectivePassRef,
    });
    return {
      schemaVersion: 'main-agent-goal-finalization-result/v1',
      status: 'awaiting_user_acceptance',
      issueCode: null,
      campaignClosureRef: authority.campaignRef,
      candidateRef,
      acceptedResultRef: { path: accepted.path, hash: accepted.hash },
      aggregateRef,
      effectivePassRef,
      ...closeout,
    };
  } finally {
    await heartbeat.stop();
    await releaseFinalizationClaim(projectRoot, claim);
  }
}
