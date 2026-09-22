import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  prepareRequirementsContractProductionJudgeRequest,
  runRequirementsContractProductionJudgePipeline,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-judge-pipeline';
import {
  buildRequirementsContractJudgeAuditPacketV3,
  publishRequirementsContractJudgeAuditPacketRef,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-packet';
import { createRequirementsContractBuildManifestV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { createRequirementsContractJudgeActiveRequest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-lifecycle';
import { writeJsonAtomic } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-control-store';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import type { PreparedRequirementsContractJudgeInvocation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { requirementsContractDomainHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';

const roots: string[] = [];
const hash = (value: string) => sha256Stable({ value });

function fixture(recordRoot: string, invoke: PreparedRequirementsContractJudgeInvocation['invoke']) {
  const semanticIr = createRequirementsContractSemanticIr({
    recordId: 'REC-CRASH-RECOVERY',
    requestId: 'REQ-CRASH-RECOVERY',
    parentSemanticRevisionId: null,
    compilerVersion: 'compiler/v3',
    semantics: {
      requirements: [{
        id: 'MUST-001',
        text: 'Persist the Judge dispatch marker before provider invocation.',
        oracle: 'A resumed request does not redispatch the provider.',
        requirementKind: 'functional',
        polarity: 'positive',
      }],
      atoms: [{
        id: 'MUST-001-A1',
        action: 'Persist the Judge dispatch marker before provider invocation.',
        oracle: 'A resumed request does not redispatch the provider.',
        requirementRef: 'MUST-001',
      }],
      decisions: [],
    },
    evidenceClaims: [],
    specSpanRegistry: [],
    executionConstraints: [],
    semanticProvenance: { 'MUST-001': 'MUST-001' },
  });
  const scopeSemanticHash = semanticIr.scopeSemanticHash;
  const sourceBindingHash = hash('crash-recovery-source-binding');
  const auditPacket = buildRequirementsContractJudgeAuditPacketV3({
    recordRoot,
    packet: {
      schemaVersion: 'requirements-contract-judge-audit-draft/v1',
      semanticRevisionId: 'SEM-CRASH-RECOVERY',
      scopeSemanticHash,
      body: {
        artifactIds: [],
        requirementIds: ['MUST-001'],
        mandatoryDimensionIds: ['completeness'],
        semanticIr,
      },
    },
  });
  const packetRef = publishRequirementsContractJudgeAuditPacketRef({ recordRoot, packet: auditPacket });
  const buildManifest = createRequirementsContractBuildManifestV2({
    scopeSemanticHash,
    sourceBindingHash,
    compilerIdentity: 'compiler/v3',
    projectionSetHash: hash('crash-recovery-projection-set'),
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
    activeSemanticRevisionId: 'SEM-CRASH-RECOVERY',
    activeScopeSemanticHash: scopeSemanticHash,
    activeBindingRevisionId: 'BIND-CRASH-RECOVERY',
    activeSourceBindingHash: sourceBindingHash,
    activeBuildHash: buildManifest.buildHash,
    activeBuildManifestPath: `authoring/builds/${buildManifest.buildHash.slice('sha256:'.length)}/manifest.json`,
    previousBuildHash: null,
    previousBuildManifestPath: null,
  };
  const provider = {
    transport: 'openai-compatible',
    apiStyle: 'chat_completions',
    model: 'judge-model',
    requestPolicy: { maximumAttempts: 1 },
  };
  const judgePrompt = {
    systemPrompt: 'Review the requirements contract.',
    rubric: { verdictRule: 'pass requires zero findings' },
    structuredOutputSchema: { type: 'object' },
    outputTokenReserve: 4096,
  };
  const providerSelection = {
    providerRef: 'judge-a',
    provider,
    adapterRef: 'OpenAICompatibleJudgeAdapter',
    providerRegistryHash: hash('crash-recovery-provider-registry'),
  };
  const preparedInvocation: PreparedRequirementsContractJudgeInvocation = {
    configPath: 'test-config',
    judgeRuntime: {},
    providerRef: 'judge-a',
    provider,
    providerRegistryHash: providerSelection.providerRegistryHash,
    credentialProviderRef: 'judge-a',
    credentialRevision: 1,
    preflight: () => undefined,
    invoke,
  };
  return {
    authoringRequestId: 'REQ-CRASH-RECOVERY',
    recordRoot,
    activeAuthority,
    buildManifest,
    auditPacket,
    judgePrompt,
    providerSelection,
    preparedInvocation,
  };
}

describe('requirements contract Judge crash recovery', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 25 });
    }
  });

  it('does not redispatch a Judge request whose durable attempt is dispatch_started', async () => {
    const recordRoot = mkdtempSync(path.join(os.tmpdir(), 'requirements-judge-crash-recovery-'));
    roots.push(recordRoot);
    const invoke = vi.fn(async () => {
      throw new Error('provider must not be called during crash recovery');
    });
    const input = fixture(recordRoot, invoke);
    const prepared = prepareRequirementsContractProductionJudgeRequest(input);
    const requestPath = `quality/requests/${prepared.request.judgeRequestHash.replace(':', '-')}/judge-request.json`;
    const activeRequest = createRequirementsContractJudgeActiveRequest({
      version: 1,
      previousVersion: null,
      semanticRevisionId: input.activeAuthority.activeSemanticRevisionId,
      auditPolicyHash: prepared.auditPolicyHash,
      providerSelectionHash: prepared.selection.providerSelectionHash,
      judgeRequestHash: prepared.request.judgeRequestHash,
      requestPath,
    });
    const attemptPath = path.join(
      recordRoot,
      'quality',
      'requests',
      prepared.request.judgeRequestHash.replace(':', '-'),
      'dispatch-attempts',
      '1.json'
    );
    writeJsonAtomic(path.join(recordRoot, 'quality', 'active-request.json'), activeRequest);
    writeJsonAtomic(attemptPath, {
      schemaVersion: 'requirements-contract-judge-attempt/v1',
      judgeRequestHash: prepared.request.judgeRequestHash,
      providerSelectionHash: prepared.selection.providerSelectionHash,
      attemptOrdinal: 1,
      outcome: 'dispatch_started',
      acceptedEvaluation: false,
      requestSerializedBytes: 1,
      auditPacketSerializedBytes: 1,
      validationIssueCodes: [],
      nextEligibleAt: null,
      rawResponse: null,
    });

    await expect(runRequirementsContractProductionJudgePipeline(input)).resolves.toMatchObject({
      status: 'audit_pending',
      issueCode: 'judge_dispatch_recovery_required',
      activeRequest: { attemptCount: 0, acceptedEvaluation: false },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('persists dispatch_started before invoking the Judge provider', async () => {
    const recordRoot = mkdtempSync(path.join(os.tmpdir(), 'requirements-judge-dispatch-marker-'));
    roots.push(recordRoot);
    let observedOutcome: unknown = null;
    const invoke = vi.fn(async ({ request }: { request: Record<string, any> }) => {
      const attemptPath = path.join(
        recordRoot,
        'quality',
        'requests',
        request.judgeRequestHash.replace(':', '-'),
        'dispatch-attempts',
        '1.json'
      );
      observedOutcome = existsSync(attemptPath)
        ? JSON.parse(readFileSync(attemptPath, 'utf8')).outcome
        : null;
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
    });

    const result = await runRequirementsContractProductionJudgePipeline(
      fixture(recordRoot, invoke)
    );

    expect(result).toMatchObject({ status: 'audited_pass' });
    expect(observedOutcome).toBe('dispatch_started');
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('repairs an attempt ledger written before the active-request CAS and resumes at the next ordinal', async () => {
    const recordRoot = mkdtempSync(path.join(os.tmpdir(), 'requirements-judge-cas-recovery-'));
    roots.push(recordRoot);
    const response = (request: Record<string, any>) => {
      const body = request.auditPacket.body;
      return {
        schemaVersion: 'requirements-contract-judge-response/v2',
        judgeRequestHash: request.judgeRequestHash,
        verdict: 'pass', findings: [], advisoryObservations: [],
        checkedDimensionIds: body.mandatoryDimensionIds,
        dimensionResults: body.mandatoryDimensionIds.map((dimensionId: string) => ({
          dimensionId, decision: 'pass', findingRefs: [],
        })),
        reviewedArtifactRefs: body.artifactIds,
        reviewedMustRefs: body.requirementIds,
        insufficientAuditReasons: [],
      };
    };
    const provider = {
      transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model',
      requestPolicy: { maximumAttempts: 2 },
    };
    const invoke = vi.fn(async ({ request }: { request: Record<string, any> }) => response(request));
    const input = fixture(recordRoot, invoke);
    input.providerSelection.provider = provider;
    input.preparedInvocation.provider = provider;
    input.preparedInvocation.invoke = invoke;
    const prepared = prepareRequirementsContractProductionJudgeRequest(input);
    const requestPath = `quality/requests/${prepared.request.judgeRequestHash.replace(':', '-')}/judge-request.json`;
    const activeRequest = createRequirementsContractJudgeActiveRequest({
      version: 1,
      previousVersion: null,
      semanticRevisionId: input.activeAuthority.activeSemanticRevisionId,
      auditPolicyHash: prepared.auditPolicyHash,
      providerSelectionHash: prepared.selection.providerSelectionHash,
      judgeRequestHash: prepared.request.judgeRequestHash,
      requestPath,
    });
    writeJsonAtomic(path.join(recordRoot, 'quality', 'active-request.json'), activeRequest);
    writeJsonAtomic(path.join(
      recordRoot, 'quality', 'requests', prepared.request.judgeRequestHash.replace(':', '-'),
      'dispatch-attempts', '1.json'
    ), {
      schemaVersion: 'requirements-contract-judge-attempt/v1',
      judgeRequestHash: prepared.request.judgeRequestHash,
      providerSelectionHash: prepared.selection.providerSelectionHash,
      attemptOrdinal: 1,
      outcome: 'transport_failure',
      acceptedEvaluation: false,
      requestSerializedBytes: 1,
      auditPacketSerializedBytes: 1,
      validationIssueCodes: ['judge_provider_transport_failed'],
      nextEligibleAt: null,
      rawResponse: null,
    });

    await expect(runRequirementsContractProductionJudgePipeline(input)).resolves.toMatchObject({
      status: 'audited_pass',
      activeRequest: { attemptCount: 2, lastAttemptPath: expect.stringMatching(/dispatch-attempts\/2\.json$/u) },
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('uses the pre-dispatch capacity decision even if a preflight hook mutates provider policy', async () => {
    const recordRoot = mkdtempSync(path.join(os.tmpdir(), 'requirements-judge-capacity-freeze-'));
    roots.push(recordRoot);
    const provider = {
      transport: 'openai-compatible', apiStyle: 'chat_completions', model: 'judge-model',
      requestPolicy: {},
    };
    const invoke = vi.fn(async ({ request }: { request: Record<string, any> }) => {
      const body = request.auditPacket.body;
      return {
        schemaVersion: 'requirements-contract-judge-response/v2',
        judgeRequestHash: request.judgeRequestHash,
        verdict: 'pass', findings: [], advisoryObservations: [],
        checkedDimensionIds: body.mandatoryDimensionIds,
        dimensionResults: body.mandatoryDimensionIds.map((dimensionId: string) => ({
          dimensionId, decision: 'pass', findingRefs: [],
        })),
        reviewedArtifactRefs: body.artifactIds,
        reviewedMustRefs: body.requirementIds,
        insufficientAuditReasons: [],
      };
    });
    const input = fixture(recordRoot, invoke);
    input.providerSelection.provider = provider;
    input.preparedInvocation.provider = provider;
    input.preparedInvocation.preflight = () => {
      provider.requestPolicy = { transportByteLimit: 1 };
    };

    const result = await runRequirementsContractProductionJudgePipeline(input);

    expect(result).toMatchObject({ status: 'audited_pass' });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('reuses the pinned audit policy on resume when the caller prompt changes', async () => {
    const recordRoot = mkdtempSync(path.join(os.tmpdir(), 'requirements-judge-policy-pin-'));
    roots.push(recordRoot);
    const responseFor = (request: Record<string, any>) => {
      const body = request.auditPacket.body;
      return {
        schemaVersion: 'requirements-contract-judge-response/v2',
        judgeRequestHash: request.judgeRequestHash,
        verdict: 'pass', findings: [], advisoryObservations: [],
        checkedDimensionIds: body.mandatoryDimensionIds,
        dimensionResults: body.mandatoryDimensionIds.map((dimensionId: string) => ({
          dimensionId, decision: 'pass', findingRefs: [],
        })),
        reviewedArtifactRefs: body.artifactIds,
        reviewedMustRefs: body.requirementIds,
        insufficientAuditReasons: [],
      };
    };
    const invoke = vi.fn(async ({ request }: { request: Record<string, any> }) => responseFor(request));
    const firstInput = fixture(recordRoot, invoke);
    const first = await runRequirementsContractProductionJudgePipeline(firstInput);
    const secondInput = fixture(recordRoot, invoke);
    secondInput.judgePrompt = {
      ...secondInput.judgePrompt,
      systemPrompt: 'A deployed prompt changed after the request was pinned.',
    };

    const second = await runRequirementsContractProductionJudgePipeline(secondInput);

    expect(first.status).toBe('audited_pass');
    expect(second.status).toBe('audited_pass');
    expect(second.request.judgeRequestHash).toBe(first.request.judgeRequestHash);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
