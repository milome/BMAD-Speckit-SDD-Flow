import path from 'node:path';
import {
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';
import { validateRequirementsContractCheckpointManifest } from './requirements-contract-authoring-manifest';

export interface ActiveAuthoringAttemptPointer {
  schemaVersion: 'ActiveAuthoringAttemptPointer/v1';
  authoringAttemptId: string;
  attemptManifestPath: string;
  attemptManifestHash: string;
  latestValidPredecessorCheckpoint: string | null;
  inputManifestHash: string;
}

export const ACTIVE_AUTHORING_ATTEMPT_POINTER_OWNER =
  'requirements-contract-active-authoring-attempt-pointer.ts#ActiveAuthoringAttemptPointer/v1';
export const ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH = 'record/active-authoring-request.json';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const KEYS = [
  'schemaVersion',
  'authoringAttemptId',
  'attemptManifestPath',
  'attemptManifestHash',
  'latestValidPredecessorCheckpoint',
  'inputManifestHash',
] as const;

function canonicalRecordRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\')) return false;
  if (path.posix.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value && normalized !== '..' && !normalized.startsWith('../');
}

export function validateActiveAuthoringAttemptPointer(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['active_authoring_attempt_pointer_invalid'] };
  }
  const pointer = value as Record<string, unknown>;
  if (
    Object.keys(pointer).length !== KEYS.length ||
    Object.keys(pointer).some((key) => !KEYS.includes(key as (typeof KEYS)[number]))
  ) {
    issueCodes.push('active_authoring_attempt_pointer_unknown_field');
  }
  if (pointer.schemaVersion !== 'ActiveAuthoringAttemptPointer/v1') {
    issueCodes.push('active_authoring_attempt_pointer_schema_version_invalid');
  }
  const attemptId = String(pointer.authoringAttemptId ?? '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(attemptId)) {
    issueCodes.push('active_authoring_attempt_id_invalid');
  }
  if (!canonicalRecordRelativePath(pointer.attemptManifestPath)) {
    issueCodes.push('active_authoring_attempt_manifest_path_invalid');
  } else {
    const pattern = new RegExp(
      `^authoring/staging/${attemptId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/manifests/[0-9]+-[A-Za-z0-9._-]+\\.json$`,
      'u'
    );
    if (!pattern.test(pointer.attemptManifestPath)) {
      issueCodes.push('active_authoring_attempt_manifest_identity_mismatch');
    }
  }
  if (!SHA256.test(String(pointer.attemptManifestHash ?? ''))) {
    issueCodes.push('active_authoring_attempt_manifest_hash_invalid');
  }
  if (!SHA256.test(String(pointer.inputManifestHash ?? ''))) {
    issueCodes.push('active_authoring_attempt_input_manifest_hash_invalid');
  }
  if (
    pointer.latestValidPredecessorCheckpoint !== null &&
    (typeof pointer.latestValidPredecessorCheckpoint !== 'string' ||
      pointer.latestValidPredecessorCheckpoint.length === 0)
  ) {
    issueCodes.push('active_authoring_attempt_predecessor_invalid');
  }
  return {
    decision: issueCodes.length ? 'block' as const : 'pass' as const,
    issueCodes: [...new Set(issueCodes)].sort(),
  };
}

export function activeAuthoringAttemptPointerHash(pointer: ActiveAuthoringAttemptPointer): string {
  const validation = validateActiveAuthoringAttemptPointer(pointer);
  if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
  return requirementsContractDomainHash(
    'ActiveAuthoringAttemptPointer/v1',
    JSON.parse(canonicalRequirementsJson(pointer))
  );
}

export function publishActiveAuthoringAttemptPointer(input: {
  pointer: ActiveAuthoringAttemptPointer;
  expectedCurrentPointerHash: string | null;
  readAttemptManifest: (recordRelativePath: string) => unknown;
  compareAndSwap: (
    targetPath: typeof ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH,
    expectedCurrentPointerHash: string | null,
    pointer: ActiveAuthoringAttemptPointer,
    pointerHash: string
  ) => boolean;
}) {
  const validation = validateActiveAuthoringAttemptPointer(input.pointer);
  if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
  const manifest = input.readAttemptManifest(input.pointer.attemptManifestPath);
  const manifestValidation = validateRequirementsContractCheckpointManifest(manifest);
  if (manifestValidation.decision === 'block') throw new Error(manifestValidation.issueCodes[0]);
  const record = manifest as Record<string, unknown>;
  if (
    record.authoringAttemptId !== input.pointer.authoringAttemptId ||
    record.inputManifestHash !== input.pointer.inputManifestHash ||
    record.checkpointManifestHash !== input.pointer.attemptManifestHash
  ) {
    throw new Error('active_authoring_attempt_manifest_readback_mismatch');
  }
  const expectedPath = `authoring/staging/${record.authoringAttemptId}/manifests/${record.checkpointOrdinal}-${record.checkpointId}.json`;
  if (input.pointer.attemptManifestPath !== expectedPath) {
    throw new Error('active_authoring_attempt_manifest_path_identity_mismatch');
  }
  if (input.pointer.latestValidPredecessorCheckpoint !== record.latestValidPredecessorCheckpoint) {
    throw new Error('active_authoring_attempt_predecessor_mismatch');
  }
  const pointerHash = activeAuthoringAttemptPointerHash(input.pointer);
  if (!input.compareAndSwap(
    ACTIVE_AUTHORING_ATTEMPT_POINTER_PATH,
    input.expectedCurrentPointerHash,
    input.pointer,
    pointerHash
  )) {
    throw new Error('active_authoring_attempt_pointer_cas_conflict');
  }
  return { pointer: input.pointer, pointerHash, readbackVerified: true as const };
}
