import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainFunctionalResumeCheck } from '../../scripts/main-agent-functional-resume-check';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';
const ARTIFACT_HASH = 'sha256:4444444444444444444444444444444444444444444444444444444444444444';

function registryFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'frozen_for_six_mental_model_full_link',
    fullLinkExecutableSubsetRequired: true,
    fullLinkRequiredFixtureCases: ['resume_happy_path', 'sourceDocumentHash_changed'],
    recoveryActionDefinitions: [
      {
        actionId: 'allow_resume',
        label: 'Allow resume from checkpoint',
        writesControlFields: ['gateChecks'],
        recordEventTypes: ['gate_check_recorded'],
      },
      {
        actionId: 'rebuild_trace_checkpoint',
        label: 'Rebuild trace checkpoint',
        writesControlFields: ['recoveryContext', 'gateChecks'],
        recordEventTypes: ['recovery_context_updated', 'gate_check_recorded'],
      },
    ],
    groups: [
      {
        groupId: 'hash_and_trace_checkpoint',
        label: 'Hash and trace checkpoint',
        caseRefs: ['resume_happy_path', 'sourceDocumentHash_changed'],
      },
    ],
    failureCases: [
      {
        id: 'resume_happy_path',
        groupId: 'hash_and_trace_checkpoint',
        coveragePhase: 'six mental models full-link deterministic fixture',
        fullLinkRequired: true,
        expectedRecoveryActions: ['allow_resume'],
      },
      {
        id: 'sourceDocumentHash_changed',
        groupId: 'hash_and_trace_checkpoint',
        coveragePhase: 'six mental models full-link deterministic fixture',
        fullLinkRequired: true,
        expectedRecoveryActions: ['rebuild_trace_checkpoint'],
      },
    ],
    ...overrides,
  };
}

function implementationConfirmationSource(
  root: string,
  overrides: Record<string, unknown> = {}
): string {
  const sourcePath = path.join(root, 'source.md');
  const registry = registryFixture(overrides.registry as Record<string, unknown> | undefined);
  const governanceEventTypeRegistryPolicy =
    overrides.governanceEventTypeRegistryPolicy === null
      ? null
      : ((overrides.governanceEventTypeRegistryPolicy as Record<string, unknown> | undefined) ?? {
          controlFieldVocabulary: [
            'artifactIndex',
            'gateChecks',
            'recoveryContext',
            'runtimePolicySnapshotRef',
          ],
          payloadKindContracts: [
            {
              payloadKind: 'decision',
              requiredFields: ['eventType', 'decision'],
              forbiddenFields: ['result', 'status'],
              allowedControlWriteModes: ['control'],
            },
            {
              payloadKind: 'status',
              requiredFields: ['eventType', 'status'],
              forbiddenFields: ['result', 'decision'],
              allowedControlWriteModes: ['control'],
            },
            {
              payloadKind: 'artifactRefs',
              requiredFields: ['eventType', 'artifactRefs'],
              forbiddenFields: ['result', 'decision', 'status'],
              allowedControlWriteModes: ['artifact_only', 'context_update'],
            },
          ],
          controlWriteModePolicies: [
            {
              allowedControlWriteMode: 'control',
              allowedWritesControlFields: ['gateChecks', 'recoveryContext'],
            },
            {
              allowedControlWriteMode: 'artifact_only',
              allowedWritesControlFields: ['artifactIndex'],
            },
            {
              allowedControlWriteMode: 'context_update',
              allowedWritesControlFields: [
                'artifactIndex',
                'recoveryContext',
                'runtimePolicySnapshotRef',
              ],
            },
          ],
          eventSpecificRequirements: [],
        });
  const governanceEventTypeRegistry = (overrides.governanceEventTypeRegistry as unknown[]) ?? [
    {
      eventType: 'gate_check_recorded',
      ownerModel: 'implementation_readiness',
      payloadKind: 'decision',
      writesControlFields: ['gateChecks'],
      canAffectControlFlow: true,
      payloadContract: {
        requiredFields: ['eventType', 'decision'],
        forbiddenFields: ['result', 'status'],
        requiredSourceRefs: false,
        allowedControlWriteMode: 'control',
      },
    },
    {
      eventType: 'recovery_context_updated',
      ownerModel: 'execution_closure',
      payloadKind: 'artifactRefs',
      writesControlFields: ['recoveryContext'],
      canAffectControlFlow: true,
      payloadContract: {
        requiredFields: ['eventType', 'artifactRefs'],
        forbiddenFields: ['result', 'decision', 'status'],
        requiredSourceRefs: false,
        allowedControlWriteMode: 'context_update',
      },
    },
  ];
  writeFileSync(
    sourcePath,
    [
      '# Test Contract',
      '',
      '```yaml',
      'implementationConfirmation:',
      ...(governanceEventTypeRegistryPolicy
        ? [
            '  governanceEventTypeRegistryPolicy:',
            ...JSON.stringify(governanceEventTypeRegistryPolicy, null, 2)
              .split('\n')
              .map((line) => `    ${line}`),
          ]
        : []),
      '  governanceEventTypeRegistry:',
      ...governanceEventTypeRegistry.flatMap((event) =>
        JSON.stringify(event, null, 2)
          .split('\n')
          .map((line, index) => `${index === 0 ? '    - ' : '      '}${line}`)
      ),
      '  functionalResumeFailureCaseRegistry:',
      ...JSON.stringify(registry, null, 2)
        .split('\n')
        .map((line) => `    ${line}`),
      '```',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

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
      const sourcePath = implementationConfirmationSource(root);
      const outDir = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-RESUME',
        'resume'
      );
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
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
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
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
      expect(packet.resumeFailureCaseRegistryCoverage).toMatchObject({
        rawPresent: true,
        groups: 1,
        failureCases: 2,
        failureCaseExercisedCount: 2,
        recoveryActions: 2,
        fullLinkRequiredFixtureCases: ['resume_happy_path', 'sourceDocumentHash_changed'],
        unexercisedCases: [],
        issues: [],
      });
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
      const sourcePath = implementationConfirmationSource(root);
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
        '--expected-source-document-hash',
        sha256Text('old-source'),
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.decision).toBe('blocked');
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining(['resume-authority-hashes-current:sourceDocumentHash'])
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
      const sourcePath = implementationConfirmationSource(root);
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
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

  it('uses latest blocker status instead of blocking on resolved historical entries', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-latest-blockers-'));
    try {
      const recordPath = writeRecord(root, {
        failureRecords: [
          {
            failureId: 'failure-001',
            status: 'open',
          },
          {
            failureId: 'failure-001',
            status: 'resolved',
          },
        ],
        rerunLoops: [
          {
            rerunLoopId: 'rerun-001',
            status: 'in_progress',
            sourceRefs: [{ sourceType: 'gate_check', id: 'gate-001' }],
          },
          {
            rerunLoopId: 'rerun-001',
            status: 'resolved',
            sourceRefs: [{ sourceType: 'gate_check', id: 'gate-001' }],
          },
        ],
        rcaRecords: [
          {
            rcaId: 'rca-001',
            status: 'open',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
          },
          {
            rcaId: 'rca-001',
            status: 'resolved',
            sourceRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
          },
        ],
      });
      const sourcePath = implementationConfirmationSource(root);
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(0);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'resume-open-blockers-clear',
            decision: 'pass',
          }),
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
      const sourcePath = implementationConfirmationSource(root);
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          'resume-required-artifacts-indexed:artifact_not_indexed_or_hash_mismatch:_bmad-output/runtime/requirement-records/REQ-RESUME/evidence/proof.json',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the source document does not provide a functional resume failure registry', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-missing-registry-'));
    try {
      const recordPath = writeRecord(root);
      const sourcePath = path.join(root, 'source.md');
      writeFileSync(sourcePath, '# no registry\n', 'utf8');
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'resume-failure-case-registry-valid:functional_resume_failure_case_registry_missing'
          ),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when any registered failure case lacks explicit coverage evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-unexercised-case-'));
    try {
      const recordPath = writeRecord(root);
      const sourcePath = implementationConfirmationSource(root, {
        registry: {
          groups: [
            {
              groupId: 'hash_and_trace_checkpoint',
              label: 'Hash and trace checkpoint',
              caseRefs: [
                'resume_happy_path',
                'sourceDocumentHash_changed',
                'trace_checkpoint_missing',
              ],
            },
          ],
          failureCases: [
            {
              id: 'resume_happy_path',
              groupId: 'hash_and_trace_checkpoint',
              coveragePhase: 'six mental models full-link deterministic fixture',
              fullLinkRequired: true,
              expectedRecoveryActions: ['allow_resume'],
            },
            {
              id: 'sourceDocumentHash_changed',
              groupId: 'hash_and_trace_checkpoint',
              coveragePhase: 'six mental models full-link deterministic fixture',
              fullLinkRequired: true,
              expectedRecoveryActions: ['rebuild_trace_checkpoint'],
            },
            {
              id: 'trace_checkpoint_missing',
              groupId: 'hash_and_trace_checkpoint',
              coveragePhase: 'unplanned',
              fullLinkRequired: false,
              expectedRecoveryActions: ['rebuild_trace_checkpoint'],
            },
          ],
        },
      });
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.resumeFailureCaseRegistryCoverage).toMatchObject({
        failureCases: 3,
        failureCaseExercisedCount: 2,
        unexercisedCases: ['trace_checkpoint_missing'],
      });
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('resume_failure_unexercised_cases_present'),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('counts post-full-link coverage matrix cases as exercised when the registry marks that phase', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-post-full-link-'));
    try {
      const recordPath = writeRecord(root);
      const sourcePath = implementationConfirmationSource(root, {
        registry: {
          groups: [
            {
              groupId: 'hash_and_trace_checkpoint',
              label: 'Hash and trace checkpoint',
              caseRefs: [
                'resume_happy_path',
                'sourceDocumentHash_changed',
                'trace_checkpoint_missing',
              ],
            },
          ],
          failureCases: [
            {
              id: 'resume_happy_path',
              groupId: 'hash_and_trace_checkpoint',
              coveragePhase: 'six mental models full-link deterministic fixture',
              fullLinkRequired: true,
              expectedRecoveryActions: ['allow_resume'],
            },
            {
              id: 'sourceDocumentHash_changed',
              groupId: 'hash_and_trace_checkpoint',
              coveragePhase: 'six mental models full-link deterministic fixture',
              fullLinkRequired: true,
              expectedRecoveryActions: ['rebuild_trace_checkpoint'],
            },
            {
              id: 'trace_checkpoint_missing',
              groupId: 'hash_and_trace_checkpoint',
              coveragePhase: 'post-full-link coverage matrix',
              fullLinkRequired: false,
              expectedRecoveryActions: ['rebuild_trace_checkpoint'],
            },
          ],
        },
      });
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(0);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.resumeFailureCaseRegistryCoverage).toMatchObject({
        failureCases: 3,
        failureCaseExercisedCount: 3,
        unexercisedCases: [],
      });
      expect(packet.resumeFailureCaseRegistryCoverage.caseEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            caseId: 'trace_checkpoint_missing',
            exercisedBy: 'post_full_link_coverage_matrix',
          }),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a failure case references an undefined recovery action', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-unknown-action-'));
    try {
      const recordPath = writeRecord(root);
      const sourcePath = implementationConfirmationSource(root, {
        registry: {
          failureCases: [
            {
              id: 'resume_happy_path',
              groupId: 'hash_and_trace_checkpoint',
              fullLinkRequired: true,
              expectedRecoveryActions: ['unknown_action'],
            },
            {
              id: 'sourceDocumentHash_changed',
              groupId: 'hash_and_trace_checkpoint',
              fullLinkRequired: true,
              expectedRecoveryActions: ['rebuild_trace_checkpoint'],
            },
          ],
        },
      });
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('resume_failure_case_unknown_recovery_action'),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when functional resume defines a second event registry', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-second-registry-'));
    try {
      const recordPath = writeRecord(root);
      const sourcePath = implementationConfirmationSource(root, {
        registry: {
          controlledRecordEventTypes: [
            {
              eventType: 'gate_check_recorded',
              writesControlFields: ['gateChecks'],
            },
          ],
        },
      });
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('resume_failure_second_event_registry_present'),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a recovery action writes control fields without recordEventTypes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-missing-event-type-'));
    try {
      const recordPath = writeRecord(root);
      const sourcePath = implementationConfirmationSource(root, {
        registry: {
          recoveryActionDefinitions: [
            {
              actionId: 'allow_resume',
              label: 'Allow resume from checkpoint',
              writesControlFields: ['gateChecks'],
              recordEventTypes: [],
            },
            {
              actionId: 'rebuild_trace_checkpoint',
              label: 'Rebuild trace checkpoint',
              writesControlFields: ['recoveryContext', 'gateChecks'],
              recordEventTypes: ['recovery_context_updated', 'gate_check_recorded'],
            },
          ],
        },
      });
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('resume_failure_recovery_action_missing_record_event_types'),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when action event types are missing global payload contracts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-missing-payload-contract-'));
    try {
      const recordPath = writeRecord(root);
      const sourcePath = implementationConfirmationSource(root, {
        governanceEventTypeRegistry: [
          {
            eventType: 'gate_check_recorded',
            ownerModel: 'implementation_readiness',
            payloadKind: 'decision',
            writesControlFields: ['gateChecks'],
            canAffectControlFlow: true,
          },
        ],
      });
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('governance_event_type_missing_payload_contract'),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when governance event type registry policy is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'functional-resume-missing-event-policy-'));
    try {
      const recordPath = writeRecord(root);
      const sourcePath = implementationConfirmationSource(root, {
        governanceEventTypeRegistryPolicy: null,
      });
      const outDir = path.join(root, 'resume');
      const code = mainFunctionalResumeCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--out-dir',
        outDir,
      ]);

      expect(code).toBe(1);
      const packet = JSON.parse(
        readFileSync(path.join(outDir, 'resume-packets.jsonl'), 'utf8').trim()
      );
      expect(packet.blockingIssues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('governance_event_type_registry_policy_missing'),
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
