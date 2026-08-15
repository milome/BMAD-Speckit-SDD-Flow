import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeCurrentReadinessScopedInputDigest } from '../../../main-agent/source-authority/scripts/main-agent-implementation-readiness-v2';
import {
  deriveArchitectureConfirmationCandidate,
  readCurrentArchitectureConfirmationAcceptance,
  resolveArchitectureConfirmationContext,
} from '../../../main-agent/source-authority/scripts/prepare-architecture-confirmation';
import { validateRuntimeStatusDecisionReceipt } from '../../../main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';
import { requirementsContractDomainHash } from '../../../main-agent/source-authority/scripts/requirements-contract-hash-domains';
import {
  sha256Stable,
  sha256Text,
  stableStringify,
} from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { resolveVerifiedSixModelStatus } from '../../../main-agent/source-authority/scripts/verified-six-model-status-facade';
import { compileGoalExecutionClosure } from './goal-execution-closure';
import { probeGoalContractRenderability } from './goal-contract-renderability-probe';
import {
  compileGoalExecutionIR,
  validateGoalExecutionIR,
  type GoalExecutionCompilerInput,
  type GoalExecutionIR,
  type GoalExecutionObligation,
} from './goal-execution-ir';
import { refreshGoalSourceBinding } from './goal-source-binding-refresh';
import { validateGoalContractSchema } from './schema-registry';

type JsonObject = Record<string, unknown>;

export interface RequirementsBackedGoalInput {
  projectRoot: string;
  requirementRecordPath: string;
  outRoot: string;
}

export interface RequirementsBackedGoalDependencies {
  compileGoalExecutionIR?: typeof compileGoalExecutionIR;
}

export interface RequirementsBackedGoalResult extends JsonObject {
  schemaVersion: 'goal-contract-generation-result/v2';
  status: 'requirements_backed_goal_ready';
  profile: 'requirements_backed';
  publicationStatus: 'published' | 'reused';
  writeCount: number;
  goalExecutionIRHash: string;
  goalJudgeDispatchCount: 0;
  admissionSnapshotRef: { path: string; hash: string };
  adapterProjectionRef: { path: string; hash: string };
  goalExecutionIrRef: { path: string; hash: string };
  sourceBindingRef: { path: string; hash: string };
  resolvedEvidenceIndexRef: { path: string; hash: string };
  closureRef: { path: string; hash: string };
  parentProjectionRef: { path: string; bytesHash: string };
  renderabilityReportRef: { path: string; bytesHash: string };
  activeAuthorityRef: { path: string; hash: string };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function readJson(filePath: string): JsonObject {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('requirements_backed_json_object_required');
  }
  return value as JsonObject;
}

function confined(root: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath))
    throw new Error('requirements_backed_artifact_path_invalid');
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...relativePath.replace(/\\/gu, '/').split('/'));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('requirements_backed_artifact_path_escape');
  }
  return resolved;
}

function assertInput(input: RequirementsBackedGoalInput): void {
  const allowed = new Set(['projectRoot', 'requirementRecordPath', 'outRoot']);
  const forbidden = Object.keys(input as JsonObject).find((key) => !allowed.has(key));
  if (forbidden) throw new Error(`requirements_backed_caller_derived_input_forbidden:${forbidden}`);
  if (!input.projectRoot || !input.requirementRecordPath || !input.outRoot) {
    throw new Error('requirements_backed_input_incomplete');
  }
}

function requirementKind(row: JsonObject): GoalExecutionObligation['kind'] {
  const id = text(row.id).toUpperCase();
  const kind = text(row.requirementKind);
  const polarity = text(row.polarity);
  if (id.startsWith('OUT-')) return 'OUT';
  if (kind === 'negative' || polarity === 'negative' || id.startsWith('NEG-')) return 'NEG';
  if (kind === 'nonfunctional' || id.startsWith('NFR-')) return 'NFR';
  if (id.startsWith('FR-')) return 'FR';
  return 'MUST';
}

export function projectRequirementsToGoalObligations(
  semanticIr: JsonObject
): GoalExecutionObligation[] {
  const payload = object(semanticIr.semanticPayload);
  const semantics = object(payload.semantics);
  const atoms = objects(semantics.atoms);
  const specSpans = objects(payload.specSpanRegistry);
  const requirements = objects(semantics.requirements).map((row) => {
    const id = text(row.id);
    if (!id || !text(row.text) || !text(row.oracle)) {
      throw new Error('requirements_successor_required:goal_obligation_shape');
    }
    const spans = specSpans.filter((span) => strings(span.boundObligationIds).includes(id));
    return {
      obligationId: id,
      kind: requirementKind(row),
      text: text(row.text),
      oracle: text(row.oracle),
      sourceRefs: sortedUnique([
        id,
        text(object(payload.semanticProvenance)[id]),
        ...spans.map((span) => text(span.specSpanId)),
      ]),
      atomRefs: sortedUnique(
        atoms.filter((atom) => text(atom.requirementRef) === id).map((atom) => text(atom.id))
      ),
      evidenceClaimRefs: sortedUnique(spans.flatMap((span) => strings(span.evidenceClaimRefs))),
    } satisfies GoalExecutionObligation;
  });
  const supplemental: Array<[string, GoalExecutionObligation['kind']]> = [
    ['acceptanceCriteria', 'ACCEPTANCE'],
    ['failures', 'FAILURE'],
    ['failureModes', 'FAILURE'],
    ['edgeCases', 'EDGE'],
  ];
  for (const [field, kind] of supplemental) {
    for (const row of objects(semantics[field])) {
      const id = text(row.id);
      if (
        !id ||
        (!text(row.text) && !text(row.description)) ||
        (!text(row.oracle) && !text(row.expected))
      ) {
        throw new Error('requirements_successor_required:goal_obligation_shape');
      }
      if (requirements.some((obligation) => obligation.obligationId === id)) {
        throw new Error('requirements_successor_required:goal_obligation_identity');
      }
      const spans = specSpans.filter((span) => strings(span.boundObligationIds).includes(id));
      requirements.push({
        obligationId: id,
        kind,
        text: text(row.text) || text(row.description),
        oracle: text(row.oracle) || text(row.expected),
        sourceRefs: sortedUnique([id, ...spans.map((span) => text(span.specSpanId))]),
        atomRefs: [],
        evidenceClaimRefs: sortedUnique(spans.flatMap((span) => strings(span.evidenceClaimRefs))),
      });
    }
  }
  return requirements.sort((left, right) => left.obligationId.localeCompare(right.obligationId));
}

function readinessCandidateHash(candidate: JsonObject): string {
  const stableOutcomes = objects(candidate.redOutcomes).map(
    ({ rawLogRef: _rawLogRef, ...outcome }) => outcome
  );
  return requirementsContractDomainHash('implementation-readiness-candidate/v1', {
    schemaVersion: candidate.schemaVersion,
    requestId: candidate.requestId,
    requirementsLineage: candidate.requirementsLineage,
    architectureConfirmationCandidateHash: candidate.architectureConfirmationCandidateHash,
    readinessScopedInputDigest: candidate.readinessScopedInputDigest,
    readinessPolicy: candidate.readinessPolicy,
    normalizedCommands: candidate.normalizedCommands,
    inputArtifacts: candidate.inputArtifacts,
    redOutcomes: stableOutcomes,
  });
}

function readCurrentReadiness(input: {
  recordRoot: string;
  runtimeRecord: JsonObject;
  semanticRevisionId: string;
  scopeSemanticHash: string;
  executionConstraintRegistryHash: string;
  architectureConfirmationCandidateHash: string;
  currentScopedInputDigest: string;
}): { candidate: JsonObject; decisionReceipt: JsonObject; projection: JsonObject } {
  const projection = object(object(input.runtimeRecord.sixModelResults).implementation_readiness);
  const candidateHash = text(object(projection.currentHashes).implementationReadinessCandidateHash);
  const receiptPath = confined(input.recordRoot, text(projection.decisionReceiptRef));
  if (!candidateHash || !fs.existsSync(receiptPath)) {
    throw new Error('readiness_recheck_required:implementation_readiness');
  }
  const decisionReceipt = readJson(receiptPath);
  if (
    !validateRuntimeStatusDecisionReceipt(decisionReceipt) ||
    decisionReceipt.receiptHash !== text(projection.decisionReceiptHash)
  ) {
    throw new Error('readiness_recheck_required:implementation_readiness');
  }
  const candidateOutput = objects(decisionReceipt.deterministicGateOutputs).find(
    (row) => text(row.role) === 'implementation_readiness_candidate'
  );
  if (!candidateOutput) throw new Error('readiness_recheck_required:implementation_readiness');
  const candidate = readJson(confined(input.recordRoot, text(candidateOutput.path)));
  const lineage = object(candidate.requirementsLineage);
  if (
    candidate.schemaVersion !== 'ImplementationReadinessCandidate/v1' ||
    text(candidate.implementationReadinessCandidateHash) !== candidateHash ||
    readinessCandidateHash(candidate) !== candidateHash ||
    text(candidateOutput.hash) !== candidateHash ||
    text(candidate.architectureConfirmationCandidateHash) !==
      input.architectureConfirmationCandidateHash ||
    text(lineage.semanticRevisionId) !== input.semanticRevisionId ||
    text(lineage.scopeSemanticHash) !== input.scopeSemanticHash ||
    text(lineage.executionConstraintRegistryHash) !== input.executionConstraintRegistryHash ||
    text(decisionReceipt.decision) !== 'pass' ||
    text(decisionReceipt.effectiveStatus) !== 'pass'
  ) {
    throw new Error('readiness_recheck_required:implementation_readiness');
  }
  if (input.currentScopedInputDigest !== text(candidate.readinessScopedInputDigest)) {
    throw new Error('readiness_recheck_required:scoped_input_digest');
  }
  return { candidate, decisionReceipt, projection };
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableStringify(value)}\n`, 'utf8');
}

function activeAuthorityWithoutBinding(value: JsonObject): JsonObject {
  const comparable = { ...value };
  delete comparable.activeAuthorityHash;
  delete comparable.sourceBindingRef;
  delete comparable.resolvedEvidenceIndexRef;
  return comparable;
}

function readReusableRequirementsBackedIr(input: {
  outRoot: string;
  activePath: string;
  semanticSource: JsonObject;
  requirementsLineage: JsonObject;
  technicalAuthority: JsonObject;
}): GoalExecutionIR | null {
  if (!fs.existsSync(input.activePath)) return null;
  const active = readJson(input.activePath);
  validateGoalContractSchema('goal-contract-active-authority.schema.json', active);
  const activePayload = { ...active };
  delete activePayload.activeAuthorityHash;
  if (text(active.activeAuthorityHash) !== sha256Stable(activePayload)) {
    throw new Error('goal_active_authority_hash_mismatch');
  }
  if (text(active.profile) !== 'requirements_backed') return null;
  const irRef = object(active.goalExecutionIrRef);
  const irPath = confined(input.outRoot, text(irRef.path));
  const ir = readJson(irPath) as GoalExecutionIR;
  const validation = validateGoalExecutionIR(ir);
  if (
    validation.decision !== 'pass' ||
    text(irRef.hash) !== ir.goalExecutionIRHash ||
    text(active.goalExecutionIRHash) !== ir.goalExecutionIRHash
  ) {
    throw new Error('goal_active_execution_ir_invalid');
  }
  return stableStringify(ir.semanticSource) === stableStringify(input.semanticSource) &&
    stableStringify(ir.requirementsLineage) === stableStringify(input.requirementsLineage) &&
    stableStringify(ir.technicalAuthority) === stableStringify(input.technicalAuthority)
    ? ir
    : null;
}

function publishImmutable(targetPath: string, bytes: Buffer): boolean {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    const handle = fs.openSync(targetPath, 'wx');
    try {
      fs.writeFileSync(handle, bytes);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('goal_immutable_artifact_readback_failed');
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!fs.readFileSync(targetPath).equals(bytes))
      throw new Error('goal_immutable_artifact_conflict');
    return false;
  }
}

function publishActiveAuthority(targetPath: string, value: JsonObject): boolean {
  const bytes = canonicalBytes(value);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) {
    if (!fs.readFileSync(targetPath).equals(bytes))
      throw new Error('goal_active_authority_conflict');
    return false;
  }
  const temporary = `${targetPath}.candidate-${process.pid}`;
  publishImmutable(temporary, bytes);
  try {
    fs.renameSync(temporary, targetPath);
  } catch (error) {
    if (fs.existsSync(targetPath) && fs.readFileSync(targetPath).equals(bytes)) {
      fs.rmSync(temporary, { force: true });
      return false;
    }
    throw error;
  }
  if (!fs.readFileSync(targetPath).equals(bytes)) {
    throw new Error('goal_active_authority_readback_failed');
  }
  return true;
}

function renderParentGoal(ir: JsonObject): string {
  const obligations = objects(ir.obligations);
  const tasks = objects(ir.atomicTasks);
  return [
    '# Goal Execution Contract',
    '',
    `Goal Execution IR: ${text(ir.goalExecutionIRHash)}`,
    `Profile: ${text(ir.profile)}`,
    '',
    '## Obligations',
    '',
    ...obligations.map((row) => `- ${text(row.kind)} ${text(row.obligationId)}: ${text(row.text)}`),
    '',
    '## Atomic Tasks',
    '',
    ...tasks.map(
      (row) =>
        `- ${text(row.taskId)}: ${text(row.title)} (${String(row.expectedEffortMinutes)}m expected, ${String(row.upperBoundEffortMinutes)}m max)`
    ),
    '',
  ].join('\n');
}

export function compileRequirementsBackedGoal(
  input: RequirementsBackedGoalInput,
  dependencies: RequirementsBackedGoalDependencies = {}
): RequirementsBackedGoalResult {
  assertInput(input);
  const projectRoot = path.resolve(input.projectRoot);
  const requirementRecordPath = path.resolve(projectRoot, input.requirementRecordPath);
  const runtimeRecord = readJson(requirementRecordPath);
  const requestId = text(runtimeRecord.recordId);
  const expectedRecordPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requestId,
    'requirement-record.json'
  );
  if (!requestId || requirementRecordPath !== expectedRecordPath) {
    throw new Error('requirements_backed_requirement_record_invalid');
  }
  const context = resolveArchitectureConfirmationContext({ projectRoot, requestId });
  const architecture = deriveArchitectureConfirmationCandidate(context);
  const architectureAcceptance = readCurrentArchitectureConfirmationAcceptance({
    context,
    candidate: architecture,
  });
  if (!architectureAcceptance)
    throw new Error('architecture_successor_required:architecture_confirmation');
  const decisionReceipts = objects(runtimeRecord.runtimeStatusDecisionReceipts).map((row) => ({
    path: text(row.path),
    receipt: row.receipt,
  }));
  const currentAttemptId = text(runtimeRecord.currentAttemptId);
  for (const modelId of [
    'requirement_confirmation',
    'architecture_confirmation',
    'implementation_readiness',
  ] as const) {
    const status = resolveVerifiedSixModelStatus({
      record: runtimeRecord,
      modelId,
      currentImplementationAttemptId: currentAttemptId,
      decisionReceipts,
    });
    if (status.effectiveStatus !== 'pass') {
      const issue =
        modelId === 'implementation_readiness'
          ? 'readiness_recheck_required:implementation_readiness'
          : modelId === 'architecture_confirmation'
            ? 'architecture_successor_required:architecture_confirmation'
            : 'requirements_successor_required:requirement_confirmation';
      throw new Error(issue);
    }
  }
  let currentScopedInputDigest = '';
  try {
    currentScopedInputDigest = computeCurrentReadinessScopedInputDigest({
      context,
      architectureCandidate: architecture,
    });
  } catch {
    throw new Error('readiness_recheck_required:scoped_input_digest');
  }
  const readiness = readCurrentReadiness({
    recordRoot: context.recordRoot,
    runtimeRecord,
    semanticRevisionId: context.semanticIr.semanticRevisionId,
    scopeSemanticHash: context.semanticIr.scopeSemanticHash,
    executionConstraintRegistryHash:
      context.semanticIr.semanticPayload.executionConstraintRegistryHash,
    architectureConfirmationCandidateHash: architecture.architectureConfirmationCandidateHash,
    currentScopedInputDigest,
  });
  const requirementsLineage = {
    recordId: context.semanticIr.recordId,
    semanticRevisionId: context.semanticIr.semanticRevisionId,
    scopeSemanticHash: context.semanticIr.scopeSemanticHash,
    executionConstraintRegistryHash:
      context.semanticIr.semanticPayload.executionConstraintRegistryHash,
    architectureConfirmationCandidateHash: architecture.architectureConfirmationCandidateHash,
    implementationReadinessCandidateHash: text(
      readiness.candidate.implementationReadinessCandidateHash
    ),
    readinessScopedInputDigest: text(readiness.candidate.readinessScopedInputDigest),
  };
  const admissionPayload = {
    schemaVersion: 'GoalContractAdmissionSnapshot/v1',
    profile: 'requirements_backed',
    requirementsLineage,
    sixModelStatus: {
      requirement_confirmation: 'pass',
      architecture_confirmation: 'pass',
      implementation_readiness: 'pass',
    },
  };
  const admissionSnapshot = {
    ...admissionPayload,
    admissionSnapshotHash: sha256Stable(admissionPayload),
  };
  const obligations = projectRequirementsToGoalObligations(
    context.semanticIr as unknown as JsonObject
  );
  const adapterPayload = {
    schemaVersion: 'GoalRequirementsAdapterProjection/v1',
    profile: 'requirements_backed',
    requirementsLineage,
    obligationMappings: obligations.map((obligation) => ({
      sourceObligationId: obligation.obligationId,
      goalObligationId: obligation.obligationId,
      kind: obligation.kind,
      sourceRefs: obligation.sourceRefs,
    })),
    conservationCounts: Object.fromEntries(
      ['MUST', 'NEG', 'OUT', 'FR', 'NFR', 'ACCEPTANCE', 'FAILURE', 'EDGE'].map((kind) => [
        kind,
        obligations.filter((obligation) => obligation.kind === kind).length,
      ])
    ),
  };
  const adapterProjection = {
    ...adapterPayload,
    adapterProjectionHash: sha256Stable(adapterPayload),
  };
  const technicalAuthority = {
    executionConstraintRegistryHash:
      context.semanticIr.semanticPayload.executionConstraintRegistryHash,
    architectureConfirmationCandidateHash: architecture.architectureConfirmationCandidateHash,
    implementationReadinessCandidateHash: text(
      readiness.candidate.implementationReadinessCandidateHash
    ),
    readinessScopedInputDigest: text(readiness.candidate.readinessScopedInputDigest),
  };
  const semanticSource = {
    kind: 'requirements_semantic_ir',
    semanticRevisionId: context.semanticIr.semanticRevisionId,
    scopeSemanticHash: context.semanticIr.scopeSemanticHash,
  };
  const compilerInput: GoalExecutionCompilerInput = {
    profile: 'requirements_backed',
    semanticSource,
    requirementsLineage,
    technicalAuthority,
    obligations,
    atoms: objects(context.semanticIr.semanticPayload.semantics.atoms),
    logicalSpecSpans: context.semanticIr.semanticPayload
      .specSpanRegistry as unknown as JsonObject[],
    executionConstraints: context.semanticIr.semanticPayload
      .executionConstraints as unknown as JsonObject[],
    architecture,
    readiness: readiness.candidate,
  };
  const outRoot = path.resolve(projectRoot, input.outRoot);
  const activePath = path.join(outRoot, 'goal', 'active-authority.json');
  const ir =
    readReusableRequirementsBackedIr({
      outRoot,
      activePath,
      semanticSource,
      requirementsLineage,
      technicalAuthority,
    }) ?? (dependencies.compileGoalExecutionIR ?? compileGoalExecutionIR)(compilerInput);
  const closure = compileGoalExecutionClosure(ir);
  const sourceBindingPayload = {
    schemaVersion: 'GoalSourceBinding/v1',
    profile: 'requirements_backed',
    goalExecutionIRHash: ir.goalExecutionIRHash,
    requirementsSemanticRevisionId: context.semanticIr.semanticRevisionId,
    requirementsBindingRevisionId: context.sourceBinding.bindingRevisionId,
    requirementsSourceBindingHash: context.sourceBinding.sourceBindingHash,
    architectureAcceptanceRef: architectureAcceptance.eventRef,
    readinessDecisionReceiptRef: {
      path: text(readiness.projection.decisionReceiptRef),
      hash: text(readiness.projection.decisionReceiptHash),
    },
  };
  const sourceBinding = {
    ...sourceBindingPayload,
    goalSourceBindingHash: sha256Stable(sourceBindingPayload),
  };
  const resolvedEvidencePayload = {
    schemaVersion: 'GoalContractResolvedEvidenceIndex/v1',
    profile: 'requirements_backed',
    goalExecutionIRHash: ir.goalExecutionIRHash,
    goalSourceBindingHash: sourceBinding.goalSourceBindingHash,
    requirementsBindingRevisionId: context.sourceBinding.bindingRevisionId,
    resolutions: obligations.map((obligation) => ({
      goalObligationId: obligation.obligationId,
      logicalSpecSpanRefs: obligation.sourceRefs.filter((ref) => ref.startsWith('SPAN-')),
      evidenceClaimRefs: obligation.evidenceClaimRefs,
    })),
  };
  const resolvedEvidenceIndex = {
    ...resolvedEvidencePayload,
    resolvedEvidenceIndexHash: sha256Stable(resolvedEvidencePayload),
  };
  for (const [schemaName, value] of [
    ['goal-contract-admission-snapshot.schema.json', admissionSnapshot],
    ['goal-requirements-adapter-projection.schema.json', adapterProjection],
    ['goal-source-binding.schema.json', sourceBinding],
    ['goal-contract-resolved-evidence-index.schema.json', resolvedEvidenceIndex],
  ] as const) {
    validateGoalContractSchema(schemaName, value);
  }
  const admissionPath = path.join(
    outRoot,
    'g00',
    `${admissionSnapshot.admissionSnapshotHash.slice(7)}.json`
  );
  const adapterPath = path.join(
    outRoot,
    'g01',
    `${adapterProjection.adapterProjectionHash.slice(7)}.json`
  );
  const irPath = path.join(
    outRoot,
    'goal',
    'ir',
    ir.goalExecutionIRHash.slice(7),
    'goal-execution-ir.json'
  );
  const bindingPath = path.join(
    outRoot,
    'goal',
    'bindings',
    sourceBinding.goalSourceBindingHash.slice(7),
    'goal-source-binding.json'
  );
  const resolvedEvidenceIndexPath = path.join(
    outRoot,
    'goal',
    'bindings',
    sourceBinding.goalSourceBindingHash.slice(7),
    'resolved-evidence-index.json'
  );
  const closurePath = path.join(
    outRoot,
    'goal',
    'closures',
    ir.goalExecutionIRHash.slice(7),
    'goal-execution-closure.json'
  );
  const parentProjectionPath = path.join(
    outRoot,
    'goal',
    'projections',
    ir.goalExecutionIRHash.slice(7),
    'goal-execution-contract.md'
  );
  const renderabilityReportPath = path.join(
    outRoot,
    'goal',
    'projections',
    ir.goalExecutionIRHash.slice(7),
    'renderability-report.json'
  );
  const parentBytes = Buffer.from(renderParentGoal(ir), 'utf8');
  const renderabilityReport = probeGoalContractRenderability({
    goalExecutionIr: ir,
    markdown: parentBytes.toString('utf8'),
  });
  if (renderabilityReport.decision !== 'pass') {
    throw new Error(renderabilityReport.issueCodes[0]);
  }
  const renderabilityBytes = canonicalBytes(renderabilityReport);
  const parentProjectionBytesHash = sha256Text(parentBytes.toString('utf8'));
  const renderabilityReportBytesHash = sha256Text(renderabilityBytes.toString('utf8'));
  const artifacts: Array<[string, Buffer]> = [
    [admissionPath, canonicalBytes(admissionSnapshot)],
    [adapterPath, canonicalBytes(adapterProjection)],
    [irPath, canonicalBytes(ir)],
    [bindingPath, canonicalBytes(sourceBinding)],
    [resolvedEvidenceIndexPath, canonicalBytes(resolvedEvidenceIndex)],
    [closurePath, canonicalBytes(closure)],
    [parentProjectionPath, parentBytes],
    [renderabilityReportPath, renderabilityBytes],
  ];
  let writeCount = 0;
  for (const [artifactPath, bytes] of artifacts) {
    if (publishImmutable(artifactPath, bytes)) writeCount += 1;
  }
  const activePayload = {
    schemaVersion: 'GoalContractActiveAuthority/v1',
    profile: 'requirements_backed',
    goalId: ir.goalId,
    goalExecutionIRHash: ir.goalExecutionIRHash,
    goalExecutionIrRef: {
      path: path.relative(outRoot, irPath).replace(/\\/gu, '/'),
      hash: ir.goalExecutionIRHash,
    },
    sourceBindingRef: {
      path: path.relative(outRoot, bindingPath).replace(/\\/gu, '/'),
      hash: sourceBinding.goalSourceBindingHash,
    },
    resolvedEvidenceIndexRef: {
      path: path.relative(outRoot, resolvedEvidenceIndexPath).replace(/\\/gu, '/'),
      hash: resolvedEvidenceIndex.resolvedEvidenceIndexHash,
    },
    closureRef: {
      path: path.relative(outRoot, closurePath).replace(/\\/gu, '/'),
      hash: closure.goalExecutionClosureHash,
    },
    parentProjectionRef: {
      path: path.relative(outRoot, parentProjectionPath).replace(/\\/gu, '/'),
      bytesHash: parentProjectionBytesHash,
    },
    renderabilityReportRef: {
      path: path.relative(outRoot, renderabilityReportPath).replace(/\\/gu, '/'),
      bytesHash: renderabilityReportBytesHash,
    },
  };
  const activeAuthority = {
    ...activePayload,
    activeAuthorityHash: sha256Stable(activePayload),
  };
  validateGoalContractSchema('goal-contract-active-authority.schema.json', activeAuthority);
  let activePublished = false;
  if (fs.existsSync(activePath)) {
    const currentActive = readJson(activePath);
    validateGoalContractSchema('goal-contract-active-authority.schema.json', currentActive);
    const currentPayload = { ...currentActive };
    delete currentPayload.activeAuthorityHash;
    if (text(currentActive.activeAuthorityHash) !== sha256Stable(currentPayload)) {
      throw new Error('goal_active_authority_hash_mismatch');
    }
    const currentBindingHash = text(object(currentActive.sourceBindingRef).hash);
    const sameNonBindingAuthority =
      stableStringify(activeAuthorityWithoutBinding(currentActive)) ===
      stableStringify(activeAuthorityWithoutBinding(activeAuthority));
    if (currentBindingHash !== sourceBinding.goalSourceBindingHash && sameNonBindingAuthority) {
      refreshGoalSourceBinding({
        outRoot,
        expectedActiveAuthorityHash: text(currentActive.activeAuthorityHash),
        sourceBinding,
        resolvedEvidenceIndex,
      });
      if (!fs.readFileSync(activePath).equals(canonicalBytes(activeAuthority))) {
        throw new Error('goal_active_authority_readback_failed');
      }
      writeCount += 2;
      activePublished = true;
    }
  }
  if (!activePublished && publishActiveAuthority(activePath, activeAuthority)) writeCount += 1;
  return Object.freeze({
    schemaVersion: 'goal-contract-generation-result/v2',
    status: 'requirements_backed_goal_ready',
    profile: 'requirements_backed',
    publicationStatus: writeCount === 0 ? 'reused' : 'published',
    writeCount,
    goalExecutionIRHash: ir.goalExecutionIRHash,
    goalJudgeDispatchCount: 0,
    admissionSnapshotRef: { path: admissionPath, hash: admissionSnapshot.admissionSnapshotHash },
    adapterProjectionRef: { path: adapterPath, hash: adapterProjection.adapterProjectionHash },
    goalExecutionIrRef: { path: irPath, hash: ir.goalExecutionIRHash },
    sourceBindingRef: { path: bindingPath, hash: sourceBinding.goalSourceBindingHash },
    resolvedEvidenceIndexRef: {
      path: resolvedEvidenceIndexPath,
      hash: resolvedEvidenceIndex.resolvedEvidenceIndexHash,
    },
    closureRef: { path: closurePath, hash: closure.goalExecutionClosureHash },
    parentProjectionRef: {
      path: parentProjectionPath,
      bytesHash: activePayload.parentProjectionRef.bytesHash,
    },
    renderabilityReportRef: {
      path: renderabilityReportPath,
      bytesHash: activePayload.renderabilityReportRef.bytesHash,
    },
    activeAuthorityRef: { path: activePath, hash: activeAuthority.activeAuthorityHash },
  });
}
