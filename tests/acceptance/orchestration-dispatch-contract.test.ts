import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type ExecutionDisciplineProfile,
  createExecutionPacket,
  createResumePacket,
  fallbackAllowed,
  packetArtifactPath,
  resolveDispatchRoute,
} from '../../scripts/orchestration-dispatch-contract';

describe('orchestration dispatch contract', () => {
  it('maps interactive implementation and review work to host-native child transports', () => {
    expect(resolveDispatchRoute('cursor', 'implement')).toEqual({
      tool: 'mcp_task',
      subtype: 'generalPurpose',
      fallback: 'disabled',
    });
    expect(resolveDispatchRoute('cursor', 'audit')).toEqual({
      tool: 'Task',
      subtype: 'code-reviewer',
      fallback: 'mcp_task:generalPurpose',
    });
    expect(resolveDispatchRoute('claude', 'implement')).toEqual({
      tool: 'Agent',
      subtype: 'general-purpose',
      fallback: 'disabled',
    });
    expect(resolveDispatchRoute('claude', 'audit')).toEqual({
      tool: 'Agent',
      subtype: 'code-reviewer',
      fallback: 'Agent:general-purpose',
    });
    expect(resolveDispatchRoute('codex', 'implement')).toEqual({
      tool: 'codex',
      subtype: 'worker:implement',
      fallback: 'disabled',
    });
    expect(resolveDispatchRoute('codex', 'audit')).toEqual({
      tool: 'codex',
      subtype: 'worker:audit',
      fallback: 'disabled',
    });
    expect(resolveDispatchRoute('codex', 'remediate')).toEqual({
      tool: 'codex',
      subtype: 'worker:remediate',
      fallback: 'disabled',
    });
    expect(resolveDispatchRoute('codex', 'document')).toEqual({
      tool: 'codex',
      subtype: 'worker:document',
      fallback: 'disabled',
    });
  });

  it('hard-disables autonomous fallback dispatch', () => {
    expect(
      fallbackAllowed({
        interactive: true,
        transportAvailable: true,
        explicitFallbackRequested: false,
      })
    ).toBe(false);
    expect(
      fallbackAllowed({
        interactive: false,
        transportAvailable: true,
        explicitFallbackRequested: false,
      })
    ).toBe(false);
    expect(
      fallbackAllowed({
        interactive: true,
        transportAvailable: false,
        explicitFallbackRequested: false,
      })
    ).toBe(false);
    expect(
      fallbackAllowed({
        interactive: true,
        transportAvailable: true,
        explicitFallbackRequested: true,
      })
    ).toBe(false);
  });

  it('builds packet contracts with stable identity and scope', () => {
    const executionPacket = createExecutionPacket({
      packetId: 'pkt-exec-01',
      parentSessionId: 'session-03',
      sourceRecommendationPacketId: 'pkt-rec-01',
      flow: 'story',
      phase: 'implement',
      taskType: 'implement',
      role: 'implementation-worker',
      inputArtifacts: ['spec.md', 'plan.md'],
      allowedWriteScope: ['src/**', 'tests/**'],
      expectedDelta: 'implement the approved journey slice',
      successCriteria: ['targeted tests pass', 'handoff emitted'],
      stopConditions: ['true blocker detected'],
      downstreamConsumer: 'auditor-implement',
    });

    const resumePacket = createResumePacket({
      packetId: 'pkt-resume-01',
      parentSessionId: 'session-03',
      originalExecutionPacketId: executionPacket.packetId,
      flow: 'story',
      phase: 'implement',
      role: 'implementation-worker',
      resumeReason: 'readiness gate passed after remediation',
      inputArtifacts: executionPacket.inputArtifacts,
      allowedWriteScope: executionPacket.allowedWriteScope,
      expectedDelta: executionPacket.expectedDelta,
      successCriteria: executionPacket.successCriteria,
      stopConditions: executionPacket.stopConditions,
    });

    expect(packetArtifactPath('D:/repo', 'session-03', executionPacket.packetId)).toContain(
      path.join(
        '_bmad-output',
        'runtime',
        'governance',
        'packets',
        'session-03',
        'pkt-exec-01.json'
      )
    );
    expect(executionPacket.sourceRecommendationPacketId).toBe('pkt-rec-01');
    expect(resumePacket.originalExecutionPacketId).toBe(executionPacket.packetId);
    expect(resumePacket.resumeReason).toContain('readiness gate passed');
  });

  it('writes packet artifacts to requirement-scoped prompt packet path when a record exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dispatch-contract-req-'));
    try {
      const recordDir = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQSET-PACKET'
      );
      mkdirSync(recordDir, { recursive: true });
      writeFileSync(
        path.join(recordDir, 'requirement-record.json'),
        JSON.stringify({
          recordId: 'REQ-PACKET',
          requirementSetId: 'REQSET-PACKET',
          runId: 'run-packet',
        }) + '\n',
        'utf8'
      );

      expect(packetArtifactPath(root, 'run-packet', 'packet-001')).toContain(
        path.join(
          '_bmad-output',
          'runtime',
          'requirement-records',
          'REQSET-PACKET',
          'prompts',
          'prompt-packets',
          'packet-001.json'
        )
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('enforces authority-mode metadata on execution packets', () => {
    expect(() =>
      createExecutionPacket({
        packetId: 'pkt-compiled-missing',
        parentSessionId: 'session-compiled',
        flow: 'standalone_tasks',
        phase: 'implement',
        taskType: 'implement',
        role: 'implementation-worker',
        inputArtifacts: [],
        allowedWriteScope: ['scripts/**'],
        expectedDelta: 'compiled work',
        successCriteria: ['compiled prompt consumed'],
        stopConditions: ['compiler blocked'],
        authorityMode: 'compiled_implementation_confirmation',
      })
    ).toThrow(/compiledPromptRef or compilerBlock is required/u);

    expect(() =>
      createExecutionPacket({
        packetId: 'pkt-legacy-missing',
        parentSessionId: 'session-legacy',
        flow: 'standalone_tasks',
        phase: 'implement',
        taskType: 'implement',
        role: 'implementation-worker',
        inputArtifacts: [],
        allowedWriteScope: ['scripts/**'],
        expectedDelta: 'legacy work',
        successCriteria: ['legacy fallback consumed'],
        stopConditions: ['true blocker'],
        authorityMode: 'legacy_generic_prompt',
      })
    ).toThrow(/legacyPromptFallbackReason is required/u);

    const packet = createExecutionPacket({
      packetId: 'pkt-compiled',
      parentSessionId: 'session-compiled',
      flow: 'standalone_tasks',
      phase: 'implement',
      taskType: 'implement',
      role: 'implementation-worker',
      inputArtifacts: [],
      allowedWriteScope: ['scripts/**'],
      expectedDelta: 'compiled work',
      successCriteria: ['compiled prompt consumed'],
      stopConditions: ['compiler blocked'],
      authorityMode: 'compiled_implementation_confirmation',
      compiledPromptRef: {
        modelPacketPath: 'trace-execution/pkt-compiled/model_packet.json',
        modelPacketHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        humanPromptPath: 'trace-execution/pkt-compiled/human_prompt.txt',
        humanPromptHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        auditReceiptPath: 'trace-execution/pkt-compiled/audit_receipt.json',
        auditReceiptHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        goalExecutionPath: null,
        goalExecutionHash: null,
        sourceDocumentHash:
          'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        implementationConfirmationHash:
          'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      },
      executionStrategy: {
        eventType: 'execution_strategy_selected',
        strategyId: 'compiled_trace_direct',
        availability: 'available',
        selectedBy: 'policy',
        strategyOptionsHash:
          'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        selectedOptionHash:
          'sha256:9999999999999999999999999999999999999999999999999999999999999999',
        modelPacketHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        sourceDocumentHash:
          'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        implementationConfirmationHash:
          'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      },
    });

    expect(packet.authorityMode).toBe('compiled_implementation_confirmation');
    expect(packet.legacyPromptFallbackReason).toBeNull();
    expect(packet.compiledPromptRef?.modelPacketPath).toContain('model_packet.json');
    expect(packet.executionStrategy?.strategyId).toBe('compiled_trace_direct');
  });

  it('requires compiled execution strategy selection after model packet gate pass', () => {
    expect(() =>
      createExecutionPacket({
        packetId: 'pkt-compiled-without-strategy',
        parentSessionId: 'session-compiled',
        flow: 'standalone_tasks',
        phase: 'implement',
        taskType: 'implement',
        role: 'implementation-worker',
        inputArtifacts: [],
        allowedWriteScope: ['scripts/**'],
        expectedDelta: 'compiled work',
        successCriteria: ['compiled prompt consumed'],
        stopConditions: ['compiler blocked'],
        authorityMode: 'compiled_implementation_confirmation',
        compiledPromptRef: {
          modelPacketPath: 'trace-execution/pkt-compiled/model_packet.json',
          modelPacketHash:
            'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          humanPromptPath: 'trace-execution/pkt-compiled/human_prompt.txt',
          humanPromptHash:
            'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          auditReceiptPath: 'trace-execution/pkt-compiled/audit_receipt.json',
          auditReceiptHash:
            'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          goalExecutionPath: null,
          goalExecutionHash: null,
          sourceDocumentHash:
            'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          implementationConfirmationHash:
            'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        },
      })
    ).toThrow(/executionStrategy is required/u);

    expect(() =>
      createExecutionPacket({
        packetId: 'pkt-strategy-bypass',
        parentSessionId: 'session-compiled',
        flow: 'standalone_tasks',
        phase: 'implement',
        taskType: 'implement',
        role: 'implementation-worker',
        inputArtifacts: [],
        allowedWriteScope: ['scripts/**'],
        expectedDelta: 'compiled work',
        successCriteria: ['compiled prompt consumed'],
        stopConditions: ['compiler blocked'],
        authorityMode: 'legacy_generic_prompt',
        legacyPromptFallbackReason: 'no_confirmed_source',
        executionStrategy: {
          eventType: 'execution_strategy_selected',
          strategyId: 'compiled_trace_direct',
          availability: 'available',
          selectedBy: 'policy',
          strategyOptionsHash:
            'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          selectedOptionHash:
            'sha256:9999999999999999999999999999999999999999999999999999999999999999',
          modelPacketHash:
            'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          sourceDocumentHash:
            'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          implementationConfirmationHash:
            'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        },
      })
    ).toThrow(/cannot bypass compiledPromptRef/u);
  });

  it('accepts typed execution discipline profile metadata without source authority fields', () => {
    const profile: ExecutionDisciplineProfile = {
      profileId: 'standalone_tasks_execution',
      profileHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      flow: 'standalone_tasks',
      authority: 'discipline_profile_only',
      sourceReferences: ['bmad-standalone-tasks/SKILL.md'],
      rules: ['Preserve compiled model_packet.json requirement authority.'],
      requiredEvidence: ['task_report', 'validation_commands', 'audit_report', 'score_receipt'],
      auditScoringConvergencePolicy: {
        auditPassRequired: true,
        criticalAuditorNoNewGapRequired: true,
        scoreReceiptRequired: true,
        dimensionContractMatchRequired: true,
        thresholdPassRequired: true,
        vetoForbidden: true,
        iterationCountRequired: true,
        freshHashesRequired: true,
      },
      dimensionContractSelector: 'tasks',
      forbiddenOverrides: ['traceRows', 'requiredCommands'],
      lintPolicy: { required: true, blockOnWarnings: true, forbiddenWaivers: [] },
      docCommentPolicy: { publicApiRequired: true, languages: ['typescript'] },
      failureExclusionPolicy: {
        objectiveFieldsRequired: true,
        userApprovalRequiredForExcludedTests: false,
      },
      testExecutionPolicy: {
        projectRootRequired: true,
        pytestCleanupEvidenceRequired: false,
      },
      subagentContinuityPolicy: {
        returnAllowedOnlyOn: [
          'scope_complete',
          'real_blocker',
          'audit_boundary',
          'resume_checkpoint',
        ],
      },
      auditReportContract: {
        parseableScoreBlockRequired: true,
        allowedGrades: ['A', 'B', 'C', 'D'],
        forbidScoreRanges: true,
      },
      hostCloseoutPolicy: { prosePassIsCompletion: false },
    };

    const packet = createExecutionPacket({
      packetId: 'pkt-profile',
      parentSessionId: 'session-profile',
      flow: 'standalone_tasks',
      phase: 'implement',
      taskType: 'implement',
      role: 'implementation-worker',
      inputArtifacts: [],
      allowedWriteScope: ['scripts/**'],
      expectedDelta: 'profile work',
      successCriteria: ['profile attached'],
      stopConditions: ['true blocker'],
      authorityMode: 'legacy_generic_prompt',
      legacyPromptFallbackReason: 'no_confirmed_source',
      executionDisciplineProfile: profile,
    });

    expect(packet.executionDisciplineProfile?.authority).toBe('discipline_profile_only');
    expect(JSON.stringify(packet.executionDisciplineProfile)).not.toContain('"taskList"');
    expect(JSON.stringify(packet.executionDisciplineProfile)).not.toContain('"legacyPromptBody"');
  });
});
