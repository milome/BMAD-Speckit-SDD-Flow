import { describe, expect, it, vi } from 'vitest';
import {
  assessRequirementsContractJudgeRequestCapacity,
  invokeRequirementsContractJudgeWithRecovery,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-capability-resolver';

function completeRequest() {
  return {
    schemaVersion: 'requirements-contract-judge-request/v2',
    judgeRequestHash: `sha256:${'1'.repeat(64)}`,
    prompt: {
      systemPrompt: '审计完整需求合同',
      rubric: { dimensions: ['completeness'] },
      structuredOutputSchema: { type: 'object' },
      outputTokenReserve: 4096,
    },
    auditPacket: {
      schemaVersion: 'requirements-contract-judge-audit-packet/v1',
      body: { source: '批量退款审批'.repeat(200) },
    },
  };
}

describe('requirements contract Judge provider capacity and recovery', () => {
  it('classifies typed orphan transport evidence without weakening directory idempotency', async () => {
    const orphan = Object.assign(new Error('codex_cli_judge_orphan_transport_failure'), {
      name: 'CodexCliJudgeOrphanTransportFailure',
      code: 'CODEX_CLI_JUDGE_ORPHAN_TRANSPORT_FAILURE',
      issueCode: 'judge_provider_transport_failed',
      orphanRecoveryEvidence: {
        stdoutBytes: 377,
        stdoutHash: `sha256:${'a'.repeat(64)}`,
        stderrBytes: 0,
        stderrHash: `sha256:${'b'.repeat(64)}`,
      },
    });
    const result = await invokeRequirementsContractJudgeWithRecovery({
      request: completeRequest(),
      provider: { requestPolicy: {} },
      attemptOrdinal: 1,
      invoke: vi.fn().mockRejectedValue(orphan),
    });

    expect(result).toMatchObject({
      state: 'audit_pending',
      resumable: true,
      issueCode: 'judge_provider_transport_failed',
      attempt: {
        attemptOrdinal: 1,
        outcome: 'transport_failure',
        issueCode: 'judge_provider_transport_failed',
      },
    });

    await expect(invokeRequirementsContractJudgeWithRecovery({
      request: completeRequest(),
      provider: { requestPolicy: {} },
      attemptOrdinal: 1,
      invoke: vi.fn().mockRejectedValue(new Error('codex_cli_judge_output_dir_already_exists')),
    })).rejects.toThrow('codex_cli_judge_output_dir_already_exists');

    const malformed = Object.assign(new Error('codex_cli_judge_orphan_transport_failure'), {
      name: 'CodexCliJudgeOrphanTransportFailure',
      code: 'CODEX_CLI_JUDGE_ORPHAN_TRANSPORT_FAILURE',
      issueCode: 'judge_provider_transport_failed',
      orphanRecoveryEvidence: {
        stdoutBytes: -1,
        stdoutHash: `sha256:${'a'.repeat(64)}`,
        stderrBytes: 0,
        stderrHash: 'sha256:not-a-hash',
      },
    });
    await expect(invokeRequirementsContractJudgeWithRecovery({
      request: completeRequest(),
      provider: { requestPolicy: {} },
      attemptOrdinal: 1,
      invoke: vi.fn().mockRejectedValue(malformed),
    })).rejects.toBe(malformed);
  });

  it('allows dispatch without guessing when the selected provider declares no capacity', () => {
    const result = assessRequirementsContractJudgeRequestCapacity({
      request: completeRequest(),
      provider: { requestPolicy: {} },
    });

    expect(result.decision).toBe('dispatch_allowed');
    expect(result.declaredCapacity).toBeNull();
    expect(result.actual.requestSerializedBytes).toBeGreaterThan(0);
    expect(result.actual.auditPacketSerializedBytes).toBeGreaterThan(0);
    expect(result.actual.outputTokenReserve).toBe(4096);
    expect(result).not.toHaveProperty('estimatedTokens');
  });

  it('returns a resumable Judge-stage block when a declared transport byte limit is exceeded', () => {
    const request = completeRequest();
    const result = assessRequirementsContractJudgeRequestCapacity({
      request,
      provider: { requestPolicy: { transportByteLimit: 128 } },
    });

    expect(result).toMatchObject({
      decision: 'capacity_blocked',
      issueCode: 'judge_provider_capacity_exceeded',
      state: 'audit_pending',
      resumable: true,
      resumeFrom: 'judge_dispatch',
      nextActions: ['select_larger_context_provider', 'adjust_provider_deployment_capacity'],
    });
    expect(result.actual.requestSerializedBytes).toBeGreaterThan(128);
  });

  it('treats provider payload rejection as an unaccepted transport attempt and preserves recovery', async () => {
    const invoke = vi.fn().mockRejectedValue(
      Object.assign(new Error('maximum context length exceeded'), { status: 413 })
    );

    const result = await invokeRequirementsContractJudgeWithRecovery({
      request: completeRequest(),
      provider: { requestPolicy: {} },
      attemptOrdinal: 1,
      invoke,
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      state: 'audit_pending',
      acceptedEvaluation: false,
      resumable: true,
      resumeFrom: 'judge_dispatch',
      issueCode: 'judge_provider_payload_rejected',
      attempt: {
        attemptOrdinal: 1,
        outcome: 'transport_failure',
        acceptedEvaluation: false,
      },
    });
  });

  it('returns a schema-invalid raw provider response to the attempt owner for durable rejection', async () => {
    const rawResponse = { schemaVersion: 'requirements-contract-judge-response/v2', verdict: 'pass' };
    const error = Object.assign(new Error('response schema invalid'), { rawResponse });

    const result = await invokeRequirementsContractJudgeWithRecovery({
      request: completeRequest(),
      provider: { requestPolicy: {} },
      attemptOrdinal: 1,
      invoke: vi.fn().mockRejectedValue(error),
    });

    expect(result).toMatchObject({
      state: 'response_received',
      acceptedEvaluation: false,
      response: rawResponse,
      attempt: { outcome: 'response_validation_failure', acceptedEvaluation: false },
    });
  });

  it('does not accept a raw response before the canonical response validator runs', async () => {
    const rawResponse = { schemaVersion: 'requirements-contract-judge-response/v2', verdict: 'pass' };

    const result = await invokeRequirementsContractJudgeWithRecovery({
      request: completeRequest(),
      provider: { requestPolicy: {} },
      attemptOrdinal: 1,
      invoke: vi.fn().mockResolvedValue(rawResponse),
    });

    expect(result).toMatchObject({
      state: 'response_received',
      acceptedEvaluation: false,
      response: rawResponse,
      attempt: { outcome: 'response_received', acceptedEvaluation: false },
    });
  });

  it('does not hide provider configuration errors as retryable transport failures', async () => {
    await expect(invokeRequirementsContractJudgeWithRecovery({
      request: completeRequest(),
      provider: { requestPolicy: {} },
      attemptOrdinal: 1,
      invoke: vi.fn().mockRejectedValue(new Error('judge_adapter_endpoint_not_allowlisted')),
    })).rejects.toThrow('judge_adapter_endpoint_not_allowlisted');
  });
});
