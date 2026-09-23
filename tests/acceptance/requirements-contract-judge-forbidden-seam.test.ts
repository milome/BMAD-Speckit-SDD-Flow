import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  executeAuditProviderJudgeAdapter,
  buildMainAgentCanonicalJudgeRunDispatch,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { auditProviderRunHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-independence';

const ROOT = process.cwd();
const LEGACY_ACTION = 'requirements-contract-critical-auditor-judge-adapter';

describe('requirements contract Judge forbidden seams', () => {
  it('invokes the neutral audit provider Judge adapter instead of failing unconditionally', () => {
    const expected = {
      providerId: 'provider-1',
      model: 'model-1',
      transport: 'cli',
      adapterRef: 'CodexCliJudgeAdapter',
      apiStyle: 'cli',
      configuredBaseUrlHash:
        'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      independenceClass: 'different_provider_different_model',
      providerRegistryHash:
        'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      providerConfigurationHash:
        'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      requestHash: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      sourceDocumentHash:
        'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      semanticModelHash:
        'sha256:5555555555555555555555555555555555555555555555555555555555555555',
      projectionSetHash:
        'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    };
    const evidenceWithoutRunHash = {
      ...expected,
      requestedModel: expected.model,
      model: expected.model,
      providerRunId: 'provider-run-1',
      responseHash:
        'sha256:7777777777777777777777777777777777777777777777777777777777777777',
    };
    const response = {
      verdict: 'no_new_valid_gap',
      requestHash: expected.requestHash,
      sourceDocumentHash: expected.sourceDocumentHash,
      semanticModelHash: expected.semanticModelHash,
      projectionSetHash: expected.projectionSetHash,
      checkedProjectionQualityRuleCodes: ['projection.current'],
      independentProviderEvidence: {
        ...evidenceWithoutRunHash,
        runHash: auditProviderRunHash(evidenceWithoutRunHash),
      },
      providerInvocationReceiptRef: {
        path: 'out/audit-provider-judge-invocation-receipt.json',
        contentHash:
          'sha256:8888888888888888888888888888888888888888888888888888888888888888',
        receiptHash:
          'sha256:9999999999999999999999999999999999999999999999999999999999999999',
      },
      judgeAdapterHostExecution: {
        adapterKind: 'audit_provider_judge_invocation',
      },
    };

    expect(
      executeAuditProviderJudgeAdapter({
        projectRoot: ROOT,
        requestPath: 'request.json',
        outputDir: 'out',
        roundIndex: 1,
        expected,
        processExecutor: (() => ({
          status: 0,
          stdout: JSON.stringify(response),
          stderr: '',
        })) as never,
      })
    ).toEqual(response);
  });

  it('exposes canonical judge run dispatch without caller authority injection', () => {
    expect(() =>
      buildMainAgentCanonicalJudgeRunDispatch({
        projectRoot: ROOT,
        config: '_bmad/_config/governance-remediation.yaml',
        request: 'request.json',
        role: 'requirements_judge',
        attemptId: 'attempt-1',
        outputDir: 'out',
        controlledDispatchRef: { packetId: 'packet-1', packetKind: 'execution' },
        callerVerdict: 'pass',
      })
    ).toThrow('main_agent_judge_bridge_caller_authority_injection');

    expect(() =>
      buildMainAgentCanonicalJudgeRunDispatch({
        projectRoot: ROOT,
        config: '_bmad/_config/governance-remediation.yaml',
        request: 'request.json',
        role: 'final_acceptance_judge' as never,
        attemptId: 'attempt-2',
        outputDir: 'out',
        controlledDispatchRef: { packetId: 'packet-2', packetKind: 'execution' },
      })
    ).toThrow('main_agent_judge_run_role_explicit_required');

    const dispatch = buildMainAgentCanonicalJudgeRunDispatch({
      projectRoot: ROOT,
      config: '_bmad/_config/governance-remediation.yaml',
      request: 'request.json',
      role: 'requirements_judge',
      attemptId: 'attempt-3',
      outputDir: 'out',
      controlledDispatchRef: { packetId: 'packet-3', packetKind: 'execution' },
    });

    expect(dispatch).toMatchObject({
      command: 'bmad-speckit judge run',
      role: 'requirements_judge',
      roleInference: false,
      directAdapterDispatch: false,
      callerAuthorityInjection: false,
      decision: 'pass',
    });
    expect(dispatch.argv).toContain('judge');
    expect(dispatch.argv).toContain('run');
  });

  it('does not expose the legacy Critical Auditor adapter as a public package action', () => {
    const bin = readFileSync(path.join(ROOT, 'packages/bmad-speckit/bin/bmad-speckit.js'), 'utf8');
    const manifest = JSON.parse(
      readFileSync(
        path.join(
          ROOT,
          '_bmad/shared/requirements-contract/requirements-contract-package-runtime-action-binding-manifest.json'
        ),
        'utf8'
      )
    ) as { actions: Array<{ actionId: string }> };

    expect(bin).not.toContain(LEGACY_ACTION);
    expect(manifest.actions.map((action) => action.actionId)).not.toContain(LEGACY_ACTION);
    expect(manifest.actions.map((action) => action.actionId)).toContain(
      'requirements-contract-judge-run'
    );
  });
});
