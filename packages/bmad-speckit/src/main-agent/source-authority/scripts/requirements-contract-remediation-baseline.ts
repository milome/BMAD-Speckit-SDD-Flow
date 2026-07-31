import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  stableHash,
  text,
  uniqueSorted,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';

const DIRTY_STATUSES = [
  'modified',
  'untracked',
  'deleted',
  'renamed',
  'symlink',
  'submodule',
] as const;

export interface RequirementsContractDirtyByteRecord {
  path: string;
  status: (typeof DIRTY_STATUSES)[number];
  mode: string;
  headHash?: string;
  workingHash: string;
}

export interface RequirementsContractDirtyBaselineManifest {
  schemaVersion: 'requirements-contract-dirty-baseline-manifest/v1';
  campaignId: string;
  campaignLineageKey: string;
  repairTransactionManifestHash: string;
  headTreeHash: string;
  indexHash: string;
  governedWorkingBytes: RequirementsContractDirtyByteRecord[];
  renameRecords: Array<{ fromPath: string; toPath: string; fromHash: string; toHash: string }>;
  deletionRecords: Array<{ path: string; headHash: string }>;
  symlinkRecords: Array<{ path: string; target: string; linkHash: string }>;
  submoduleRecords: Array<{ path: string; commitHash: string }>;
  governedByteManifestHash: string;
  userChangePreservationProof: {
    untouchedUnrelatedPathHashes: string[];
    decision: 'pass';
  };
  gitOperationSafety: {
    stage: false;
    commit: false;
    reset: false;
    overwriteUserChanges: false;
  };
  decision: 'pass';
  baselineManifestHash: string;
}

export class RequirementsContractRemediationBaselineError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractRemediationBaselineError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractRemediationBaselineError(code);
}

function rejectUnsafePath(
  pathValue: string,
  pathKind = 'remediation_baseline_path_escape'
): string {
  const normalized = pathValue.replace(/\\/gu, '/').trim();
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-z]:/iu.test(normalized) ||
    normalized.split('/').includes('..')
  ) {
    fail(pathKind);
  }
  if (/[*?[\]{}]/u.test(normalized)) fail('remediation_baseline_mutable_glob_forbidden');
  return normalized;
}

function authorizedPathsFromRepairManifest(manifest: JsonRecord): string[] {
  const units = Array.isArray(manifest.repairUnits) ? manifest.repairUnits : [];
  const paths = units.flatMap((unit) =>
    isRecord(unit)
      ? requireNonEmptyUniqueStrings(unit.authorizedPaths, 'remediation_baseline_scope_missing')
      : []
  );
  return uniqueSorted(paths.map((entry) => rejectUnsafePath(entry)));
}

function requireRepairManifest(value: unknown): JsonRecord {
  if (!isRecord(value) || value.decision !== 'pass')
    fail('remediation_baseline_repair_manifest_invalid');
  return value;
}

function requireGitOperationSafety(
  value: unknown
): RequirementsContractDirtyBaselineManifest['gitOperationSafety'] {
  if (!isRecord(value)) fail('remediation_baseline_git_operation_forbidden');
  const safety = {
    stage: value.stage === true,
    commit: value.commit === true,
    reset: value.reset === true,
    overwriteUserChanges: value.overwriteUserChanges === true,
  };
  if (safety.stage || safety.commit || safety.reset || safety.overwriteUserChanges) {
    fail('remediation_baseline_git_operation_forbidden');
  }
  return {
    stage: false,
    commit: false,
    reset: false,
    overwriteUserChanges: false,
  };
}

function requireDirtyRecord(value: unknown): RequirementsContractDirtyByteRecord {
  if (!isRecord(value)) fail('remediation_baseline_dirty_record_invalid');
  const status = text(value.status);
  if (!DIRTY_STATUSES.includes(status as RequirementsContractDirtyByteRecord['status'])) {
    fail('remediation_baseline_dirty_record_invalid');
  }
  const record: RequirementsContractDirtyByteRecord = {
    path: rejectUnsafePath(requireText(value, 'path', 'remediation_baseline_path_escape')),
    status: status as RequirementsContractDirtyByteRecord['status'],
    mode: requireText(value, 'mode', 'remediation_baseline_dirty_record_invalid'),
    workingHash: requireHash(value, 'workingHash', 'remediation_baseline_dirty_record_invalid'),
  };
  if (value.headHash !== undefined) {
    record.headHash = requireHash(value, 'headHash', 'remediation_baseline_dirty_record_invalid');
  }
  return record;
}

function requireRename(value: unknown) {
  if (!isRecord(value)) fail('remediation_baseline_rename_invalid');
  return {
    fromPath: rejectUnsafePath(requireText(value, 'fromPath', 'remediation_baseline_path_escape')),
    toPath: rejectUnsafePath(requireText(value, 'toPath', 'remediation_baseline_path_escape')),
    fromHash: requireHash(value, 'fromHash', 'remediation_baseline_rename_invalid'),
    toHash: requireHash(value, 'toHash', 'remediation_baseline_rename_invalid'),
  };
}

function requireDeletion(value: unknown) {
  if (!isRecord(value)) fail('remediation_baseline_deletion_invalid');
  return {
    path: rejectUnsafePath(requireText(value, 'path', 'remediation_baseline_path_escape')),
    headHash: requireHash(value, 'headHash', 'remediation_baseline_deletion_invalid'),
  };
}

function requireSymlink(value: unknown) {
  if (!isRecord(value)) fail('remediation_baseline_symlink_invalid');
  const path = rejectUnsafePath(requireText(value, 'path', 'remediation_baseline_path_escape'));
  const target = rejectUnsafePath(
    requireText(value, 'target', 'remediation_baseline_symlink_escape'),
    'remediation_baseline_symlink_escape'
  );
  return {
    path,
    target,
    linkHash: requireHash(value, 'linkHash', 'remediation_baseline_symlink_invalid'),
  };
}

function requireSubmodule(value: unknown) {
  if (!isRecord(value)) fail('remediation_baseline_submodule_invalid');
  return {
    path: rejectUnsafePath(requireText(value, 'path', 'remediation_baseline_path_escape')),
    commitHash: requireHash(value, 'commitHash', 'remediation_baseline_submodule_invalid'),
  };
}

function unrelatedDirtyHashes(value: unknown): string[] {
  const records = Array.isArray(value) ? value : [];
  return uniqueSorted(
    records.map((record) =>
      isRecord(record)
        ? requireHash(record, 'workingHash', 'remediation_baseline_unrelated_dirty_invalid')
        : fail('remediation_baseline_unrelated_dirty_invalid')
    )
  );
}

export function compileRequirementsContractDirtyBaselineManifest(
  input: unknown
): RequirementsContractDirtyBaselineManifest {
  if (!isRecord(input)) fail('remediation_baseline_input_invalid');
  const repairManifest = requireRepairManifest(input.repairTransactionManifest);
  const authorizedPaths = new Set(authorizedPathsFromRepairManifest(repairManifest));
  const governedWorkingBytes = (
    Array.isArray(input.governedWorkingBytes) ? input.governedWorkingBytes : []
  )
    .map(requireDirtyRecord)
    .sort((left, right) => left.path.localeCompare(right.path));
  if (governedWorkingBytes.length === 0) fail('remediation_baseline_governed_bytes_missing');
  const unrelatedPaths = new Set(
    (Array.isArray(input.unrelatedDirtyFiles) ? input.unrelatedDirtyFiles : [])
      .filter(isRecord)
      .map((record) =>
        rejectUnsafePath(requireText(record, 'path', 'remediation_baseline_path_escape'))
      )
  );
  for (const entry of governedWorkingBytes) {
    if (unrelatedPaths.has(entry.path)) fail('remediation_baseline_unrelated_dirty_capture');
    if (entry.status === 'untracked' && !authorizedPaths.has(entry.path)) {
      fail('remediation_baseline_unknown_untracked');
    }
    if (!authorizedPaths.has(entry.path)) fail('remediation_baseline_unrelated_dirty_capture');
  }
  const headTreeHash = requireHash(input, 'headTreeHash', 'remediation_baseline_mismatch');
  const currentAuthority = isRecord(input.currentAuthority) ? input.currentAuthority : {};
  if (
    currentAuthority.headTreeHash !== undefined &&
    currentAuthority.headTreeHash !== headTreeHash
  ) {
    fail('remediation_baseline_mismatch');
  }
  const payload = {
    schemaVersion: 'requirements-contract-dirty-baseline-manifest/v1' as const,
    campaignId: requireText(input, 'campaignId', 'remediation_baseline_identity_invalid'),
    campaignLineageKey: requireHash(
      input,
      'campaignLineageKey',
      'remediation_baseline_identity_invalid'
    ),
    repairTransactionManifestHash: requireHash(
      repairManifest,
      'manifestHash',
      'remediation_baseline_repair_manifest_invalid'
    ),
    headTreeHash,
    indexHash: requireHash(input, 'indexHash', 'remediation_baseline_mismatch'),
    governedWorkingBytes,
    renameRecords: (Array.isArray(input.renameRecords) ? input.renameRecords : [])
      .map(requireRename)
      .sort((left, right) => left.toPath.localeCompare(right.toPath)),
    deletionRecords: (Array.isArray(input.deletionRecords) ? input.deletionRecords : [])
      .map(requireDeletion)
      .sort((left, right) => left.path.localeCompare(right.path)),
    symlinkRecords: (Array.isArray(input.symlinkRecords) ? input.symlinkRecords : [])
      .map(requireSymlink)
      .sort((left, right) => left.path.localeCompare(right.path)),
    submoduleRecords: (Array.isArray(input.submoduleRecords) ? input.submoduleRecords : [])
      .map(requireSubmodule)
      .sort((left, right) => left.path.localeCompare(right.path)),
    governedByteManifestHash: stableHash({ governedWorkingBytes }),
    userChangePreservationProof: {
      untouchedUnrelatedPathHashes: unrelatedDirtyHashes(input.unrelatedDirtyFiles),
      decision: 'pass' as const,
    },
    gitOperationSafety: requireGitOperationSafety(input.gitOperationPlan),
    decision: 'pass' as const,
  };
  return { ...payload, baselineManifestHash: stableHash(payload) };
}

export function validateRequirementsContractDirtyBaselineManifest(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractDirtyBaselineManifest {
  if (!isRecord(value) || !isRecord(currentAuthority))
    fail('remediation_baseline_manifest_invalid');
  const manifest = value as unknown as RequirementsContractDirtyBaselineManifest;
  const { baselineManifestHash, ...payload } = manifest;
  if (baselineManifestHash !== stableHash(payload)) {
    fail('remediation_baseline_manifest_hash_mismatch');
  }
  if (
    manifest.schemaVersion !== 'requirements-contract-dirty-baseline-manifest/v1' ||
    manifest.decision !== 'pass'
  ) {
    fail('remediation_baseline_manifest_invalid');
  }
  for (const field of ['campaignId', 'campaignLineageKey', 'baselineManifestHash'] as const) {
    if (text(manifest[field]) !== text(currentAuthority[field])) {
      fail('remediation_baseline_manifest_stale');
    }
  }
  return manifest;
}
