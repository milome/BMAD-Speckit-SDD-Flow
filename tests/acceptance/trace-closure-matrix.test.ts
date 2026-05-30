import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainTraceClosureMatrix } from '../../scripts/trace-closure-matrix';

const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function artifactRef() {
  return {
    artifactType: 'implementation_evidence',
    sourceOfTruthRole: 'evidence',
    path: '_bmad-output/runtime/requirement-records/REQ-MATRIX/execution/evidence.json',
    contentHash: HASH,
    producer: 'trace-closure-matrix.test',
    purpose: 'prove trace closure projection uses indexed delivery evidence',
    relatedRequirementIds: ['MUST-001'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'artifact-v1',
  };
}

describe('trace closure matrix projection', () => {
  it('projects closure state from requirement record evidence only', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'trace-closure-matrix-'));
    try {
      const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-MATRIX');
      mkdirSync(base, { recursive: true });
      const recordPath = path.join(base, 'requirement-record.json');
      const outPath = path.join(base, 'trace-closure-matrix.json');
      writeFileSync(
        recordPath,
        `${JSON.stringify(
          {
            recordId: 'REQ-MATRIX',
            requirementSetId: 'REQ-MATRIX',
            requirementClosures: [
              { requirementId: 'MUST-001', status: 'open', recordedAt: '2026-05-19T00:00:00.000Z' },
              { requirementId: 'MUST-001', status: 'pass', recordedAt: '2026-05-19T00:01:00.000Z' },
              {
                requirementId: 'TRACE-001',
                status: 'pass',
                recordedAt: '2026-05-19T00:02:00.000Z',
              },
              { requirementId: 'NEG-001', status: 'open', recordedAt: '2026-05-19T00:01:00.000Z' },
            ],
            executionIterations: [
              {
                executionIterationId: 'exec-001',
                traceRows: ['TRACE-001'],
                evidenceRefs: ['EVD-001'],
                evidenceArtifactRefs: [artifactRef()],
              },
            ],
            deliveryEvidence: {
              requiredCommands: [
                {
                  commandId: 'CMD-DELIVERY',
                  traceRows: ['TRACE-001'],
                  evidenceRefs: ['EVD-001'],
                  artifactRefs: [{ ...artifactRef(), hash: HASH }],
                },
              ],
            },
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const code = mainTraceClosureMatrix([
        '--requirement-record',
        recordPath,
        '--out',
        outPath,
        '--json',
      ]);

      expect(code).toBe(0);
      const matrix = JSON.parse(readFileSync(outPath, 'utf8'));
      expect(matrix.sourceOfTruth).toBe('requirement-record.json');
      expect(matrix.projectionClosurePolicy).toMatchObject({
        sourceDocumentTraceStatusRole: 'confirmed_contract_projection',
        runtimeClosureAuthority: 'requirement-record.requirementClosures',
      });
      expect(matrix.projectionClosurePolicy.pendingSourceStatusMeaning).toContain(
        'does not represent runtime delivery closure'
      );
      expect(matrix.projectionClosurePolicy.semanticMutationPolicy).toContain(
        'requires reconfirmation'
      );
      expect(matrix.readModelBoundary).toContain('tests passed are evidence inputs only');
      expect(matrix.rows.find((row: { id: string }) => row.id === 'MUST-001')).toMatchObject({
        status: 'pass',
        closed: true,
      });
      expect(matrix.rows.find((row: { id: string }) => row.id === 'NEG-001')).toMatchObject({
        status: 'open',
        closed: false,
        blockingReason: 'missing_execution_iteration',
      });
      expect(matrix.rows.find((row: { id: string }) => row.id === 'TRACE-001')).toMatchObject({
        status: 'pass',
        closed: true,
        commandIds: ['CMD-DELIVERY'],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
