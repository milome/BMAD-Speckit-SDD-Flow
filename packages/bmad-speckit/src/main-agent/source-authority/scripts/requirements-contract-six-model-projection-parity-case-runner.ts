import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  SIX_MODEL_PARITY_CASE_PRODUCER,
  SIX_MODEL_PARITY_CASES,
  SIX_MODEL_PARITY_SURFACES,
} from './requirements-contract-six-model-projection-parity-observation-producer';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
} from './requirements-contract-runtime-status-decision-receipt';

type JsonRecord = Record<string, unknown>;
type ParityCaseId = (typeof SIX_MODEL_PARITY_CASES)[number];
type ParitySurface = (typeof SIX_MODEL_PARITY_SURFACES)[number];

interface RuntimeStatusAuthorityCore {
  resolveVerifiedSixModelStatus(input: {
    record: JsonRecord | null;
    modelId: string;
    currentImplementationAttemptId: string;
  }): JsonRecord;
  resolveVerifiedSixModelPanorama(input: {
    record: JsonRecord | null;
    currentImplementationAttemptId: string;
  }): JsonRecord[];
}

export interface RunRequirementsContractSixModelProjectionParityCaseOptions {
  runtimeCorePath: string;
  surface: string;
  caseId: string;
  contractHash: string;
  requirementSetId: string;
  implementationAttemptId: string;
  observedAt?: string;
}

export interface RequirementsContractSixModelProjectionParityBehaviorObservation
  extends JsonRecord {
  schemaVersion: 'requirements-contract-six-model-projection-parity-behavior-observation/v1';
  producer: typeof SIX_MODEL_PARITY_CASE_PRODUCER;
  action: string;
  surface: ParitySurface;
  caseId: ParityCaseId;
  contractHash: string;
  requirementSetId: string;
  implementationAttemptId: string;
  observedAt: string;
  outcome: JsonRecord;
}

const MODEL_ID = 'implementation_readiness';
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

interface ParityRecordContext {
  contractHash: string;
  requirementSetId: string;
  implementationAttemptId: string;
  observedAt: string;
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function requireHash(value: string, label: string): string {
  const normalized = requireText(value, label);
  if (!SHA256_PATTERN.test(normalized)) throw new Error(`${label} must be a sha256 hash`);
  return normalized;
}

function loadRuntimeCore(runtimeCorePath: string): RuntimeStatusAuthorityCore {
  const resolvedPath = path.resolve(requireText(runtimeCorePath, 'runtimeCorePath'));
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    throw new Error(`runtimeCorePath is missing: ${resolvedPath}`);
  }
  const requireFromCore = createRequire(resolvedPath);
  const loaded = requireFromCore(resolvedPath) as Partial<RuntimeStatusAuthorityCore>;
  if (
    typeof loaded.resolveVerifiedSixModelStatus !== 'function' ||
    typeof loaded.resolveVerifiedSixModelPanorama !== 'function'
  ) {
    throw new Error(`runtimeCorePath does not expose the verified facade: ${resolvedPath}`);
  }
  return loaded as RuntimeStatusAuthorityCore;
}

function derivedHash(label: string, context: ParityRecordContext): string {
  return `sha256:${createHash('sha256')
    .update(
      JSON.stringify({
        label,
        contractHash: context.contractHash,
        requirementSetId: context.requirementSetId,
        implementationAttemptId: context.implementationAttemptId,
      })
    )
    .digest('hex')}`;
}

function baseRecord(context: ParityRecordContext): JsonRecord {
  return {
    recordId: context.requirementSetId,
    requirementSetId: context.requirementSetId,
    currentAttemptId: context.implementationAttemptId,
    sourceDocumentHash: context.contractHash,
    implementationConfirmationHash: derivedHash('implementation-confirmation', context),
    semanticModelHash: derivedHash('semantic-model', context),
    sixModelResults: {},
    runtimeStatusDecisionReceipts: [],
    artifactIndex: [],
  };
}

function controlledRecord(input: {
  context: ParityRecordContext;
  decision: 'pass' | 'block';
  effectiveStatus: 'pass' | 'blocked';
  authorityClass: 'controlled_confirmation' | 'deterministic_gate';
  blockerRefs: string[];
}): JsonRecord {
  const record = baseRecord(input.context);
  const update = createRuntimeStatusProjectionUpdate({
    recordId: String(record.recordId),
    requirementSetId: String(record.requirementSetId),
    modelId: MODEL_ID,
    implementationAttemptId: input.context.implementationAttemptId,
    sourceDocumentHash: String(record.sourceDocumentHash),
    implementationConfirmationHash: String(record.implementationConfirmationHash),
    semanticModelHash: String(record.semanticModelHash),
    stageInputs: [
      {
        role: 'six_model_parity_input',
        path: 'parity/input.json',
        hash: derivedHash('stage-input', input.context),
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'six_model_parity_gate',
        path: 'parity/gate.json',
        hash: derivedHash('deterministic-gate', input.context),
      },
    ],
    blockerRefs: input.blockerRefs,
    evidenceRefs: ['parity/gate.json'],
    authorityClass: input.authorityClass,
    decision: input.decision,
    effectiveStatus: input.effectiveStatus,
    createdAt: input.context.observedAt,
    receiptPath: 'parity/status/implementation-readiness.json',
    projection: {
      status: input.effectiveStatus,
      blockingReasons: input.blockerRefs,
    },
  });
  return {
    ...record,
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId: MODEL_ID,
      update,
    }),
  };
}

function caseInput(
  caseId: ParityCaseId,
  context: ParityRecordContext
): {
  record: JsonRecord;
  currentImplementationAttemptId: string;
  receiptState: 'valid' | 'missing' | 'stale' | 'blocked';
} {
  if (caseId === 'blocked_receipt') {
    return {
      record: controlledRecord({
        context,
        decision: 'block',
        effectiveStatus: 'blocked',
        authorityClass: 'deterministic_gate',
        blockerRefs: ['six_model_parity_gate_failed'],
      }),
      currentImplementationAttemptId: context.implementationAttemptId,
      receiptState: 'blocked',
    };
  }
  if (caseId === 'synthetic_bridge') {
    return {
        record: {
        ...baseRecord(context),
        sixModelResults: {
          [MODEL_ID]: {
            status: 'not_established',
            blockingReasons: ['runtime_status_decision_receipt_missing'],
          },
        },
      },
      currentImplementationAttemptId: context.implementationAttemptId,
      receiptState: 'missing',
    };
  }
  if (caseId === 'complete_panorama') {
    return {
      record: baseRecord(context),
      currentImplementationAttemptId: context.implementationAttemptId,
      receiptState: 'missing',
    };
  }

  const record = controlledRecord({
    context,
    decision: 'pass',
    effectiveStatus: 'pass',
    authorityClass: 'controlled_confirmation',
    blockerRefs: [],
  });
  if (caseId === 'missing_receipt') {
    record.runtimeStatusDecisionReceipts = [];
    return {
      record,
      currentImplementationAttemptId: context.implementationAttemptId,
      receiptState: 'missing',
    };
  }
  if (caseId === 'missing_projection') {
    const projections = record.sixModelResults as JsonRecord;
    delete projections[MODEL_ID];
    return {
      record,
      currentImplementationAttemptId: context.implementationAttemptId,
      receiptState: 'valid',
    };
  }
  if (caseId === 'projection_mismatch') {
    const projections = record.sixModelResults as JsonRecord;
    projections[MODEL_ID] = {
      ...(projections[MODEL_ID] as JsonRecord),
      status: 'blocked',
      blockingReasons: ['runtime_status_projection_decision_mismatch'],
    };
    return {
      record,
      currentImplementationAttemptId: context.implementationAttemptId,
      receiptState: 'valid',
    };
  }
  if (caseId === 'stale_attempt') {
    return {
      record,
      currentImplementationAttemptId: `${context.implementationAttemptId}-CURRENT`,
      receiptState: 'stale',
    };
  }
  return {
    record,
    currentImplementationAttemptId: context.implementationAttemptId,
    receiptState: 'valid',
  };
}

export function runRequirementsContractSixModelProjectionParityCase(
  options: RunRequirementsContractSixModelProjectionParityCaseOptions
): RequirementsContractSixModelProjectionParityBehaviorObservation {
  const surface = requireText(options.surface, 'surface') as ParitySurface;
  if (!SIX_MODEL_PARITY_SURFACES.includes(surface)) {
    throw new Error(`unknown parity surface: ${surface}`);
  }
  const caseId = requireText(options.caseId, 'caseId') as ParityCaseId;
  if (!SIX_MODEL_PARITY_CASES.includes(caseId)) {
    throw new Error(`unknown parity case: ${caseId}`);
  }
  const contractHash = requireHash(options.contractHash, 'contractHash');
  const requirementSetId = requireText(options.requirementSetId, 'requirementSetId');
  const implementationAttemptId = requireText(
    options.implementationAttemptId,
    'implementationAttemptId'
  );
  const observedAt = options.observedAt?.trim() || new Date().toISOString();
  if (!Number.isFinite(new Date(observedAt).getTime())) {
    throw new Error('observedAt must be an ISO timestamp');
  }

  const runtimeCore = loadRuntimeCore(options.runtimeCorePath);
  const input = caseInput(caseId, {
    contractHash,
    requirementSetId,
    implementationAttemptId,
    observedAt,
  });
  const status = runtimeCore.resolveVerifiedSixModelStatus({
    record: input.record,
    modelId: MODEL_ID,
    currentImplementationAttemptId: input.currentImplementationAttemptId,
  });
  const outcome: JsonRecord = {
    effectiveStatus: status.effectiveStatus,
    projectionStatus: status.projectionStatus ?? null,
    projectionIntegrity: status.projectionIntegrity,
    receiptState: input.receiptState,
    authorityClass: status.authorityClass ?? 'none',
    syntheticBridgePass:
      caseId === 'synthetic_bridge' && status.effectiveStatus === 'pass',
  };
  if (caseId === 'complete_panorama') {
    const panorama = runtimeCore.resolveVerifiedSixModelPanorama({
      record: input.record,
      currentImplementationAttemptId: input.currentImplementationAttemptId,
    });
    outcome.panoramaModelOrder = panorama.map((entry) => entry.modelId);
    outcome.panoramaRowCount = panorama.length;
  }

  return {
    schemaVersion:
      'requirements-contract-six-model-projection-parity-behavior-observation/v1',
    producer: SIX_MODEL_PARITY_CASE_PRODUCER,
    action: `run:${caseId}`,
    surface,
    caseId,
    contractHash,
    requirementSetId,
    implementationAttemptId,
    observedAt,
    outcome,
  };
}

function argumentValue(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  if (index < 0 || index + 1 >= argv.length) throw new Error(`${name} is required`);
  return argv[index + 1];
}

export function requirementsContractSixModelProjectionParityCaseCommand(
  argv = process.argv.slice(2)
): number {
  const observation = runRequirementsContractSixModelProjectionParityCase({
    runtimeCorePath: argumentValue(argv, '--runtime-core'),
    surface: argumentValue(argv, '--surface'),
    caseId: argumentValue(argv, '--case'),
    contractHash: argumentValue(argv, '--contract-hash'),
    requirementSetId: argumentValue(argv, '--requirement-set-id'),
    implementationAttemptId: argumentValue(argv, '--implementation-attempt-id'),
  });
  process.stdout.write(`${JSON.stringify(observation, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = requirementsContractSixModelProjectionParityCaseCommand();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
