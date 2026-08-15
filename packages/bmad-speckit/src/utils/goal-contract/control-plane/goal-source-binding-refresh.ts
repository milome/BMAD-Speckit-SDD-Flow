import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  sha256Stable,
  stableStringify,
} from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateGoalContractSchema } from './schema-registry';

type JsonObject = Record<string, unknown>;

export interface GoalSourceBindingRefreshInput {
  outRoot: string;
  expectedActiveAuthorityHash: string;
  sourceBinding: JsonObject;
  resolvedEvidenceIndex: JsonObject;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readJson(filePath: string): JsonObject {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('goal_binding_refresh_json_object_required');
  }
  return value as JsonObject;
}

function without(value: JsonObject, field: string): JsonObject {
  const payload = { ...value };
  delete payload[field];
  return payload;
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${stableStringify(value)}\n`, 'utf8');
}

function publishImmutable(targetPath: string, value: unknown): void {
  const bytes = canonicalBytes(value);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    const handle = fs.openSync(targetPath, 'wx');
    try {
      fs.writeFileSync(handle, bytes);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!fs.readFileSync(targetPath).equals(bytes)) {
      throw new Error('goal_binding_refresh_immutable_conflict');
    }
  }
  if (!fs.readFileSync(targetPath).equals(bytes)) {
    throw new Error('goal_binding_refresh_immutable_readback_failed');
  }
}

function verifyInputs(active: JsonObject, input: GoalSourceBindingRefreshInput): void {
  const sourceBinding = input.sourceBinding;
  const evidenceIndex = input.resolvedEvidenceIndex;
  validateGoalContractSchema('goal-source-binding.schema.json', sourceBinding);
  validateGoalContractSchema('goal-contract-resolved-evidence-index.schema.json', evidenceIndex);
  if (
    sourceBinding.schemaVersion !== 'GoalSourceBinding/v1' ||
    text(sourceBinding.goalExecutionIRHash) !== text(active.goalExecutionIRHash) ||
    text(sourceBinding.goalSourceBindingHash) !==
      sha256Stable(without(sourceBinding, 'goalSourceBindingHash'))
  ) {
    throw new Error('goal_binding_refresh_source_binding_invalid');
  }
  if (
    evidenceIndex.schemaVersion !== 'GoalContractResolvedEvidenceIndex/v1' ||
    text(evidenceIndex.goalExecutionIRHash) !== text(active.goalExecutionIRHash) ||
    text(evidenceIndex.goalSourceBindingHash) !== text(sourceBinding.goalSourceBindingHash) ||
    text(evidenceIndex.resolvedEvidenceIndexHash) !==
      sha256Stable(without(evidenceIndex, 'resolvedEvidenceIndexHash'))
  ) {
    throw new Error('goal_binding_refresh_evidence_index_invalid');
  }
}

export function refreshGoalSourceBinding(input: GoalSourceBindingRefreshInput) {
  const outRoot = path.resolve(input.outRoot);
  const activePath = path.join(outRoot, 'goal', 'active-authority.json');
  const lockPath = `${activePath}.lock`;
  fs.mkdirSync(path.dirname(activePath), { recursive: true });
  let lock: number;
  try {
    lock = fs.openSync(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('goal_binding_refresh_writer_busy');
    }
    throw error;
  }
  try {
    const active = readJson(activePath);
    validateGoalContractSchema('goal-contract-active-authority.schema.json', active);
    if (
      text(active.activeAuthorityHash) !== input.expectedActiveAuthorityHash ||
      sha256Stable(without(active, 'activeAuthorityHash')) !== input.expectedActiveAuthorityHash
    ) {
      throw new Error('goal_binding_refresh_active_authority_cas_mismatch');
    }
    verifyInputs(active, input);
    const currentBindingRef = active.sourceBindingRef as JsonObject;
    const fromGoalSourceBindingHash = text(currentBindingRef?.hash);
    const toGoalSourceBindingHash = text(input.sourceBinding.goalSourceBindingHash);
    if (fromGoalSourceBindingHash === toGoalSourceBindingHash) {
      throw new Error('goal_binding_refresh_no_change');
    }
    const bindingDirectory = path.join(
      outRoot,
      'goal',
      'bindings',
      toGoalSourceBindingHash.slice('sha256:'.length)
    );
    const bindingPath = path.join(bindingDirectory, 'goal-source-binding.json');
    const evidenceIndexPath = path.join(bindingDirectory, 'resolved-evidence-index.json');
    publishImmutable(bindingPath, input.sourceBinding);
    publishImmutable(evidenceIndexPath, input.resolvedEvidenceIndex);
    const receiptPayload = {
      schemaVersion: 'GoalContractSourceBindingRefreshReceipt/v1',
      profile: text(active.profile),
      goalExecutionIRHash: text(active.goalExecutionIRHash),
      fromGoalSourceBindingHash,
      toGoalSourceBindingHash,
      toResolvedEvidenceIndexHash: text(input.resolvedEvidenceIndex.resolvedEvidenceIndexHash),
      decision: 'binding_only_refreshed',
      semanticCompileCount: 0,
      judgeDispatchCount: 0,
    };
    const receipt = {
      ...receiptPayload,
      refreshReceiptHash: sha256Stable(receiptPayload),
    };
    validateGoalContractSchema('goal-contract-source-binding-refresh-receipt.schema.json', receipt);
    const receiptPath = path.join(
      outRoot,
      'goal',
      'binding-refreshes',
      toGoalSourceBindingHash.slice('sha256:'.length),
      'refresh-receipt.json'
    );
    publishImmutable(receiptPath, receipt);
    const activePayload = {
      ...without(active, 'activeAuthorityHash'),
      sourceBindingRef: {
        path: path.relative(outRoot, bindingPath).replace(/\\/gu, '/'),
        hash: toGoalSourceBindingHash,
      },
      resolvedEvidenceIndexRef: {
        path: path.relative(outRoot, evidenceIndexPath).replace(/\\/gu, '/'),
        hash: text(input.resolvedEvidenceIndex.resolvedEvidenceIndexHash),
      },
    };
    const nextActive = {
      ...activePayload,
      activeAuthorityHash: sha256Stable(activePayload),
    };
    validateGoalContractSchema('goal-contract-active-authority.schema.json', nextActive);
    const temporaryPath = `${activePath}.candidate-${process.pid}`;
    fs.writeFileSync(temporaryPath, canonicalBytes(nextActive), { flag: 'wx' });
    fs.renameSync(temporaryPath, activePath);
    const readback = readJson(activePath);
    validateGoalContractSchema('goal-contract-active-authority.schema.json', readback);
    if (text(readback.activeAuthorityHash) !== nextActive.activeAuthorityHash) {
      throw new Error('goal_binding_refresh_active_authority_readback_failed');
    }
    return Object.freeze({
      ...receipt,
      sourceBindingRef: { path: bindingPath, hash: toGoalSourceBindingHash },
      resolvedEvidenceIndexRef: {
        path: evidenceIndexPath,
        hash: text(input.resolvedEvidenceIndex.resolvedEvidenceIndexHash),
      },
      refreshReceiptRef: { path: receiptPath, hash: receipt.refreshReceiptHash },
      activeAuthorityRef: { path: activePath, hash: nextActive.activeAuthorityHash },
    });
  } finally {
    fs.closeSync(lock!);
    fs.rmSync(lockPath, { force: true });
  }
}
