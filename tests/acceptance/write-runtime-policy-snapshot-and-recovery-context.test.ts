import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainWriteRuntimePolicySnapshotAndRecoveryContext } from '../../scripts/write-runtime-policy-snapshot-and-recovery-context';

function writeFixture(root: string): void {
  cpSync(path.join(process.cwd(), '_bmad'), path.join(root, '_bmad'), { recursive: true });
  const requirementSetId = 'REQ-RUNTIME-WRITER';
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', requirementSetId);
  mkdirSync(path.join(base, 'recovery'), { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: requirementSetId,
        requirementSetId,
        status: 'user_confirmed',
        entryFlow: 'standalone_tasks',
        entryFlowClass: 'task_packet_entry',
        workflowAdapter: 'direct',
        sourcePath: 'docs/design/example.md',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash:
            'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        },
        runtimePolicySnapshotRef: {
          path: `_bmad-output/runtime/requirement-records/${requirementSetId}/recovery/runtime-policy-snapshot.json`,
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const indexPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
  mkdirSync(path.dirname(indexPath), { recursive: true });
  writeFileSync(
    indexPath,
    `${JSON.stringify(
      {
        version: 1,
        active: { recordId: requirementSetId, requirementSetId },
        records: [
          {
            recordId: requirementSetId,
            requirementSetId,
            recordPath: path.relative(root, recordPath).replace(/\\/g, '/'),
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const seedSnapshot = {
    kind: 'runtime-policy-snapshot',
    schemaVersion: 'runtime-policy-snapshot/v1',
    flow: 'standalone_tasks',
    stage: 'implement',
    policy: { flow: 'standalone_tasks', stage: 'implement' },
  };
  writeFileSync(
    path.join(base, 'recovery', 'runtime-policy-snapshot.json'),
    `${JSON.stringify(seedSnapshot, null, 2)}\n`,
    'utf8'
  );
}

describe('write-runtime-policy-snapshot-and-recovery-context', () => {
  it('writes requirement-scoped runtime policy snapshot and recovery context', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-policy-writer-'));
    try {
      writeFixture(root);
      const code = mainWriteRuntimePolicySnapshotAndRecoveryContext([
        '--cwd',
        root,
        '--record-id',
        'REQ-RUNTIME-WRITER',
        '--requirement-set-id',
        'REQ-RUNTIME-WRITER',
        '--locale',
        'zh-CN',
        '--host',
        'codex',
        '--json',
      ]);

      expect(code).toBe(0);
      const snapshotPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-RUNTIME-WRITER',
        'recovery',
        'runtime-policy-snapshot.json'
      );
      const recoveryPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-RUNTIME-WRITER',
        'recovery',
        'recovery-context.json'
      );
      expect(existsSync(snapshotPath)).toBe(true);
      expect(existsSync(recoveryPath)).toBe(true);
      const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
      expect(snapshot).toMatchObject({
        kind: 'runtime-policy-snapshot',
        schemaVersion: 'runtime-policy-snapshot/v1',
        recordId: 'REQ-RUNTIME-WRITER',
        requirementSetId: 'REQ-RUNTIME-WRITER',
        locale: 'zh-CN',
        host: 'codex',
        stage: 'implement',
        strictness: 'strict',
      });
      expect(snapshot.policyHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(snapshot.localeIsolation).toMatchObject({
        localeAffectsConfirmationLanguage: false,
        localeAffectsRequirementSemantics: false,
        localeAffectsPassEvidence: false,
        localeAffectsCloseout: false,
      });
      const recovery = JSON.parse(readFileSync(recoveryPath, 'utf8'));
      expect(recovery).toMatchObject({
        kind: 'recovery-context',
        schemaVersion: 'recovery-context/v1',
        controlSource: 'requirement-record.json',
        legacyRuntimeContextAllowed: false,
      });
      expect(recovery.runtimePolicySnapshotRef.sourceOfTruthRole).toBe('projection');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
