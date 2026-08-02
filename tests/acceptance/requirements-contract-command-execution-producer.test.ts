import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateRequirementsContractCommandExecutionReceiptArtifact } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-command-execution-receipt';

const PACKAGE_CLI = path.resolve(
  __dirname,
  '../../packages/bmad-speckit/bin/bmad-speckit.js'
);

function sha256(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256Stable(value: unknown): string {
  return sha256(stableStringify(value));
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('requirements contract command execution producer', () => {
  it('executes real argv through the public CLI and emits a bound receipt', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'command-execution-producer-'));
    try {
      const identity = crypto.randomUUID().replace(/-/gu, '');
      const observedOutput = crypto.randomUUID();
      const evidenceRoot = path.join(root, 'evidence', identity);
      const requestPath = path.join(evidenceRoot, 'request.json');
      const stdoutPath = path.join(evidenceRoot, 'stdout.log');
      const stderrPath = path.join(evidenceRoot, 'stderr.log');
      const receiptPath = path.join(evidenceRoot, 'receipt.json');
      const argv = [
        process.execPath,
        '-e',
        `process.stdout.write(${JSON.stringify(observedOutput)})`,
      ];
      writeJson(requestPath, {
        schemaVersion: 'requirements-contract-command-execution-producer-input/v1',
        commandRunId: `RUN-${identity}`,
        commandId: `CMD-${identity}`,
        argv,
        cwd: root,
        stdoutPath,
        stderrPath,
        receiptPath,
        requirementSetId: `REQSET-${identity}`,
        requirementRefs: [`REQ-${identity}`],
        transactionId: `TX-${identity}`,
        implementationAttemptId: `IMPL-ATTEMPT-${identity.toUpperCase()}`,
        architectureAuditAttemptId: `AUDIT-${identity}`,
        activePhaseAuditAttemptId: `AUDIT-${identity}`,
        contractHash: sha256(`contract-${identity}`),
        inputSnapshotHash: sha256(`snapshot-${identity}`),
        acceptanceRefs: [`AC-${identity}`],
        traceRefs: [`TR-${identity}`],
      });

      const execution = spawnSync(
        process.execPath,
        [
          PACKAGE_CLI,
          'requirements-contract-command-execution-producer',
          '--project-root',
          root,
          '--request',
          requestPath,
          '--json',
        ],
        {
          cwd: root,
          encoding: 'utf8',
        }
      );

      expect(execution.status, `${execution.stdout}\n${execution.stderr}`).toBe(0);
      expect(readFileSync(stdoutPath, 'utf8')).toBe(observedOutput);
      expect(readFileSync(stderrPath, 'utf8')).toBe('');
      const validation =
        validateRequirementsContractCommandExecutionReceiptArtifact({
          projectRoot: root,
          receiptPath,
          expectedProducer: {
            executorClass: 'controlled_detached_executor',
            executorId: 'requirements-contract-command-execution-producer/v1',
            writer: 'requirements-contract-command-execution-producer/v1',
          },
        });
      expect(validation.issueCodes).toEqual([]);
      expect(validation.receipt).toMatchObject({
        commandRunId: `RUN-${identity}`,
        commandId: `CMD-${identity}`,
        argv,
        exitCode: 0,
        decision: 'pass',
        inputSnapshotHash: sha256(`snapshot-${identity}`),
      });
      const tamperedReceipt = {
        ...validation.receipt,
        executorIdentity: {
          ...validation.receipt?.executorIdentity,
          id: `untrusted-${identity}`,
        },
      } as Record<string, unknown>;
      delete tamperedReceipt.receiptHash;
      tamperedReceipt.receiptHash = sha256Stable(tamperedReceipt);
      writeJson(receiptPath, tamperedReceipt);
      const tamperedValidation =
        validateRequirementsContractCommandExecutionReceiptArtifact({
          projectRoot: root,
          receiptPath,
          expectedProducer: {
            executorClass: 'controlled_detached_executor',
            executorId: 'requirements-contract-command-execution-producer/v1',
            writer: 'requirements-contract-command-execution-producer/v1',
          },
        });
      expect(tamperedValidation.issueCodes).toContain(
        'command_execution_receipt_producer_binding_mismatch'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
