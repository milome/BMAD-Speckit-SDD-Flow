import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { hashControlPlaneValue, stableControlPlaneStringify } from './canonical-hash';
import {
  acquireControlPlaneGenerationLock,
  releaseControlPlaneGenerationLock,
} from './control-plane-generation-lock';
import {
  freezeGoalRunExecutionAdapterAuthority,
  PACKAGED_GOAL_RUN_EXECUTION_ADAPTER_PATH,
  resolvePackagedGoalRunExecutionAdapterAuthority,
} from './goal-run-execution-adapter-authority';
import { validateGoalContractSchema } from './schema-registry';

export type FrozenGoalActivationModule = never;

const EXECUTION_ELIGIBILITY_SCHEMA = 'goal-contract-execution-eligibility.schema.json';
const DIRECT_EXECUTION_PACKAGE_SCHEMA = 'goal-contract-direct-execution-package.schema.json';
const CHILD_EXECUTION_PACKAGE_SCHEMA = 'goal-contract-child-execution-package.schema.json';
const CHILD_EXECUTION_CONTRACT_SCHEMA = 'goal-child-execution-contract.schema.json';
const PARTITION_MANIFEST_SCHEMA = 'goal-contract-frozen-partition-manifest.schema.json';
const CANDIDATE_RUN_SCHEMA = 'goal-contract-candidate-run.schema.json';
const ACTIVATION_RECORD_SCHEMA = 'goal-contract-activation-record.schema.json';
const ACTIVE_RUN_POINTER_SCHEMA = 'goal-contract-active-run-pointer.schema.json';
const ACTIVATION_RESULT_SCHEMA = 'goal-contract-activation-result.schema.json';
const GOAL_EXECUTION_IR_SCHEMA = 'goal-execution-ir.schema.json';
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ACTIVE_RUN_ZERO_HASH =
  'sha256:0000000000000000000000000000000000000000000000000000000000000000';
const ACTIVE_RUN_LOCK_LEASE_MS = 30_000;
const ACTIVE_RUN_LOCK_TIMEOUT_MS = 2_000;
const ACTIVE_RUN_LOCK_POLL_MS = 10;

// Schema validation establishes shape before dynamic records are consumed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaRecord = Record<string, any>;

function failure(failureClass: string, details: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
}

function isRecord(value: unknown): value is SchemaRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function requireHash(value: unknown, field: string): string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value))
    throw failure('activation_request_invalid', { field });
  return value;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw failure('activation_request_invalid', { field });
  return value;
}

function sha256(bytes: Buffer): string {
  return 'sha256:' + createHash('sha256').update(bytes).digest('hex');
}

function readJsonFile(filePath: string, failureClass: string): SchemaRecord {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw failure(failureClass, { path: path.resolve(filePath).replace(/\\/gu, '/') });
  }
}
function normalizedPath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/gu, '/');
}

function isConfined(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative !== '' && (relative.startsWith('..') || path.isAbsolute(relative))) return false;
  let existing = resolvedTarget;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return false;
    existing = parent;
  }
  try {
    const realRoot = fs.realpathSync.native(resolvedRoot);
    const realExisting = fs.realpathSync.native(existing);
    return realExisting === realRoot || realExisting.startsWith(`${realRoot}${path.sep}`);
  } catch {
    return false;
  }
}

function confinedPath(root: string, value: unknown, field: string): string {
  const relative = requireText(value, field);
  if (path.isAbsolute(relative)) {
    throw failure('goal_execution_authority_invalid', { field });
  }
  const resolved = path.resolve(root, relative);
  if (!isConfined(root, resolved)) {
    throw failure('goal_execution_authority_invalid', { field });
  }
  return resolved;
}

function canonicalJsonBytes(value: unknown): Buffer {
  return Buffer.from(`${stableControlPlaneStringify(value)}\n`, 'utf8');
}

function recordWithoutHash(record: SchemaRecord, hashField: string): SchemaRecord {
  const payload = { ...record };
  delete payload[hashField];
  return payload;
}

function verifyRecordHash(record: SchemaRecord, hashField: string, failureClass: string): string {
  const expected = requireHash(record[hashField], hashField);
  if (hashControlPlaneValue(recordWithoutHash(record, hashField)) !== expected) {
    throw failure(failureClass, { field: hashField });
  }
  return expected;
}

function readHashReferencedRecord(input: {
  outRoot: string;
  ref: unknown;
  field: string;
  schemaName: string;
  hashField: string;
}): { path: string; record: SchemaRecord; hash: string } {
  if (!isRecord(input.ref)) {
    throw failure('goal_execution_authority_invalid', { field: input.field });
  }
  const targetPath = confinedPath(input.outRoot, input.ref.path, `${input.field}.path`);
  const record = readJsonFile(targetPath, 'goal_execution_authority_invalid');
  validateGoalContractSchema(input.schemaName, record);
  const hash = verifyRecordHash(record, input.hashField, 'goal_execution_authority_invalid');
  if (hash !== requireHash(input.ref.hash, `${input.field}.hash`)) {
    throw failure('goal_execution_authority_invalid', { field: input.field });
  }
  return { path: targetPath, record, hash };
}

function verifyBytesReference(outRoot: string, ref: unknown, field: string): string {
  if (!isRecord(ref)) {
    throw failure('goal_execution_authority_invalid', { field });
  }
  const targetPath = confinedPath(outRoot, ref.path, `${field}.path`);
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    throw failure('goal_execution_authority_invalid', { field });
  }
  const actual = sha256(fs.readFileSync(targetPath));
  if (actual !== requireHash(ref.bytesHash, `${field}.bytesHash`)) {
    throw failure('goal_execution_authority_invalid', { field });
  }
  return targetPath;
}

function resolveFrozenGoalAuthority(input: { projectRoot: string; goalAuthorityPath: string }): {
  projectRoot: string;
  outRoot: string;
  goalAuthorityPath: string;
  activeAuthority: SchemaRecord;
  goalExecutionIr: SchemaRecord;
  sourceBinding: SchemaRecord;
} {
  const projectRoot = path.resolve(input.projectRoot);
  const goalAuthorityPath = path.resolve(projectRoot, input.goalAuthorityPath);
  if (
    !isConfined(projectRoot, goalAuthorityPath) ||
    path.basename(goalAuthorityPath) !== 'active-authority.json' ||
    path.basename(path.dirname(goalAuthorityPath)) !== 'goal'
  ) {
    throw failure('goal_execution_authority_invalid', {
      field: 'goalAuthorityPath',
    });
  }
  const outRoot = path.dirname(path.dirname(goalAuthorityPath));
  const activeAuthority = readJsonFile(goalAuthorityPath, 'goal_execution_authority_invalid');
  validateGoalContractSchema('goal-contract-active-authority.schema.json', activeAuthority);
  verifyRecordHash(activeAuthority, 'activeAuthorityHash', 'goal_execution_authority_invalid');

  const irRef = activeAuthority.goalExecutionIrRef;
  if (!isRecord(irRef)) {
    throw failure('goal_execution_authority_invalid', {
      field: 'goalExecutionIrRef',
    });
  }
  const irPath = confinedPath(outRoot, irRef.path, 'goalExecutionIrRef.path');
  const goalExecutionIr = readJsonFile(irPath, 'goal_execution_ir_invalid');
  const { validateGoalExecutionIR } = require(
    __filename.endsWith('.ts') ? './goal-execution-ir.ts' : './goal-execution-ir'
  );
  const irValidation = validateGoalExecutionIR(goalExecutionIr);
  if (
    irValidation.decision !== 'pass' ||
    requireHash(irRef.hash, 'goalExecutionIrRef.hash') !== goalExecutionIr.goalExecutionIRHash ||
    activeAuthority.goalExecutionIRHash !== goalExecutionIr.goalExecutionIRHash ||
    activeAuthority.profile !== goalExecutionIr.profile ||
    activeAuthority.goalId !== goalExecutionIr.goalId
  ) {
    throw failure('goal_execution_ir_invalid', {
      issueCodes: irValidation.issueCodes,
    });
  }

  const sourceBindingRef = readHashReferencedRecord({
    outRoot,
    ref: activeAuthority.sourceBindingRef,
    field: 'sourceBindingRef',
    schemaName: 'goal-source-binding.schema.json',
    hashField: 'goalSourceBindingHash',
  });
  if (
    sourceBindingRef.record.profile !== activeAuthority.profile ||
    sourceBindingRef.record.goalExecutionIRHash !== goalExecutionIr.goalExecutionIRHash
  ) {
    throw failure('goal_execution_authority_invalid', {
      field: 'sourceBindingRef',
    });
  }
  const evidenceRef = readHashReferencedRecord({
    outRoot,
    ref: activeAuthority.resolvedEvidenceIndexRef,
    field: 'resolvedEvidenceIndexRef',
    schemaName: 'goal-contract-resolved-evidence-index.schema.json',
    hashField: 'resolvedEvidenceIndexHash',
  });
  const closureRef = readHashReferencedRecord({
    outRoot,
    ref: activeAuthority.closureRef,
    field: 'closureRef',
    schemaName: 'goal-execution-closure.schema.json',
    hashField: 'goalExecutionClosureHash',
  });
  if (
    evidenceRef.record.goalExecutionIRHash !== goalExecutionIr.goalExecutionIRHash ||
    evidenceRef.record.goalSourceBindingHash !== sourceBindingRef.hash ||
    closureRef.record.goalExecutionIRHash !== goalExecutionIr.goalExecutionIRHash ||
    closureRef.record.decision !== 'pass'
  ) {
    throw failure('goal_execution_authority_invalid', {
      field: 'authorityTuple',
    });
  }
  verifyBytesReference(outRoot, activeAuthority.parentProjectionRef, 'parentProjectionRef');
  verifyBytesReference(outRoot, activeAuthority.renderabilityReportRef, 'renderabilityReportRef');

  if (activeAuthority.profile === 'standalone') {
    const standaloneSemanticIrRef = activeAuthority.standaloneSemanticIrRef;
    if (!isRecord(standaloneSemanticIrRef)) {
      throw failure('goal_execution_authority_invalid', {
        field: 'standaloneSemanticIrRef',
      });
    }
    const standaloneSemanticIrPath = confinedPath(
      outRoot,
      standaloneSemanticIrRef.path,
      'standaloneSemanticIrRef.path'
    );
    const standaloneSemanticIr = readJsonFile(
      standaloneSemanticIrPath,
      'goal_execution_authority_invalid'
    );
    validateGoalContractSchema('standalone-goal-semantic-ir.schema.json', standaloneSemanticIr);
    const standaloneSemanticIrHash = requireHash(
      standaloneSemanticIr.standaloneGoalSemanticIRHash,
      'standaloneGoalSemanticIRHash'
    );
    const standaloneSemanticIrPayload = {
      sourcePlanHash: standaloneSemanticIr.sourcePlanHash,
      semanticPayload: standaloneSemanticIr.semanticPayload,
    };
    if (
      hashControlPlaneValue(standaloneSemanticIrPayload) !== standaloneSemanticIrHash ||
      standaloneSemanticIrHash !==
        requireHash(standaloneSemanticIrRef.hash, 'standaloneSemanticIrRef.hash')
    ) {
      throw failure('goal_execution_authority_invalid', {
        field: 'standaloneGoalSemanticIRHash',
      });
    }
    const passRef = readHashReferencedRecord({
      outRoot,
      ref: activeAuthority.standaloneAuthoringEffectivePassRef,
      field: 'standaloneAuthoringEffectivePassRef',
      schemaName: 'standalone-goal-authoring-effective-pass.schema.json',
      hashField: 'authoringEffectivePassHash',
    });
    if (passRef.record.decision !== 'pass') {
      throw failure('standalone_goal_successor_required:authoring_effective_pass');
    }
  }

  return {
    projectRoot,
    outRoot,
    goalAuthorityPath,
    activeAuthority,
    goalExecutionIr,
    sourceBinding: sourceBindingRef.record,
  };
}

export function validateGoalExecutionAdmission(input: {
  phase: 'activation_prepare' | 'activation_commit' | 'execution_start_or_resume' | 'closeout';
  projectRoot: string;
  goalAuthorityPath?: string;
  profile?: 'requirements_backed' | 'standalone';
  expectedGoalExecutionIRHash?: string;
  activeRunPointerPath?: string;
  requestId?: string;
  requirementRecordPath?: string;
}) {
  if (
    !['activation_prepare', 'activation_commit', 'execution_start_or_resume', 'closeout'].includes(
      input.phase
    )
  ) {
    throw failure('activation_request_invalid', { field: 'phase' });
  }
  if (
    input.profile !== undefined &&
    !['requirements_backed', 'standalone'].includes(input.profile)
  ) {
    throw failure('activation_request_invalid', { field: 'profile' });
  }
  if (input.phase === 'closeout') {
    if (input.profile !== undefined && input.profile !== 'requirements_backed') {
      throw failure('goal_execution_authority_invalid', { field: 'profile' });
    }
    const projectRoot = path.resolve(input.projectRoot);
    const requestId = requireText(input.requestId, 'requestId');
    if (!/^[A-Za-z0-9._-]+$/u.test(requestId)) {
      throw failure('goal_execution_closeout_admission_invalid', { field: 'requestId' });
    }
    const requirementRecordPath = path.resolve(
      requireText(input.requirementRecordPath, 'requirementRecordPath')
    );
    const expectedRecordPath = path.join(
      projectRoot,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requestId,
      'requirement-record.json'
    );
    if (requirementRecordPath !== expectedRecordPath) {
      throw failure('goal_execution_closeout_admission_invalid', {
        field: 'requirementRecordPath',
      });
    }
    const requirementRecord = readJsonFile(
      requirementRecordPath,
      'goal_execution_closeout_admission_invalid'
    );
    const closeout = isRecord(requirementRecord.closeout) ? requirementRecord.closeout : {};
    const currentRequest = isRecord(closeout.acceptanceRequest) ? closeout.acceptanceRequest : {};
    const sixModelResults = isRecord(requirementRecord.sixModelResults)
      ? requirementRecord.sixModelResults
      : {};
    const deliveryConfirmation = isRecord(sixModelResults.delivery_confirmation)
      ? sixModelResults.delivery_confirmation
      : {};
    const acceptedReplay =
      requirementRecord.status === 'closed' &&
      requirementRecord.lastEventType === 'record_closed' &&
      currentRequest.status === 'user_accepted_closeout' &&
      currentRequest.decision === 'accept' &&
      currentRequest.committedRecordRevision === requirementRecord.recordRevision;
    const rejectedReplay =
      requirementRecord.status === 'blocked' &&
      requirementRecord.lastEventType === 'closeout_acceptance_rejected' &&
      currentRequest.status === 'user_rejected_closeout' &&
      currentRequest.decision === 'reject' &&
      currentRequest.committedRecordRevision === requirementRecord.recordRevision;
    const awaitingDecision =
      requirementRecord.status === 'awaiting_user_acceptance' &&
      deliveryConfirmation.status === 'awaiting_user_acceptance' &&
      currentRequest.status === 'awaiting_user_acceptance' &&
      currentRequest.expectedRecordRevision === requirementRecord.recordRevision;
    if (
      requirementRecord.recordId !== requestId ||
      requirementRecord.requirementSetId !== requestId
    ) {
      throw failure('goal_execution_closeout_admission_invalid', {
        field: 'recordLineage',
      });
    }
    if (currentRequest.currentImplementationAttemptId !== requirementRecord.currentAttemptId) {
      throw failure('goal_execution_closeout_admission_invalid', {
        field: 'currentImplementationAttemptId',
        actual: currentRequest.currentImplementationAttemptId,
        expected: requirementRecord.currentAttemptId,
      });
    }
    if (!awaitingDecision && !acceptedReplay && !rejectedReplay) {
      throw failure('goal_execution_closeout_admission_invalid', {
        field: 'currentRequestState',
      });
    }
    return Object.freeze({
      phase: input.phase,
      projectRoot,
      requirementRecordPath,
      requirementRecord,
      currentRequest,
      replayState: acceptedReplay ? 'accepted' : rejectedReplay ? 'rejected' : null,
    });
  }
  const goalAuthorityPath = requireText(input.goalAuthorityPath, 'goalAuthorityPath');
  if (input.phase === 'execution_start_or_resume') {
    const committed = resolveCommittedActiveRun({
      projectRoot: input.projectRoot,
      activeRunPointerPath: requireText(input.activeRunPointerPath, 'activeRunPointerPath'),
    });
    if (path.resolve(goalAuthorityPath) !== path.resolve(committed.goalAuthorityPath)) {
      throw failure('goal_execution_authority_invalid', {
        field: 'execution_start_or_resume.goalAuthorityPath',
      });
    }
    if (input.profile !== undefined && input.profile !== committed.profile) {
      throw failure('goal_execution_authority_invalid', { field: 'profile' });
    }
    return Object.freeze({ ...committed, phase: input.phase });
  }
  const resolved = resolveFrozenGoalAuthority({
    projectRoot: input.projectRoot,
    goalAuthorityPath,
  });
  if (input.profile !== undefined && input.profile !== resolved.activeAuthority.profile) {
    throw failure('goal_execution_authority_invalid', { field: 'profile' });
  }
  if (input.phase === 'activation_commit') {
    const expectedGoalExecutionIRHash = requireHash(
      input.expectedGoalExecutionIRHash,
      'expectedGoalExecutionIRHash'
    );
    if (resolved.goalExecutionIr.goalExecutionIRHash !== expectedGoalExecutionIRHash) {
      throw failure('goal_execution_authority_invalid', {
        field: 'activation_commit.goalExecutionIRHash',
      });
    }
  }
  if (resolved.activeAuthority.profile === 'requirements_backed') {
    const requirementsLineage = resolved.goalExecutionIr.requirementsLineage;
    if (!isRecord(requirementsLineage)) {
      throw failure('requirements_successor_required:semantic_authority');
    }
    const requestId = requireText(requirementsLineage.recordId, 'requirementsLineage.recordId');
    const requirementRecordPath = path.join(
      resolved.projectRoot,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requestId,
      'requirement-record.json'
    );
    const { validateRequirementsBackedGoalAdmissionCurrent } = require(
      __filename.endsWith('.ts') ? './goal-requirements-adapter.ts' : './goal-requirements-adapter'
    );
    const requirementsReadiness = validateRequirementsBackedGoalAdmissionCurrent({
      projectRoot: resolved.projectRoot,
      requestId,
      requirementRecordPath,
      expectedRequirementsLineage: requirementsLineage,
    });
    return Object.freeze({
      ...resolved,
      phase: input.phase,
      requirementsReadiness,
    });
  }
  return Object.freeze({ ...resolved, phase: input.phase, requirementsReadiness: null });
}

function sortedUniqueText(values: unknown[]): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === 'string' && value.length > 0)
    ),
  ].sort();
}

function deriveComponentOwnedPaths(
  ir: SchemaRecord,
  component: SchemaRecord,
  domainComponentCounts: Map<string, number>
): string[] {
  const taskRefs = new Set(Array.isArray(component.taskRefs) ? component.taskRefs.map(String) : []);
  const tasks = Array.isArray(ir.atomicTasks) ? ir.atomicTasks.filter(isRecord) : [];
  const componentTasks = tasks.filter((task) => taskRefs.has(String(task.taskId)));
  const obligationRefs = new Set(
    componentTasks.flatMap((task) =>
      Array.isArray(task.obligationRefs) ? task.obligationRefs.map(String) : []
    )
  );
  const atomRefs = new Set(
    componentTasks.flatMap((task) =>
      Array.isArray(task.atomRefs) ? task.atomRefs.map(String) : []
    )
  );
  const basisRefs = new Set(
    Array.isArray(component.basisRefs) ? component.basisRefs.map(String) : []
  );
  const globalOwnedPaths = new Set(
    isRecord(ir.logicalScopes) && Array.isArray(ir.logicalScopes.ownedPaths)
      ? ir.logicalScopes.ownedPaths.map(String)
      : []
  );
  const domainRefs = new Set(
    Array.isArray(component.executionDomainRefs) ? component.executionDomainRefs.map(String) : []
  );
  const domains = Array.isArray(ir.executionDomains)
    ? ir.executionDomains
        .filter(isRecord)
        .filter((domain) => domainRefs.has(String(domain.executionDomainId)))
    : [];
  const domainPaths = new Set(
    domains.flatMap((domain) =>
      Array.isArray(domain.logicalTargetPaths) ? domain.logicalTargetPaths.map(String) : []
    )
  );
  const candidates = new Set<string>();
  for (const artifact of Array.isArray(ir.artifacts) ? ir.artifacts.filter(isRecord) : []) {
    const artifactObligations = Array.isArray(artifact.obligationRefs)
      ? artifact.obligationRefs.map(String)
      : [];
    const artifactAtoms = Array.isArray(artifact.atomRefs) ? artifact.atomRefs.map(String) : [];
    if (
      artifactObligations.some((ref) => obligationRefs.has(ref)) ||
      artifactAtoms.some((ref) => atomRefs.has(ref))
    ) {
      candidates.add(String(artifact.logicalPath ?? ''));
    }
  }
  for (const domain of domains) {
    const domainId = String(domain.executionDomainId);
    if ((domainComponentCounts.get(domainId) ?? 0) === 1) {
      for (const targetPath of Array.isArray(domain.logicalTargetPaths)
        ? domain.logicalTargetPaths
        : []) {
        candidates.add(String(targetPath));
      }
    }
    for (const ownership of Array.isArray(domain.ownership)
      ? domain.ownership.filter(isRecord)
      : []) {
      const ownershipBasis = Array.isArray(ownership.basisRefs)
        ? ownership.basisRefs.map(String)
        : [];
      if (ownershipBasis.some((ref) => basisRefs.has(ref))) {
        candidates.add(String(ownership.targetPath ?? ''));
      }
    }
  }
  return sortedUniqueText(
    [...candidates].filter(
      (targetPath) =>
        targetPath.length > 0 && globalOwnedPaths.has(targetPath) && domainPaths.has(targetPath)
    )
  );
}

function deriveGoalExecutionComponents(ir: SchemaRecord): SchemaRecord[] {
  const tasks = Array.isArray(ir.atomicTasks) ? ir.atomicTasks.filter(isRecord) : [];
  const taskIds = tasks.map((task) => requireText(task.taskId, 'taskId')).sort();
  const parent = new Map(taskIds.map((taskId) => [taskId, taskId]));
  const find = (taskId: string): string => {
    const current = parent.get(taskId);
    if (!current) throw failure('goal_execution_ir_invalid', { field: 'taskRefs' });
    if (current === taskId) return current;
    const root = find(current);
    parent.set(taskId, root);
    return root;
  };
  const union = (left: string, right: string): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const [first, second] = [leftRoot, rightRoot].sort();
    parent.set(second, first);
  };
  const constraints = Array.isArray(ir.coExecutionConstraints)
    ? ir.coExecutionConstraints.filter(isRecord)
    : [];
  for (const constraint of constraints) {
    const refs = Array.isArray(constraint.taskRefs)
      ? constraint.taskRefs.filter((value): value is string => taskIds.includes(String(value)))
      : [];
    for (let index = 1; index < refs.length; index += 1) {
      union(refs[0], refs[index]);
    }
  }
  const traceSlices = Array.isArray(ir.traceSlices) ? ir.traceSlices.filter(isRecord) : [];
  for (const trace of traceSlices) {
    const refs = Array.isArray(trace.taskRefs)
      ? trace.taskRefs.filter((value): value is string => taskIds.includes(String(value)))
      : [];
    for (let index = 1; index < refs.length; index += 1) {
      union(refs[0], refs[index]);
    }
  }
  const taskById = new Map(tasks.map((task) => [String(task.taskId), task]));
  const grouped = new Map<string, string[]>();
  for (const taskId of taskIds) {
    const root = find(taskId);
    grouped.set(root, [...(grouped.get(root) ?? []), taskId]);
  }
  const components = [...grouped.values()]
    .map((refs, index) => {
      const componentTasks = refs.map((taskId) => taskById.get(taskId)!);
      const componentTraceSlices = traceSlices.filter(
        (trace) =>
          Array.isArray(trace.taskRefs) &&
          trace.taskRefs.some((taskRef) => refs.includes(String(taskRef)))
      );
      const expectedEffortMinutes = componentTasks.reduce(
        (total, task) => total + Number(task.expectedEffortMinutes || 0),
        0
      );
      const upperBoundEffortMinutes = componentTasks.reduce(
        (total, task) => total + Number(task.upperBoundEffortMinutes || 0),
        0
      );
      return {
        componentId: `COMPONENT-${String(index + 1).padStart(3, '0')}`,
        executionDomainRefs: sortedUniqueText(
          componentTraceSlices.map((trace) => trace.executionDomainRef)
        ),
        traceSliceRefs: sortedUniqueText(componentTraceSlices.map((trace) => trace.traceSliceId)),
        taskRefs: [...refs].sort(),
        expectedEffortMinutes,
        upperBoundEffortMinutes,
        basisRefs: sortedUniqueText([
          ...componentTasks.flatMap((task) =>
            Array.isArray(task.effortBasisRefs) ? task.effortBasisRefs : []
          ),
          ...constraints
            .filter(
              (constraint) =>
                Array.isArray(constraint.taskRefs) &&
                constraint.taskRefs.some((taskRef) => refs.includes(String(taskRef)))
            )
            .flatMap((constraint) =>
              Array.isArray(constraint.basisRefs) ? constraint.basisRefs : []
            ),
          ...componentTraceSlices.flatMap((trace) =>
            Array.isArray(trace.basisRefs) ? trace.basisRefs : []
          ),
        ]),
        admissible:
          expectedEffortMinutes > 0 &&
          upperBoundEffortMinutes >= expectedEffortMinutes &&
          upperBoundEffortMinutes <= 240,
      };
    })
    .sort((left, right) => String(left.taskRefs[0]).localeCompare(String(right.taskRefs[0])));
  const domainComponentCounts = new Map<string, number>();
  for (const component of components) {
    for (const domainRef of component.executionDomainRefs) {
      domainComponentCounts.set(domainRef, (domainComponentCounts.get(domainRef) ?? 0) + 1);
    }
  }
  return components.map((component) => ({
    ...component,
    ownedPaths: deriveComponentOwnedPaths(ir, component, domainComponentCounts),
  }));
}

function compileFrozenGoalExecutionEligibility(ir: SchemaRecord): SchemaRecord {
  const components = deriveGoalExecutionComponents(ir);
  if (components.length === 0) {
    throw failure('goal_execution_ir_invalid', { field: 'atomicTasks' });
  }
  const oversized = components.find((component) => component.admissible !== true);
  if (oversized) {
    const issueCode =
      ir.profile === 'requirements_backed'
        ? 'requirements_successor_required:goal_task_decomposition'
        : 'standalone_goal_successor_required:goal_task_decomposition';
    throw failure(issueCode, { componentId: oversized.componentId });
  }
  if (components.length === 1) {
    const { directGoalExecutionTopologyAdmissible } = require(
      __filename.endsWith('.ts') ? './frozen-goal-partition.ts' : './frozen-goal-partition'
    );
    if (!directGoalExecutionTopologyAdmissible(ir, components[0])) {
      const issueCode =
        ir.profile === 'requirements_backed'
          ? 'architecture_successor_required:goal_execution_domain'
          : 'standalone_goal_successor_required:goal_execution_domain';
      throw failure(issueCode, { componentId: components[0].componentId });
    }
  }
  const executionMode = components.length === 1 ? 'direct_goal' : 'partitioned_goal';
  const payload = {
    schemaVersion: 'GoalContractExecutionEligibility/v1',
    profile: ir.profile,
    goalId: ir.goalId,
    goalExecutionIRHash: ir.goalExecutionIRHash,
    executionMode,
    partitionOutcome:
      executionMode === 'direct_goal' ? 'not_applicable' : 'partition_search_inconclusive',
    componentCount: components.length,
    components,
    decision: 'pass',
  };
  const eligibility = {
    ...payload,
    eligibilityHash: hashControlPlaneValue(payload),
  };
  validateGoalContractSchema(EXECUTION_ELIGIBILITY_SCHEMA, eligibility);
  return eligibility;
}

function renderDirectHumanPrompt(ir: SchemaRecord): string {
  const tasks = Array.isArray(ir.atomicTasks) ? ir.atomicTasks.filter(isRecord) : [];
  const commands = Array.isArray(ir.commands) ? ir.commands.filter(isRecord) : [];
  return [
    '# Direct Goal Execution',
    '',
    `Goal: ${String(ir.goalId)}`,
    `Goal Execution IR: ${String(ir.goalExecutionIRHash)}`,
    '',
    'Execute only the frozen Goal Execution IR authority.',
    '',
    '## Tasks',
    ...tasks.map((task) => `- ${String(task.taskId)}: ${String(task.title)}`),
    '',
    '## Validation Commands',
    ...commands.map((command) => `- ${String(command.commandId)}: ${String(command.invocation)}`),
    '',
  ].join('\n');
}

function renderDirectGoalExecution(ir: SchemaRecord): string {
  const obligations = Array.isArray(ir.obligations) ? ir.obligations.filter(isRecord) : [];
  const tasks = Array.isArray(ir.atomicTasks) ? ir.atomicTasks.filter(isRecord) : [];
  return [
    '# Goal Execution Package',
    '',
    `Goal Execution IR: ${String(ir.goalExecutionIRHash)}`,
    'Execution Mode: direct_goal',
    '',
    '## Obligations',
    ...obligations.map(
      (obligation) =>
        `- ${String(obligation.kind)} ${String(obligation.obligationId)}: ${String(obligation.text)}`
    ),
    '',
    '## Atomic Tasks',
    ...tasks.map((task) => `- ${String(task.taskId)}: ${String(task.title)}`),
    '',
  ].join('\n');
}

function compileDirectPackage(input: {
  activeAuthority: SchemaRecord;
  goalExecutionIr: SchemaRecord;
  eligibility: SchemaRecord;
  executionAdapterRef: { path: string; hash: string };
}): {
  directPackage: SchemaRecord;
  files: Map<string, Buffer>;
} {
  const ir = input.goalExecutionIr;
  const modelPacketPayload = {
    schemaVersion: 'GoalDirectExecutionModelPacket/v1',
    profile: ir.profile,
    goalId: ir.goalId,
    goalExecutionIRHash: ir.goalExecutionIRHash,
    executionMode: 'direct_goal',
    obligations: ir.obligations,
    logicalSpecSpans: ir.logicalSpecSpans,
    executionDomains: ir.executionDomains,
    traceSlices: ir.traceSlices,
    atomicTasks: ir.atomicTasks,
    dependencies: ir.dependencies,
    logicalScopes: ir.logicalScopes,
    commands: ir.commands,
    evidenceContracts: ir.evidenceContracts,
    artifacts: ir.artifacts,
    coExecutionConstraints: ir.coExecutionConstraints,
  };
  const modelPacket = {
    ...modelPacketPayload,
    modelPacketHash: hashControlPlaneValue(modelPacketPayload),
  };
  const modelPacketBytes = canonicalJsonBytes(modelPacket);
  const humanPromptBytes = Buffer.from(renderDirectHumanPrompt(ir), 'utf8');
  const goalExecutionBytes = Buffer.from(renderDirectGoalExecution(ir), 'utf8');
  const auditPayload = {
    schemaVersion: 'GoalExecutionPackageAuditReceipt/v1',
    profile: ir.profile,
    goalId: ir.goalId,
    goalExecutionIRHash: ir.goalExecutionIRHash,
    executionMode: 'direct_goal',
    artifacts: [
      {
        role: 'model_packet',
        path: 'package/model_packet.json',
        hash: modelPacket.modelPacketHash,
        bytesHash: sha256(modelPacketBytes),
      },
      {
        role: 'human_prompt',
        path: 'package/human_prompt.txt',
        hash: sha256(humanPromptBytes),
        bytesHash: sha256(humanPromptBytes),
      },
      {
        role: 'goal_execution_projection',
        path: 'package/goal_execution.md',
        hash: sha256(goalExecutionBytes),
        bytesHash: sha256(goalExecutionBytes),
      },
    ],
    decision: 'pass',
  };
  const auditReceipt = {
    ...auditPayload,
    auditReceiptHash: hashControlPlaneValue(auditPayload),
  };
  const auditReceiptBytes = canonicalJsonBytes(auditReceipt);
  const packagePayload = {
    schemaVersion: 'GoalContractDirectExecutionPackage/v2',
    profile: ir.profile,
    goalId: ir.goalId,
    goalExecutionIRHash: ir.goalExecutionIRHash,
    executionMode: 'direct_goal',
    goalExecutionAuthorityRef: {
      path: String(input.activeAuthority.goalExecutionIrRef.path),
      hash: ir.goalExecutionIRHash,
    },
    eligibilityRef: {
      path: 'eligibility.json',
      hash: input.eligibility.eligibilityHash,
    },
    executionAdapterRef: input.executionAdapterRef,
    artifacts: [
      {
        role: 'model_packet',
        path: 'package/model_packet.json',
        hash: modelPacket.modelPacketHash,
      },
      {
        role: 'human_prompt',
        path: 'package/human_prompt.txt',
        hash: sha256(humanPromptBytes),
      },
      {
        role: 'audit_receipt',
        path: 'package/audit_receipt.json',
        hash: auditReceipt.auditReceiptHash,
      },
      {
        role: 'goal_execution_projection',
        path: 'package/goal_execution.md',
        hash: sha256(goalExecutionBytes),
      },
    ],
  };
  const directPackage = {
    ...packagePayload,
    directExecutionPackageHash: hashControlPlaneValue(packagePayload),
  };
  validateGoalContractSchema(DIRECT_EXECUTION_PACKAGE_SCHEMA, directPackage);
  return {
    directPackage,
    files: new Map([
      ['package/model_packet.json', modelPacketBytes],
      ['package/human_prompt.txt', humanPromptBytes],
      ['package/audit_receipt.json', auditReceiptBytes],
      ['package/goal_execution.md', goalExecutionBytes],
      ['package/direct-execution-package.json', canonicalJsonBytes(directPackage)],
    ]),
  };
}

function writeFileDurably(targetPath: string, bytes: Buffer): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const descriptor = fs.openSync(targetPath, 'wx');
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  if (!fs.readFileSync(targetPath).equals(bytes)) {
    throw failure('goal_execution_package_invalid', { targetPath });
  }
}

function verifyCandidateRunFiles(runRoot: string, files: Map<string, Buffer>): void {
  for (const [relativePath, expectedBytes] of files) {
    const targetPath = path.join(runRoot, ...relativePath.split('/'));
    if (!fs.existsSync(targetPath) || !fs.readFileSync(targetPath).equals(expectedBytes)) {
      throw failure('goal_execution_package_invalid', {
        targetPath: normalizedPath(targetPath),
      });
    }
  }
}

function promoteCandidateRun(input: {
  runtimeRoot: string;
  candidateRunId: string;
  files: Map<string, Buffer>;
}): { runRoot: string; reused: boolean } {
  const runsRoot = path.join(input.runtimeRoot, 'runs');
  const runRoot = path.join(runsRoot, input.candidateRunId);
  if (fs.existsSync(runRoot)) {
    verifyCandidateRunFiles(runRoot, input.files);
    return { runRoot, reused: true };
  }
  const stagingRoot = path.join(
    input.runtimeRoot,
    'staging',
    `${input.candidateRunId}-${process.pid}-${Date.now()}`
  );
  fs.mkdirSync(path.dirname(stagingRoot), { recursive: true });
  fs.mkdirSync(stagingRoot, { recursive: false });
  try {
    for (const [relativePath, bytes] of input.files) {
      writeFileDurably(path.join(stagingRoot, ...relativePath.split('/')), bytes);
    }
    verifyCandidateRunFiles(stagingRoot, input.files);
    fs.mkdirSync(runsRoot, { recursive: true });
    try {
      fs.renameSync(stagingRoot, runRoot);
    } catch (error) {
      if (!fs.existsSync(runRoot)) throw error;
      verifyCandidateRunFiles(runRoot, input.files);
      fs.rmSync(stagingRoot, { recursive: true, force: true });
      return { runRoot, reused: true };
    }
    verifyCandidateRunFiles(runRoot, input.files);
    return { runRoot, reused: false };
  } catch (error) {
    if (fs.existsSync(stagingRoot)) {
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
    throw error;
  }
}

function readActiveRunPointer(pointerPath: string): SchemaRecord | null {
  if (!fs.existsSync(pointerPath)) return null;
  const pointer = readJsonFile(pointerPath, 'active_run_cas_conflict');
  validateGoalContractSchema(ACTIVE_RUN_POINTER_SCHEMA, pointer);
  verifyRecordHash(pointer, 'activeRunPointerHash', 'active_run_cas_conflict');
  if (!fs.readFileSync(pointerPath).equals(canonicalJsonBytes(pointer))) {
    throw failure('active_run_cas_conflict');
  }
  return pointer;
}

function activeRunPointerMatches(
  pointer: SchemaRecord | null,
  activationRecordRef: string,
  activationRecordHash: string
): pointer is SchemaRecord {
  return (
    pointer?.activationRecordHash === activationRecordHash &&
    pointer?.activationRecordRef === activationRecordRef
  );
}

function activeRunPointerClaimPath(pointerPath: string, nextPointerVersion: number): string {
  return path.join(
    path.dirname(pointerPath),
    'active-run-claims',
    `v${String(nextPointerVersion).padStart(16, '0')}.json`
  );
}

function activeRunVersionLockPath(pointerPath: string, nextPointerVersion: number): string {
  return `${pointerPath}.lock-v${String(nextPointerVersion).padStart(16, '0')}`;
}

function readHighestContinuousActiveRunClaim(pointerPath: string): SchemaRecord | null {
  const claimsRoot = path.join(path.dirname(pointerPath), 'active-run-claims');
  if (!fs.existsSync(claimsRoot)) return null;
  try {
    const claimNames = fs
      .readdirSync(claimsRoot)
      .filter((name) => /^v[0-9]{16}\.json$/u.test(name))
      .sort();
    if (claimNames.length === 0) return null;
    let previousHash = ACTIVE_RUN_ZERO_HASH;
    let previousVersion = 0;
    let highest: SchemaRecord | null = null;
    const expectedClaimKeys = [
      'activationRecordHash',
      'activationRecordRef',
      'candidateRunId',
      'claimHash',
      'expectedBeforeHash',
      'expectedBeforeVersion',
      'nextActiveRunPointerHash',
      'nextPointerVersion',
      'schemaVersion',
    ].sort();
    for (const claimName of claimNames) {
      const nextVersion = previousVersion + 1;
      if (claimName !== `v${String(nextVersion).padStart(16, '0')}.json`) {
        throw failure('active_run_cas_conflict');
      }
      const claimPath = path.join(claimsRoot, claimName);
      const claim = readJsonFile(claimPath, 'active_run_cas_conflict');
      if (
        stableControlPlaneStringify(Object.keys(claim).sort()) !==
          stableControlPlaneStringify(expectedClaimKeys) ||
        claim.schemaVersion !== 'GoalContractActiveRunPointerClaim/v1' ||
        claim.expectedBeforeHash !== previousHash ||
        claim.expectedBeforeVersion !== previousVersion ||
        claim.nextPointerVersion !== nextVersion ||
        !fs.readFileSync(claimPath).equals(canonicalJsonBytes(claim)) ||
        hashControlPlaneValue(recordWithoutHash(claim, 'claimHash')) !== claim.claimHash
      ) {
        throw failure('active_run_cas_conflict');
      }
      const payload = {
        schemaVersion: 'GoalContractActiveRunPointer/v1',
        pointerVersion: nextVersion,
        candidateRunId: claim.candidateRunId,
        activationRecordRef: claim.activationRecordRef,
        activationRecordHash: claim.activationRecordHash,
      };
      const pointer = {
        ...payload,
        activeRunPointerHash: hashControlPlaneValue(payload),
      };
      validateGoalContractSchema(ACTIVE_RUN_POINTER_SCHEMA, pointer);
      if (pointer.activeRunPointerHash !== claim.nextActiveRunPointerHash) {
        throw failure('active_run_cas_conflict');
      }
      highest = pointer;
      previousHash = pointer.activeRunPointerHash;
      previousVersion = nextVersion;
    }
    return highest;
  } catch (error) {
    if ((error as { failureClass?: string }).failureClass === 'active_run_cas_conflict') {
      throw error;
    }
    throw failure('active_run_cas_conflict');
  }
}

function requireCurrentActiveRunClaim(pointerPath: string, pointer: SchemaRecord): void {
  const highestClaimedPointer = readHighestContinuousActiveRunClaim(pointerPath);
  if (
    !highestClaimedPointer ||
    highestClaimedPointer.pointerVersion !== pointer.pointerVersion ||
    highestClaimedPointer.activeRunPointerHash !== pointer.activeRunPointerHash ||
    highestClaimedPointer.activationRecordHash !== pointer.activationRecordHash
  ) {
    throw failure('active_run_cas_conflict');
  }
}

function restoreClaimedActiveRunPointer(pointerPath: string, pointer: SchemaRecord): SchemaRecord {
  const lock = acquireControlPlaneGenerationLock({
    lockPath: activeRunVersionLockPath(pointerPath, Number(pointer.pointerVersion)),
    lockSchemaVersion: 'GoalContractActiveRunLock/v2',
    legacyLockSchemaVersions: ['GoalContractActiveRunLock/v1'],
    timeoutMs: ACTIVE_RUN_LOCK_TIMEOUT_MS,
    pollMs: ACTIVE_RUN_LOCK_POLL_MS,
    leaseMs: ACTIVE_RUN_LOCK_LEASE_MS,
    conflictIssueCode: 'active_run_cas_conflict',
  });
  let temporaryPath = '';
  try {
    const current = readActiveRunPointer(pointerPath);
    if (current) {
      if (current.activeRunPointerHash !== pointer.activeRunPointerHash) {
        throw failure('active_run_cas_conflict');
      }
      return current;
    }
    const bytes = canonicalJsonBytes(pointer);
    temporaryPath = `${pointerPath}.candidate-${process.pid}-${Date.now()}-${process.hrtime.bigint()}`;
    writeFileDurably(temporaryPath, bytes);
    fs.renameSync(temporaryPath, pointerPath);
    temporaryPath = '';
    if (!fs.readFileSync(pointerPath).equals(bytes)) throw failure('active_run_cas_conflict');
    return pointer;
  } finally {
    if (temporaryPath && fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
    releaseControlPlaneGenerationLock(lock);
  }
}

function publishActiveRunPointerClaim(input: {
  pointerPath: string;
  expectedBeforeHash: string;
  expectedBeforeVersion: number;
  pointer: SchemaRecord;
}): boolean {
  const claimPayload = {
    schemaVersion: 'GoalContractActiveRunPointerClaim/v1',
    expectedBeforeHash: input.expectedBeforeHash,
    expectedBeforeVersion: input.expectedBeforeVersion,
    nextPointerVersion: input.pointer.pointerVersion,
    candidateRunId: input.pointer.candidateRunId,
    activationRecordRef: input.pointer.activationRecordRef,
    activationRecordHash: input.pointer.activationRecordHash,
    nextActiveRunPointerHash: input.pointer.activeRunPointerHash,
  };
  const claim = {
    ...claimPayload,
    claimHash: hashControlPlaneValue(claimPayload),
  };
  const claimBytes = canonicalJsonBytes(claim);
  const claimPath = activeRunPointerClaimPath(input.pointerPath, input.pointer.pointerVersion);
  fs.mkdirSync(path.dirname(claimPath), { recursive: true });
  const temporaryPath = `${claimPath}.candidate-${process.pid}-${Date.now()}-${process.hrtime.bigint()}`;
  let created = false;
  try {
    writeFileDurably(temporaryPath, claimBytes);
    try {
      fs.linkSync(temporaryPath, claimPath);
      created = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
  if (!fs.existsSync(claimPath) || !fs.readFileSync(claimPath).equals(claimBytes)) {
    throw failure('active_run_cas_conflict', {
      expectedBeforeHash: input.expectedBeforeHash,
      expectedBeforeVersion: input.expectedBeforeVersion,
    });
  }
  return created;
}

function commitActiveRunPointerUnderControl(input: {
  pointerPath: string;
  expectedBeforeHash: string;
  expectedBeforeVersion: number;
  candidateRunId: string;
  activationRecordRef: string;
  activationRecordHash: string;
}): { pointer: SchemaRecord; reused: boolean } {
  fs.mkdirSync(path.dirname(input.pointerPath), { recursive: true });
  let alreadyCommitted = readActiveRunPointer(input.pointerPath);
  const { readGoalExecutionAttemptPointer } = require(
    __filename.endsWith('.ts')
      ? '../../../main-agent/source-authority/scripts/main-agent-goal-execution-attempt.ts'
      : '../../../main-agent/source-authority/scripts/main-agent-goal-execution-attempt'
  );
  const outRoot = path.dirname(path.dirname(path.dirname(input.pointerPath)));
  const attemptPointer = readGoalExecutionAttemptPointer({ outRoot });
  if (!alreadyCommitted) {
    const claimedPointer = readHighestContinuousActiveRunClaim(input.pointerPath);
    if (claimedPointer) {
      const nonClosedAttempt = attemptPointer && attemptPointer.phase !== 'closed';
      const claimedByAttempt =
        nonClosedAttempt &&
        attemptPointer.activeRunPointerHash === claimedPointer.activeRunPointerHash &&
        attemptPointer.activationRecordHash === claimedPointer.activationRecordHash;
      if (nonClosedAttempt && !claimedByAttempt) {
        throw failure('active_run_cas_conflict');
      }
      if (
        !activeRunPointerMatches(
          claimedPointer,
          input.activationRecordRef,
          input.activationRecordHash
        )
      ) {
        throw failure('active_run_cas_conflict');
      }
      alreadyCommitted = restoreClaimedActiveRunPointer(input.pointerPath, claimedPointer);
    }
  }
  if (
    activeRunPointerMatches(alreadyCommitted, input.activationRecordRef, input.activationRecordHash)
  ) {
    return { pointer: alreadyCommitted, reused: true };
  }
  if (attemptPointer && attemptPointer.phase !== 'closed') {
    throw failure('active_run_cas_conflict');
  }
  const observedBeforeHash = alreadyCommitted?.activeRunPointerHash ?? ACTIVE_RUN_ZERO_HASH;
  const observedBeforeVersion = Number(alreadyCommitted?.pointerVersion ?? 0);
  if (
    observedBeforeHash !== input.expectedBeforeHash ||
    observedBeforeVersion !== input.expectedBeforeVersion
  ) {
    throw failure('active_run_cas_conflict', {
      expectedBeforeHash: input.expectedBeforeHash,
      observedBeforeHash,
      expectedBeforeVersion: input.expectedBeforeVersion,
      observedBeforeVersion,
    });
  }
  const payload = {
    schemaVersion: 'GoalContractActiveRunPointer/v1',
    pointerVersion: input.expectedBeforeVersion + 1,
    candidateRunId: input.candidateRunId,
    activationRecordRef: input.activationRecordRef,
    activationRecordHash: input.activationRecordHash,
  };
  const pointer = {
    ...payload,
    activeRunPointerHash: hashControlPlaneValue(payload),
  };
  validateGoalContractSchema(ACTIVE_RUN_POINTER_SCHEMA, pointer);
  const claimCreated = publishActiveRunPointerClaim({
    pointerPath: input.pointerPath,
    expectedBeforeHash: input.expectedBeforeHash,
    expectedBeforeVersion: input.expectedBeforeVersion,
    pointer,
  });
  const lockPath = activeRunVersionLockPath(input.pointerPath, pointer.pointerVersion);
  const lock = acquireControlPlaneGenerationLock({
    lockPath,
    lockSchemaVersion: 'GoalContractActiveRunLock/v2',
    legacyLockSchemaVersions: ['GoalContractActiveRunLock/v1'],
    timeoutMs: ACTIVE_RUN_LOCK_TIMEOUT_MS,
    pollMs: ACTIVE_RUN_LOCK_POLL_MS,
    leaseMs: ACTIVE_RUN_LOCK_LEASE_MS,
    conflictIssueCode: 'active_run_cas_conflict',
  });
  let temporaryPath = '';
  try {
    const current = readActiveRunPointer(input.pointerPath);
    if (activeRunPointerMatches(current, input.activationRecordRef, input.activationRecordHash)) {
      return { pointer: current, reused: true };
    }
    const observedBeforeHash = current?.activeRunPointerHash ?? ACTIVE_RUN_ZERO_HASH;
    const observedBeforeVersion = Number(current?.pointerVersion ?? 0);
    if (
      observedBeforeHash !== input.expectedBeforeHash ||
      observedBeforeVersion !== input.expectedBeforeVersion
    ) {
      throw failure('active_run_cas_conflict', {
        expectedBeforeHash: input.expectedBeforeHash,
        observedBeforeHash,
        expectedBeforeVersion: input.expectedBeforeVersion,
        observedBeforeVersion,
      });
    }
    const bytes = canonicalJsonBytes(pointer);
    temporaryPath = `${input.pointerPath}.candidate-${process.pid}-${Date.now()}`;
    writeFileDurably(temporaryPath, bytes);
    fs.renameSync(temporaryPath, input.pointerPath);
    temporaryPath = '';
    if (!fs.readFileSync(input.pointerPath).equals(bytes)) {
      throw failure('active_run_cas_conflict');
    }
    return { pointer, reused: !claimCreated };
  } finally {
    if (temporaryPath && fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath, { force: true });
    }
    releaseControlPlaneGenerationLock(lock);
  }
}

function commitActiveRunPointer(input: {
  pointerPath: string;
  expectedBeforeHash: string;
  expectedBeforeVersion: number;
  candidateRunId: string;
  activationRecordRef: string;
  activationRecordHash: string;
}): { pointer: SchemaRecord; reused: boolean } {
  const outRoot = path.dirname(path.dirname(path.dirname(input.pointerPath)));
  const lockPath = path.join(outRoot, 'goal', 'runtime', 'execution-control.lock');
  const lock = acquireControlPlaneGenerationLock({
    lockPath,
    lockSchemaVersion: 'GoalExecutionControlLock/v2',
    legacyLockSchemaVersions: ['GoalExecutionControlLock/v1'],
    timeoutMs: ACTIVE_RUN_LOCK_TIMEOUT_MS,
    pollMs: ACTIVE_RUN_LOCK_POLL_MS,
    leaseMs: ACTIVE_RUN_LOCK_LEASE_MS,
    conflictIssueCode: 'active_run_cas_conflict',
  });
  try {
    return commitActiveRunPointerUnderControl(input);
  } finally {
    releaseControlPlaneGenerationLock(lock);
  }
}

function activationArtifact(role: string, artifactRef: string, artifactHash: unknown) {
  return {
    role,
    artifactRef: normalizedPath(artifactRef),
    artifactHash: requireHash(artifactHash, `${role}.artifactHash`),
  };
}

function activationIssueCode(error: unknown): string {
  const issue =
    (error as { failureClass?: string; code?: string; message?: string })?.failureClass ||
    (error as { code?: string })?.code ||
    (error instanceof Error ? error.message : '');
  if (
    /^(requirements_successor_required|architecture_successor_required|readiness_recheck_required|standalone_goal_successor_required):[a-z0-9_]+$/u.test(
      issue
    )
  ) {
    return issue;
  }
  if (issue === 'partition_no_valid_solution' || issue === 'partition_search_inconclusive') {
    return issue;
  }
  if (issue === 'active_run_cas_conflict') return issue;
  if (issue === 'goal_run_execution_adapter_authority_invalid') return issue;
  if (issue.includes('package') || issue.includes('candidate_run')) {
    return 'goal_execution_package_invalid';
  }
  if (issue.includes('authority') || issue.includes('source_binding')) {
    return 'goal_execution_authority_invalid';
  }
  if (issue.includes('goal_execution_ir')) return 'goal_execution_ir_invalid';
  if (issue.includes('request') || issue.includes('argument')) {
    return 'activation_request_invalid';
  }
  return 'activation_internal_error';
}

function goalContractActivationFailureResult(error: unknown) {
  const issueCode = activationIssueCode(error);
  const errorDetails = (error ?? {}) as { executionMode?: unknown; profile?: unknown };
  const profile = issueCode.startsWith('standalone_goal_successor_required:')
    ? 'standalone'
    : /^(requirements_successor_required|architecture_successor_required|readiness_recheck_required):/u.test(
          issueCode
        )
      ? 'requirements_backed'
      : ['requirements_backed', 'standalone'].includes(String(errorDetails.profile))
        ? String(errorDetails.profile)
        : null;
  const blockedPartitionOutcome = [
    'partition_no_valid_solution',
    'partition_search_inconclusive',
  ].includes(issueCode)
    ? issueCode
    : null;
  const result = {
    schemaVersion: 'goal-contract-activation-result/v1',
    profile,
    status: 'blocked',
    issueCode,
    executionMode:
      blockedPartitionOutcome && errorDetails.executionMode === 'partitioned_goal'
        ? 'partitioned_goal'
        : null,
    partitionOutcome: blockedPartitionOutcome,
    artifacts: [],
  };
  validateGoalContractSchema(ACTIVATION_RESULT_SCHEMA, result);
  return Object.freeze(result);
}

function compilePartitionFromFrozenGoalAuthority(input: {
  goalExecutionIr: SchemaRecord;
  eligibility: SchemaRecord;
  executionAdapterRef: { path: string; hash: string };
}) {
  const { compilePartitionFromFrozenGoalAuthority: compile } = require(
    __filename.endsWith('.ts') ? './frozen-goal-partition.ts' : './frozen-goal-partition'
  );
  return compile(input);
}

function compileFrozenCandidateRunIdentity(input: unknown): string {
  if (!isRecord(input)) throw failure('activation_request_invalid');
  const executionMode = requireText(input.executionMode, 'executionMode');
  if (!['direct_goal', 'partitioned_goal'].includes(executionMode)) {
    throw failure('activation_request_invalid', { field: 'executionMode' });
  }
  const payload = {
    schemaVersion: 'GoalContractCandidateRunIdentity/v1',
    goalExecutionIRHash: requireHash(input.goalExecutionIRHash, 'goalExecutionIRHash'),
    executionAdapterAuthorityHash: requireHash(
      input.executionAdapterAuthorityHash,
      'executionAdapterAuthorityHash'
    ),
    executionMode,
    ...(executionMode === 'partitioned_goal'
      ? {
          partitionSelectionIdentityHash: requireHash(
            input.partitionSelectionIdentityHash,
            'partitionSelectionIdentityHash'
          ),
        }
      : {}),
  };
  return hashControlPlaneValue(payload);
}

function partitionSelectionIdentityFromManifest(manifest: SchemaRecord): string {
  const partitions = Array.isArray(manifest.partitions) ? manifest.partitions.filter(isRecord) : [];
  return hashControlPlaneValue({
    schemaVersion: 'FrozenGoalPartitionSelectionIdentity/v1',
    goalExecutionIRHash: manifest.goalExecutionIRHash,
    hardCompatibilityPolicyHash: manifest.hardCompatibilityPolicyHash,
    selectorPolicyHash: manifest.selectorPolicyHash,
    groups: partitions.map((partition) => ({
      componentRefs: partition.componentRefs,
      taskRefs: partition.taskRefs,
      ownedPaths: isRecord(partition.logicalScopes)
        ? partition.logicalScopes.ownedPaths
        : partition.ownedPaths,
    })),
  });
}

function candidateRunIdFromIdentity(input: {
  goalExecutionIRHash: string;
  executionAdapterAuthorityHash: string;
  executionMode: string;
  partitionSelectionIdentityHash: string | null;
}): string {
  const identityHash = compileFrozenCandidateRunIdentity({
    goalExecutionIRHash: input.goalExecutionIRHash,
    executionAdapterAuthorityHash: input.executionAdapterAuthorityHash,
    executionMode: input.executionMode,
    ...(input.partitionSelectionIdentityHash
      ? { partitionSelectionIdentityHash: input.partitionSelectionIdentityHash }
      : {}),
  });
  return `RUN-${identityHash.slice('sha256:'.length, 'sha256:'.length + 16).toUpperCase()}`;
}

function assertActivationCandidateBindings(
  candidateRun: SchemaRecord,
  activationRecord: SchemaRecord
): void {
  const scalarFields = [
    'candidateRunId',
    'profile',
    'goalId',
    'goalExecutionIRHash',
    'executionAdapterAuthorityHash',
    'executionMode',
    'partitionOutcome',
  ];
  const referenceFields = [
    'goalExecutionAuthorityRef',
    'eligibilityRef',
    'executionPackageRefs',
    'selectedPartitionManifestRef',
  ];
  if (
    scalarFields.some((field) => candidateRun[field] !== activationRecord[field]) ||
    referenceFields.some(
      (field) =>
        stableControlPlaneStringify(candidateRun[field] ?? null) !==
        stableControlPlaneStringify(activationRecord[field] ?? null)
    )
  ) {
    throw failure('goal_execution_package_invalid', { field: 'activationCandidateBindings' });
  }
}

function verifyCanonicalRecordBytes(targetPath: string, record: SchemaRecord): void {
  if (!fs.readFileSync(targetPath).equals(canonicalJsonBytes(record))) {
    throw failure('goal_execution_package_invalid', { targetPath: normalizedPath(targetPath) });
  }
}

function verifyExecutionPackageArtifacts(input: {
  runRoot: string;
  packagePath: string;
  packageRecord: SchemaRecord;
}): void {
  const packageBase =
    input.packageRecord.executionMode === 'direct_goal'
      ? input.runRoot
      : path.dirname(path.dirname(input.packagePath));
  for (const artifact of Array.isArray(input.packageRecord.artifacts)
    ? input.packageRecord.artifacts.filter(isRecord)
    : []) {
    const artifactPath = confinedPath(packageBase, artifact.path, 'executionPackage.artifact.path');
    if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
      throw failure('goal_execution_package_invalid', { artifactPath });
    }
    const role = String(artifact.role ?? '');
    const expectedHash = requireHash(artifact.hash, `executionPackage.${role}.hash`);
    if (role === 'model_packet' || role === 'audit_receipt') {
      const record = readJsonFile(artifactPath, 'goal_execution_package_invalid');
      verifyCanonicalRecordBytes(artifactPath, record);
      const hashField = role === 'model_packet' ? 'modelPacketHash' : 'auditReceiptHash';
      if (verifyRecordHash(record, hashField, 'goal_execution_package_invalid') !== expectedHash) {
        throw failure('goal_execution_package_invalid', { artifactPath });
      }
    } else if (sha256(fs.readFileSync(artifactPath)) !== expectedHash) {
      throw failure('goal_execution_package_invalid', { artifactPath });
    }
  }
}

function readReusableCandidateRun(input: {
  runtimeRoot: string;
  candidateRunId: string;
  goalExecutionIRHash: string;
  executionAdapterAuthorityHash: string;
  executionMode: string;
  partitionSelectionIdentityHash: string | null;
}): {
  runRoot: string;
  candidateRun: SchemaRecord;
  activationRecord: SchemaRecord;
  eligibility: SchemaRecord;
  packageArtifacts: Array<{ role: string; relativePath: string; hash: string }>;
} | null {
  const runRoot = path.join(input.runtimeRoot, 'runs', input.candidateRunId);
  if (!fs.existsSync(runRoot)) return null;
  const candidateRun = readJsonFile(
    path.join(runRoot, 'candidate-run.json'),
    'goal_execution_package_invalid'
  );
  validateGoalContractSchema(CANDIDATE_RUN_SCHEMA, candidateRun);
  verifyRecordHash(candidateRun, 'candidateRunHash', 'goal_execution_package_invalid');
  verifyCanonicalRecordBytes(path.join(runRoot, 'candidate-run.json'), candidateRun);
  if (
    candidateRun.candidateRunId !== input.candidateRunId ||
    candidateRun.goalExecutionIRHash !== input.goalExecutionIRHash ||
    candidateRun.executionAdapterAuthorityHash !== input.executionAdapterAuthorityHash ||
    candidateRun.executionMode !== input.executionMode
  ) {
    throw failure('goal_execution_package_invalid', { field: 'candidateRunIdentity' });
  }
  const activationRecord = readJsonFile(
    path.join(runRoot, 'activation.json'),
    'goal_execution_package_invalid'
  );
  validateGoalContractSchema(ACTIVATION_RECORD_SCHEMA, activationRecord);
  verifyRecordHash(activationRecord, 'activationRecordHash', 'goal_execution_package_invalid');
  verifyCanonicalRecordBytes(path.join(runRoot, 'activation.json'), activationRecord);
  if (
    activationRecord.candidateRunId !== input.candidateRunId ||
    !isRecord(activationRecord.candidateRunRef) ||
    activationRecord.candidateRunRef.hash !== candidateRun.candidateRunHash ||
    activationRecord.goalExecutionIRHash !== input.goalExecutionIRHash ||
    activationRecord.executionAdapterAuthorityHash !== input.executionAdapterAuthorityHash ||
    activationRecord.executionMode !== input.executionMode
  ) {
    throw failure('goal_execution_package_invalid', { field: 'activationRecordIdentity' });
  }
  assertActivationCandidateBindings(candidateRun, activationRecord);
  if (!isRecord(candidateRun.eligibilityRef)) {
    throw failure('goal_execution_package_invalid', { field: 'eligibilityRef' });
  }
  const eligibilityRef = readHashReferencedRecord({
    outRoot: runRoot,
    ref: candidateRun.eligibilityRef,
    field: 'eligibilityRef',
    schemaName: EXECUTION_ELIGIBILITY_SCHEMA,
    hashField: 'eligibilityHash',
  });
  verifyCanonicalRecordBytes(eligibilityRef.path, eligibilityRef.record);
  const packageArtifacts: Array<{ role: string; relativePath: string; hash: string }> = [];
  if (input.executionMode === 'partitioned_goal') {
    if (!isRecord(candidateRun.selectedPartitionManifestRef)) {
      throw failure('goal_execution_package_invalid', { field: 'selectedPartitionManifestRef' });
    }
    const manifestRef = readHashReferencedRecord({
      outRoot: runRoot,
      ref: candidateRun.selectedPartitionManifestRef,
      field: 'selectedPartitionManifestRef',
      schemaName: PARTITION_MANIFEST_SCHEMA,
      hashField: 'partitionManifestHash',
    });
    verifyCanonicalRecordBytes(manifestRef.path, manifestRef.record);
    if (
      !input.partitionSelectionIdentityHash ||
      partitionSelectionIdentityFromManifest(manifestRef.record) !==
        input.partitionSelectionIdentityHash
    ) {
      throw failure('goal_execution_package_invalid', { field: 'partitionSelectionIdentity' });
    }
    packageArtifacts.push({
      role: 'partition_manifest',
      relativePath: String(candidateRun.selectedPartitionManifestRef.path),
      hash: String(candidateRun.selectedPartitionManifestRef.hash),
    });
  }
  const executionPackageRefs = Array.isArray(candidateRun.executionPackageRefs)
    ? candidateRun.executionPackageRefs.filter(isRecord)
    : [];
  for (const packageRef of executionPackageRefs) {
    const packageSchema =
      input.executionMode === 'direct_goal'
        ? DIRECT_EXECUTION_PACKAGE_SCHEMA
        : CHILD_EXECUTION_PACKAGE_SCHEMA;
    const packageHashField =
      input.executionMode === 'direct_goal'
        ? 'directExecutionPackageHash'
        : 'childExecutionPackageHash';
    const resolved = readHashReferencedRecord({
      outRoot: runRoot,
      ref: packageRef,
      field: 'executionPackageRef',
      schemaName: packageSchema,
      hashField: packageHashField,
    });
    verifyCanonicalRecordBytes(resolved.path, resolved.record);
    verifyExecutionPackageArtifacts({
      runRoot,
      packagePath: resolved.path,
      packageRecord: resolved.record,
    });
    if (
      !isRecord(resolved.record.executionAdapterRef) ||
      resolved.record.executionAdapterRef.hash !== input.executionAdapterAuthorityHash
    ) {
      throw failure('goal_execution_package_invalid', { field: 'executionAdapterRef' });
    }
    resolvePackagedGoalRunExecutionAdapterAuthority({
      runRoot,
      executionAdapterRef: resolved.record.executionAdapterRef,
    });
    packageArtifacts.push({
      role:
        input.executionMode === 'direct_goal'
          ? 'direct_execution_package'
          : 'child_execution_package',
      relativePath: String(packageRef.path),
      hash: String(packageRef.hash),
    });
  }
  return {
    runRoot,
    candidateRun,
    activationRecord,
    eligibility: eligibilityRef.record,
    packageArtifacts,
  };
}

function readCompatibleActiveRun(input: {
  outRoot: string;
  runtimeRoot: string;
  profile: string;
  goalId: string;
  goalExecutionIRHash: string;
  executionAdapterAuthorityHash: string;
  executionMode: string;
}): (ReturnType<typeof readReusableCandidateRun> & { pointer: SchemaRecord }) | null {
  const pointerPath = path.join(input.runtimeRoot, 'active-run.json');
  const pointer = readActiveRunPointer(pointerPath);
  if (!pointer) return null;
  const candidateRunId = String(pointer.candidateRunId);
  const runRoot = path.join(input.runtimeRoot, 'runs', candidateRunId);
  const expectedActivationPath = path.join(runRoot, 'activation.json');
  const activationPath = confinedPath(
    input.outRoot,
    pointer.activationRecordRef,
    'activationRecordRef'
  );
  if (path.resolve(activationPath) !== path.resolve(expectedActivationPath)) {
    throw failure('goal_execution_package_invalid', { field: 'activationRecordRef' });
  }
  const activationRecord = readJsonFile(activationPath, 'goal_execution_package_invalid');
  validateGoalContractSchema(ACTIVATION_RECORD_SCHEMA, activationRecord);
  const activationRecordHash = verifyRecordHash(
    activationRecord,
    'activationRecordHash',
    'goal_execution_package_invalid'
  );
  verifyCanonicalRecordBytes(activationPath, activationRecord);
  if (
    activationRecordHash !== pointer.activationRecordHash ||
    activationRecord.candidateRunId !== candidateRunId
  ) {
    throw failure('goal_execution_package_invalid', { field: 'activeRunActivationRecord' });
  }
  const candidateRunPath = path.join(runRoot, 'candidate-run.json');
  if (!fs.existsSync(candidateRunPath)) {
    throw failure('goal_execution_package_invalid', { targetPath: candidateRunPath });
  }
  const candidateRun = readJsonFile(candidateRunPath, 'goal_execution_package_invalid');
  validateGoalContractSchema(CANDIDATE_RUN_SCHEMA, candidateRun);
  verifyRecordHash(candidateRun, 'candidateRunHash', 'goal_execution_package_invalid');
  verifyCanonicalRecordBytes(candidateRunPath, candidateRun);
  if (
    candidateRun.candidateRunId !== candidateRunId ||
    candidateRun.profile !== input.profile ||
    candidateRun.goalId !== input.goalId ||
    candidateRun.goalExecutionIRHash !== input.goalExecutionIRHash ||
    candidateRun.executionAdapterAuthorityHash !== input.executionAdapterAuthorityHash ||
    candidateRun.executionMode !== input.executionMode
  ) {
    return null;
  }
  assertActivationCandidateBindings(candidateRun, activationRecord);
  let partitionSelectionIdentityHash: string | null = null;
  if (input.executionMode === 'partitioned_goal') {
    if (!isRecord(candidateRun.selectedPartitionManifestRef)) {
      throw failure('goal_execution_package_invalid', { field: 'selectedPartitionManifestRef' });
    }
    const manifestRef = readHashReferencedRecord({
      outRoot: runRoot,
      ref: candidateRun.selectedPartitionManifestRef,
      field: 'selectedPartitionManifestRef',
      schemaName: PARTITION_MANIFEST_SCHEMA,
      hashField: 'partitionManifestHash',
    });
    verifyCanonicalRecordBytes(manifestRef.path, manifestRef.record);
    if (
      manifestRef.record.profile !== input.profile ||
      manifestRef.record.goalId !== input.goalId ||
      manifestRef.record.goalExecutionIRHash !== input.goalExecutionIRHash
    ) {
      throw failure('goal_execution_package_invalid', { field: 'partitionManifestIdentity' });
    }
    const { partitionPolicyIdentity } = require(
      __filename.endsWith('.ts') ? './frozen-goal-partition.ts' : './frozen-goal-partition'
    );
    const currentPolicy = partitionPolicyIdentity();
    if (
      manifestRef.record.hardCompatibilityPolicyHash !==
        currentPolicy.hardCompatibilityPolicyHash ||
      manifestRef.record.selectorPolicyHash !== currentPolicy.selectorPolicyHash
    ) {
      return null;
    }
    partitionSelectionIdentityHash = partitionSelectionIdentityFromManifest(manifestRef.record);
  }
  if (
    candidateRunIdFromIdentity({
      goalExecutionIRHash: input.goalExecutionIRHash,
      executionAdapterAuthorityHash: input.executionAdapterAuthorityHash,
      executionMode: input.executionMode,
      partitionSelectionIdentityHash,
    }) !== candidateRunId
  ) {
    throw failure('goal_execution_package_invalid', { field: 'candidateRunId' });
  }
  const reusable = readReusableCandidateRun({
    runtimeRoot: input.runtimeRoot,
    candidateRunId,
    goalExecutionIRHash: input.goalExecutionIRHash,
    executionAdapterAuthorityHash: input.executionAdapterAuthorityHash,
    executionMode: input.executionMode,
    partitionSelectionIdentityHash,
  });
  if (!reusable) {
    throw failure('goal_execution_package_invalid', { field: 'activeRunCandidate' });
  }
  const activationRecordRef = path
    .relative(input.outRoot, path.join(reusable.runRoot, 'activation.json'))
    .replace(/\\/gu, '/');
  if (
    !activeRunPointerMatches(
      pointer,
      activationRecordRef,
      String(reusable.activationRecord.activationRecordHash)
    )
  ) {
    throw failure('active_run_cas_conflict', { field: 'activationRecordRef' });
  }
  return { ...reusable, pointer };
}

function sameControlPlaneValue(left: unknown, right: unknown): boolean {
  return stableControlPlaneStringify(left ?? null) === stableControlPlaneStringify(right ?? null);
}

function requireCommittedActiveRunPointerPath(input: {
  projectRoot: string;
  activeRunPointerPath: string;
}): {
  projectRoot: string;
  outRoot: string;
  runtimeRoot: string;
  activeRunPointerPath: string;
} {
  const projectRoot = path.resolve(requireText(input.projectRoot, 'projectRoot'));
  const activeRunPointerPath = path.resolve(
    projectRoot,
    requireText(input.activeRunPointerPath, 'activeRunPointerPath')
  );
  if (
    !isConfined(projectRoot, activeRunPointerPath) ||
    path.basename(activeRunPointerPath) !== 'active-run.json' ||
    path.basename(path.dirname(activeRunPointerPath)) !== 'runtime' ||
    path.basename(path.dirname(path.dirname(activeRunPointerPath))) !== 'goal'
  ) {
    throw failure('goal_execution_package_invalid', { field: 'activeRunPointerPath' });
  }
  const runtimeRoot = path.dirname(activeRunPointerPath);
  return {
    projectRoot,
    outRoot: path.dirname(path.dirname(runtimeRoot)),
    runtimeRoot,
    activeRunPointerPath,
  };
}

function assertExecutionIdentity(
  record: SchemaRecord,
  identity: { profile: string; goalId: string; goalExecutionIRHash: string; executionMode: string },
  field: string
): void {
  if (
    record.profile !== identity.profile ||
    record.goalId !== identity.goalId ||
    record.goalExecutionIRHash !== identity.goalExecutionIRHash ||
    record.executionMode !== identity.executionMode
  ) {
    throw failure('goal_execution_package_invalid', { field });
  }
}

function resolveDirectExecutionAuthority(input: {
  outRoot: string;
  runRoot: string;
  candidateRun: SchemaRecord;
  eligibility: SchemaRecord;
  goalExecutionIr: SchemaRecord;
}) {
  const packageRefs = Array.isArray(input.candidateRun.executionPackageRefs)
    ? input.candidateRun.executionPackageRefs.filter(isRecord)
    : [];
  if (packageRefs.length !== 1) {
    throw failure('goal_execution_package_invalid', { field: 'executionPackageRefs' });
  }
  const packageRef = readHashReferencedRecord({
    outRoot: input.runRoot,
    ref: packageRefs[0],
    field: 'executionPackageRefs[0]',
    schemaName: DIRECT_EXECUTION_PACKAGE_SCHEMA,
    hashField: 'directExecutionPackageHash',
  });
  verifyCanonicalRecordBytes(packageRef.path, packageRef.record);
  verifyExecutionPackageArtifacts({
    runRoot: input.runRoot,
    packagePath: packageRef.path,
    packageRecord: packageRef.record,
  });
  assertExecutionIdentity(
    packageRef.record,
    {
      profile: String(input.candidateRun.profile),
      goalId: String(input.candidateRun.goalId),
      goalExecutionIRHash: String(input.candidateRun.goalExecutionIRHash),
      executionMode: 'direct_goal',
    },
    'directExecutionPackageIdentity'
  );
  if (
    !sameControlPlaneValue(
      packageRef.record.goalExecutionAuthorityRef,
      input.candidateRun.goalExecutionAuthorityRef
    ) ||
    !sameControlPlaneValue(packageRef.record.eligibilityRef, input.candidateRun.eligibilityRef) ||
    input.eligibility.executionMode !== 'direct_goal'
  ) {
    throw failure('goal_execution_package_invalid', { field: 'directExecutionPackageBindings' });
  }
  const logicalScopes = isRecord(input.goalExecutionIr.logicalScopes)
    ? input.goalExecutionIr.logicalScopes
    : {};
  return [
    Object.freeze({
      profile: String(input.candidateRun.profile),
      candidateRunId: String(input.candidateRun.candidateRunId),
      executionAuthorityId: String(input.goalExecutionIr.goalId),
      executionAuthorityHash: String(input.goalExecutionIr.goalExecutionIRHash),
      executionPackagePath: packageRef.path,
      executionPackageHash: packageRef.hash,
      ownedPaths: sortedUniqueText(
        Array.isArray(logicalScopes.ownedPaths) ? logicalScopes.ownedPaths : []
      ),
      forbiddenPaths: sortedUniqueText(
        Array.isArray(logicalScopes.forbiddenPaths) ? logicalScopes.forbiddenPaths : []
      ),
      commands: Array.isArray(input.goalExecutionIr.commands)
        ? input.goalExecutionIr.commands.filter(isRecord)
        : [],
      dependencies: Array.isArray(input.goalExecutionIr.dependencies)
        ? input.goalExecutionIr.dependencies.filter(isRecord)
        : [],
      dependencyExecutionAuthorityIds: [],
    }),
  ];
}

function resolvePartitionedExecutionAuthorities(input: {
  runRoot: string;
  candidateRun: SchemaRecord;
  eligibility: SchemaRecord;
}) {
  const manifestRef = readHashReferencedRecord({
    outRoot: input.runRoot,
    ref: input.candidateRun.selectedPartitionManifestRef,
    field: 'selectedPartitionManifestRef',
    schemaName: PARTITION_MANIFEST_SCHEMA,
    hashField: 'partitionManifestHash',
  });
  verifyCanonicalRecordBytes(manifestRef.path, manifestRef.record);
  assertExecutionIdentity(
    { ...manifestRef.record, executionMode: 'partitioned_goal' },
    {
      profile: String(input.candidateRun.profile),
      goalId: String(input.candidateRun.goalId),
      goalExecutionIRHash: String(input.candidateRun.goalExecutionIRHash),
      executionMode: 'partitioned_goal',
    },
    'partitionManifestIdentity'
  );
  if (
    manifestRef.record.partitionOutcome !== input.candidateRun.partitionOutcome ||
    input.eligibility.partitionOutcome !== input.candidateRun.partitionOutcome
  ) {
    throw failure('goal_execution_package_invalid', { field: 'partitionOutcome' });
  }
  const rows = Array.isArray(manifestRef.record.partitions)
    ? manifestRef.record.partitions.filter(isRecord)
    : [];
  const rowByPartitionId = new Map(rows.map((row) => [String(row.partitionId), row] as const));
  const topologicalOrder = Array.isArray(manifestRef.record.topologicalOrder)
    ? manifestRef.record.topologicalOrder.map(String)
    : [];
  if (
    rows.length !== Number(manifestRef.record.partitionCount) ||
    topologicalOrder.length !== rows.length ||
    topologicalOrder.some((partitionId) => !rowByPartitionId.has(partitionId))
  ) {
    throw failure('goal_execution_package_invalid', { field: 'partitionTopologicalOrder' });
  }
  const topologicalIndex = new Map(
    topologicalOrder.map((partitionId, index) => [partitionId, index] as const)
  );
  for (const row of rows) {
    const consumerId = String(row.partitionId);
    const consumerIndex = topologicalIndex.get(consumerId)!;
    for (const dependencyId of Array.isArray(row.dependencyPartitionRefs)
      ? row.dependencyPartitionRefs.map(String)
      : []) {
      const dependencyIndex = topologicalIndex.get(dependencyId);
      if (dependencyIndex === undefined || dependencyIndex >= consumerIndex) {
        throw failure('goal_execution_package_invalid', {
          field: `${consumerId}.dependencyTopologicalOrder`,
        });
      }
    }
  }
  const candidatePackageRefs = Array.isArray(input.candidateRun.executionPackageRefs)
    ? input.candidateRun.executionPackageRefs.filter(isRecord)
    : [];
  if (candidatePackageRefs.length !== rows.length) {
    throw failure('goal_execution_package_invalid', { field: 'executionPackageRefs' });
  }
  const manifestBase = path.dirname(manifestRef.path);
  const authorities = new Map<string, SchemaRecord>();
  for (const row of rows) {
    const partitionId = String(row.partitionId);
    const childContractPath = confinedPath(
      manifestBase,
      isRecord(row.childContractRef) ? row.childContractRef.path : null,
      `${partitionId}.childContractRef.path`
    );
    const childContract = readJsonFile(childContractPath, 'goal_execution_package_invalid');
    validateGoalContractSchema(CHILD_EXECUTION_CONTRACT_SCHEMA, childContract);
    const childContractHash = verifyRecordHash(
      childContract,
      'childContractHash',
      'goal_execution_package_invalid'
    );
    verifyCanonicalRecordBytes(childContractPath, childContract);
    if (!isRecord(row.childContractRef) || childContractHash !== row.childContractRef.hash) {
      throw failure('goal_execution_package_invalid', { field: `${partitionId}.childContractRef` });
    }
    const membership = {
      partitionId,
      componentRefs: row.componentRefs,
      taskRefs: row.taskRefs,
      traceSliceRefs: row.traceSliceRefs,
      obligationRefs: row.obligationRefs,
      dependencyPartitionRefs: row.dependencyPartitionRefs,
      expectedEffortMinutes: row.expectedEffortMinutes,
      upperBoundEffortMinutes: row.upperBoundEffortMinutes,
      ownedPaths: row.ownedPaths,
      forbiddenPaths: row.forbiddenPaths,
    };
    const expectedChildContractId = `CHILD-${hashControlPlaneValue(membership)
      .slice('sha256:'.length, 'sha256:'.length + 16)
      .toUpperCase()}`;
    const childMembership = {
      partitionId: childContract.partitionId,
      componentRefs: childContract.componentRefs,
      taskRefs: childContract.taskRefs,
      traceSliceRefs: childContract.traceSliceRefs,
      obligationRefs: childContract.obligationRefs,
      dependencyPartitionRefs: childContract.dependencyPartitionRefs,
      expectedEffortMinutes: childContract.expectedEffortMinutes,
      upperBoundEffortMinutes: childContract.upperBoundEffortMinutes,
      ownedPaths: isRecord(childContract.logicalScopes)
        ? childContract.logicalScopes.ownedPaths
        : null,
      forbiddenPaths: isRecord(childContract.logicalScopes)
        ? childContract.logicalScopes.forbiddenPaths
        : null,
    };
    if (
      childContract.partitionMembershipHash !== hashControlPlaneValue(membership) ||
      childContract.childContractId !== expectedChildContractId ||
      !sameControlPlaneValue(membership, childMembership) ||
      childContract.profile !== input.candidateRun.profile ||
      childContract.goalId !== input.candidateRun.goalId ||
      childContract.goalExecutionIRHash !== input.candidateRun.goalExecutionIRHash
    ) {
      throw failure('goal_execution_package_invalid', { field: `${partitionId}.childContract` });
    }
    const childPackagePath = confinedPath(
      manifestBase,
      isRecord(row.childExecutionPackageRef) ? row.childExecutionPackageRef.path : null,
      `${partitionId}.childExecutionPackageRef.path`
    );
    const candidateRelativePackagePath = path
      .relative(input.runRoot, childPackagePath)
      .replace(/\\/gu, '/');
    const candidatePackageRef = candidatePackageRefs.find(
      (ref) => ref.path === candidateRelativePackagePath
    );
    if (
      !candidatePackageRef ||
      !isRecord(row.childExecutionPackageRef) ||
      candidatePackageRef.hash !== row.childExecutionPackageRef.hash
    ) {
      throw failure('goal_execution_package_invalid', {
        field: `${partitionId}.childExecutionPackageRef`,
      });
    }
    const childPackage = readJsonFile(childPackagePath, 'goal_execution_package_invalid');
    validateGoalContractSchema(CHILD_EXECUTION_PACKAGE_SCHEMA, childPackage);
    const childPackageHash = verifyRecordHash(
      childPackage,
      'childExecutionPackageHash',
      'goal_execution_package_invalid'
    );
    verifyCanonicalRecordBytes(childPackagePath, childPackage);
    verifyExecutionPackageArtifacts({
      runRoot: input.runRoot,
      packagePath: childPackagePath,
      packageRecord: childPackage,
    });
    const expectedPackageChildContractPath = confinedPath(
      path.dirname(path.dirname(childPackagePath)),
      isRecord(childPackage.childContractRef) ? childPackage.childContractRef.path : null,
      `${partitionId}.childPackage.childContractRef.path`
    );
    if (
      childPackageHash !== candidatePackageRef.hash ||
      childPackage.partitionId !== partitionId ||
      childPackage.profile !== input.candidateRun.profile ||
      childPackage.goalId !== input.candidateRun.goalId ||
      childPackage.goalExecutionIRHash !== input.candidateRun.goalExecutionIRHash ||
      !isRecord(childPackage.childContractRef) ||
      childPackage.childContractRef.hash !== childContractHash ||
      expectedPackageChildContractPath !== path.resolve(childContractPath)
    ) {
      throw failure('goal_execution_package_invalid', { field: `${partitionId}.childPackage` });
    }
    authorities.set(
      partitionId,
      Object.freeze({
        profile: String(input.candidateRun.profile),
        candidateRunId: String(input.candidateRun.candidateRunId),
        executionAuthorityId: String(childContract.childContractId),
        executionAuthorityHash: childContractHash,
        executionPackagePath: childPackagePath,
        executionPackageHash: childPackageHash,
        partitionId,
        ownedPaths: sortedUniqueText(
          isRecord(childContract.logicalScopes) &&
            Array.isArray(childContract.logicalScopes.ownedPaths)
            ? childContract.logicalScopes.ownedPaths
            : []
        ),
        forbiddenPaths: sortedUniqueText(
          isRecord(childContract.logicalScopes) &&
            Array.isArray(childContract.logicalScopes.forbiddenPaths)
            ? childContract.logicalScopes.forbiddenPaths
            : []
        ),
        commands: Array.isArray(childContract.commands)
          ? childContract.commands.filter(isRecord)
          : [],
        dependencies: Array.isArray(childContract.dependencies)
          ? childContract.dependencies.filter(isRecord)
          : [],
        dependencyPartitionRefs: Array.isArray(childContract.dependencyPartitionRefs)
          ? childContract.dependencyPartitionRefs.map(String)
          : [],
      })
    );
  }
  const ordered = topologicalOrder.map((partitionId) => authorities.get(partitionId)!);
  const authorityIdByPartitionId = new Map(
    ordered.map((authority) => [
      String(authority.partitionId),
      String(authority.executionAuthorityId),
    ])
  );
  return ordered.map((authority) =>
    Object.freeze({
      ...authority,
      dependencyExecutionAuthorityIds: (Array.isArray(authority.dependencyPartitionRefs)
        ? authority.dependencyPartitionRefs.map(String)
        : []
      ).map((partitionId) => {
        const authorityId = authorityIdByPartitionId.get(partitionId);
        if (!authorityId) {
          throw failure('goal_execution_package_invalid', {
            field: `${String(authority.partitionId)}.dependencyPartitionRefs`,
          });
        }
        return authorityId;
      }),
    })
  );
}

export function executionResumeAuthorizedOwnedPaths(
  attemptPointer: {
    executionStarted?: unknown;
    phase?: unknown;
    nextExecutionAuthorityId?: unknown;
    validClosureRefs?: unknown;
  } | null,
  executionAuthorities: Array<{ executionAuthorityId: string; ownedPaths: string[] }>
): string[] {
  if (!attemptPointer?.executionStarted) return [];
  const authorizedAuthorityIds = new Set(
    Array.isArray(attemptPointer.validClosureRefs)
      ? attemptPointer.validClosureRefs
          .filter(isRecord)
          .map((closureRef) => String(closureRef.executionAuthorityId))
      : []
  );
  if (typeof attemptPointer.nextExecutionAuthorityId === 'string') {
    authorizedAuthorityIds.add(attemptPointer.nextExecutionAuthorityId);
  }
  return sortedUniqueText(
    executionAuthorities
      .filter((authority) => authorizedAuthorityIds.has(authority.executionAuthorityId))
      .flatMap((authority) => authority.ownedPaths)
  );
}

function executionAttemptAuthoritySnapshot(executionAuthorities: SchemaRecord[]): SchemaRecord[] {
  return executionAuthorities.map((authority) => ({
    profile: String(authority.profile),
    candidateRunId: String(authority.candidateRunId),
    executionAuthorityId: String(authority.executionAuthorityId),
    executionAuthorityHash: String(authority.executionAuthorityHash),
    executionPackageHash: String(authority.executionPackageHash),
    dependencyExecutionAuthorityIds: Array.isArray(authority.dependencyExecutionAuthorityIds)
      ? authority.dependencyExecutionAuthorityIds.map(String)
      : [],
    ownedPaths: sortedUniqueText(authority.ownedPaths),
  }));
}

export function resolveCommittedActiveRun(input: {
  projectRoot: string;
  activeRunPointerPath: string;
}) {
  const location = requireCommittedActiveRunPointerPath(input);
  const activeRunPointer = readActiveRunPointer(location.activeRunPointerPath);
  if (!activeRunPointer) {
    throw failure('goal_execution_package_invalid', { field: 'activeRunPointer' });
  }
  requireCurrentActiveRunClaim(location.activeRunPointerPath, activeRunPointer);
  verifyCanonicalRecordBytes(location.activeRunPointerPath, activeRunPointer);
  const candidateRunId = requireText(activeRunPointer.candidateRunId, 'candidateRunId');
  const runRoot = path.join(location.runtimeRoot, 'runs', candidateRunId);
  const candidateRunPath = path.join(runRoot, 'candidate-run.json');
  const candidateRun = readJsonFile(candidateRunPath, 'goal_execution_package_invalid');
  validateGoalContractSchema(CANDIDATE_RUN_SCHEMA, candidateRun);
  verifyRecordHash(candidateRun, 'candidateRunHash', 'goal_execution_package_invalid');
  verifyCanonicalRecordBytes(candidateRunPath, candidateRun);
  const compatible = readCompatibleActiveRun({
    outRoot: location.outRoot,
    runtimeRoot: location.runtimeRoot,
    profile: String(candidateRun.profile),
    goalId: String(candidateRun.goalId),
    goalExecutionIRHash: String(candidateRun.goalExecutionIRHash),
    executionAdapterAuthorityHash: String(candidateRun.executionAdapterAuthorityHash),
    executionMode: String(candidateRun.executionMode),
  });
  if (!compatible) {
    throw failure('goal_execution_package_invalid', { field: 'activeRunCompatibility' });
  }
  const goalExecutionIrRef = readHashReferencedRecord({
    outRoot: location.outRoot,
    ref: candidateRun.goalExecutionAuthorityRef,
    field: 'goalExecutionAuthorityRef',
    schemaName: GOAL_EXECUTION_IR_SCHEMA,
    hashField: 'goalExecutionIRHash',
  });
  verifyCanonicalRecordBytes(goalExecutionIrRef.path, goalExecutionIrRef.record);
  const { validateGoalExecutionIR } = require(
    __filename.endsWith('.ts') ? './goal-execution-ir.ts' : './goal-execution-ir'
  );
  const goalExecutionIrValidation = validateGoalExecutionIR(goalExecutionIrRef.record);
  if (
    goalExecutionIrValidation.decision !== 'pass' ||
    goalExecutionIrRef.record.profile !== candidateRun.profile ||
    goalExecutionIrRef.record.goalId !== candidateRun.goalId ||
    goalExecutionIrRef.record.goalExecutionIRHash !== candidateRun.goalExecutionIRHash ||
    compatible.eligibility.profile !== candidateRun.profile ||
    compatible.eligibility.goalId !== candidateRun.goalId ||
    compatible.eligibility.goalExecutionIRHash !== candidateRun.goalExecutionIRHash ||
    compatible.eligibility.executionMode !== candidateRun.executionMode ||
    compatible.eligibility.decision !== 'pass'
  ) {
    throw failure('goal_execution_package_invalid', { field: 'committedAuthorityBindings' });
  }
  const executionAuthorities =
    candidateRun.executionMode === 'direct_goal'
      ? resolveDirectExecutionAuthority({
          outRoot: location.outRoot,
          runRoot,
          candidateRun,
          eligibility: compatible.eligibility,
          goalExecutionIr: goalExecutionIrRef.record,
        })
      : resolvePartitionedExecutionAuthorities({
          runRoot,
          candidateRun,
          eligibility: compatible.eligibility,
        });
  const orderedExecutionAuthorityIds = executionAuthorities.map((authority) =>
    String(authority.executionAuthorityId)
  );
  const executionAdapter = resolvePackagedGoalRunExecutionAdapterAuthority({
    runRoot,
    executionAdapterRef: {
      path: PACKAGED_GOAL_RUN_EXECUTION_ADAPTER_PATH,
      hash: candidateRun.executionAdapterAuthorityHash,
    },
  });
  let requirementsReadiness = null;
  if (candidateRun.profile === 'requirements_backed') {
    const requirementsLineage = goalExecutionIrRef.record.requirementsLineage;
    if (!isRecord(requirementsLineage)) {
      throw failure('requirements_successor_required:semantic_authority');
    }
    const requestId = requireText(requirementsLineage.recordId, 'requirementsLineage.recordId');
    const requirementRecordPath = path.join(
      location.projectRoot,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requestId,
      'requirement-record.json'
    );
    const { readGoalExecutionAttemptPointer } = require(
      __filename.endsWith('.ts')
        ? '../../../main-agent/source-authority/scripts/main-agent-goal-execution-attempt.ts'
        : '../../../main-agent/source-authority/scripts/main-agent-goal-execution-attempt'
    );
    const attemptPointer = readGoalExecutionAttemptPointer({ outRoot: location.outRoot });
    const isResume =
      attemptPointer?.activeRunPointerHash === activeRunPointer.activeRunPointerHash &&
      attemptPointer?.activationRecordHash === compatible.activationRecord.activationRecordHash &&
      attemptPointer?.executionStarted === true &&
      sameControlPlaneValue(
        attemptPointer.executionAuthorities,
        executionAttemptAuthoritySnapshot(executionAuthorities)
      ) &&
      ['executing', 'closure_pending', 'blocked', 'closed'].includes(String(attemptPointer?.phase));
    const { validateRequirementsBackedGoalAdmissionCurrent } = require(
      __filename.endsWith('.ts') ? './goal-requirements-adapter.ts' : './goal-requirements-adapter'
    );
    requirementsReadiness = validateRequirementsBackedGoalAdmissionCurrent({
      projectRoot: location.projectRoot,
      requestId,
      requirementRecordPath,
      expectedRequirementsLineage: requirementsLineage,
      phase: isResume ? 'execution_resume' : 'execution_start',
      authorizedOwnedPaths: isResume
        ? executionResumeAuthorizedOwnedPaths(attemptPointer, executionAuthorities)
        : [],
    });
  }
  return Object.freeze({
    ...location,
    goalAuthorityPath: path.join(location.outRoot, 'goal', 'active-authority.json'),
    goalExecutionIrPath: goalExecutionIrRef.path,
    profile: String(candidateRun.profile),
    goalId: String(candidateRun.goalId),
    goalExecutionIRHash: String(candidateRun.goalExecutionIRHash),
    executionMode: String(candidateRun.executionMode),
    activeRunPointer,
    runRoot,
    candidateRun: compatible.candidateRun,
    activationRecord: compatible.activationRecord,
    eligibility: compatible.eligibility,
    executionAdapter,
    executionAuthorities,
    orderedExecutionAuthorityIds,
    requirementsReadiness,
  });
}

function activationResultFromRun(input: {
  prepared: ReturnType<typeof validateGoalExecutionAdmission>;
  pointerPath: string;
  committed: { pointer: SchemaRecord; reused: boolean };
  runRoot: string;
  candidateRun: SchemaRecord;
  activationRecord: SchemaRecord;
  eligibility: SchemaRecord;
  packageArtifacts: Array<{ role: string; relativePath: string; hash: string }>;
}) {
  const runFile = (relativePath: string) => path.join(input.runRoot, ...relativePath.split('/'));
  const result = {
    schemaVersion: 'goal-contract-activation-result/v1',
    profile: input.candidateRun.profile,
    status: input.committed.reused ? 'activation_reused' : 'activated',
    issueCode: null,
    executionMode: input.candidateRun.executionMode,
    partitionOutcome: input.candidateRun.partitionOutcome,
    artifacts: [
      activationArtifact(
        'goal_execution_authority',
        input.prepared.goalAuthorityPath,
        input.prepared.activeAuthority.activeAuthorityHash
      ),
      activationArtifact(
        'execution_eligibility',
        runFile('eligibility.json'),
        input.eligibility.eligibilityHash
      ),
      activationArtifact(
        'candidate_run',
        runFile('candidate-run.json'),
        input.candidateRun.candidateRunHash
      ),
      activationArtifact(
        'activation_record',
        runFile('activation.json'),
        input.activationRecord.activationRecordHash
      ),
      ...input.packageArtifacts.map((artifact) =>
        activationArtifact(artifact.role, runFile(artifact.relativePath), artifact.hash)
      ),
      activationArtifact(
        'active_run_pointer',
        input.pointerPath,
        input.committed.pointer.activeRunPointerHash
      ),
    ],
  };
  validateGoalContractSchema(ACTIVATION_RESULT_SCHEMA, result);
  return Object.freeze(result);
}

function activateFrozenGoalAuthority(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('activation_request_invalid');
  }
  const projectRoot = path.resolve(requireText(request.projectRoot, 'projectRoot'));
  const goalAuthorityPath = path.resolve(
    projectRoot,
    requireText(request.goalAuthorityPath, 'goalAuthorityPath')
  );
  const prepared = validateGoalExecutionAdmission({
    phase: 'activation_prepare',
    projectRoot,
    goalAuthorityPath,
  });
  const executionAdapter = freezeGoalRunExecutionAdapterAuthority({
    outRoot: prepared.outRoot,
  });
  let eligibility = compileFrozenGoalExecutionEligibility(prepared.goalExecutionIr);
  const executionMode = String(eligibility.executionMode);
  const runtimeRoot = path.join(prepared.outRoot, 'goal', 'runtime');
  const pointerPath = path.join(runtimeRoot, 'active-run.json');
  const compatibleActiveRun = readCompatibleActiveRun({
    outRoot: prepared.outRoot,
    runtimeRoot,
    profile: String(prepared.goalExecutionIr.profile),
    goalId: String(prepared.goalExecutionIr.goalId),
    goalExecutionIRHash: String(prepared.goalExecutionIr.goalExecutionIRHash),
    executionAdapterAuthorityHash: executionAdapter.authority.adapterAuthorityHash,
    executionMode,
  });
  if (compatibleActiveRun) {
    validateGoalExecutionAdmission({
      phase: 'activation_commit',
      projectRoot,
      goalAuthorityPath,
      expectedGoalExecutionIRHash: prepared.goalExecutionIr.goalExecutionIRHash,
    });
    const activationRecordRef = path
      .relative(prepared.outRoot, path.join(compatibleActiveRun.runRoot, 'activation.json'))
      .replace(/\\/gu, '/');
    const committed = commitActiveRunPointer({
      pointerPath,
      expectedBeforeHash: String(compatibleActiveRun.pointer.activeRunPointerHash),
      expectedBeforeVersion: Number(compatibleActiveRun.pointer.pointerVersion),
      candidateRunId: String(compatibleActiveRun.candidateRun.candidateRunId),
      activationRecordRef,
      activationRecordHash: String(compatibleActiveRun.activationRecord.activationRecordHash),
    });
    return activationResultFromRun({
      prepared,
      pointerPath,
      committed,
      ...compatibleActiveRun,
    });
  }
  let partitionOutcome = String(eligibility.partitionOutcome);
  let selectedPartitionManifestRef: SchemaRecord | null = null;
  let partitionSelectionIdentityHash: string | null = null;
  let executionPackageRefs: SchemaRecord[] = [];
  let packageFiles = new Map<string, Buffer>();
  let resultPackageArtifacts: Array<{
    role: string;
    relativePath: string;
    hash: string;
  }> = [];
  if (executionMode === 'direct_goal') {
    const direct = compileDirectPackage({
      activeAuthority: prepared.activeAuthority,
      goalExecutionIr: prepared.goalExecutionIr,
      eligibility,
      executionAdapterRef: executionAdapter.executionAdapterRef,
    });
    packageFiles = new Map(direct.files);
    executionPackageRefs = [
      {
        path: 'package/direct-execution-package.json',
        hash: direct.directPackage.directExecutionPackageHash,
      },
    ];
    resultPackageArtifacts = [
      {
        role: 'direct_execution_package',
        relativePath: 'package/direct-execution-package.json',
        hash: String(direct.directPackage.directExecutionPackageHash),
      },
    ];
  } else {
    const partitioned = compilePartitionFromFrozenGoalAuthority({
      goalExecutionIr: prepared.goalExecutionIr,
      eligibility,
      executionAdapterRef: executionAdapter.executionAdapterRef,
    });
    eligibility = partitioned.eligibility;
    partitionOutcome = String(partitioned.manifest.partitionOutcome);
    packageFiles = new Map(partitioned.files);
    partitionSelectionIdentityHash = partitioned.selectionIdentityHash;
    selectedPartitionManifestRef = {
      path: 'partition/manifest.json',
      hash: partitioned.manifest.partitionManifestHash,
    };
    executionPackageRefs = partitioned.childPackages.map((childPackage) => ({
      path: childPackage.relativePath,
      hash: childPackage.hash,
    }));
    resultPackageArtifacts = [
      {
        role: 'partition_manifest',
        relativePath: 'partition/manifest.json',
        hash: String(partitioned.manifest.partitionManifestHash),
      },
      ...partitioned.childPackages.map((childPackage) => ({
        role: 'child_execution_package',
        relativePath: childPackage.relativePath,
        hash: childPackage.hash,
      })),
    ];
  }
  const candidateRunIdentityHash = compileFrozenCandidateRunIdentity({
    goalExecutionIRHash: prepared.goalExecutionIr.goalExecutionIRHash,
    executionAdapterAuthorityHash: executionAdapter.authority.adapterAuthorityHash,
    executionMode,
    ...(partitionSelectionIdentityHash ? { partitionSelectionIdentityHash } : {}),
  });
  const candidateRunId = `RUN-${candidateRunIdentityHash
    .slice('sha256:'.length, 'sha256:'.length + 16)
    .toUpperCase()}`;
  const reusable = readReusableCandidateRun({
    runtimeRoot,
    candidateRunId,
    goalExecutionIRHash: String(prepared.goalExecutionIr.goalExecutionIRHash),
    executionAdapterAuthorityHash: executionAdapter.authority.adapterAuthorityHash,
    executionMode,
    partitionSelectionIdentityHash,
  });
  if (reusable) {
    validateGoalExecutionAdmission({
      phase: 'activation_commit',
      projectRoot,
      goalAuthorityPath,
      expectedGoalExecutionIRHash: prepared.goalExecutionIr.goalExecutionIRHash,
    });
    const beforePointer = readActiveRunPointer(pointerPath);
    const activationRecordRef = path
      .relative(prepared.outRoot, path.join(reusable.runRoot, 'activation.json'))
      .replace(/\\/gu, '/');
    const committed = commitActiveRunPointer({
      pointerPath,
      expectedBeforeHash: beforePointer?.activeRunPointerHash ?? ACTIVE_RUN_ZERO_HASH,
      expectedBeforeVersion: Number(beforePointer?.pointerVersion ?? 0),
      candidateRunId,
      activationRecordRef,
      activationRecordHash: String(reusable.activationRecord.activationRecordHash),
    });
    return activationResultFromRun({
      prepared,
      pointerPath,
      committed,
      ...reusable,
    });
  }
  const candidatePayload = {
    schemaVersion: 'GoalContractCandidateRun/v2',
    candidateRunId,
    profile: prepared.goalExecutionIr.profile,
    goalId: prepared.goalExecutionIr.goalId,
    goalExecutionIRHash: prepared.goalExecutionIr.goalExecutionIRHash,
    executionAdapterAuthorityHash: executionAdapter.authority.adapterAuthorityHash,
    executionMode,
    partitionOutcome,
    goalExecutionAuthorityRef: {
      path: String(prepared.activeAuthority.goalExecutionIrRef.path),
      hash: prepared.goalExecutionIr.goalExecutionIRHash,
    },
    eligibilityRef: {
      path: 'eligibility.json',
      hash: eligibility.eligibilityHash,
    },
    executionPackageRefs,
    ...(selectedPartitionManifestRef ? { selectedPartitionManifestRef } : {}),
  };
  const candidateRun = {
    ...candidatePayload,
    candidateRunHash: hashControlPlaneValue(candidatePayload),
  };
  validateGoalContractSchema(CANDIDATE_RUN_SCHEMA, candidateRun);
  const activationPayload = {
    schemaVersion: 'GoalContractActivationRecord/v2',
    candidateRunId,
    profile: prepared.goalExecutionIr.profile,
    goalId: prepared.goalExecutionIr.goalId,
    goalExecutionIRHash: prepared.goalExecutionIr.goalExecutionIRHash,
    executionAdapterAuthorityHash: executionAdapter.authority.adapterAuthorityHash,
    executionMode,
    partitionOutcome,
    goalExecutionAuthorityRef: {
      path: String(prepared.activeAuthority.goalExecutionIrRef.path),
      hash: prepared.goalExecutionIr.goalExecutionIRHash,
    },
    eligibilityRef: {
      path: 'eligibility.json',
      hash: eligibility.eligibilityHash,
    },
    candidateRunRef: {
      path: 'candidate-run.json',
      hash: candidateRun.candidateRunHash,
    },
    executionPackageRefs: candidateRun.executionPackageRefs,
    ...(selectedPartitionManifestRef ? { selectedPartitionManifestRef } : {}),
  };
  const activationRecord = {
    ...activationPayload,
    activationRecordHash: hashControlPlaneValue(activationPayload),
  };
  validateGoalContractSchema(ACTIVATION_RECORD_SCHEMA, activationRecord);

  const beforePointer = readActiveRunPointer(pointerPath);
  const expectedBeforeHash = beforePointer?.activeRunPointerHash ?? ACTIVE_RUN_ZERO_HASH;
  const expectedBeforeVersion = Number(beforePointer?.pointerVersion ?? 0);
  const files = new Map(packageFiles);
  for (const [relativePath, bytes] of executionAdapter.files) {
    files.set(relativePath, bytes);
  }
  files.set('eligibility.json', canonicalJsonBytes(eligibility));
  files.set('candidate-run.json', canonicalJsonBytes(candidateRun));
  files.set('activation.json', canonicalJsonBytes(activationRecord));
  const promoted = promoteCandidateRun({
    runtimeRoot,
    candidateRunId,
    files,
  });

  validateGoalExecutionAdmission({
    phase: 'activation_commit',
    projectRoot,
    goalAuthorityPath,
    expectedGoalExecutionIRHash: prepared.goalExecutionIr.goalExecutionIRHash,
  });
  const activationRecordRef = path
    .relative(prepared.outRoot, path.join(promoted.runRoot, 'activation.json'))
    .replace(/\\/gu, '/');
  const committed = commitActiveRunPointer({
    pointerPath,
    expectedBeforeHash,
    expectedBeforeVersion,
    candidateRunId,
    activationRecordRef,
    activationRecordHash: activationRecord.activationRecordHash,
  });
  return activationResultFromRun({
    prepared,
    pointerPath,
    committed,
    runRoot: promoted.runRoot,
    candidateRun,
    activationRecord,
    eligibility,
    packageArtifacts: resultPackageArtifacts,
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    activateFrozenGoalAuthority,
    compileFrozenCandidateRunIdentity,
    compileFrozenGoalExecutionEligibility,
    compilePartitionFromFrozenGoalAuthority,
    deriveGoalExecutionComponents,
    goalContractActivationFailureResult,
    executionResumeAuthorizedOwnedPaths,
    resolveCommittedActiveRun,
    validateGoalExecutionAdmission,
  };
}
