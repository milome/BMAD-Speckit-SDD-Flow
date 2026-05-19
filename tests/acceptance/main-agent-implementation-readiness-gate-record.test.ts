import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainImplementationReadinessGate } from '../../scripts/main-agent-implementation-readiness-gate';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const PAGE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const ARCH_HASH = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';

function writeRecord(root: string, record: Record<string, unknown>): string {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-READINESS');
  mkdirSync(base, { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return recordPath;
}

function baseRecord(): Record<string, unknown> {
  return {
    recordId: 'REQ-READINESS',
    requirementSetId: 'REQ-READINESS',
    status: 'user_confirmed',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-READINESS',
        requirementSetId: 'REQ-READINESS',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/design/source.md',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationPageHash: PAGE_HASH,
        confirmationText: 'confirmed hashes',
        renderReportPath:
          '_bmad-output/runtime/requirement-records/REQ-READINESS/confirmation/confirmation-render-report.json',
        htmlPath: '_bmad-output/runtime/requirement-records/REQ-READINESS/confirmation/confirmation.html',
      },
    ],
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: ARCH_HASH,
    },
    contractSummary: {
      openQuestions: [],
    },
  };
}

describe('requirement-scoped implementation readiness gate', () => {
  it('passes only from explicit confirmation history and active architecture confirmation', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-pass-'));
    try {
      const recordPath = writeRecord(root, baseRecord());
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
      });
      expect(record.lastEventType).toBe('implementation_readiness_check_recorded');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not infer readiness from status when confirmation history is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-missing-history-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        confirmationHistory: [],
      });
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'Implementation Readiness Gate',
        decision: 'blocked',
      });
      expect(record.gateChecks.at(-1).blockingReasons).toContain('confirmation_history_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks stale source or implementation confirmation hashes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-readiness-stale-hash-'));
    try {
      const recordPath = writeRecord(root, {
        ...baseRecord(),
        sourceDocumentHash:
          'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });
      const code = mainImplementationReadinessGate([
        '--requirement-record',
        recordPath,
        '--evaluated-at',
        '2026-05-19T00:00:01.000Z',
      ]);
      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1).blockingReasons).toContain(
        'source_document_hash_not_current'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
