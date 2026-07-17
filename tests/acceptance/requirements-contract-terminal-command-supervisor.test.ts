import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractTerminalCommandSupervisorCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-terminal-command-supervisor';
import {
  createTerminalCloseoutFixture,
  terminalCommandIds,
} from './helpers/requirements-contract-terminal-closeout-fixture';

const sha256 = (value: string) =>
  `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;

function write(root: string, relativePath: string, value: string) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
  return sha256(value);
}

describe('requirements contract terminal command supervisor', () => {
  it('binds the three-target closure and runs the schema-owned commands without mutating the bundle', async () => {
    const fixture = createTerminalCloseoutFixture();
    const root = fixture.root;
    const base = 'docs/plans/evidence/loop-engineering-remediation';
    const requirementSetId = `req-${randomUUID()}`;
    const implementationAttemptId = fixture.bundle.implementationAttemptId;
    const declarationHash = sha256('declaration');
    const commandIds = terminalCommandIds();
    const recordPath =
      `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
    try {
      rmSync(path.join(root, fixture.terminalReceiptPath), { force: true });
      const recordHash = write(root, recordPath, '{"schemaVersion":"requirement-record/v1"}\n');
      const contractPath = fixture.contractPath;
      const contractText = [
        `| ${commandIds[0]} | \`node -e "require('fs').appendFileSync('terminal-order.txt','${commandIds[0]}\\n')"\` | Repository root | pass | AC-01 |`,
        `| ${commandIds[1]} | \`node -e "require('fs').appendFileSync('terminal-order.txt','${commandIds[1]}\\n')"\` | Repository root | pass | AC-01 |`,
        '',
      ].join('\n');
      fixture.bundle.contractHash = write(root, contractPath, contractText);
      write(root, fixture.bundlePath, `${JSON.stringify(fixture.bundle)}\n`);
      const roles = [
        [
          'AMEND05-SAFE-WRITE-MANIFEST',
          'amend05-safe-write-manifest',
          `${base}/amend05-safe-write-receipt-manifest.json`,
          `${base}/finalization-receipts/amend05-safe-write-receipt-manifest.receipt.json`,
          'not_applicable',
        ],
        [
          'EVD-15',
          'goal-task-evidence',
          `${base}/G15-final-gates.json`,
          `${base}/finalization-receipts/G15-final-gates.receipt.json`,
          `${base}/finalization-receipts/amend05-safe-write-receipt-manifest.receipt.json`,
        ],
        [
          'ARTIFACT-01',
          'implementation-evidence-bundle',
          `${base}/implementation-evidence.json`,
          `${base}/finalization-receipts/implementation-evidence.receipt.json`,
          `${base}/finalization-receipts/G15-final-gates.receipt.json`,
        ],
      ] as const;
      let predecessor: { path: string; hash: string; artifactRole: string } | null = null;
      for (const [artifactRole, validationProfile, targetPath, receiptPath, expected] of roles) {
        const targetText =
          targetPath === fixture.bundlePath
            ? readFileSync(path.join(root, targetPath), 'utf8')
            : `${JSON.stringify({ schemaVersion: `${artifactRole}/v1`, decision: 'PASS' })}\n`;
        const targetHash =
          targetPath === fixture.bundlePath
            ? sha256(targetText)
            : write(root, targetPath, targetText);
        const receipt = {
          schemaVersion: 'requirements-contract-finalization-safe-write-receipt/v1',
          commandId: 'requirements-contract-finalization-safe-write',
          finalizationRunId: `FINALIZATION-RUN-${randomUUID().toUpperCase()}`,
          requirementRecord: { path: recordPath, hash: recordHash },
          implementationAttemptId,
          exactArgv: ['node', artifactRole],
          argvHash: sha256(artifactRole),
          artifactRole,
          validationProfile,
          finalizationDeclarationHash: declarationHash,
          predecessor: predecessor
            ? { applicable: true, expectedReceiptPath: expected, receipt: predecessor }
            : { applicable: false, expectedReceiptPath: 'not_applicable' },
          target: {
            path: targetPath,
            requiredSchemaVersion: `${artifactRole}/v1`,
            requiredSchemaHash: sha256('schema'),
            minBytes: 2,
            targetExistedBefore: false,
            previousHash: null,
            promotedHash: targetHash,
            readbackHash: targetHash,
          },
          draft: { path: `${base}/.finalization-staging/${artifactRole}.json`, hash: targetHash, bytes: targetText.length },
          writerIdentity: 'requirements-contract-finalization-safe-writer/v1',
          result: 'PASS',
          selectedReceiptPath: receiptPath,
        };
        const serialized = `${JSON.stringify(receipt)}\n`;
        const receiptHash = write(root, receiptPath, serialized);
        predecessor = { path: receiptPath, hash: receiptHash, artifactRole };
      }
      const bundlePath = roles[2][2];
      const bundleHash = sha256(readFileSync(path.join(root, bundlePath), 'utf8'));
      const receipt = await requirementsContractTerminalCommandSupervisorCommand({
        cwd: root,
        contract: contractPath,
        bundle: bundlePath,
        safeWriteManifestReceipt: roles[0][3],
        evd15Receipt: roles[1][3],
        artifact01Receipt: roles[2][3],
        receipt: `${base}/terminal-command-receipt.json`,
        firstCommand: commandIds[0],
        secondCommand: commandIds[1],
        json: false,
      });

      expect(receipt.result).toBe('PASS');
      expect(readFileSync(path.join(root, 'terminal-order.txt'), 'utf8')).toBe(
        `${commandIds.join('\n')}\n`
      );
      expect(sha256(readFileSync(path.join(root, bundlePath), 'utf8'))).toBe(bundleHash);
      expect(existsSync(path.join(root, `${base}/terminal-command-receipt.json`))).toBe(true);
      expect(existsSync(path.join(root, fixture.packetPath))).toBe(true);
      expect(existsSync(path.join(root, fixture.readbackReceiptPath))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
