import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateReverseAuditReadinessGate,
  evaluateTargetArtifactRealization,
  implementationConfirmationHash,
} from '../../scripts/target-artifact-realization-gate';

const ATTEMPT = 'attempt-target-001';

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function confirmationStableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => confirmationStableStringify(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${confirmationStableStringify(record[key])}`)
    .join(',')}}`;
}

function confirmationRecipeHash(confirmation: Record<string, unknown>): string {
  const bookkeeping = new Set([
    'status',
    'confirmedAt',
    'confirmedBy',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'reconfirmationRequest',
    'confirmationRender',
  ]);
  const semantic = Object.fromEntries(
    Object.entries(confirmation).filter(([key]) => !bookkeeping.has(key))
  );
  return sha256Text(confirmationStableStringify(semantic));
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function sourceDoc(root: string) {
  const sourcePath = path.join(root, 'source.md');
  const artifactPath = path.join(root, 'evidence', 'target-report.json');
  writeJson(artifactPath, { ok: true });
  const confirmation = {
    status: 'user_confirmed',
    artifactAutomationPlan: [
      {
        id: 'ART-TARGET',
        artifactType: 'report',
        path: artifactPath.replace(/\\/gu, '/'),
        producer: 'fixture-producer',
        sourceOfTruthRole: 'implementation',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    currentTargetMap: {
      canonicalArtifacts: [{ targetPathOrField: 'RequirementRecord.genericCanonicalField' }],
      pathRegistry: [],
      existingArtifacts: [
        {
          currentPath: 'legacy_completion_event',
          completionProofPolicy: 'legacy_only',
        },
      ],
    },
  };
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      '  status: user_confirmed',
      '  artifactAutomationPlan:',
      '    - id: ART-TARGET',
      '      artifactType: report',
      `      path: ${artifactPath.replace(/\\/gu, '/')}`,
      '      producer: fixture-producer',
      '      sourceOfTruthRole: implementation',
      '      traceRows: [TRACE-001]',
      '      evidenceRefs: [EVD-001]',
      '  currentTargetMap:',
      '    canonicalArtifacts:',
      '      - targetPathOrField: RequirementRecord.genericCanonicalField',
      '    pathRegistry: []',
      '    existingArtifacts:',
      '      - currentPath: legacy_completion_event',
      '        completionProofPolicy: legacy_only',
      '',
    ].join('\n')
  );
  return {
    sourcePath,
    artifactPath,
    implementationHash: implementationConfirmationHash(confirmation),
  };
}

function passingRecord(root: string) {
  const source = sourceDoc(root);
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-GENERIC');
  const eventPath = path.join(base, 'events', 'control-events.jsonl');
  const artifact = {
    artifactType: 'report',
    path: source.artifactPath.replace(/\\/gu, '/'),
    contentHash: sha256File(source.artifactPath),
    producer: 'fixture-producer',
    sourceOfTruthRole: 'implementation',
    status: 'active',
    relatedRequirementIds: ['TRACE-001', 'EVD-001'],
  };
  const event = {
    eventId: 'artifact_indexed:target',
    eventType: 'artifact_indexed',
    payload: {
      packet: {
        closeoutAttemptId: ATTEMPT,
        artifactRefs: [artifact],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    },
  };
  mkdirSync(path.dirname(eventPath), { recursive: true });
  writeFileSync(eventPath, `${JSON.stringify(event)}\n`, 'utf8');
  const record = {
    recordId: 'REQ-GENERIC',
    requirementSetId: 'REQ-GENERIC',
    sourcePath: source.sourcePath,
    status: 'user_confirmed',
    implementationConfirmationHash: source.implementationHash,
    genericCanonicalField: [{ status: 'present' }],
    controlStore: { eventLogPath: eventPath.replace(/\\/gu, '/') },
    executionIterations: [
      {
        executionIterationId: 'exec-target',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRunRefs: [
          { commandId: 'CMD-TARGET', closeoutAttemptId: ATTEMPT, runId: 'run-target', exitCode: 0 },
        ],
      },
    ],
    artifactIndex: [artifact],
  };
  const recordPath = path.join(base, 'requirement-record.json');
  writeJson(recordPath, record);
  return { ...source, record, recordPath };
}

function writeReverseAuditSource(root: string, attemptId: string) {
  const sourcePath = path.join(root, 'source.md');
  const reportPath = path.join(root, 'confirmation-render-report.json');
  const confirmation = {
    status: 'user_confirmed',
    contractAuthoringRequired: true,
    sourceDocumentHash: 'sha256:placeholder-source',
    implementationConfirmationHash: 'sha256:placeholder-implementation',
    confirmationRender: {
      htmlPath: path.join(root, 'confirmation.html').replace(/\\/gu, '/'),
      summaryPath: path.join(root, 'confirmation-summary.json').replace(/\\/gu, '/'),
      reportPath: reportPath.replace(/\\/gu, '/'),
      htmlHash: 'sha256:placeholder-html',
      confirmationPhrase: 'confirm placeholder',
    },
    must: [
      {
        id: 'MUST-001',
        text: 'Must prove current runtime readiness.',
        evidenceRefs: ['EVD-001'],
        coveredByTraceRows: ['TRACE-001'],
      },
    ],
    evidence: [
      {
        id: 'EVD-001',
        text: 'Current command evidence.',
        oracle: 'non-smoke runtime evidence',
        gate: 'controlled reverse audit readiness gate',
        requiredCommandRefs: ['CMD-001'],
      },
    ],
    traceRows: [
      {
        id: 'TRACE-001',
        covers: ['MUST-001'],
        evidenceRefs: ['EVD-001'],
        deliveryEvidenceCommandRefs: ['CMD-001'],
      },
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command: 'node scripts/current-proof.js',
        oracle: 'non-smoke runtime evidence',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
    targetModificationPaths: [
      {
        id: 'TARGET-001',
        path: 'scripts/current-proof.js',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      },
    ],
  };
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      ...JSON.stringify(confirmation, null, 2)
        .split('\n')
        .map((line) => `  ${line}`),
      '',
      '## Reverse Audit Report',
      '### implementationConfirmation Findings',
      'No blockers.',
      '### HTML Confirmation Findings',
      'No blockers.',
      '### Reconfirmation Findings',
      'No blockers.',
      '### ID Reference Findings',
      'No blockers.',
      '### Diagram And Step Findings',
      'No blockers.',
      '### Artifact Automation Plan Findings',
      'No blockers.',
      '### traceRows Findings',
      'No blockers.',
      '### Row Quality Findings',
      'No blockers.',
      '### E2E Anti-Smoke Findings',
      'Does Not Count As: exit code only, stdout, HTTP 200, page render, mock calls.',
      '### Open Findings',
      'No blockers.',
      '## Definition of Done',
      '- Complete.',
      '',
    ].join('\n')
  );
  const sourceTextValue = readFileSync(sourcePath, 'utf8');
  const sourceHash = sha256Text(sourceTextValue.replace(/implementationConfirmation:[\s\S]*?\n\n## Reverse Audit Report/u, ''));
  const implementationHash = implementationConfirmationHash(confirmation);
  const currentConfirmation = {
    ...confirmation,
    sourceDocumentHash: sourceHash,
    implementationConfirmationHash: implementationHash,
    confirmationRender: {
      ...confirmation.confirmationRender,
      confirmationPhrase: `confirm sourceDocumentHash=${sourceHash} implementationConfirmationHash=${implementationHash} confirmationPageHash=sha256:placeholder-html`,
    },
  };
  writeText(
    sourcePath,
    [
      'implementationConfirmation:',
      ...JSON.stringify(currentConfirmation, null, 2)
        .split('\n')
        .map((line) => `  ${line}`),
      '',
      '## Reverse Audit Report',
      '### implementationConfirmation Findings',
      'No blockers.',
      '### HTML Confirmation Findings',
      'No blockers.',
      '### Reconfirmation Findings',
      'No blockers.',
      '### ID Reference Findings',
      'No blockers.',
      '### Diagram And Step Findings',
      'No blockers.',
      '### Artifact Automation Plan Findings',
      'No blockers.',
      '### traceRows Findings',
      'No blockers.',
      '### Row Quality Findings',
      'No blockers.',
      '### E2E Anti-Smoke Findings',
      'Does Not Count As: exit code only, stdout, HTTP 200, page render, mock calls.',
      '### Open Findings',
      'No blockers.',
      '## Definition of Done',
      '- Complete.',
      '',
    ].join('\n')
  );
  const renderReport = {
    recordId: 'REQ-REVERSE-AUDIT',
    requirementSetId: 'REQ-REVERSE-AUDIT',
    sourcePath: sourcePath.replace(/\\/gu, '/'),
    sourceDocumentHash: sourceHash,
    implementationConfirmationHash: implementationHash,
    confirmationPageHash: 'sha256:placeholder-html',
    actualHtmlFileHash: 'sha256:placeholder-html',
    generatedAt: '2026-05-27T00:00:00.000Z',
    language: 'zh-CN',
    confirmability: 'confirmable',
    deliveryReadiness: { ready: false, status: 'stale_render_time_readiness' },
    blockingIssues: [],
    warnings: [],
    diagramCoverage: {},
    traceCoverage: {},
    artifactAutomationCoverage: {},
    confirmInstruction: `confirm sourceDocumentHash=${sourceHash} implementationConfirmationHash=${implementationHash} confirmationPageHash=sha256:placeholder-html`,
    artifactRef: { hash: 'sha256:placeholder-html' },
    renderedSections: ['pre-confirmation-semantic-drilldown'],
    preConfirmationSemanticDrilldown: {
      reportPath: path.join(root, 'pre-confirmation-drilldown.json').replace(/\\/gu, '/'),
      report: {
        verdict: 'PASS',
        confirmability: 'confirmable',
        sourceDocumentHash: sourceHash,
        implementationConfirmationHash: implementationHash,
        failedChecks: [],
        criticalAuditor: { consecutiveNoNewGapRounds: 3 },
        packetSourceReconciliation: { verdict: 'pass' },
      },
    },
  };
  writeJson(reportPath, renderReport);
  const artifact = {
    artifactType: 'command_output',
    path: path.join(root, 'evidence', 'command-output.txt').replace(/\\/gu, '/'),
    contentHash: sha256Text('current evidence'),
    producer: 'fixture',
    purpose: 'current attempt evidence',
    relatedRequirementIds: ['TRACE-001', 'EVD-001'],
    closeoutAttemptId: attemptId,
    status: 'active',
    inputVersion: attemptId,
    outputVersion: attemptId,
    sourceOfTruthRole: 'evidence',
    traceRows: ['TRACE-001'],
    evidenceRefs: ['EVD-001'],
  };
  writeText(artifact.path, 'current evidence');
  const recordPath = path.join(root, 'requirement-record.json');
  const record = {
    recordId: 'REQ-REVERSE-AUDIT',
    requirementSetId: 'REQ-REVERSE-AUDIT',
    status: 'user_confirmed',
    sourcePath: sourcePath.replace(/\\/gu, '/'),
    closeout: { currentAttemptId: attemptId },
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-001',
          closeoutAttemptId: attemptId,
          lastRunRef: { commandId: 'CMD-001', runId: 'run-current', closeoutAttemptId: attemptId },
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
          artifactRefs: [artifact],
        },
      ],
    },
    executionIterations: [
      {
        executionIterationId: 'exec-current',
        runId: 'run-current',
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRunRefs: [{ commandId: 'CMD-001', runId: 'run-current', closeoutAttemptId: attemptId, exitCode: 0 }],
      },
    ],
    artifactIndex: [artifact],
  };
  writeJson(recordPath, record);
  return { sourcePath, record, recordPath };
}

describe('target artifact realization gate', () => {
  it('uses the same semantic implementationConfirmation hash recipe as controlled confirmation', () => {
    const confirmation = {
      status: 'user_confirmed',
      zetaField: { lower: true },
      aiTddContractExecutionManifestProjection: { closeoutProof: { requiredCommands: ['CMD-001'] } },
      currentTargetMap: { canonicalArtifacts: [] },
      AlphaField: ['forces default sort to differ from localeCompare'],
      implementationConfirmationHash: 'sha256:old-bookkeeping',
    };
    expect(implementationConfirmationHash(confirmation)).toBe(confirmationRecipeHash(confirmation));
  });

  it('passes declared targets without hardcoded requirement fields', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-pass-'));
    try {
      const fixture = passingRecord(root);
      const report = evaluateTargetArtifactRealization({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('pass');
      expect(report.targetCount).toBeGreaterThanOrEqual(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses runtime delivery readiness before stale renderer delivery readiness', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'reverse-audit-runtime-readiness-'));
    try {
      const fixture = writeReverseAuditSource(root, ATTEMPT);
      const report = evaluateReverseAuditReadinessGate({
        sourcePath: fixture.sourcePath,
        record: fixture.record,
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.deliveryReadiness).toMatchObject({
        ready: true,
        currentAttemptId: ATTEMPT,
        currentPassTraceRows: 1,
      });
      expect(report.blockingReasons).not.toContain('reverse_audit_delivery_readiness_not_ready');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('derives projection targets and traceRefs aliases from confirmation rows', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-projection-role-'));
    try {
      const fixture = passingRecord(root);
      const sourcePath = path.join(root, 'projection-source.md');
      const projectionPath = path.join(root, 'evidence', 'projection.json');
      writeJson(projectionPath, { projected: true });
      const confirmation = {
        status: 'user_confirmed',
        artifactAutomationPlan: [
          {
            artifactId: 'ART-PROJECTION',
            artifactType: 'prompt_projection',
            path: projectionPath.replace(/\\/gu, '/'),
            producer: 'fixture-producer',
            sourceOfTruthRole: 'projection',
            traceRefs: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
          },
        ],
        currentTargetMap: {
          canonicalArtifacts: [
            {
              id: 'SURFACE-PROJECTION',
              targetPathOrField: 'RequirementRecord.genericCanonicalField',
              traceRefs: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          ],
          pathRegistry: [],
          existingArtifacts: [
            {
              currentPath: 'legacy_completion_event',
              completionProofPolicy: 'legacy_only',
            },
          ],
        },
      };
      writeText(
        sourcePath,
        `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}\n`
      );
      const artifact = {
        artifactType: 'prompt_projection',
        path: projectionPath.replace(/\\/gu, '/'),
        contentHash: sha256File(projectionPath),
        producer: 'fixture-producer',
        sourceOfTruthRole: 'projection',
        status: 'active',
        relatedRequirementIds: ['TRACE-001', 'EVD-001'],
      };
      const eventPath = path.join(path.dirname(fixture.recordPath), 'events', 'projection-control-events.jsonl');
      writeText(
        eventPath,
        `${JSON.stringify({
          eventId: 'artifact_indexed:projection',
          eventType: 'artifact_indexed',
          payload: {
            packet: {
              closeoutAttemptId: ATTEMPT,
              artifactRefs: [artifact],
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          },
        })}\n`
      );
      const record = {
        ...fixture.record,
        sourcePath,
        implementationConfirmationHash: implementationConfirmationHash(confirmation),
        artifactIndex: [artifact],
        controlStore: { eventLogPath: eventPath.replace(/\\/gu, '/') },
      };
      const report = evaluateTargetArtifactRealization({
        sourcePath,
        record,
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.targets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ART-PROJECTION',
            expectedSourceOfTruthRole: 'projection',
            traceRefs: ['TRACE-001'],
          }),
          expect.objectContaining({
            id: 'SURFACE-PROJECTION',
            traceRefs: ['TRACE-001'],
          }),
        ])
      );
      expect(report.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('matches run-id template paths under evidence category directories and treats manifest sections as logical surfaces', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-run-id-'));
    try {
      const sourcePath = path.join(root, 'source.md');
      const recordId = 'REQ-RUN-ID';
      const runId = 'run-20260527T140000Z';
      const attemptId = 'attempt-run-id';
      const reportPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        recordId,
        'evidence',
        'AI-TDD-MANIFEST',
        runId,
        'ai-tdd-pre-run-report.json'
      );
      writeJson(reportPath, { reportType: 'pre-run' });
      const confirmation = {
        status: 'user_confirmed',
        artifactAutomationPlan: [
          {
            id: 'ART-AI-TDD-PRE-RUN-REPORT',
            artifactType: 'report',
            path: `_bmad-output/runtime/requirement-records/<recordId>/evidence/<runId>/ai-tdd-pre-run-report.json`,
            producer: 'fixture-producer',
            sourceOfTruthRole: 'evidence',
            traceRows: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
          },
        ],
        currentTargetMap: {
          canonicalArtifacts: [
            {
              id: 'CANONICAL-MANIFEST',
              targetPathOrField: 'ContractExecutionManifest.closeoutProof.requiredCommands',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
            {
              id: 'CANONICAL-DELIVERY',
              targetPathOrField: 'deliveryEvidence.requiredCommands[]',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          ],
          pathRegistry: [],
          existingArtifacts: [],
        },
      };
      writeText(
        sourcePath,
        `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}\n`
      );
      const artifact = {
        artifactType: 'report',
        path: reportPath.replace(/\\/gu, '/'),
        contentHash: sha256File(reportPath),
        producer: 'fixture-producer',
        sourceOfTruthRole: 'evidence',
        status: 'active',
        relatedRequirementIds: ['TRACE-001', 'EVD-001'],
        inputVersion: attemptId,
        outputVersion: attemptId,
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      };
      const eventPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId, 'events', 'control-events.jsonl');
      writeText(
        eventPath,
        `${JSON.stringify({
          eventType: 'artifact_indexed',
          payload: {
            packet: {
              closeoutAttemptId: attemptId,
              artifactRefs: [artifact],
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          },
        })}\n`
      );
      const record = {
        recordId,
        requirementSetId: recordId,
        status: 'user_confirmed',
        sourcePath,
        implementationConfirmationHash: implementationConfirmationHash(confirmation),
        controlStore: { eventLogPath: eventPath.replace(/\\/gu, '/') },
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-001',
              command: 'node --version',
              blockingIfMissing: true,
              closeoutAttemptId: attemptId,
              lastRunRef: { commandId: 'CMD-001', runId, closeoutAttemptId: attemptId },
              artifactRefs: [artifact],
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          ],
        },
        executionIterations: [
          {
            executionIterationId: 'exec-run-id',
            runId,
            traceRows: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
            commandRunRefs: [{ commandId: 'CMD-001', closeoutAttemptId: attemptId, runId, exitCode: 0 }],
          },
        ],
        artifactIndex: [artifact],
      };
      const recordPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId, 'requirement-record.json');
      writeJson(recordPath, record);
      const report = evaluateTargetArtifactRealization({
        sourcePath,
        record,
        recordPath,
        attemptId,
      });
      expect(report.blockingReasons).not.toContain('target_artifact_missing');
      expect(report.blockingReasons).not.toContain('target_artifact_index_missing');
      expect(report.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when declared record field, hash, and current attempt binding are missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-fail-'));
    try {
      const fixture = passingRecord(root);
      const brokenRecord = {
        ...fixture.record,
        genericCanonicalField: [],
        artifactIndex: [
          {
            ...(fixture.record.artifactIndex as Record<string, unknown>[])[0],
            contentHash: undefined,
          },
        ],
        controlStore: {
          eventLogPath: path.join(root, 'missing-control-events.jsonl').replace(/\\/gu, '/'),
        },
        executionIterations: [],
        deliveryEvidence: { requiredCommands: [] },
      };
      const report = evaluateTargetArtifactRealization({
        sourcePath: fixture.sourcePath,
        record: brokenRecord,
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('target_record_field_missing');
      expect(report.blockingReasons).toContain('target_artifact_hash_missing');
      expect(report.blockingReasons).toContain('target_artifact_attempt_binding_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when legacy-only artifacts are used as completion proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-legacy-'));
    try {
      const fixture = passingRecord(root);
      const report = evaluateTargetArtifactRealization({
        sourcePath: fixture.sourcePath,
        record: {
          ...fixture.record,
          lastEventType: 'legacy_completion_event',
        },
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toContain('legacy_artifact_used_as_completion_proof');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not treat legacy compatibility snapshots as completion proof usage', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-legacy-snapshot-'));
    try {
      const fixture = passingRecord(root);
      const legacyPath = path.join(root, 'scripts', 'run-confirmed-final-required-commands.js');
      writeText(legacyPath, '// tombstone delegates elsewhere\n');
      const sourcePath = path.join(root, 'legacy-source.md');
      const confirmation = {
        status: 'user_confirmed',
        artifactAutomationPlan: [
          {
            id: 'ART-LEGACY-RUNNER',
            artifactType: 'legacy_compatibility',
            path: legacyPath.replace(/\\/gu, '/'),
            producer: 'fixture-producer',
            sourceOfTruthRole: 'legacy_compatibility',
            traceRows: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
          },
        ],
        currentTargetMap: {
          canonicalArtifacts: [],
          pathRegistry: [],
          existingArtifacts: [
            {
              id: 'LEGACY-001',
              currentPath: legacyPath.replace(/\\/gu, '/'),
              completionProofPolicy: 'legacy_only',
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          ],
        },
      };
      writeText(
        sourcePath,
        `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}\n`
      );
      const artifact = {
        artifactType: 'legacy_compatibility',
        path: legacyPath.replace(/\\/gu, '/'),
        contentHash: sha256File(legacyPath),
        producer: 'fixture-producer',
        sourceOfTruthRole: 'evidence',
        status: 'active',
        relatedRequirementIds: ['TRACE-001', 'EVD-001'],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      };
      const eventPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-GENERIC',
        'events',
        'legacy-control-events.jsonl'
      );
      writeText(
        eventPath,
        `${JSON.stringify({
          eventType: 'implementation_evidence_ingested',
          payload: {
            packet: {
              closeoutAttemptId: ATTEMPT,
              artifactRefs: [artifact],
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          },
        })}\n`
      );
      const record = {
        ...fixture.record,
        sourcePath,
        implementationConfirmationHash: implementationConfirmationHash(confirmation),
        artifactIndex: [artifact],
        controlStore: { eventLogPath: eventPath.replace(/\\/gu, '/') },
      };
      const report = evaluateTargetArtifactRealization({
        sourcePath,
        record,
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('legacy_artifact_used_as_completion_proof');
      expect(report.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves file targets that include an explanatory suffix after the path', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-path-suffix-'));
    try {
      const fixture = passingRecord(root);
      const gatePath = path.join(root, 'scripts', 'ai-tdd-contract-gate.ts');
      writeText(gatePath, 'export const closeoutProofAuthority = true;\n');
      const sourcePath = path.join(root, 'suffix-source.md');
      const confirmation = {
        status: 'user_confirmed',
        currentTargetMap: {
          canonicalArtifacts: [
            {
              id: 'CANONICAL-006',
              targetPathOrField: `${gatePath.replace(/\\/gu, '/')} closeoutProof authority`,
              traceRefs: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          ],
          pathRegistry: [],
          existingArtifacts: [],
        },
      };
      writeText(
        sourcePath,
        `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}\n`
      );
      const artifact = {
        artifactType: 'implementation',
        path: gatePath.replace(/\\/gu, '/'),
        contentHash: sha256File(gatePath),
        producer: 'fixture-producer',
        sourceOfTruthRole: 'evidence',
        status: 'active',
        relatedRequirementIds: ['TRACE-001', 'EVD-001'],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
      };
      const eventPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-GENERIC',
        'events',
        'suffix-control-events.jsonl'
      );
      writeText(
        eventPath,
        `${JSON.stringify({
          eventType: 'implementation_evidence_ingested',
          payload: {
            packet: {
              closeoutAttemptId: ATTEMPT,
              artifactRefs: [artifact],
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          },
        })}\n`
      );
      const record = {
        ...fixture.record,
        sourcePath,
        implementationConfirmationHash: implementationConfirmationHash(confirmation),
        artifactIndex: [artifact],
        controlStore: { eventLogPath: eventPath.replace(/\\/gu, '/') },
      };
      const report = evaluateTargetArtifactRealization({
        sourcePath,
        record,
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('target_artifact_missing');
      expect(report.blockingReasons).not.toContain('target_artifact_index_missing');
      expect(report.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('recognizes post-closeout review templates with camelCase placeholders as current attempt artifacts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-closeout-review-'));
    const previousCwd = process.cwd();
    try {
      process.chdir(root);
      const recordId = 'REQ-CLOSEOUT-REVIEW';
      const attemptId = 'closeout-attempt-current';
      const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
      const confirmationDir = path.join(base, 'confirmation');
      const htmlPath = path.join(confirmationDir, `closeout-review-${attemptId}.html`);
      const reportPath = path.join(confirmationDir, `closeout-review-${attemptId}.render-report.json`);
      writeText(htmlPath, '<!doctype html><title>closeout review</title>\n');
      const sourcePath = path.join(root, 'source.md');
      const confirmation = {
        status: 'user_confirmed',
        artifactAutomationPlan: [
          {
            id: 'ART-POST-CLOSEOUT-CONFIRMATION-HTML',
            artifactType: 'html_projection',
            path: '_bmad-output/runtime/requirement-records/<recordId>/confirmation/closeout-review-<closeoutAttemptId>.html',
            sourceOfTruthRole: 'post_closeout_review_projection',
            producer:
              '_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts --mode closeout-review',
            traceRefs: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
          },
          {
            id: 'ART-POST-CLOSEOUT-CONFIRMATION-RENDER-REPORT',
            artifactType: 'render_report',
            path: '_bmad-output/runtime/requirement-records/<recordId>/confirmation/closeout-review-<closeoutAttemptId>.render-report.json',
            sourceOfTruthRole: 'post_closeout_review_evidence',
            producer:
              '_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts --mode closeout-review',
            traceRefs: ['TRACE-001'],
            evidenceRefs: ['EVD-001'],
          },
        ],
      };
      writeText(
        sourcePath,
        `implementationConfirmation:\n${JSON.stringify(confirmation, null, 2)
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')}\n`
      );
      const implementationHash = implementationConfirmationHash(confirmation);
      writeJson(reportPath, {
        mode: 'closeout-review',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash: implementationHash,
        finalAcceptanceReview: {
          ready: true,
          currentAttemptId: attemptId,
          recordClosed: true,
        },
      });
      const record = {
        recordId,
        requirementSetId: recordId,
        sourcePath,
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash: implementationHash,
        lastEventType: 'record_closed',
        closeout: { currentAttemptId: attemptId, decision: 'pass' },
        artifactIndex: [],
      };
      const recordPath = path.join(base, 'requirement-record.json');
      writeJson(recordPath, record);
      const report = evaluateTargetArtifactRealization({
        sourcePath,
        record,
        recordPath,
        attemptId,
      });
      expect(report.blockingReasons).not.toContain('target_artifact_missing');
      expect(report.blockingReasons).not.toContain('target_artifact_index_missing');
      expect(report.blockingReasons).not.toContain('post_closeout_review_not_ready');
      expect(report.decision).toBe('pass');
    } finally {
      process.chdir(previousCwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('prefers current-attempt artifact index entries over stale same-path entries', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'target-artifact-current-attempt-entry-'));
    try {
      const fixture = passingRecord(root);
      const source = sourceDoc(root);
      const staleArtifact = {
        ...(fixture.record.artifactIndex as Record<string, unknown>[])[0],
        contentHash: `sha256:${'0'.repeat(64)}`,
        inputVersion: 'stale-attempt',
        outputVersion: 'stale-attempt',
      };
      const currentArtifact = {
        ...(fixture.record.artifactIndex as Record<string, unknown>[])[0],
        contentHash: sha256File(source.artifactPath),
        hash: sha256File(source.artifactPath),
        closeoutAttemptId: ATTEMPT,
        inputVersion: ATTEMPT,
        outputVersion: ATTEMPT,
      };
      const eventPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-GENERIC',
        'events',
        'current-attempt-control-events.jsonl'
      );
      writeText(
        eventPath,
        `${JSON.stringify({
          eventType: 'implementation_evidence_ingested',
          payload: {
            packet: {
              closeoutAttemptId: ATTEMPT,
              artifactRefs: [currentArtifact],
              traceRows: ['TRACE-001'],
              evidenceRefs: ['EVD-001'],
            },
          },
        })}\n`
      );
      const record = {
        ...fixture.record,
        artifactIndex: [staleArtifact, currentArtifact],
        controlStore: { eventLogPath: eventPath.replace(/\\/gu, '/') },
      };
      const report = evaluateTargetArtifactRealization({
        sourcePath: source.sourcePath,
        record,
        recordPath: fixture.recordPath,
        attemptId: ATTEMPT,
      });
      expect(report.blockingReasons).not.toContain('target_artifact_hash_mismatch');
      expect(report.decision).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
