const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { hashControlPlaneValue, stableControlPlaneStringify } = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const { validateGoalContractSchema } = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
);

export type FrozenGoalActivationModule = never;

const EXECUTION_ELIGIBILITY_SCHEMA = 'goal-contract-execution-eligibility.schema.json';
const DIRECT_EXECUTION_PACKAGE_SCHEMA = 'goal-contract-direct-execution-package.schema.json';
const CHILD_EXECUTION_PACKAGE_SCHEMA = 'goal-contract-child-execution-package.schema.json';
const PARTITION_MANIFEST_SCHEMA = 'goal-contract-frozen-partition-manifest.schema.json';
const CANDIDATE_RUN_SCHEMA = 'goal-contract-candidate-run.schema.json';
const ACTIVATION_RECORD_SCHEMA = 'goal-contract-activation-record.schema.json';
const ACTIVE_RUN_POINTER_SCHEMA = 'goal-contract-active-run-pointer.schema.json';
const ACTIVATION_RESULT_SCHEMA = 'goal-contract-activation-result.schema.json';
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ACTIVE_RUN_ZERO_HASH =
  'sha256:0000000000000000000000000000000000000000000000000000000000000000';
const ACTIVE_RUN_LOCK_SLEEP = new Int32Array(new SharedArrayBuffer(4));
const ACTIVE_RUN_LOCK_LEASE_MS = 30_000;

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
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
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
    readHashReferencedRecord({
      outRoot,
      ref: activeAuthority.standaloneSemanticIrRef,
      field: 'standaloneSemanticIrRef',
      schemaName: 'standalone-goal-semantic-ir.schema.json',
      hashField: 'standaloneGoalSemanticIRHash',
    });
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

function validateGoalExecutionAdmission(input: {
  phase: 'activation_prepare' | 'activation_commit';
  projectRoot: string;
  goalAuthorityPath: string;
  expectedGoalExecutionIRHash?: string;
}) {
  const resolved = resolveFrozenGoalAuthority(input);
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
    validateRequirementsBackedGoalAdmissionCurrent({
      projectRoot: resolved.projectRoot,
      requestId,
      requirementRecordPath,
      expectedRequirementsLineage: requirementsLineage,
    });
  }
  return Object.freeze({ ...resolved, phase: input.phase });
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
    schemaVersion: 'GoalContractDirectExecutionPackage/v1',
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

function activeRunLockOwnerAlive(ownerPid: number): boolean {
  if (!Number.isInteger(ownerPid) || ownerPid <= 0) return false;
  try {
    process.kill(ownerPid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readActiveRunLock(lockPath: string): SchemaRecord | null {
  try {
    const value = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function reclaimStaleActiveRunLock(lockPath: string): boolean {
  if (!fs.existsSync(lockPath)) return true;
  const observedBytes = fs.readFileSync(lockPath);
  const lock = readActiveRunLock(lockPath);
  const stale = lock
    ? lock.schemaVersion === 'GoalContractActiveRunLock/v1' &&
      !activeRunLockOwnerAlive(Number(lock.ownerPid))
    : fs.statSync(lockPath).mtimeMs + ACTIVE_RUN_LOCK_LEASE_MS <= Date.now();
  if (!stale || !fs.existsSync(lockPath)) return false;
  if (!fs.readFileSync(lockPath).equals(observedBytes)) return false;
  fs.rmSync(lockPath, { force: true });
  return !fs.existsSync(lockPath);
}

function releaseActiveRunLock(lockPath: string, ownerToken: string): void {
  const lock = readActiveRunLock(lockPath);
  if (lock?.ownerToken === ownerToken) fs.rmSync(lockPath, { force: true });
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

function commitActiveRunPointer(input: {
  pointerPath: string;
  expectedBeforeHash: string;
  expectedBeforeVersion: number;
  candidateRunId: string;
  activationRecordRef: string;
  activationRecordHash: string;
}): { pointer: SchemaRecord; reused: boolean } {
  fs.mkdirSync(path.dirname(input.pointerPath), { recursive: true });
  const alreadyCommitted = readActiveRunPointer(input.pointerPath);
  if (
    activeRunPointerMatches(alreadyCommitted, input.activationRecordRef, input.activationRecordHash)
  ) {
    return { pointer: alreadyCommitted, reused: true };
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
  const deadline = Date.now() + 2_000;
  let descriptor: number | undefined;
  const ownerToken = sha256(
    Buffer.from(`${process.pid}:${Date.now()}:${process.hrtime.bigint()}`, 'utf8')
  );
  while (descriptor === undefined && Date.now() < deadline) {
    try {
      descriptor = fs.openSync(lockPath, 'wx');
      const acquiredAtMs = Date.now();
      fs.writeFileSync(
        descriptor,
        canonicalJsonBytes({
          schemaVersion: 'GoalContractActiveRunLock/v1',
          ownerPid: process.pid,
          ownerToken,
          expectedBeforeHash: input.expectedBeforeHash,
          expectedBeforeVersion: input.expectedBeforeVersion,
          candidateRunId: input.candidateRunId,
          acquiredAtMs,
          leaseExpiresAtMs: acquiredAtMs + ACTIVE_RUN_LOCK_LEASE_MS,
        })
      );
      fs.fsyncSync(descriptor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const current = readActiveRunPointer(input.pointerPath);
      if (activeRunPointerMatches(current, input.activationRecordRef, input.activationRecordHash)) {
        return { pointer: current, reused: true };
      }
      if (reclaimStaleActiveRunLock(lockPath)) continue;
      Atomics.wait(ACTIVE_RUN_LOCK_SLEEP, 0, 0, 10);
    }
  }
  if (descriptor === undefined) {
    const current = readActiveRunPointer(input.pointerPath);
    if (activeRunPointerMatches(current, input.activationRecordRef, input.activationRecordHash)) {
      return { pointer: current, reused: true };
    }
    throw failure('active_run_cas_conflict');
  }
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
    fs.closeSync(descriptor);
    releaseActiveRunLock(lockPath, ownerToken);
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
  executionMode: string;
  partitionSelectionIdentityHash: string | null;
}): string {
  const identityHash = compileFrozenCandidateRunIdentity({
    goalExecutionIRHash: input.goalExecutionIRHash,
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
    schemaVersion: 'GoalContractCandidateRun/v1',
    candidateRunId,
    profile: prepared.goalExecutionIr.profile,
    goalId: prepared.goalExecutionIr.goalId,
    goalExecutionIRHash: prepared.goalExecutionIr.goalExecutionIRHash,
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
    schemaVersion: 'GoalContractActivationRecord/v1',
    candidateRunId,
    profile: prepared.goalExecutionIr.profile,
    goalId: prepared.goalExecutionIr.goalId,
    goalExecutionIRHash: prepared.goalExecutionIr.goalExecutionIRHash,
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

module.exports = {
  activateFrozenGoalAuthority,
  compileFrozenCandidateRunIdentity,
  compileFrozenGoalExecutionEligibility,
  compilePartitionFromFrozenGoalAuthority,
  deriveGoalExecutionComponents,
  goalContractActivationFailureResult,
  validateGoalExecutionAdmission,
};
