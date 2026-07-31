import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
  text,
  uniqueSorted,
} from './requirements-contract-verification-evidence-normalizer';
import type { RequirementsContractDirtyBaselineManifest } from './requirements-contract-remediation-baseline';

export interface RequirementsContractRemediationWorkspaceReceipt {
  schemaVersion: 'requirements-contract-remediation-workspace-receipt/v1';
  campaignId: string;
  campaignLineageKey: string;
  baselineManifestHash: string;
  workspaceRoot: string;
  isolated: true;
  governedByteParity: {
    reproducedPathHashes: string[];
    decision: 'pass';
  };
  userChangePreservationProof: {
    untouchedUnrelatedPathHashes: string[];
    decision: 'pass';
  };
  hostOperationSafety: {
    staged: false;
    committed: false;
    reset: false;
    overwrittenUserChanges: false;
  };
  decision: 'pass';
  workspaceReceiptHash: string;
}

export class RequirementsContractRemediationWorkspaceError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractRemediationWorkspaceError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractRemediationWorkspaceError(code);
}

function rejectUnsafePath(pathValue: string): string {
  const normalized = pathValue.replace(/\\/gu, '/').trim();
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-z]:/iu.test(normalized) ||
    normalized.split('/').includes('..') ||
    /[*?[\]{}]/u.test(normalized)
  ) {
    fail('remediation_workspace_path_escape');
  }
  return normalized;
}

function requireBaseline(value: unknown): RequirementsContractDirtyBaselineManifest {
  if (!isRecord(value)) fail('remediation_workspace_baseline_invalid');
  const baseline = value as unknown as RequirementsContractDirtyBaselineManifest;
  if (
    baseline.schemaVersion !== 'requirements-contract-dirty-baseline-manifest/v1' ||
    baseline.decision !== 'pass'
  ) {
    fail('remediation_workspace_baseline_invalid');
  }
  return baseline;
}

function requireHostOperations(
  value: unknown
): RequirementsContractRemediationWorkspaceReceipt['hostOperationSafety'] {
  if (!isRecord(value)) fail('remediation_workspace_host_operation_forbidden');
  const staged = value.staged === true;
  const committed = value.committed === true;
  const reset = value.reset === true;
  const overwrittenUserChanges = value.overwrittenUserChanges === true;
  if (staged || committed || reset || overwrittenUserChanges) {
    fail('remediation_workspace_host_operation_forbidden');
  }
  return {
    staged: false,
    committed: false,
    reset: false,
    overwrittenUserChanges: false,
  };
}

function reproducedRecords(value: unknown) {
  const records = Array.isArray(value) ? value : [];
  return records
    .map((record) => {
      if (!isRecord(record)) fail('remediation_workspace_reproduced_record_invalid');
      return {
        path: rejectUnsafePath(requireText(record, 'path', 'remediation_workspace_path_escape')),
        reproducedHash: requireHash(
          record,
          'reproducedHash',
          'remediation_workspace_reproduced_record_invalid'
        ),
        mode: requireText(record, 'mode', 'remediation_workspace_reproduced_record_invalid'),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function prepareRequirementsContractRemediationWorkspace(
  input: unknown
): RequirementsContractRemediationWorkspaceReceipt {
  if (!isRecord(input)) fail('remediation_workspace_input_invalid');
  const baseline = requireBaseline(input.baselineManifest);
  const workspaceRoot = rejectUnsafePath(
    requireText(input, 'workspaceRoot', 'remediation_workspace_path_escape')
  );
  const reproduced = reproducedRecords(input.reproducedBytes);
  const expectedByPath = new Map(
    baseline.governedWorkingBytes.map((entry) => [
      entry.path,
      { workingHash: entry.workingHash, mode: entry.mode },
    ])
  );
  for (const record of reproduced) {
    const expected = expectedByPath.get(record.path);
    if (!expected) fail('remediation_workspace_unknown_path');
    if (expected.workingHash !== record.reproducedHash || expected.mode !== record.mode) {
      fail('remediation_workspace_baseline_mismatch');
    }
  }
  if (reproduced.length !== expectedByPath.size) fail('remediation_workspace_baseline_mismatch');
  const untouchedUnrelatedPathHashes = uniqueSorted(
    Array.isArray(input.untouchedUnrelatedPathHashes)
      ? input.untouchedUnrelatedPathHashes.map((hashValue) =>
          requireHash({ hashValue }, 'hashValue', 'remediation_workspace_user_change_modified')
        )
      : []
  );
  if (
    JSON.stringify(untouchedUnrelatedPathHashes) !==
    JSON.stringify(baseline.userChangePreservationProof.untouchedUnrelatedPathHashes)
  ) {
    fail('remediation_workspace_user_change_modified');
  }
  const payload = {
    schemaVersion: 'requirements-contract-remediation-workspace-receipt/v1' as const,
    campaignId: baseline.campaignId,
    campaignLineageKey: baseline.campaignLineageKey,
    baselineManifestHash: baseline.baselineManifestHash,
    workspaceRoot,
    isolated: true as const,
    governedByteParity: {
      reproducedPathHashes: reproduced.map((record) =>
        stableHash({ path: record.path, reproducedHash: record.reproducedHash, mode: record.mode })
      ),
      decision: 'pass' as const,
    },
    userChangePreservationProof: {
      untouchedUnrelatedPathHashes,
      decision: 'pass' as const,
    },
    hostOperationSafety: requireHostOperations(input.hostOperations),
    decision: 'pass' as const,
  };
  return { ...payload, workspaceReceiptHash: stableHash(payload) };
}

export function validateRequirementsContractRemediationWorkspaceReceipt(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractRemediationWorkspaceReceipt {
  if (!isRecord(value) || !isRecord(currentAuthority))
    fail('remediation_workspace_receipt_invalid');
  const receipt = value as unknown as RequirementsContractRemediationWorkspaceReceipt;
  const { workspaceReceiptHash, ...payload } = receipt;
  if (workspaceReceiptHash !== stableHash(payload)) {
    fail('remediation_workspace_receipt_hash_mismatch');
  }
  if (
    receipt.schemaVersion !== 'requirements-contract-remediation-workspace-receipt/v1' ||
    receipt.decision !== 'pass' ||
    receipt.isolated !== true
  ) {
    fail('remediation_workspace_receipt_invalid');
  }
  for (const field of [
    'campaignId',
    'campaignLineageKey',
    'baselineManifestHash',
    'workspaceReceiptHash',
  ] as const) {
    if (text(receipt[field]) !== text(currentAuthority[field])) {
      fail('remediation_workspace_receipt_stale');
    }
  }
  return receipt;
}
