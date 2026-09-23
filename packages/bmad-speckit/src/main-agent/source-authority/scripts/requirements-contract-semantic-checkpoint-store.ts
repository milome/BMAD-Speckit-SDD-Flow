import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from './requirement-record-control-store';
import {
  publishRequirementsContentObject,
  readRequirementsContentObject,
  verifyRequirementsContentRef,
  type RequirementsContentRef,
} from './requirements-contract-content-store';
import { canonicalRequirementsJson, requirementsContractDomainHash } from './requirements-contract-hash-domains';
import { acquireRequirementsFileLock, releaseRequirementsFileLock } from './requirements-contract-file-lock';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const SAFE_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const CHECKPOINT_ID = /^cp0[0-8]$/u;
const STATE_KEYS = new Set([
  'schemaVersion', 'operationId', 'checkpointId', 'semanticInputHash', 'planHash',
  'completedUnits', 'pendingUnitIds', 'validatorVersion', 'decision', 'stateHash',
]);
const UNIT_KEYS = new Set(['unitId', 'unitInputHash', 'compilerVersion', 'outputRefs']);

export interface RequirementsSemanticCheckpointUnit {
  unitId: string;
  unitInputHash: string;
  compilerVersion: string;
  outputRefs: RequirementsContentRef[];
}

export interface RequirementsSemanticCheckpointState {
  schemaVersion: 'requirements-semantic-checkpoint-state/v1';
  operationId: string;
  checkpointId: string;
  semanticInputHash: string;
  planHash: string;
  completedUnits: RequirementsSemanticCheckpointUnit[];
  pendingUnitIds: string[];
  validatorVersion: string;
  decision: 'in_progress' | 'passed' | 'blocked';
  stateHash: string;
}

function statePath(recordRoot: string, operationId: string, checkpointId: string): string {
  if (!SAFE_OPERATION_ID.test(operationId) || !CHECKPOINT_ID.test(checkpointId)) {
    throw new Error('requirements_checkpoint_state_identity_invalid');
  }
  const realRoot = realpathSync.native(path.resolve(recordRoot));
  const relative = path.join('authoring', 'operations', operationId, 'checkpoints', `${checkpointId}.json`);
  const target = path.resolve(realRoot, relative);
  const outside = path.relative(realRoot, target);
  if (outside.startsWith('..') || path.isAbsolute(outside)) {
    throw new Error('requirements_checkpoint_state_path_invalid');
  }
  let cursor = realRoot;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (!existsSync(cursor)) continue;
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error('requirements_checkpoint_state_symlink_forbidden');
    const realCursor = realpathSync.native(cursor);
    const realRelative = path.relative(realRoot, realCursor);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw new Error('requirements_checkpoint_state_path_invalid');
    }
  }
  return target;
}

function normalizedState(
  value: Record<string, unknown>,
  requireSchemaVersion = false
): Omit<RequirementsSemanticCheckpointState, 'stateHash'> {
  if (Object.keys(value).some((key) => !STATE_KEYS.has(key))) {
    throw new Error('requirements_checkpoint_state_invalid');
  }
  if (!Array.isArray(value.completedUnits) || !Array.isArray(value.pendingUnitIds)) {
    throw new Error('requirements_checkpoint_state_invalid');
  }
  const completedUnits = value.completedUnits.map((unit) => {
        if (!unit || typeof unit !== 'object' || Array.isArray(unit)) {
          throw new Error('requirements_checkpoint_unit_invalid');
        }
        const item = unit as unknown as RequirementsSemanticCheckpointUnit;
        if (
          Object.keys(item).some((key) => !UNIT_KEYS.has(key)) ||
          typeof item.unitId !== 'string' || !item.unitId ||
          !SHA256.test(item.unitInputHash) ||
          typeof item.compilerVersion !== 'string' || !item.compilerVersion ||
           !Array.isArray(item.outputRefs) || item.outputRefs.some((ref) => !ref || typeof ref !== 'object' || Array.isArray(ref))
        ) {
          throw new Error('requirements_checkpoint_unit_invalid');
        }
        return {
          unitId: item.unitId,
          unitInputHash: item.unitInputHash,
          compilerVersion: item.compilerVersion,
          outputRefs: item.outputRefs,
        };
      }).sort((left, right) => left.unitId.localeCompare(right.unitId));
  const pendingUnitIds = value.pendingUnitIds.map((unitId) => {
    if (typeof unitId !== 'string' || !unitId) throw new Error('requirements_checkpoint_state_invalid');
    return unitId;
  }).sort();
  if (
    new Set(completedUnits.map((unit) => unit.unitId)).size !== completedUnits.length ||
    new Set(pendingUnitIds).size !== pendingUnitIds.length
  ) {
    throw new Error('requirements_checkpoint_state_invalid');
  }
  if (
    (requireSchemaVersion && value.schemaVersion !== 'requirements-semantic-checkpoint-state/v1') ||
    (value.schemaVersion !== undefined && value.schemaVersion !== 'requirements-semantic-checkpoint-state/v1')
  ) {
    throw new Error('requirements_checkpoint_state_invalid');
  }
  if (
    !SAFE_OPERATION_ID.test(String(value.operationId)) ||
    !CHECKPOINT_ID.test(String(value.checkpointId)) ||
    !SHA256.test(String(value.semanticInputHash)) ||
    !SHA256.test(String(value.planHash)) ||
    typeof value.validatorVersion !== 'string' || !value.validatorVersion ||
    !['in_progress', 'passed', 'blocked'].includes(String(value.decision)) ||
    completedUnits.some((unit) => pendingUnitIds.includes(unit.unitId))
  ) {
    throw new Error('requirements_checkpoint_state_invalid');
  }
  return {
    schemaVersion: 'requirements-semantic-checkpoint-state/v1',
    operationId: String(value.operationId),
    checkpointId: String(value.checkpointId),
    semanticInputHash: String(value.semanticInputHash),
    planHash: String(value.planHash),
    completedUnits,
    pendingUnitIds,
    validatorVersion: String(value.validatorVersion),
    decision: value.decision as RequirementsSemanticCheckpointState['decision'],
  };
}

export function checkpointStateHash(
  state: Omit<RequirementsSemanticCheckpointState, 'stateHash'>
): string {
  const { operationId: _operationId, ...semanticState } = state;
  return requirementsContractDomainHash('requirements-semantic-checkpoint-state/v1', semanticState);
}

export function readRequirementsSemanticCheckpoint(input: {
  recordRoot: string;
  operationId: string;
  checkpointId: string;
}): RequirementsSemanticCheckpointState {
  const filePath = statePath(input.recordRoot, input.operationId, input.checkpointId);
  const value = JSON.parse(readFileSync(filePath, 'utf8')) as RequirementsSemanticCheckpointState;
  const { stateHash, ...payload } = value;
  const normalized = normalizedState(payload, true);
  if (stateHash !== checkpointStateHash(normalized)) {
    throw new Error('requirements_checkpoint_state_hash_mismatch');
  }
  for (const unit of normalized.completedUnits) {
    for (const ref of unit.outputRefs) verifyRequirementsContentRef({ recordRoot: input.recordRoot, ref });
  }
  return { ...normalized, stateHash };
}

export function saveRequirementsSemanticCheckpoint(input: {
  recordRoot: string;
  expectedStateHash: string | null;
  nextState: Record<string, unknown>;
}): RequirementsSemanticCheckpointState {
  const normalized = normalizedState(input.nextState);
  const filePath = statePath(input.recordRoot, normalized.operationId, normalized.checkpointId);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const lockPath = `${filePath}.lock`;
  const lock = acquireRequirementsFileLock({ lockPath, busyCode: 'requirements_checkpoint_state_busy' });
  try {
    if (existsSync(filePath)) {
      const current = readRequirementsSemanticCheckpoint({
        recordRoot: input.recordRoot,
        operationId: normalized.operationId,
        checkpointId: normalized.checkpointId,
      });
      if (current.stateHash !== input.expectedStateHash) {
        throw new Error('requirements_checkpoint_state_cas_mismatch');
      }
    } else if (input.expectedStateHash !== null) {
      throw new Error('requirements_checkpoint_state_cas_mismatch');
    }
    for (const unit of normalized.completedUnits) {
      for (const ref of unit.outputRefs) verifyRequirementsContentRef({ recordRoot: input.recordRoot, ref });
    }
    const state = { ...normalized, stateHash: checkpointStateHash(normalized) };
    writeJsonAtomic(filePath, state);
    return readRequirementsSemanticCheckpoint({
      recordRoot: input.recordRoot,
      operationId: normalized.operationId,
      checkpointId: normalized.checkpointId,
    });
  } finally {
    releaseRequirementsFileLock(lock);
  }
}

export function runRequirementsSemanticCheckpointUnits(input: {
  recordRoot: string;
  operationId: string;
  checkpointId: string;
  semanticInputHash: string;
  planHash: string;
  validatorVersion: string;
  units: Array<{
    unitId: string;
    unitInputHash: string;
    compilerVersion: string;
    execute: () => RequirementsContentRef[];
  }>;
}): { state: RequirementsSemanticCheckpointState; executedUnitIds: string[]; reusedUnitIds: string[] } {
  let current: RequirementsSemanticCheckpointState | null = null;
  try {
    current = readRequirementsSemanticCheckpoint({
      recordRoot: input.recordRoot,
      operationId: input.operationId,
      checkpointId: input.checkpointId,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
  }
  const reusable: RequirementsSemanticCheckpointUnit[] = [];
  if (
    current?.semanticInputHash === input.semanticInputHash &&
    current.planHash === input.planHash &&
    current.validatorVersion === input.validatorVersion
  ) {
    for (let index = 0; index < input.units.length; index += 1) {
      const expected = input.units[index];
      const completed = current.completedUnits[index];
      if (
        !completed || completed.unitId !== expected.unitId ||
        completed.unitInputHash !== expected.unitInputHash ||
        completed.compilerVersion !== expected.compilerVersion
      ) break;
      for (const ref of completed.outputRefs) {
        verifyRequirementsContentRef({ recordRoot: input.recordRoot, ref });
      }
      reusable.push(completed);
    }
  }
  const pending = input.units.slice(reusable.length);
  if (
    current?.decision === 'passed' &&
    pending.length === 0 &&
    reusable.length === input.units.length
  ) {
    return {
      state: current,
      executedUnitIds: [],
      reusedUnitIds: reusable.map((unit) => unit.unitId),
    };
  }
  let state = saveRequirementsSemanticCheckpoint({
    recordRoot: input.recordRoot,
    expectedStateHash: current?.stateHash ?? null,
    nextState: {
      operationId: input.operationId,
      checkpointId: input.checkpointId,
      semanticInputHash: input.semanticInputHash,
      planHash: input.planHash,
      completedUnits: reusable,
      pendingUnitIds: pending.map((unit) => unit.unitId),
      validatorVersion: input.validatorVersion,
      decision: pending.length === 0 ? 'passed' : 'in_progress',
    },
  });
  const executedUnitIds: string[] = [];
  for (const unit of pending) {
    const outputRefs = unit.execute();
    for (const ref of outputRefs) verifyRequirementsContentRef({ recordRoot: input.recordRoot, ref });
    executedUnitIds.push(unit.unitId);
    state = saveRequirementsSemanticCheckpoint({
      recordRoot: input.recordRoot,
      expectedStateHash: state.stateHash,
      nextState: {
        ...state,
        completedUnits: [...state.completedUnits, {
          unitId: unit.unitId,
          unitInputHash: unit.unitInputHash,
          compilerVersion: unit.compilerVersion,
          outputRefs,
        }],
        pendingUnitIds: state.pendingUnitIds.filter((unitId) => unitId !== unit.unitId),
        decision: state.pendingUnitIds.length === 1 ? 'passed' : 'in_progress',
      },
    });
  }
  return { state, executedUnitIds, reusedUnitIds: reusable.map((unit) => unit.unitId) };
}

export function runRequirementsSemanticCheckpointJsonUnit<T>(input: {
  recordRoot: string;
  operationId: string;
  checkpointId: string;
  semanticInputHash: string;
  planHash: string;
  validatorVersion: string;
  unitId: string;
  unitInputHash: string;
  compilerVersion: string;
  role: string;
  execute: () => T;
}): {
  value: T;
  state: RequirementsSemanticCheckpointState;
  executed: boolean;
  reused: boolean;
} {
  let executedValue: T | undefined;
  const result = runRequirementsSemanticCheckpointUnits({
    recordRoot: input.recordRoot,
    operationId: input.operationId,
    checkpointId: input.checkpointId,
    semanticInputHash: input.semanticInputHash,
    planHash: input.planHash,
    validatorVersion: input.validatorVersion,
    units: [{
      unitId: input.unitId,
      unitInputHash: input.unitInputHash,
      compilerVersion: input.compilerVersion,
      execute: () => {
        executedValue = input.execute();
        return [publishRequirementsContentObject({
          recordRoot: input.recordRoot,
          role: input.role,
          mediaType: 'application/json',
          bytes: Buffer.from(canonicalRequirementsJson(executedValue), 'utf8'),
        })];
      },
    }],
  });
  const outputRef = result.state.completedUnits[0]?.outputRefs[0];
  if (!outputRef) throw new Error('requirements_checkpoint_unit_output_missing');
  const value = executedValue ?? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
    readRequirementsContentObject({ recordRoot: input.recordRoot, ref: outputRef })
  )) as T;
  return {
    value,
    state: result.state,
    executed: result.executedUnitIds.length === 1,
    reused: result.reusedUnitIds.length === 1,
  };
}
