import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainFunctionalResumeCheck } from '../../scripts/main-agent-functional-resume-check';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const ARTIFACT_HASH = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeRecord(root: string, overrides: Record<string, unknown> = {}): string {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-RESUME');
  const recordPath = path.join(base, 'requirement-record.json');
  const artifactPath = '_bmad-output/runtime/requirement-records/REQ-RESUME/evidence/proof.json';
  writeJson(recordPath, {
    recordId: 'REQ-RESUME',
    requirementSetId: 'REQ-RESUME',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    confirmationHistory: [
      {
        status: 'user_confirmed',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
      },
    ],
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
    },
    executionIterations: [
      {
        executionIterationId: 'exec-001',
        traceRows: ['TRACE-001'],
        commandRunRefs: [
          {
            commandId: 'CMD-001',
            closeoutAttemptId: 'attempt-001',
            exitCode: 0,
          },
        ],
      },
    ],
    gateChecks: [
      {
        checkId: 'readiness-001',
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
      },
    ],
    requirementClosures: [
      { requirementId: 'MUST-001', status: 'blocked' },
      { requirementId: 'MUST-001', status: 'pass' },
      { requirementId: 'EVD-001', status: 'pass' },
    ],
    artifactIndex: [
      {
        artifactType: 'implementation_evidence',
        sourceOfTruthRole: 'evidence',
        path: artifactPath,
        contentHash: ARTIFACT_HASH,
        producer: 'functional-resume-test',
        purpose: 'prove required artifact hash',
        relatedRequirementIds: ['MUST-001'],
        status: 'active',
        inputVersion: 'source-v1',
        outputVersion: 'artifact-v1',
      },
    ],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-001',
          command: 'node proof.js',
          blockingIfMissing: true,
          artifactRefs: [
            {
              artifactType: 'implementation_evidence',
              sourceOfTruthRole: 'evidence',
              path: artifactPath,
              hash: ARTIFACT_HASH,
              producer: 'functional-resume-test',
              purpose: 'prove required artifact hash',
              relatedRequirementIds: ['MUST-001'],
              status: 'active',
              inputVersion: 'source-v1',
              outputVersion: 'artifact-v1',
            },
          ],
        },
      ],
    },
    ...overrides,
  });
  return recordPath;
}

describe('main-agent functional resume check', () => {
  it('writes checkpoint, resume packet, and proof from controlled RequirementRecord sources', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-pass-'));
    try {
      const recordPath = writeRecord(root);
      const outDir = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-RESUME', 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--out-dir',
        outDir,
        '--checkpoint-id',
        'checkpoint-001',
        '--expected-source-document-hash',
        SOURCE_HASH,
        '--expected-implementation-confirmation-hash',
        IMPLEMENTATION_HASH,
        '--expected-architecture-confirmation-hash',
        ARCHITECTURE_HASH,
        '--generated-at',
        '2026-05-19T00:00:00.000Z',
        '--json',
      ]);

      expect(code).toBe(0);
      const proofPath = path.join(outDir, 'functional-resume-proof.json');
      expect(existsSync(path.join(outDir, 'trace-checkpoints.jsonl'))).toBe(true);
      expect(existsSync(path.join(outDir, 'resume-packets.jsonl'))).toBe(true);
      expect(existsSync(proofPath)).toBe(true);
      const packet = JSON.parse(readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim());
      expect(packet).toMatchObject({
        packetType: 'functional_resume_packet',
        decision: 'pass',
        resumeAllowed: true,
        checkpointId: 'checkpoint-001',
      });
      expect(packet.modelChecks).toEqual([
        'requirement_confirmation',
        'architecture_confirmation',
        'implementation_readiness',
        'execution_closure',
        'audit_review',
        'delivery_closeout',
      ]);
      const proof = JSON.parse(readFileSync(proofPath, 'utf8'));
      expect(proof.decision).toBe('pass');
      expect(proof.checkpointRef.hash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when source document hash drifts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-hash-drift-'));
    try {
      const recordPath = writeRecord(root);
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--out-dir',
        outDir,
        '--expected-source-document-hash',
        sha256Text('old-source'),
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim());
      expect(packet.decision).toBe('blocked');
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          'resume-authority-hashes-current:sourceDocumentHash',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when pending rerun or open RCA exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-open-blocker-'));
    try {
      const recordPath = writeRecord(root, {
        rerunLoops: [
          {
            rerunLoopId: 'rerun-001',
            status: 'in_progress',
            sourceRefs: [{ sourceType: 'gate_check', id: 'gate-001' }],
          },
        ],
        rcaRecords: [
          {
            rcaId: 'rca-001',
            status: 'open',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
          },
        ],
      });
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim());
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          'resume-open-blockers-clear:pending_rerun:rerun-001',
          'resume-open-blockers-clear:open_rca:rca-001',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when required artifact hash is not indexed', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-artifact-missing-'));
    try {
      const recordPath = writeRecord(root, {
        artifactIndex: [],
      });
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim());
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          'resume-required-artifacts-indexed:artifact_not_indexed_or_hash_mismatch:_bmad-output/runtime/requirement-records/REQ-RESUME/evidence/proof.json',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
