import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainDeliveryCloseoutGate } from '../../scripts/main-agent-delivery-closeout-gate';

const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function writeRecord(root: string, record: Record<string, unknown>): string {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-CLOSEOUT');
  mkdirSync(base, { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return recordPath;
}

function baseRecord(): Record<string, unknown> {
  return {
    recordId: 'REQ-CLOSEOUT',
    requirementSetId: 'REQ-CLOSEOUT',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: HASH,
    },
    artifactIndex: [
      {
        path: '_bmad-output/runtime/requirement-records/REQ-CLOSEOUT/execution/evidence.json',
        contentHash: HASH,
      },
    ],
  };
}

describe('requirement-scoped delivery closeout gate', () => {
  it('creates a blocked immutable attempt when required commands are missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-missing-'));
    try {
      const recordPath = writeRecord(root, baseRecord());
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-001',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.currentAttemptId).toBe('closeout-001');
      expect(record.closeout.decision).toBe('blocked');
      expect(record.closeout.attempts).toHaveLength(1);
      expect(record.closeout.attempts[0].blockingReasons).toContain(
        'deliveryEvidence.requiredCommands_missing'
      );
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Delivery Closeout Gate',
        decision: 'blocked',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes only when current attempt required commands, artifacts, and closures are satisfied', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-pass-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-DELIVERY',
              blockingIfMissing: true,
              negativeOrRegression: true,
              artifactRefs: [
                {
                  path: '_bmad-output/runtime/requirement-records/REQ-CLOSEOUT/execution/evidence.json',
                  hash: HASH,
                },
              ],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-001',
            commandRunRefs: [
              {
                commandId: 'CMD-DELIVERY',
                closeoutAttemptId: 'closeout-pass',
                exitCode: 0,
              },
            ],
          },
        ],
        requirementClosures: [{ requirementId: 'MUST-001', status: 'pass' }],
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-pass',
        '--evaluated-at',
        '2026-05-19T00:00:00.000Z',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.currentAttemptId).toBe('closeout-pass');
      expect(record.closeout.decision).toBe('pass');
      expect(record.closeout.attempts[0]).toMatchObject({
        closeoutAttemptId: 'closeout-pass',
        decision: 'pass',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects attempts that would overwrite an existing closeout attempt', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-duplicate-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        closeout: {
          currentAttemptId: 'closeout-001',
          attempts: [{ closeoutAttemptId: 'closeout-001', decision: 'blocked' }],
        },
      });
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-001',
      ]);
      expect(code).toBe(2);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts).toHaveLength(1);
      expect(record.closeout.attempts[0].decision).toBe('blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
