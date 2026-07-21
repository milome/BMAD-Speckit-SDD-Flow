import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  type JudgeAuditUnitProjectionResult,
  validateRequirementsContractJudgeAuditUnitSet,
} from './requirements-contract-judge-audit-unit-projector';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
} from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;

export interface JudgeRuntimeBindingRef {
  path: string;
  hash: string;
  schemaVersion?: string;
}

export interface RequirementsContractJudgeRuntimeBindingsResolution {
  judgeAuditUnitSet: JudgeAuditUnitProjectionResult;
  refs: {
    judgeAuditUnitSet: JudgeRuntimeBindingRef;
    rubric: JudgeRuntimeBindingRef;
    systemPrompt: JudgeRuntimeBindingRef;
    source: JudgeRuntimeBindingRef;
    trace: JudgeRuntimeBindingRef;
    red: JudgeRuntimeBindingRef;
    baseEvidence: JudgeRuntimeBindingRef;
    authorizedChallengeDerivationProtocol: JudgeRuntimeBindingRef;
  };
  baseJudgeInputBundleHash: string;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as JsonRecord;
}

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`judge_runtime_binding_path_escape:${value}`);
  }
  return resolved;
}

function validate(value: JsonRecord, schemaName: string): void {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', schemaName);
  const validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    readJson(schemaPath)
  );
  if (!validator(value)) {
    throw new Error(
      `judge_runtime_binding_schema_invalid:${schemaName}:${JSON.stringify(
        validator.errors ?? []
      )}`
    );
  }
}

function resolveBinding(
  root: string,
  phaseRoot: string,
  value: unknown,
  field: string,
  schemaVersion?: string
): { filePath: string; ref: JudgeRuntimeBindingRef } {
  const binding = record(value, `judge_runtime_binding_invalid:${field}`);
  if (
    typeof binding.path !== 'string' ||
    typeof binding.hash !== 'string' ||
    (schemaVersion !== undefined && binding.schemaVersion !== schemaVersion)
  ) {
    throw new Error(`judge_runtime_binding_invalid:${field}`);
  }
  const filePath = resolveWithin(root, binding.path);
  if (filePath !== phaseRoot && !filePath.startsWith(`${phaseRoot}${path.sep}`)) {
    throw new Error(`judge_runtime_binding_outside_phase_root:${field}`);
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`judge_runtime_binding_missing:${field}`);
  }
  const hash = fileHash(filePath);
  if (hash !== binding.hash) {
    throw new Error(`judge_runtime_binding_hash_mismatch:${field}`);
  }
  return {
    filePath,
    ref: {
      path: slash(path.relative(root, filePath)),
      hash,
      ...(schemaVersion ? { schemaVersion } : {}),
    },
  };
}

export function resolveRequirementsContractJudgeRuntimeBindings(input: {
  root: string;
  phaseRoot: string;
  phase: 'pre-candidate' | 'final';
  phaseAuditAttemptId: string;
  context: JsonRecord;
}): RequirementsContractJudgeRuntimeBindingsResolution {
  validate(input.context, 'requirements-contract-stage-audit-context.schema.json');
  if (
    input.context.phase !== input.phase ||
    input.context.phaseAuditAttemptId !== input.phaseAuditAttemptId
  ) {
    throw new Error('judge_runtime_binding_attempt_context_mismatch');
  }
  const bindings = record(
    input.context.judgeRuntimeBindings,
    'judge_runtime_bindings_missing'
  );
  if (
    bindings.schemaVersion !== 'requirements-contract-stage-judge-runtime-bindings/v1'
  ) {
    throw new Error('judge_runtime_bindings_invalid');
  }
  const judgeAuditUnitSetBinding = resolveBinding(
    input.root,
    input.phaseRoot,
    bindings.judgeAuditUnitSetRef,
    'judgeAuditUnitSetRef',
    'requirements-contract-judge-audit-unit-set/v1'
  );
  const rubricBinding = resolveBinding(
    input.root,
    input.phaseRoot,
    bindings.rubricRef,
    'rubricRef'
  );
  const systemPromptBinding = resolveBinding(
    input.root,
    input.phaseRoot,
    bindings.systemPromptRef,
    'systemPromptRef'
  );
  const sourceBinding = resolveBinding(
    input.root,
    input.phaseRoot,
    bindings.sourceRef,
    'sourceRef'
  );
  const traceBinding = resolveBinding(input.root, input.phaseRoot, bindings.traceRef, 'traceRef');
  const redBinding = resolveBinding(input.root, input.phaseRoot, bindings.redRef, 'redRef');
  const baseEvidenceBinding = resolveBinding(
    input.root,
    input.phaseRoot,
    bindings.baseEvidenceRef,
    'baseEvidenceRef'
  );
  const challengeProtocolBinding = resolveBinding(
    input.root,
    input.phaseRoot,
    bindings.authorizedChallengeDerivationProtocolRef,
    'authorizedChallengeDerivationProtocolRef'
  );
  const judgeAuditUnitSet = readJson(
    judgeAuditUnitSetBinding.filePath
  ) as JudgeAuditUnitProjectionResult;
  validate(judgeAuditUnitSet, 'requirements-contract-judge-audit-unit-set.schema.json');
  const semanticValidation = validateRequirementsContractJudgeAuditUnitSet(judgeAuditUnitSet);
  if (!semanticValidation.ok) {
    throw new Error(
      `judge_runtime_binding_judge_audit_unit_set_invalid:${semanticValidation.issues.join(',')}`
    );
  }
  const semanticModelHashes = Object.values(
    record(input.context.semanticModelHashes, 'judge_runtime_binding_semantic_hashes_invalid')
  );
  if (
    judgeAuditUnitSet.requirementSetId !== input.context.requirementSetId ||
    judgeAuditUnitSet.judgeAuditUniverseHash !== input.context.frozenUniverseHash ||
    !semanticModelHashes.includes(judgeAuditUnitSet.semanticModelHash)
  ) {
    throw new Error('judge_runtime_binding_judge_audit_unit_set_context_mismatch');
  }
  const refs = {
    judgeAuditUnitSet: judgeAuditUnitSetBinding.ref,
    rubric: rubricBinding.ref,
    systemPrompt: systemPromptBinding.ref,
    source: sourceBinding.ref,
    trace: traceBinding.ref,
    red: redBinding.ref,
    baseEvidence: baseEvidenceBinding.ref,
    authorizedChallengeDerivationProtocol: challengeProtocolBinding.ref,
  };
  const baseJudgeInputBundleHash = sha256(
    canonicalJson({
      schemaVersion: 'requirements-contract-base-judge-input-bundle/v1',
      phase: input.phase,
      phaseAuditAttemptId: input.phaseAuditAttemptId,
      requirementSetId: input.context.requirementSetId,
      transactionId: input.context.transactionId,
      implementationAttemptId: input.context.implementationAttemptId,
      judgeAuditUnitSetRef: refs.judgeAuditUnitSet,
      judgeAuditUniverseHash: judgeAuditUnitSet.judgeAuditUniverseHash,
      judgeAuditUnitSetHash: judgeAuditUnitSet.judgeAuditUnitSetHash,
      rubricRef: refs.rubric,
      systemPromptRef: refs.systemPrompt,
      sourceRef: refs.source,
      traceRef: refs.trace,
      redRef: refs.red,
      baseEvidenceRef: refs.baseEvidence,
      authorizedChallengeDerivationProtocolRef: refs.authorizedChallengeDerivationProtocol,
    })
  );
  return { judgeAuditUnitSet, refs, baseJudgeInputBundleHash };
}
