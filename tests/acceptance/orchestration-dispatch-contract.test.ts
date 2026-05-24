import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
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
      const recordDir = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQSET-PACKET');
      mkdirSync(recordDir, { recursive: true });
      writeFileSync(
        path.join(recordDir, 'requirement-record.json'),
        JSON.stringify({ recordId: 'REQ-PACKET', requirementSetId: 'REQSET-PACKET', runId: 'run-packet' }) + '\n',
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
});
