import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_REQUIREMENTS_CONTRACT_RECORD_VERSION,
  openRequirementsContractRecord,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-record-boundary';
import {
  confirmRequirementsContractIrScope,
  refreshRequirementsContractConfirmationBinding,
  renderAndPromoteRequirementsContractConfirmation,
  stageRequirementsContractConfirmationBindingRefresh,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance';

function writeRecord(root: string, record: Record<string, unknown>): string {
  const recordPath = path.join(root, 'record', 'requirement-record.json');
  mkdirSync(path.dirname(recordPath), { recursive: true });
  writeFileSync(recordPath, `${JSON.stringify(record)}\n`, 'utf8');
  return recordPath;
}

describe('requirements authoring retired record hard cut', () => {
  it('rejects a retired top-level version without opening or modifying child artifacts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-retired-record-'));
    const sentinelPath = path.join(root, 'retired', 'must-not-open.json');
    mkdirSync(path.dirname(sentinelPath), { recursive: true });
    writeFileSync(sentinelPath, '{not-json', 'utf8');
    const before = readFileSync(sentinelPath);
    const recordPath = writeRecord(root, {
      schemaVersion: 'requirements-contract-record/v1',
      recordId: 'REQ-RETIRED',
      activeAuthority: { activeBuildManifestPath: 'retired/must-not-open.json' },
    });

    try {
      expect(() => openRequirementsContractRecord(recordPath)).toThrowError(
        expect.objectContaining({
          issueCode: 'requirements_authoring_record_version_unsupported',
          declaredVersion: 'requirements-contract-record/v1',
          currentVersion: CURRENT_REQUIREMENTS_CONTRACT_RECORD_VERSION,
        })
      );
      expect(readFileSync(sentinelPath)).toEqual(before);
      expect(existsSync(path.join(root, 'authoring'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('opens only a current v3 record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-current-record-'));
    try {
      const record = {
        schemaVersion: CURRENT_REQUIREMENTS_CONTRACT_RECORD_VERSION,
        recordId: 'REQ-CURRENT',
        lifecycle: 'audit_pending',
        confirmedScopeSemanticHash: null,
        activeAuthority: null,
      };
      const recordPath = writeRecord(root, record);
      expect(openRequirementsContractRecord(recordPath)).toEqual(record);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['render', (root: string, requestId: string) => renderAndPromoteRequirementsContractConfirmation({
      projectRoot: root, requestId, targetSource: 'docs/requirements.md',
    })],
    ['stage binding refresh', (root: string, requestId: string) => stageRequirementsContractConfirmationBindingRefresh({
      projectRoot: root, requestId, bindingRevisionId: 'BIND-RETIRED',
    })],
    ['refresh binding', (root: string, requestId: string) => refreshRequirementsContractConfirmationBinding({
      projectRoot: root, requestId,
    })],
    ['confirm', (root: string, requestId: string) => confirmRequirementsContractIrScope({
      projectRoot: root, requestId, exactConfirmationText: 'not-used',
    })],
  ])('rejects a retired record at the %s public boundary before nested reads', (_label, invoke) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-retired-confirmation-'));
    const requestId = 'REQ-RETIRED-CONFIRMATION';
    const recordRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records', requestId);
    const sentinelPath = path.join(recordRoot, 'retired', 'must-not-open.json');
    mkdirSync(path.dirname(sentinelPath), { recursive: true });
    writeFileSync(sentinelPath, '{not-json', 'utf8');
    const before = readFileSync(sentinelPath);
    writeRecord(recordRoot, {
      schemaVersion: 'requirements-contract-record/v1',
      recordId: requestId,
      lifecycle: 'user_confirmable',
      activeAuthority: { activeBuildManifestPath: 'retired/must-not-open.json' },
    });
    try {
      expect(() => invoke(root, requestId)).toThrow('requirements_authoring_record_version_unsupported');
      expect(readFileSync(sentinelPath)).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
