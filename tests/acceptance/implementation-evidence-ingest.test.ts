import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainIngestImplementationEvidence } from '../../scripts/ingest-implementation-evidence';

function sha256(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function artifactRef(artifactPath: string, contentHash: string, overrides: Record<string, unknown> = {}) {
  return {
    artifactType: 'implementation_evidence',
    sourceOfTruthRole: 'evidence',
    path: artifactPath,
    hash: contentHash,
    producer: 'implementation-evidence-ingest.test',
    purpose: 'prove controlled implementation evidence ingest behavior',
    relatedRequirementIds: ['MUST-007', 'NEG-008'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'artifact-v1',
    ...overrides,
  };
}

function writeFixture(root: string): { recordPath: string; evidencePath: string; artifactPath: string } {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-EVIDENCE-INGEST');
  const evidenceDir = path.join(base, 'execution');
  mkdirSync(evidenceDir, { recursive: true });
  const artifactPath = path.join(evidenceDir, 'implementation-evidence.json');
  const artifactContent = JSON.stringify({ assertion: 'negative regression evidence' }, null, 2);
  writeFileSync(artifactPath, `${artifactContent}\n`, 'utf8');
  const recordPath = path.join(base, 'requirement-record.json');
  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        recordId: 'REQ-EVIDENCE-INGEST',
        requirementSetId: 'REQ-EVIDENCE-INGEST',
        status: 'user_confirmed',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        architectureConfirmationState: {
          status: 'active',
          currentArchitectureConfirmationHash:
            'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const evidencePath = path.join(evidenceDir, 'packet.json');
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        eventType: 'execution_iteration_recorded',
        recordId: 'REQ-EVIDENCE-INGEST',
        requirementSetId: 'REQ-EVIDENCE-INGEST',
        executionIterationId: 'exec-001',
        runId: 'run-001',
        status: 'done',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        architectureConfirmationHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        traceRows: ['TRACE-003'],
        taskRefs: ['TASK-DELIVERY-CORE-EVIDENCE'],
        evidenceRefs: ['EVD-006'],
        filesChanged: ['scripts/ingest-implementation-evidence.ts'],
        implementationDelta: {
          filesChanged: ['scripts/ingest-implementation-evidence.ts'],
          diffSummaryRef: 'diff-summary.md',
          behaviorAffecting: true,
          negativeAssertionArtifactRefs: [
            artifactRef(artifactPath, sha256(`${artifactContent}\n`)),
          ],
        },
        diffSummary: 'Add controlled implementation evidence ingest.',
        commandRuns: [
          {
            commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
            command:
              'npx vitest run tests/acceptance/implementation-evidence-ingest.test.ts',
            runId: 'run-001',
            closeoutAttemptId: 'closeout-001',
            exitCode: 0,
            startedAt: '2026-05-19T00:00:00.000Z',
            completedAt: '2026-05-19T00:00:05.000Z',
            outputSummary: '3 tests passed',
          },
        ],
        artifactRefs: [
          artifactRef(artifactPath, sha256(`${artifactContent}\n`)),
        ],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
              command:
                'npx vitest run tests/acceptance/implementation-evidence-ingest.test.ts',
              commandType: 'delivery_evidence',
              blockingIfMissing: true,
              traceRows: ['TRACE-003'],
              evidenceRefs: ['EVD-006'],
              artifactRefs: [
                artifactRef(artifactPath, sha256(`${artifactContent}\n`)),
              ],
            },
          ],
          historicalRunRefs: [
            {
              commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
              runId: 'run-001',
              closeoutAttemptId: 'closeout-001',
            },
          ],
        },
        requirementClosures: [{ requirementId: 'MUST-005', status: 'pass' }],
        gateChecks: [{ gate: 'Execution Closure Check', decision: 'pass' }],
        closeoutAttemptId: 'closeout-001',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { recordPath, evidencePath, artifactPath };
}

describe('implementation evidence ingest', () => {
  it('records execution evidence through controlled ingest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-ingest-'));
    try {
      const fixture = writeFixture(root);
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
        '--confirmed-at',
        '2026-05-19T00:00:06.000Z',
        '--recorded-by',
        'test-agent',
        '--json',
      ]);
      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.lastEventType).toBe('execution_iteration_recorded');
      expect(record.executionIterations).toHaveLength(1);
      expect(record.executionIterations[0]).toMatchObject({
        executionIterationId: 'exec-001',
        status: 'done',
        recordedBy: 'test-agent',
      });
      expect(record.executionIterations[0].commandRunRefs[0]).toMatchObject({
        commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
        runId: 'run-001',
        closeoutAttemptId: 'closeout-001',
      });
      expect(record.requirementClosures[0]).toMatchObject({
        eventType: 'requirement_closure_recorded',
        requirementId: 'MUST-005',
        status: 'pass',
      });
      expect(record.gateChecks[0]).toMatchObject({
        eventType: 'gate_check_recorded',
        gate: 'Execution Closure Check',
        decision: 'pass',
      });
      expect(record.deliveryEvidence.requiredCommands[0]).toMatchObject({
        commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
        blockingIfMissing: true,
      });
      expect(record.deliveryEvidence.requiredCommands[0].artifactRefs).toHaveLength(1);
      expect(record.artifactIndex[0]).toMatchObject({
        purpose: 'prove controlled implementation evidence ingest behavior',
        relatedRequirementIds: ['MUST-007', 'NEG-008'],
        status: 'active',
        inputVersion: 'source-v1',
        outputVersion: 'artifact-v1',
      });
      expect(record.deliveryEvidence.historicalRunRefs[0]).toMatchObject({
        commandId: 'CMD-IMPLEMENTATION-EVIDENCE-INGEST-TEST',
        runId: 'run-001',
        closeoutAttemptId: 'closeout-001',
      });
      expect(existsSync(path.join(path.dirname(fixture.recordPath), 'artifact-index.jsonl'))).toBe(
        true
      );
      expect(
        existsSync(path.join(path.dirname(path.dirname(fixture.recordPath)), 'artifact-index.jsonl'))
      ).toBe(true);
      expect(existsSync(fixture.artifactPath)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects stale hashes without mutating the requirement record', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-stale-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.architectureConfirmationHash =
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects legacy result fields and historical command runs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-result-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.result = 'pass';
      packet.commandRuns[0].runId = 'old-run';
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects delivery required commands that cannot prove current blocking evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-required-command-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.deliveryEvidence.requiredCommands[0].blockingIfMissing = false;
      packet.deliveryEvidence.requiredCommands[0].artifactRefs = [];
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects evidence packets without behavior-affecting implementation delta proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-delta-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      delete packet.implementationDelta;
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects artifact refs without pass-grade metadata', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-artifact-metadata-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      delete packet.artifactRefs[0].purpose;
      packet.artifactRefs[0].relatedRequirementIds = [];
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects inline full diffs and legacy write targets', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-inline-diff-'));
    try {
      const fixture = writeFixture(root);
      const before = readFileSync(fixture.recordPath, 'utf8');
      const packet = JSON.parse(readFileSync(fixture.evidencePath, 'utf8'));
      packet.fullDiff = 'diff --git a/file b/file';
      packet.artifactRefs[0].path = '_bmad-output/runtime/gates/legacy-report.json';
      writeFileSync(fixture.evidencePath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(3);
      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('normalizes historical artifact refs without making them current pass evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'implementation-evidence-historical-artifact-'));
    try {
      const fixture = writeFixture(root);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      record.artifactIndex = [
        {
          artifactType: 'legacy_report',
          sourceOfTruthRole: 'evidence',
          path: '_bmad-output/runtime/requirement-records/REQ-EVIDENCE-INGEST/execution/old-report.json',
          contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          producer: 'legacy-runner',
          traceRows: ['TRACE-OLD'],
          evidenceRefs: ['EVD-OLD'],
        },
      ];
      writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      const code = mainIngestImplementationEvidence([
        '--evidence',
        fixture.evidencePath,
        '--requirement-record',
        fixture.recordPath,
      ]);
      expect(code).toBe(0);
      const updated = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(updated.artifactIndex[0]).toMatchObject({
        status: 'archived',
        inputVersion: 'pre-artifact-metadata-enforcement',
        outputVersion: 'archived-historical-artifact',
      });
      expect(updated.artifactIndex.at(-1)).toMatchObject({
        status: 'active',
        relatedRequirementIds: ['MUST-007', 'NEG-008'],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
