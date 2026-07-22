import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PACKAGE_CLI = path.join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');

function sha256(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function fileHash(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function sourceSnapshotHash(relativePaths: string[]): string {
  return sha256(
    [...relativePaths]
      .sort()
      .map((relativePath) => `${relativePath}:${fileHash(path.join(ROOT, relativePath))}`)
      .join('\n')
  );
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('requirements contract clean materialization', () => {
  it(
    'rebuilds current source in a root without stale dist, node_modules, or receipts',
    () => {
      const identity = crypto.randomUUID().replace(/-/gu, '');
      const evidenceRoot = path.join(
        ROOT,
        '.codex-tmp',
        'goal-gap-remediation',
        `clean-materialization-${identity}`
      );
      const tempParent = mkdtempSync(path.join(os.tmpdir(), 'clean-materialization-'));
      const materializationRoot = path.join(tempParent, 'workspace');
      const requestPath = path.join(evidenceRoot, 'request.json');
      const receiptPath = path.join(evidenceRoot, 'receipt.json');
      const sourceSnapshotPaths = [
        'packages/bmad-speckit/bin/bmad-speckit.js',
      ];
      try {
        writeJson(requestPath, {
          schemaVersion: 'requirements-contract-clean-materialization-input/v1',
          materializationRunId: `RUN-${identity}`,
          materializationRoot,
          receiptPath,
          sourceSnapshotPaths,
          sourceSnapshotHash: sourceSnapshotHash(sourceSnapshotPaths),
          requirementSetId: `REQSET-${identity}`,
          requirementRefs: [`REQ-${identity}`],
          transactionId: `TX-${identity}`,
          implementationAttemptId: `IMPL-ATTEMPT-${identity.toUpperCase()}`,
          architectureAuditAttemptId: `AUDIT-${identity}`,
          activePhaseAuditAttemptId: `AUDIT-${identity}`,
          contractHash: sha256(`contract-${identity}`),
          acceptanceRefs: [`AC-${identity}`],
          traceRefs: [`TR-${identity}`],
        });

        const execution = spawnSync(
          process.execPath,
          [
            PACKAGE_CLI,
            'requirements-contract-clean-materialization',
            '--project-root',
            ROOT,
            '--request',
            requestPath,
            '--json',
          ],
          {
            cwd: ROOT,
            encoding: 'utf8',
            timeout: 540_000,
            maxBuffer: 64 * 1024 * 1024,
          }
        );

        expect(execution.status, `${execution.stdout}\n${execution.stderr}`).toBe(0);
        expect(existsSync(receiptPath)).toBe(true);
        const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<
          string,
          unknown
        >;
        expect(receipt).toMatchObject({
          schemaVersion: 'requirements-contract-clean-materialization-receipt/v1',
          materializationRunId: `RUN-${identity}`,
          sourceSnapshotHash: sourceSnapshotHash(sourceSnapshotPaths),
          sourceWasCleanOfBuildOutputs: true,
          decision: 'pass',
        });
        expect(String(receipt.installReceiptHash)).toMatch(/^sha256:[a-f0-9]{64}$/u);
        expect(String(receipt.buildReceiptHash)).toMatch(/^sha256:[a-f0-9]{64}$/u);
        expect(String(receipt.runtimeBuildAuthorityReceiptHash)).toMatch(
          /^sha256:[a-f0-9]{64}$/u
        );
      } finally {
        rmSync(evidenceRoot, { recursive: true, force: true });
        rmSync(tempParent, { recursive: true, force: true });
      }
    },
    600_000
  );
});
