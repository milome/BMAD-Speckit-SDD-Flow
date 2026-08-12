import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runRequirementsContractProductionJudgePipeline } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-judge-pipeline';
import { canonicalJson } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';
import { atomicNoClobberPublish } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-atomic-no-clobber-publisher';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import type { PreparedRequirementsContractJudgeInvocation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation';

const HASH = (value: string) => sha256Stable({ value });

function preparedInvocation(
  invoke: PreparedRequirementsContractJudgeInvocation['invoke'],
  provider: Record<string, any> = {
    transport: 'openai-compatible',
    apiStyle: 'chat_completions',
    model: 'judge-model',
    requestPolicy: {},
  }
): PreparedRequirementsContractJudgeInvocation {
  return {
    configPath: 'test-config',
    judgeRuntime: {},
    providerRef: 'judge-a',
    provider,
    providerRegistryHash: HASH('registry'),
    credentialProviderRef: 'judge-a',
    credentialRevision: 1,
    invoke,
  };
}

function configuredJudgePrompt(label = 'configured-requirements-judge') {
  return {
    systemPrompt: `System prompt loaded from ${label}.`,
    rubric: {
      source: label,
      verdictRule: 'pass requires complete review and zero findings',
    },
    structuredOutputSchema: {
      type: 'object',
      required: ['schemaVersion', 'judgeRequestHash', 'verdict'],
    },
    outputTokenReserve: 4096,
  };
}

function responseFor(request: Record<string, any>) {
  const body = request.auditPacket.body;
  return {
    schemaVersion: 'requirements-contract-judge-response/v2',
    judgeRequestHash: request.judgeRequestHash,
    verdict: 'pass',
    findings: [],
    advisoryObservations: [],
    checkedDimensionIds: body.mandatoryDimensionIds,
    dimensionResults: body.mandatoryDimensionIds.map((dimensionId: string) => ({
      dimensionId,
      decision: 'pass',
      findingRefs: [],
    })),
    reviewedArtifactRefs: body.artifactIds,
    reviewedMustRefs: body.requirementIds,
    insufficientAuditReasons: [],
  };
}

function failResponseFor(request: Record<string, any>, finding: Record<string, any>) {
  const response = responseFor(request);
  return {
    ...response,
    verdict: 'fail',
    findings: [finding],
    dimensionResults: response.dimensionResults.map((result: Record<string, any>, index: number) => ({
      ...result,
      decision: index === 0 ? 'fail' : result.decision,
      findingRefs: index === 0 ? [finding.findingId] : [],
    })),
  };
}

function writeCanonicalJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, canonicalJson(value), 'utf8');
}

describe('requirements production Judge pipeline', () => {
  it('uses the selected production provider and creates a real aggregate and EffectivePass', async () => {
    const invoke = vi.fn(async (request: Record<string, any>) => responseFor(request));
    const judgePrompt = configuredJudgePrompt('fixture-a');
    const result = await runRequirementsContractProductionJudgePipeline({
      authoringRequestId: 'REQ-001',
      recordRoot: 'unused-by-in-memory-test',
      activeAuthority: {
        activeSemanticRevisionId: 'SEM-001',
        activeSemanticIrPath: 'authoring/semantic-revisions/SEM-001/semantic-ir.json',
        activeScopeSemanticHash: HASH('scope'),
        activeBindingRevisionId: 'BIND-001',
        activeSourceBindingPath: 'authoring/source-bindings/BIND-001/source-binding.json',
        activeSourceBindingHash: HASH('binding'),
        activeAuthoringAttemptId: 'ATTEMPT-001',
        activeBuildManifestPath: 'authoring/staging/ATTEMPT-001/contract-build-manifest.json',
        activeBuildManifestHash: HASH('build'),
      },
      buildManifest: {
        buildManifestHash: HASH('build'),
        artifactEntries: [],
        auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet') },
        projectionReportRefs: [],
      },
      auditPacket: {
        schemaVersion: 'requirements-contract-judge-audit-packet/v1',
        semanticRevisionId: 'SEM-001',
        scopeSemanticHash: HASH('scope'),
        body: {
          artifactIds: ['final-markdown'],
          requirementIds: ['MUST-001'],
          mandatoryDimensionIds: ['business-rule-completeness'],
        },
      },
      judgePrompt,
      providerSelection: {
        providerRef: 'judge-a',
        provider: { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: {} },
        adapterRef: 'OpenAICompatibleJudgeAdapter',
        providerRegistryHash: HASH('registry'),
      },
      preparedInvocation: preparedInvocation(async ({ request }) => invoke(request)),
      persist: false,
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.request.prompt).toEqual(judgePrompt);
    expect(result.status).toBe('audited_pass');
    expect(result.aggregate.decision).toBe('pass');
    expect(result.effectivePass.decision).toBe('pass');
    expect(result.activeRequest.status).toBe('audited_pass');
  });

  it('does not invoke a provider whose declared capacity is too small', async () => {
    const invoke = vi.fn();
    const result = await runRequirementsContractProductionJudgePipeline({
      authoringRequestId: 'REQ-002',
      recordRoot: 'unused-by-in-memory-test',
      activeAuthority: {
        activeSemanticRevisionId: 'SEM-002', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-002/semantic-ir.json', activeScopeSemanticHash: HASH('scope-2'),
        activeBindingRevisionId: 'BIND-002', activeSourceBindingPath: 'authoring/source-bindings/BIND-002/source-binding.json', activeSourceBindingHash: HASH('binding-2'),
        activeAuthoringAttemptId: 'ATTEMPT-002', activeBuildManifestPath: 'authoring/staging/ATTEMPT-002/contract-build-manifest.json', activeBuildManifestHash: HASH('build-2'),
      },
      buildManifest: { buildManifestHash: HASH('build-2'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-2') }, projectionReportRefs: [] },
      auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-002', scopeSemanticHash: HASH('scope-2'), body: { artifactIds: ['a'], requirementIds: ['M'], mandatoryDimensionIds: ['D'], payload: 'x'.repeat(1000) } },
      judgePrompt: configuredJudgePrompt('fixture-b'),
      providerSelection: { providerRef: 'judge-a', provider: { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: { transportByteLimit: 128 } }, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
      preparedInvocation: preparedInvocation(async ({ request }) => invoke(request), {
        transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model',
        requestPolicy: { transportByteLimit: 128 },
      }),
      persist: false,
    });

    expect(invoke).not.toHaveBeenCalled();
    expect(result.status).toBe('audit_pending');
    expect(result.issueCode).toBe('judge_provider_capacity_exceeded');
    expect(result.capacity.actual.requestSerializedBytes).toBeGreaterThan(128);
  });

  it('persists the same hash identity through Windows-safe physical path segments', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-path-'));
    try {
      const result = await runRequirementsContractProductionJudgePipeline({
        authoringRequestId: 'REQ-003', recordRoot: root,
        activeAuthority: {
          activeSemanticRevisionId: 'SEM-003', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-003/semantic-ir.json', activeScopeSemanticHash: HASH('scope-3'),
          activeBindingRevisionId: 'BIND-003', activeSourceBindingPath: 'authoring/source-bindings/BIND-003/source-binding.json', activeSourceBindingHash: HASH('binding-3'),
          activeAuthoringAttemptId: 'ATTEMPT-003', activeBuildManifestPath: 'authoring/staging/ATTEMPT-003/contract-build-manifest.json', activeBuildManifestHash: HASH('build-3'),
        },
        buildManifest: { buildManifestHash: HASH('build-3'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-3') }, projectionReportRefs: [] },
        auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-003', scopeSemanticHash: HASH('scope-3'), body: { artifactIds: ['a'], requirementIds: ['M'], mandatoryDimensionIds: ['D'] } },
        judgePrompt: configuredJudgePrompt('fixture-c'),
        providerSelection: { providerRef: 'judge-a', provider: { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: {} }, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
        preparedInvocation: preparedInvocation(async ({ request }) => responseFor(request)),
      });

      expect(result.activeRequest.requestPath).toMatch(/^quality\/requests\/sha256-[a-f0-9]{64}\/judge-request\.json$/u);
      expect(result.activeRequest.requestPath).not.toContain(':');
      expect(result.request.judgeRequestHash).toMatch(/^sha256:/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves the Judge request and attempt when the provider rejects payload by status', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-capacity-recovery-'));
    try {
      const result = await runRequirementsContractProductionJudgePipeline({
        authoringRequestId: 'REQ-004', recordRoot: root,
        activeAuthority: {
          activeSemanticRevisionId: 'SEM-004', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-004/semantic-ir.json', activeScopeSemanticHash: HASH('scope-4'),
          activeBindingRevisionId: 'BIND-004', activeSourceBindingPath: 'authoring/source-bindings/BIND-004/source-binding.json', activeSourceBindingHash: HASH('binding-4'),
          activeAuthoringAttemptId: 'ATTEMPT-004', activeBuildManifestPath: 'authoring/staging/ATTEMPT-004/contract-build-manifest.json', activeBuildManifestHash: HASH('build-4'),
        },
        buildManifest: { buildManifestHash: HASH('build-4'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-4') }, projectionReportRefs: [] },
        auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-004', scopeSemanticHash: HASH('scope-4'), body: { artifactIds: ['a'], requirementIds: ['M'], mandatoryDimensionIds: ['D'] } },
        judgePrompt: configuredJudgePrompt('fixture-d'),
        providerSelection: { providerRef: 'judge-a', provider: { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: {} }, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
        preparedInvocation: preparedInvocation(async () => {
          throw Object.assign(new Error('provider rejected request'), { status: 413 });
        }),
      });

      expect(result).toMatchObject({
        status: 'audit_pending',
        issueCode: 'judge_provider_payload_rejected',
        activeRequest: {
          status: 'audit_pending',
          acceptedEvaluation: false,
          attemptCount: 1,
          lastAttemptPath: expect.stringMatching(/dispatch-attempts\/1\.json$/u),
          requestPath: expect.stringMatching(/judge-request\.json$/u),
        },
      });
      const resumed = await runRequirementsContractProductionJudgePipeline({
        authoringRequestId: 'REQ-004', recordRoot: root,
        activeAuthority: {
          activeSemanticRevisionId: 'SEM-004', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-004/semantic-ir.json', activeScopeSemanticHash: HASH('scope-4'),
          activeBindingRevisionId: 'BIND-004', activeSourceBindingPath: 'authoring/source-bindings/BIND-004/source-binding.json', activeSourceBindingHash: HASH('binding-4'),
          activeAuthoringAttemptId: 'ATTEMPT-004', activeBuildManifestPath: 'authoring/staging/ATTEMPT-004/contract-build-manifest.json', activeBuildManifestHash: HASH('build-4'),
        },
        buildManifest: { buildManifestHash: HASH('build-4'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-4') }, projectionReportRefs: [] },
        auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-004', scopeSemanticHash: HASH('scope-4'), body: { artifactIds: ['a'], requirementIds: ['M'], mandatoryDimensionIds: ['D'] } },
        judgePrompt: configuredJudgePrompt('fixture-d'),
        providerSelection: { providerRef: 'judge-a', provider: { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: {} }, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
        preparedInvocation: preparedInvocation(async () => {
          throw new Error('provider must not be called after exhaustion');
        }),
      });
      expect(resumed).toMatchObject({
        status: 'audit_pending',
        issueCode: 'attempts_exhausted',
        activeRequest: { status: 'audit_pending', attemptCount: 1 },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resumes the same request at the next attempt after an unaccepted transport failure', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-resume-'));
    const provider = { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: { maximumAttempts: 2 } };
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }))
      .mockImplementationOnce(async ({ request }) => responseFor(request));
    const common = {
      authoringRequestId: 'REQ-004-RESUME',
      recordRoot: root,
      activeAuthority: {
        activeSemanticRevisionId: 'SEM-004-RESUME', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-004-RESUME/semantic-ir.json', activeScopeSemanticHash: HASH('scope-4-resume'),
        activeBindingRevisionId: 'BIND-004-RESUME', activeSourceBindingPath: 'authoring/source-bindings/BIND-004-RESUME/source-binding.json', activeSourceBindingHash: HASH('binding-4-resume'),
        activeAuthoringAttemptId: 'ATTEMPT-004-RESUME', activeBuildManifestPath: 'authoring/staging/ATTEMPT-004-RESUME/contract-build-manifest.json', activeBuildManifestHash: HASH('build-4-resume'),
      },
      buildManifest: { buildManifestHash: HASH('build-4-resume'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-4-resume') }, projectionReportRefs: [] },
      auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-004-RESUME', scopeSemanticHash: HASH('scope-4-resume'), body: { artifactIds: ['a'], requirementIds: ['M'], mandatoryDimensionIds: ['D'] } },
      judgePrompt: configuredJudgePrompt('fixture-d-resume'),
      providerSelection: { providerRef: 'judge-a', provider, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
      preparedInvocation: preparedInvocation(invoke, provider),
    };
    try {
      const first = await runRequirementsContractProductionJudgePipeline(common);
      const second = await runRequirementsContractProductionJudgePipeline(common);

      expect(first).toMatchObject({ status: 'audit_pending', activeRequest: { attemptCount: 1 } });
      expect(second).toMatchObject({ status: 'audited_pass', activeRequest: { attemptCount: 2 } });
      expect(invoke).toHaveBeenCalledTimes(2);
      expect(second.request.judgeRequestHash).toBe(first.request.judgeRequestHash);
      expect(second.activeRequest.lastAttemptPath).toMatch(/dispatch-attempts\/2\.json$/u);
      expect(existsSync(path.join(root, ...second.activeRequest.lastAttemptPath.split('/')))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('persists an invalid response in the attempt ledger and retries without a canonical response', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-validation-resume-'));
    const provider = { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: { maximumAttempts: 2 } };
    const invoke = vi
      .fn()
      .mockImplementationOnce(async ({ request }) => ({
        ...responseFor(request),
        reviewedArtifactRefs: [],
      }))
      .mockImplementationOnce(async ({ request }) => responseFor(request));
    const common = {
      authoringRequestId: 'REQ-004-VALIDATION', recordRoot: root,
      activeAuthority: {
        activeSemanticRevisionId: 'SEM-004-VALIDATION', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-004-VALIDATION/semantic-ir.json', activeScopeSemanticHash: HASH('scope-4-validation'),
        activeBindingRevisionId: 'BIND-004-VALIDATION', activeSourceBindingPath: 'authoring/source-bindings/BIND-004-VALIDATION/source-binding.json', activeSourceBindingHash: HASH('binding-4-validation'),
        activeAuthoringAttemptId: 'ATTEMPT-004-VALIDATION', activeBuildManifestPath: 'authoring/staging/ATTEMPT-004-VALIDATION/contract-build-manifest.json', activeBuildManifestHash: HASH('build-4-validation'),
      },
      buildManifest: { buildManifestHash: HASH('build-4-validation'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-4-validation') }, projectionReportRefs: [] },
      auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-004-VALIDATION', scopeSemanticHash: HASH('scope-4-validation'), body: { artifactIds: ['a'], requirementIds: ['M'], mandatoryDimensionIds: ['D'] } },
      judgePrompt: configuredJudgePrompt('fixture-d-validation'),
      providerSelection: { providerRef: 'judge-a', provider, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
      preparedInvocation: preparedInvocation(invoke, provider),
    };
    try {
      const first = await runRequirementsContractProductionJudgePipeline(common);
      expect(first).toMatchObject({
        status: 'audit_pending',
        issueCode: 'requirements_contract_judge_response_validation_failed',
        activeRequest: { status: 'retry_scheduled', attemptCount: 1, responseRef: null },
      });
      expect(existsSync(path.join(root, 'quality', 'requests', first.request.judgeRequestHash.replace(':', '-'), 'judge-response.json'))).toBe(false);

      const second = await runRequirementsContractProductionJudgePipeline(common);
      expect(second).toMatchObject({ status: 'audited_pass', activeRequest: { attemptCount: 2 } });
      expect(invoke).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reuses an accepted terminal evaluation without invoking the provider again', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-one-shot-'));
    const invoke = vi.fn(async ({ request }) => responseFor(request));
    const common = {
      authoringRequestId: 'REQ-004-ONE-SHOT',
      recordRoot: root,
      activeAuthority: {
        activeSemanticRevisionId: 'SEM-004-ONE-SHOT', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-004-ONE-SHOT/semantic-ir.json', activeScopeSemanticHash: HASH('scope-4-one-shot'),
        activeBindingRevisionId: 'BIND-004-ONE-SHOT', activeSourceBindingPath: 'authoring/source-bindings/BIND-004-ONE-SHOT/source-binding.json', activeSourceBindingHash: HASH('binding-4-one-shot'),
        activeAuthoringAttemptId: 'ATTEMPT-004-ONE-SHOT', activeBuildManifestPath: 'authoring/staging/ATTEMPT-004-ONE-SHOT/contract-build-manifest.json', activeBuildManifestHash: HASH('build-4-one-shot'),
      },
      buildManifest: { buildManifestHash: HASH('build-4-one-shot'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-4-one-shot') }, projectionReportRefs: [] },
      auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-004-ONE-SHOT', scopeSemanticHash: HASH('scope-4-one-shot'), body: { artifactIds: ['a'], requirementIds: ['M'], mandatoryDimensionIds: ['D'] } },
      judgePrompt: configuredJudgePrompt('fixture-d-one-shot'),
      providerSelection: { providerRef: 'judge-a', provider: { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: {} }, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
      preparedInvocation: preparedInvocation(invoke),
    };
    try {
      const first = await runRequirementsContractProductionJudgePipeline(common);
      const second = await runRequirementsContractProductionJudgePipeline(common);

      expect(first.status).toBe('audited_pass');
      expect(second.status).toBe('audited_pass');
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(second.activeRequest).toEqual(first.activeRequest);
      expect(JSON.parse(readFileSync(path.join(root, 'quality', 'active-request.json'), 'utf8'))).toEqual(first.activeRequest);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('replays a durable valid raw response without redispatch after an active-pointer crash', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-raw-replay-'));
    const invoke = vi.fn(async ({ request }) => responseFor(request));
    const common = {
      authoringRequestId: 'REQ-004-RAW-REPLAY', recordRoot: root,
      activeAuthority: {
        activeSemanticRevisionId: 'SEM-004-RAW-REPLAY', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-004-RAW-REPLAY/semantic-ir.json', activeScopeSemanticHash: HASH('scope-4-raw-replay'),
        activeBindingRevisionId: 'BIND-004-RAW-REPLAY', activeSourceBindingPath: 'authoring/source-bindings/BIND-004-RAW-REPLAY/source-binding.json', activeSourceBindingHash: HASH('binding-4-raw-replay'),
        activeAuthoringAttemptId: 'ATTEMPT-004-RAW-REPLAY', activeBuildManifestPath: 'authoring/staging/ATTEMPT-004-RAW-REPLAY/contract-build-manifest.json', activeBuildManifestHash: HASH('build-4-raw-replay'),
      },
      buildManifest: { buildManifestHash: HASH('build-4-raw-replay'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-4-raw-replay') }, projectionReportRefs: [] },
      auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-004-RAW-REPLAY', scopeSemanticHash: HASH('scope-4-raw-replay'), body: { artifactIds: ['a'], requirementIds: ['M'], mandatoryDimensionIds: ['D'] } },
      judgePrompt: configuredJudgePrompt('fixture-d-raw-replay'),
      providerSelection: { providerRef: 'judge-a', provider: { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: {} }, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
      preparedInvocation: preparedInvocation(invoke),
    };
    try {
      const baseline = await runRequirementsContractProductionJudgePipeline({ ...common, persist: false });
      const requestDirectory = path.join(root, 'quality', 'requests', baseline.request.judgeRequestHash.replace(':', '-'));
      atomicNoClobberPublish({ targetPath: path.join(requestDirectory, 'judge-request.json'), value: baseline.request });
      atomicNoClobberPublish({ targetPath: path.join(root, 'quality', 'selections', baseline.request.providerSelection.providerSelectionHash.replace(':', '-'), 'provider-selection-receipt.json'), value: baseline.request.providerSelection });
      writeCanonicalJson(path.join(root, 'quality', 'active-request.json'), {
        schemaVersion: 'requirements-contract-judge-active-request/v1',
        version: 1, previousVersion: null,
        semanticRevisionId: common.activeAuthority.activeSemanticRevisionId,
        auditPolicyHash: baseline.activeRequest.auditPolicyHash,
        providerSelectionHash: baseline.request.providerSelection.providerSelectionHash,
        judgeRequestHash: baseline.request.judgeRequestHash,
        requestPath: `quality/requests/${baseline.request.judgeRequestHash.replace(':', '-')}/judge-request.json`,
        status: 'dispatch_pending', acceptedEvaluation: false, attemptCount: 0,
        lastAttemptPath: null, lastIssueCode: null, responseRef: null, aggregateRef: null,
        effectivePassRef: null, remediationPlanRef: null, remediationDeltaRef: null,
      });
      writeCanonicalJson(path.join(requestDirectory, 'dispatch-attempts', '1.json'), {
        schemaVersion: 'requirements-contract-judge-attempt/v1',
        judgeRequestHash: baseline.request.judgeRequestHash,
        providerSelectionHash: baseline.request.providerSelection.providerSelectionHash,
        attemptOrdinal: 1, outcome: 'response_received', acceptedEvaluation: true,
        requestSerializedBytes: 1, auditPacketSerializedBytes: 1,
        validationIssueCodes: [], nextEligibleAt: null, rawResponse: responseFor(baseline.request),
      });
      invoke.mockClear();

      const resumed = await runRequirementsContractProductionJudgePipeline(common);
      expect(resumed).toMatchObject({ status: 'audited_pass', activeRequest: { attemptCount: 1 } });
      expect(invoke).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a frozen selection that does not match the canonical invocation provider', async () => {
    const invoke = vi.fn();
    await expect(runRequirementsContractProductionJudgePipeline({
      authoringRequestId: 'REQ-005', recordRoot: 'unused-by-in-memory-test',
      activeAuthority: {
        activeSemanticRevisionId: 'SEM-005', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-005/semantic-ir.json', activeScopeSemanticHash: HASH('scope-5'),
        activeBindingRevisionId: 'BIND-005', activeSourceBindingPath: 'authoring/source-bindings/BIND-005/source-binding.json', activeSourceBindingHash: HASH('binding-5'),
        activeAuthoringAttemptId: 'ATTEMPT-005', activeBuildManifestPath: 'authoring/staging/ATTEMPT-005/contract-build-manifest.json', activeBuildManifestHash: HASH('build-5'),
      },
      buildManifest: { buildManifestHash: HASH('build-5'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-5') }, projectionReportRefs: [] },
      auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-005', scopeSemanticHash: HASH('scope-5'), body: { artifactIds: ['a'], requirementIds: ['M'], mandatoryDimensionIds: ['D'] } },
      judgePrompt: configuredJudgePrompt('fixture-e'),
      providerSelection: { providerRef: 'judge-b', provider: { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'other-model', requestPolicy: {} }, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
      preparedInvocation: preparedInvocation(invoke),
      persist: false,
    })).rejects.toThrow('requirements_contract_judge_frozen_selection_mismatch');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('classifies an accepted fail into a repair plan without creating EffectivePass', async () => {
    const result = await runRequirementsContractProductionJudgePipeline({
      authoringRequestId: 'REQ-006', recordRoot: 'unused-by-in-memory-test',
      activeAuthority: {
        activeSemanticRevisionId: 'SEM-006', activeSemanticIrPath: 'authoring/semantic-revisions/SEM-006/semantic-ir.json', activeScopeSemanticHash: HASH('scope-6'),
        activeBindingRevisionId: 'BIND-006', activeSourceBindingPath: 'authoring/source-bindings/BIND-006/source-binding.json', activeSourceBindingHash: HASH('binding-6'),
        activeAuthoringAttemptId: 'ATTEMPT-006', activeBuildManifestPath: 'authoring/staging/ATTEMPT-006/contract-build-manifest.json', activeBuildManifestHash: HASH('build-6'),
      },
      buildManifest: { buildManifestHash: HASH('build-6'), artifactEntries: [], auditPacketRef: { artifactId: 'judge-audit-packet', path: 'packet.json', hash: HASH('packet-6') }, projectionReportRefs: [] },
      auditPacket: { schemaVersion: 'requirements-contract-judge-audit-packet/v1', semanticRevisionId: 'SEM-006', scopeSemanticHash: HASH('scope-6'), body: { artifactIds: ['final-markdown'], requirementIds: ['MUST-001'], mandatoryDimensionIds: ['completeness'] } },
      judgePrompt: configuredJudgePrompt('fixture-f'),
      providerSelection: { providerRef: 'judge-a', provider: { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: {} }, adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry') },
      preparedInvocation: preparedInvocation(async ({ request }) => failResponseFor(request, {
        findingId: 'F-1', severity: 'Major', summary: 'Frozen rule missing from projection',
        affectedMustRefs: ['MUST-001'], affectedArtifactRefs: ['final-markdown'],
        logicalEvidenceRefs: ['MUST-001'],
      })),
      persist: false,
    });
    expect(result).toMatchObject({
      status: 'repair_planned',
      activeRequest: { status: 'audited_fail', acceptedEvaluation: true, effectivePassRef: null },
      remediationPlan: { state: 'repair_planned', repairSteps: [{ classification: 'projection_repair' }] },
    });
    expect(result).not.toHaveProperty('effectivePass');
  });
});
