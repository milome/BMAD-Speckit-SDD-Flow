import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runRequirementsContractProductionJudgePipeline } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-judge-pipeline';
import { canonicalJson } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';
import { atomicNoClobberPublish } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-atomic-no-clobber-publisher';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import type { PreparedRequirementsContractJudgeInvocation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation';
import { assertJudgePayloadBudget } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-payload-budget';
import { OpenAICompatibleJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-openai-compatible-judge-adapter';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import {
  buildRequirementsContractJudgeAuditPacketV3,
  publishRequirementsContractJudgeAuditPacketRef,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-packet';
import { createRequirementsContractBuildManifestV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { requirementsContractDomainHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';

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
    preflight: ({ request }) => assertJudgePayloadBudget({
      serializedPayload: JSON.stringify(request), provider, stage: 'test-only-preflight',
    }),
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

function v3JudgeInput(input: {
  recordRoot: string;
  label: string;
  invoke: PreparedRequirementsContractJudgeInvocation['invoke'];
  provider?: Record<string, any>;
  providerRef?: string;
  invocationProvider?: Record<string, any>;
  judgePrompt?: ReturnType<typeof configuredJudgePrompt>;
  artifactIds?: string[];
  body?: Record<string, unknown>;
  persist?: boolean;
}) {
  const provider = input.provider ?? {
    transport: 'openai-compatible',
    apiStyle: 'chat_completions',
    model: 'judge-model',
    requestPolicy: {},
  };
  const semanticIr = createRequirementsContractSemanticIr({
    recordId: `REC-${input.label}`,
    requestId: `REQ-${input.label}`,
    parentSemanticRevisionId: null,
    compilerVersion: 'compiler/v3',
    semantics: {
      requirements: [{
        id: 'MUST-001', text: 'Persist the confirmed requirement.',
        oracle: 'The confirmation projection includes MUST-001.',
        requirementKind: 'functional', polarity: 'positive',
      }],
      atoms: [{
        id: 'MUST-001-A1', action: 'Persist the confirmed requirement.',
        oracle: 'The confirmation projection includes MUST-001.', requirementRef: 'MUST-001',
      }],
      decisions: [],
    },
    evidenceClaims: [], specSpanRegistry: [], executionConstraints: [],
    semanticProvenance: { 'MUST-001': 'MUST-001' },
  });
  const auditPacket = buildRequirementsContractJudgeAuditPacketV3({
    recordRoot: input.recordRoot,
    packet: {
      schemaVersion: 'requirements-contract-judge-audit-draft/v1',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      body: {
        artifactIds: input.artifactIds ?? ['final-markdown'],
        requirementIds: ['MUST-001'],
        mandatoryDimensionIds: ['completeness'],
        semanticIr,
        ...input.body,
      },
    },
  });
  const packetRef = publishRequirementsContractJudgeAuditPacketRef({
    recordRoot: input.recordRoot,
    packet: auditPacket,
  });
  const buildManifest = createRequirementsContractBuildManifestV2({
    scopeSemanticHash: semanticIr.scopeSemanticHash,
    sourceBindingHash: HASH(`${input.label}-source-binding`),
    compilerIdentity: 'compiler/v3',
    projectionSetHash: HASH(`${input.label}-projection-set`),
    checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
    validationSummary: { decision: 'pass', checkIds: [] },
    artifactEntries: [{
      role: 'judge_audit_packet',
      schemaVersion: String(auditPacket.schemaVersion),
      semanticHash: requirementsContractDomainHash(
        'requirements-projection:judge_audit_packet/v1',
        auditPacket
      ),
      contentRef: packetRef,
    }],
  });
  const activeAuthority = {
    activeSemanticRevisionId: semanticIr.semanticRevisionId,
    activeScopeSemanticHash: semanticIr.scopeSemanticHash,
    activeBindingRevisionId: `BIND-${input.label}`,
    activeSourceBindingHash: buildManifest.sourceBindingHash,
    activeBuildHash: buildManifest.buildHash,
    activeBuildManifestPath: `authoring/builds/${buildManifest.buildHash.slice('sha256:'.length)}/manifest.json`,
    previousBuildHash: null,
    previousBuildManifestPath: null,
  };
  return {
    authoringRequestId: `REQ-${input.label}`,
    recordRoot: input.recordRoot,
    activeAuthority,
    buildManifest,
    auditPacket,
    judgePrompt: input.judgePrompt ?? configuredJudgePrompt(input.label),
    providerSelection: {
      providerRef: input.providerRef ?? 'judge-a', provider,
      adapterRef: 'OpenAICompatibleJudgeAdapter', providerRegistryHash: HASH('registry'),
    },
    preparedInvocation: preparedInvocation(input.invoke, input.invocationProvider ?? provider),
    ...(input.persist === undefined ? {} : { persist: input.persist }),
  };
}

describe('requirements production Judge pipeline', () => {
  it('rejects the actual final payload before publishing authority and repeats without dispatch', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-final-budget-'));
    const provider = {
      transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model',
      requestPolicy: { maximumAttempts: 1, transportByteLimit: 8192 },
    };
    const invoke = vi.fn(async ({ request }: { request: Record<string, any> }) => responseFor(request));
    const unpublishedPaths = ['quality/selections', 'quality/requests', 'quality/active-request.json'];
    // Test-only invocation uses the actual pure HTTP preflight and never contacts a Judge.
    const preflight = vi.fn<PreparedRequirementsContractJudgeInvocation['preflight']>((payload) => {
      expect(Buffer.byteLength(canonicalJson(payload.request), 'utf8')).toBeLessThan(8192);
      for (const artifactPath of unpublishedPaths) {
        expect.soft(existsSync(path.join(root, artifactPath))).toBe(false);
      }
      return OpenAICompatibleJudgeAdapter.preflight({ provider, credential: undefined, payload });
    });
    const judgePrompt = configuredJudgePrompt('test-only-final-budget');
    judgePrompt.systemPrompt = 'x'.repeat(4096);
    const input = v3JudgeInput({
      recordRoot: root, label: 'FINAL-BUDGET', invoke, provider, judgePrompt,
    });
    input.preparedInvocation.preflight = preflight;
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const failure = await runRequirementsContractProductionJudgePipeline(input).then(
          () => null, (error: unknown) => error
        );
        expect.soft(failure).toMatchObject({
          failureClass: 'judge_provider_capacity_exceeded', dispatchState: 'not_dispatched',
          goalJudgeDispatchCount: 0,
        });
        for (const artifactPath of unpublishedPaths) {
          expect.soft(existsSync(path.join(root, artifactPath))).toBe(false);
        }
        expect.soft(invoke).not.toHaveBeenCalled();
      }
      expect(preflight).toHaveBeenCalledTimes(2);
      expect(preflight).toHaveBeenCalledWith(expect.objectContaining({
        systemPrompt: expect.stringContaining(judgePrompt.systemPrompt),
        executionContext: expect.objectContaining({ requestPath: expect.any(String) }),
        structuredOutputSchema: judgePrompt.structuredOutputSchema,
      }));
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('uses the selected production provider and creates a real aggregate and EffectivePass', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-provider-'));
    const invoke = vi.fn(async ({ request }: { request: Record<string, any> }) => responseFor(request));
    const judgePrompt = configuredJudgePrompt('fixture-a');
    try {
      const result = await runRequirementsContractProductionJudgePipeline(v3JudgeInput({
        recordRoot: root, label: 'PROVIDER', invoke, judgePrompt, persist: false,
      }));

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(result.request.prompt).toMatchObject({
        rubric: judgePrompt.rubric,
        structuredOutputSchema: judgePrompt.structuredOutputSchema,
        outputTokenReserve: judgePrompt.outputTokenReserve,
      });
      expect(result.request.prompt.systemPrompt).toContain(judgePrompt.systemPrompt);
      expect(result.request).not.toHaveProperty('auditPacket');
      expect(result.request.auditPacketRef).toMatchObject({
        schemaVersion: 'requirements-content-ref/v1',
        contentHash: expect.stringMatching(/^sha256:/u),
      });
      expect(invoke.mock.calls[0]?.[0]).toHaveProperty('request.auditPacket.body');
      expect(result.status).toBe('audited_pass');
      expect(result.aggregate.decision).toBe('pass');
      expect(result.effectivePass.decision).toBe('pass');
      expect(result.activeRequest.status).toBe('audited_pass');
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('does not invoke a provider whose declared capacity is too small', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-small-capacity-'));
    const invoke = vi.fn();
    const provider = {
        transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model',
        requestPolicy: { transportByteLimit: 128 },
      };
    try {
      const result = await runRequirementsContractProductionJudgePipeline(v3JudgeInput({
        recordRoot: root, label: 'SMALL-CAPACITY',
        invoke: async ({ request }) => invoke(request), provider,
        body: { payload: 'x'.repeat(1000) }, persist: false,
      }));

      expect(invoke).not.toHaveBeenCalled();
      expect(result.status).toBe('audit_pending');
      expect(result.issueCode).toBe('judge_provider_capacity_exceeded');
      expect(result.capacity.actual.requestSerializedBytes).toBeGreaterThan(128);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('persists the same hash identity through Windows-safe physical path segments', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-path-'));
    try {
      const result = await runRequirementsContractProductionJudgePipeline(v3JudgeInput({
        recordRoot: root,
        label: 'PATH',
        invoke: async ({ request }) => responseFor(request),
      }));

      expect(result.activeRequest.requestPath).toMatch(/^quality\/requests\/sha256-[a-f0-9]{64}\/judge-request\.json$/u);
      expect(result.activeRequest.requestPath).not.toContain(':');
      expect(result.request.judgeRequestHash).toMatch(/^sha256:/u);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('preserves the Judge request and attempt when the provider rejects payload by status', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-capacity-recovery-'));
    try {
      const common = v3JudgeInput({
        recordRoot: root,
        label: 'PROVIDER-REJECT',
        invoke: async () => {
          throw Object.assign(new Error('provider rejected request'), { status: 413 });
        },
      });
      const result = await runRequirementsContractProductionJudgePipeline(common);

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
        ...common,
        preparedInvocation: preparedInvocation(async () => {
          throw new Error('provider must not be called after exhaustion');
        }, common.providerSelection.provider),
      });
      expect(resumed).toMatchObject({
        status: 'audit_pending',
        issueCode: 'attempts_exhausted',
        activeRequest: { status: 'audit_pending', attemptCount: 1 },
      });
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('resumes the same request at the next attempt after an unaccepted transport failure', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-resume-'));
    const provider = { transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model', requestPolicy: { maximumAttempts: 2 } };
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }))
      .mockImplementationOnce(async ({ request }) => responseFor(request));
    const common = v3JudgeInput({ recordRoot: root, label: 'RESUME', invoke, provider });
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
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
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
    const common = v3JudgeInput({ recordRoot: root, label: 'VALIDATION', invoke, provider });
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
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('reuses an accepted terminal evaluation without invoking the provider again', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-one-shot-'));
    const invoke = vi.fn(async ({ request }) => responseFor(request));
    const common = v3JudgeInput({ recordRoot: root, label: 'ONE-SHOT', invoke });
    try {
      const first = await runRequirementsContractProductionJudgePipeline(common);
      const second = await runRequirementsContractProductionJudgePipeline(common);

      expect(first.status).toBe('audited_pass');
      expect(second.status).toBe('audited_pass');
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(second.activeRequest).toEqual(first.activeRequest);
      expect(JSON.parse(readFileSync(path.join(root, 'quality', 'active-request.json'), 'utf8'))).toEqual(first.activeRequest);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('replays a durable valid raw response without redispatch after an active-pointer crash', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-raw-replay-'));
    const invoke = vi.fn(async ({ request }) => responseFor(request));
    const common = v3JudgeInput({ recordRoot: root, label: 'RAW-REPLAY', invoke });
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
        validationIssueCodes: [], nextEligibleAt: null,
        rawResponse: baseline.response,
      });
      invoke.mockClear();

      const resumed = await runRequirementsContractProductionJudgePipeline(common);
      expect(resumed).toMatchObject({ status: 'audited_pass', activeRequest: { attemptCount: 1 } });
      expect(invoke).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('rejects a frozen selection that does not match the canonical invocation provider', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-selection-mismatch-'));
    const invoke = vi.fn();
    try {
      await expect(runRequirementsContractProductionJudgePipeline(v3JudgeInput({
        recordRoot: root,
        label: 'SELECTION-MISMATCH',
        invoke,
        providerRef: 'judge-b',
        provider: {
          transport: 'openai-compatible', apiStyle: 'chat_completions',
          model: 'other-model', requestPolicy: {},
        },
        invocationProvider: {
          transport: 'openai-compatible', apiStyle: 'chat_completions',
          model: 'judge-model', requestPolicy: {},
        },
        persist: false,
      }))).rejects.toThrow('requirements_contract_judge_frozen_selection_mismatch');
      expect(invoke).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });

  it('classifies an accepted fail into a repair plan without creating EffectivePass', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-fail-repair-'));
    try {
      const result = await runRequirementsContractProductionJudgePipeline(v3JudgeInput({
        recordRoot: root,
        label: 'FAIL-REPAIR',
        invoke: async ({ request }) => failResponseFor(request, {
          findingId: 'F-1', severity: 'Major', summary: 'Frozen rule missing from projection',
          affectedMustRefs: ['MUST-001'], affectedArtifactRefs: ['final-markdown'],
          logicalEvidenceRefs: ['MUST-001'],
        }),
        persist: false,
      }));
      expect(result).toMatchObject({
        status: 'repair_planned',
        activeRequest: { status: 'audited_fail', acceptedEvaluation: true, effectivePassRef: null },
        remediationPlan: { state: 'repair_planned', repairSteps: [{ classification: 'projection_repair' }] },
      });
      expect(result).not.toHaveProperty('effectivePass');
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
    }
  });
});
