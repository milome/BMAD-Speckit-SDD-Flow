import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildCriticalAuditorJudgeRuntimeBinding,
  buildCriticalAuditorIndependentProviderExpectationFromJudgeRuntime,
  buildCriticalAuditorIndependentProviderExpectationFromJudgeSelection,
  criticalAuditorIndependentProviderRunHash,
  type CriticalAuditorIndependentProviderEvidence,
  type CriticalAuditorIndependentProviderExpectation,
  validateCriticalAuditorIndependentProviderEvidence,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence';
import { readGovernanceRemediationConfig } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/governance-remediation-config';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const projectRoot = path.resolve(__dirname, '../..');
const writerPath = path.join(
  projectRoot,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'write-critical-auditor-no-new-gap-response.js'
);
const temporaryRoots: string[] = [];
const transactionId = 'CATX-CRITICAL-AUDITOR-INDEPENDENCE';
const auditAttemptId = 'AUDIT-CRITICAL-AUDITOR-INDEPENDENCE';

function independentProviderExpectation(): CriticalAuditorIndependentProviderExpectation {
  return {
    transactionId,
    auditAttemptId,
    providerId: 'local-sonnet-judge',
    model: 'claude-sonnet-5',
    transport: 'claude-code-cli',
    apiStyle: 'cli',
    configuredBaseUrlHash: sha256Stable('claude'),
    independenceClass: 'different_provider_different_model',
    providerRegistryHash:
      'sha256:7777777777777777777777777777777777777777777777777777777777777777',
    providerConfigurationHash:
      'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    capabilityReceiptHash:
      'sha256:8888888888888888888888888888888888888888888888888888888888888888',
    selectionReceiptHash:
      'sha256:9999999999999999999999999999999999999999999999999999999999999999',
    requestHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    sourceDocumentHash:
      'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    semanticModelHash:
      'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    projectionSetHash:
      'sha256:5555555555555555555555555555555555555555555555555555555555555555',
  };
}

function judgeProviderRegistry(): Record<string, unknown> {
  return {
    schemaVersion: 'requirements-contract-judge-runtime/v1',
    enabled: true,
    activeProviderRef: 'local-sonnet-judge',
    selectionPolicy: {
      mode: 'contract_locked',
      runtimeFallbackAllowed: false,
      runtimeAutoDiscoveryAllowed: false,
      environmentOverrideAllowed: false,
      cliTransportAllowed: true,
      selectionReceiptRequired: true,
    },
    credentialConfig: {
      source: 'config_file',
      path: '_bmad-output/config/private/judge-provider.credentials.yaml',
      schemaVersion: 'requirements-contract-judge-credentials/v1',
      allowedRoot: '_bmad-output/config/private',
      environmentFallbackAllowed: false,
    },
    providers: {
      'local-sonnet-judge': {
        enabled: true,
        transport: 'claude-code-cli',
        apiStyle: 'cli',
        model: 'claude-sonnet-5',
        credentialRef: 'claude-code-session',
        endpoint: {
          command: 'claude',
          resolutionMode: 'path_search',
          routingOwnership: 'transport_adapter',
          upstreamVersioning: 'cli_managed',
          explicitOperationPath: null,
        },
        authentication: {
          type: 'claude_code_session',
          sensitivity: 'host_managed',
          arbitraryNonEmptyValueAllowed: false,
          sessionRevision: 1,
        },
        auditPolicy: {
          independenceClass: 'different_provider_different_model',
          blindReview: true,
          allowPassAuthority: false,
          toolsAllowed: true,
          allowedTools: ['Read'],
          implementationWritesAllowed: false,
        },
        requestPolicy: {
          timeoutMs: 300_000,
          maximumAttempts: 1,
          structuredResponseRequired: true,
        },
      },
    },
  };
}

function withReceiptHash(record: Record<string, unknown>): Record<string, unknown> {
  return { ...record, receiptHash: sha256Stable(record) };
}

function judgeCapabilityReceipt(
  registry = judgeProviderRegistry()
): Record<string, unknown> {
  const provider = (registry.providers as Record<string, Record<string, unknown>>)[
    'local-sonnet-judge'
  ];
  return withReceiptHash({
    schemaVersion: 'requirements-contract-judge-capability-receipt/v1',
    transactionId,
    auditAttemptId,
    providerRef: 'local-sonnet-judge',
    publicProviderConfigurationHash: sha256Stable(provider),
    configuredBaseUrlHash: sha256Stable('claude'),
    transport: 'claude-code-cli',
    apiStyle: 'cli',
    endpointResolutionMode: 'path_search',
    upstreamVersioningMode: 'cli_managed',
    configuredModel: 'claude-sonnet-5',
    returnedModel: 'claude-sonnet-5',
    transportSuccess: true,
    structuredOutputSupported: true,
    configuredOriginPreserved: true,
    fallbackObserved: false,
    decision: 'pass',
  });
}

function judgeSelectionReceipt(
  registry = judgeProviderRegistry(),
  capability = judgeCapabilityReceipt(registry)
): Record<string, unknown> {
  const provider = (registry.providers as Record<string, Record<string, unknown>>)[
    'local-sonnet-judge'
  ];
  const lineage = independentProviderExpectation();
  const runtimeBinding = buildCriticalAuditorJudgeRuntimeBinding(registry);
  if (!runtimeBinding.binding || runtimeBinding.issueCodes.length > 0) {
    return withReceiptHash({
      schemaVersion: 'requirements-contract-judge-selection-receipt/v1',
      transactionId,
      auditAttemptId,
      providerRegistryHash: sha256Stable(registry),
      publicProviderConfigurationHash: sha256Stable(provider),
      capabilityReceiptHash: capability.receiptHash,
      selectedProvider: 'local-sonnet-judge',
      configuredBaseUrlHash: sha256Stable('claude'),
      transport: 'claude-code-cli',
      apiStyle: 'cli',
      model: 'claude-sonnet-5',
      independenceClass: 'different_provider_different_model',
      blindReview: true,
      allowPassAuthority: false,
      runtimeFallbackAllowed: false,
      sourceHash: lineage.sourceDocumentHash,
      decision: 'frozen',
    });
  }
  return withReceiptHash({
    schemaVersion: 'requirements-contract-judge-selection-receipt/v1',
    transactionId,
    auditAttemptId,
    providerRegistryHash: runtimeBinding.binding.providerRegistryHash,
    publicProviderConfigurationHash: sha256Stable(provider),
    capabilityReceiptHash: capability.receiptHash,
    selectedProvider: 'local-sonnet-judge',
    configuredBaseUrlHash: sha256Stable('claude'),
    transport: 'claude-code-cli',
    apiStyle: 'cli',
    model: 'claude-sonnet-5',
    independenceClass: 'different_provider_different_model',
    blindReview: true,
    allowPassAuthority: false,
    runtimeFallbackAllowed: false,
    sourceHash: lineage.sourceDocumentHash,
    decision: 'frozen',
  });
}

function buildExpectationFromJudgeSelection(input?: {
  providerRegistry?: Record<string, unknown>;
  capabilityReceipt?: Record<string, unknown>;
  selectionReceipt?: Record<string, unknown> | null;
  expectedTransactionId?: string;
  expectedAuditAttemptId?: string;
}) {
  const providerRegistry = input?.providerRegistry ?? judgeProviderRegistry();
  const capabilityReceipt =
    input?.capabilityReceipt ?? judgeCapabilityReceipt(providerRegistry);
  const selectionReceipt =
    input && 'selectionReceipt' in input
      ? input.selectionReceipt
      : judgeSelectionReceipt(providerRegistry, capabilityReceipt);
  const lineage = independentProviderExpectation();
  return buildCriticalAuditorIndependentProviderExpectationFromJudgeSelection({
    providerRegistry,
    capabilityReceipt,
    selectionReceipt,
    expectedTransactionId: input?.expectedTransactionId ?? transactionId,
    expectedAuditAttemptId: input?.expectedAuditAttemptId ?? auditAttemptId,
    requestHash: lineage.requestHash,
    sourceDocumentHash: lineage.sourceDocumentHash,
    semanticModelHash: lineage.semanticModelHash,
    projectionSetHash: lineage.projectionSetHash,
  });
}

function independentProviderEvidence(
  overrides: Partial<CriticalAuditorIndependentProviderEvidence> = {}
): CriticalAuditorIndependentProviderEvidence {
  const expected = independentProviderExpectation();
  const evidenceWithoutRunHash = {
    ...expected,
    requestedModel: expected.model,
    providerRunId: 'critical-auditor-run-current',
    responseHash:
      'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    ...overrides,
  };
  return {
    ...evidenceWithoutRunHash,
    runHash: criticalAuditorIndependentProviderRunHash(evidenceWithoutRunHash),
  };
}

function createAuthoringRequest(): { authoringDir: string; responsePath: string } {
  const authoringDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'critical-auditor-independence-')
  );
  temporaryRoots.push(authoringDir);
  const requestPath = path.join(authoringDir, 'critical-auditor-round-request-1.json');
  const responsePath = path.join(authoringDir, 'critical-auditor-round-response-1.json');
  fs.writeFileSync(
    requestPath,
    `${JSON.stringify(
      {
        schemaVersion: 'critical-auditor-round-request/v1',
        requestHash: 'sha256:request-current',
        recordId: 'REQ-CRITICAL-AUDITOR-INDEPENDENCE',
        roundIndex: 1,
        transactionId: 'CATX-CRITICAL-AUDITOR-INDEPENDENCE',
        namespaceVersion: 'critical-auditor-namespace/current',
        sourceDocumentHash: 'sha256:source-current',
        implementationConfirmationHash: 'sha256:confirmation-current',
        packetHash: 'sha256:packet-current',
        mustRefs: ['MUST-001'],
        packetProjectionSummary: {
          projectionGroups: ['mustAcceptanceProjection'],
          projectionRefs: ['MUST-001:ACC-001'],
        },
        projectionQualityGate: {
          requiredRuleCodes: ['projection_per_must_acceptance_not_independent'],
        },
        gateDryRun: {
          gateDryRunHash: 'sha256:gate-current',
          actionableBlockingIssueCount: 0,
          actionableBlockingIssues: [],
          reconciliation: {
            issueCount: 0,
          },
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { authoringDir, responsePath };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('S127 Critical Auditor independence', () => {
  it('rejects deterministic no-gap synthesis without independent provider evidence', () => {
    const { authoringDir, responsePath } = createAuthoringRequest();
    const execution = spawnSync(
      process.execPath,
      [writerPath, '--authoring-dir', authoringDir, '--round', '1', '--json'],
      { cwd: projectRoot, encoding: 'utf8' }
    );
    const result = JSON.parse(execution.stdout || execution.stderr) as {
      ok?: boolean;
      failureClass?: string;
    };

    expect(result.ok).toBe(false);
    expect(result.failureClass).toBe(
      'critical_auditor_independent_provider_evidence_required'
    );
    expect(fs.existsSync(responsePath)).toBe(false);
  });

  it('rejects a no-gap response that omits independent provider run evidence', () => {
    const validation = validateCriticalAuditorIndependentProviderEvidence({
      expected: independentProviderExpectation(),
      evidence: null,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issueCodes).toEqual([
      'critical_auditor_independent_provider_evidence_required',
    ]);
  });

  it('accepts exact configured independent provider and current lineage evidence', () => {
    const validation = validateCriticalAuditorIndependentProviderEvidence({
      expected: independentProviderExpectation(),
      evidence: independentProviderEvidence(),
    });

    expect(validation).toEqual({ ok: true, issueCodes: [] });
  });

  it('treats the configured model as a routing hint and binds a different returned model', () => {
    const expected = independentProviderExpectation();
    const validation = validateCriticalAuditorIndependentProviderEvidence({
      expected,
      evidence: independentProviderEvidence({
        requestedModel: expected.model,
        model: 'gateway-returned-model',
      } as Partial<CriticalAuditorIndependentProviderEvidence>),
    });

    expect(validation).toEqual({ ok: true, issueCodes: [] });
  });

  it('rejects requested model drift independently of the returned model identity', () => {
    const validation = validateCriticalAuditorIndependentProviderEvidence({
      expected: independentProviderExpectation(),
      evidence: independentProviderEvidence({
        requestedModel: 'different-routing-hint',
      } as Partial<CriticalAuditorIndependentProviderEvidence>),
    });

    expect(validation.ok).toBe(false);
    expect(validation.issueCodes).toContain(
      'critical_auditor_requested_model_identity_mismatch'
    );
  });

  it.each([
    ['transactionId', 'other-transaction', 'critical_auditor_transaction_id_mismatch'],
    ['auditAttemptId', 'other-audit-attempt', 'critical_auditor_audit_attempt_id_mismatch'],
    ['providerId', 'other-provider', 'critical_auditor_provider_identity_mismatch'],
    [
      'requestedModel',
      'other-model',
      'critical_auditor_requested_model_identity_mismatch',
    ],
    ['transport', 'anthropic-compatible', 'critical_auditor_transport_identity_mismatch'],
    ['apiStyle', 'messages', 'critical_auditor_api_style_mismatch'],
    [
      'configuredBaseUrlHash',
      'sha256:abababababababababababababababababababababababababababababababab',
      'critical_auditor_configured_base_url_hash_mismatch',
    ],
    ['independenceClass', 'same_provider_same_model', 'critical_auditor_independence_class_mismatch'],
    [
      'providerRegistryHash',
      'sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
      'critical_auditor_provider_registry_hash_mismatch',
    ],
    [
      'providerConfigurationHash',
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'critical_auditor_provider_configuration_hash_mismatch',
    ],
    [
      'capabilityReceiptHash',
      'sha256:dededededededededededededededededededededededededededededededede',
      'critical_auditor_capability_receipt_hash_mismatch',
    ],
    [
      'selectionReceiptHash',
      'sha256:efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef',
      'critical_auditor_selection_receipt_hash_mismatch',
    ],
    [
      'requestHash',
      'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'critical_auditor_request_hash_mismatch',
    ],
    [
      'sourceDocumentHash',
      'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'critical_auditor_source_hash_stale',
    ],
    [
      'semanticModelHash',
      'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'critical_auditor_semantic_model_hash_stale',
    ],
    [
      'projectionSetHash',
      'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      'critical_auditor_projection_set_hash_mismatch',
    ],
  ] as const)(
    'rejects %s drift independently',
    (field, value, expectedIssueCode) => {
      const validation = validateCriticalAuditorIndependentProviderEvidence({
        expected: independentProviderExpectation(),
        evidence: independentProviderEvidence({ [field]: value }),
      });

      expect(validation.ok).toBe(false);
      expect(validation.issueCodes).toContain(expectedIssueCode);
    }
  );

  it('rejects missing run identity, malformed response hash, and a stale run hash', () => {
    const evidence = independentProviderEvidence();
    const validation = validateCriticalAuditorIndependentProviderEvidence({
      expected: independentProviderExpectation(),
      evidence: {
        ...evidence,
        providerRunId: '',
        responseHash: 'not-a-hash',
        runHash:
          'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      },
    });

    expect(validation.ok).toBe(false);
    expect(validation.issueCodes).toEqual(
      expect.arrayContaining([
        'critical_auditor_provider_run_id_missing',
        'critical_auditor_provider_response_hash_invalid',
        'critical_auditor_provider_run_hash_mismatch',
      ])
    );
  });

  it('rejects credential material in independent provider evidence', () => {
    const validation = validateCriticalAuditorIndependentProviderEvidence({
      expected: independentProviderExpectation(),
      evidence: {
        ...independentProviderEvidence(),
        authorization: 'Bearer forbidden',
      } as CriticalAuditorIndependentProviderEvidence,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issueCodes).toContain(
      'critical_auditor_credential_material_forbidden'
    );
  });

  it('builds the expected identity only from the current frozen Judge selection chain', () => {
    const result = buildExpectationFromJudgeSelection();

    expect(result.issueCodes).toEqual([]);
    expect(result.expectation).toMatchObject({
      transactionId,
      auditAttemptId,
      providerId: 'local-sonnet-judge',
      model: 'claude-sonnet-5',
      transport: 'claude-code-cli',
      apiStyle: 'cli',
      independenceClass: 'different_provider_different_model',
    });
  });

  it('reads the production Judge authority from judgeRuntime rather than the governance provider', () => {
    const config = readGovernanceRemediationConfig(projectRoot);
    expect(config.judgeRuntime).toBeDefined();
    const registry = config.judgeRuntime as unknown as Record<string, unknown>;
    const bindingResult = buildCriticalAuditorJudgeRuntimeBinding(registry);
    const lineage = independentProviderExpectation();
    const expectationResult =
      buildCriticalAuditorIndependentProviderExpectationFromJudgeRuntime({
        providerRegistry: registry,
        requestHash: lineage.requestHash,
        sourceDocumentHash: lineage.sourceDocumentHash,
        semanticModelHash: lineage.semanticModelHash,
        projectionSetHash: lineage.projectionSetHash,
      });

    expect(config.provider.id).toBe('openai-governance');
    expect(bindingResult.issueCodes).toEqual([]);
    expect(bindingResult.binding).toMatchObject({
      providerId: 'local-sonnet-judge',
      model: null,
      transport: 'claude-code-cli',
      apiStyle: 'cli',
    });
    expect(expectationResult.issueCodes).toEqual([]);
    expect(expectationResult.expectation).toMatchObject({
      providerId: 'local-sonnet-judge',
      model: null,
      transport: 'claude-code-cli',
      apiStyle: 'cli',
    });
  });

  it('binds a gateway-selected model while preserving a null requested model', () => {
    const expected = {
      ...independentProviderExpectation(),
      model: null,
    } as unknown as CriticalAuditorIndependentProviderExpectation;
    const evidenceWithoutRunHash = {
      ...expected,
      requestedModel: null,
      model: `returned-${randomUUID()}`,
      providerRunId: `provider-run-${randomUUID()}`,
      responseHash:
        'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    };
    const evidence = {
      ...evidenceWithoutRunHash,
      runHash: criticalAuditorIndependentProviderRunHash(
        evidenceWithoutRunHash as unknown as Omit<
          CriticalAuditorIndependentProviderEvidence,
          'runHash'
        >
      ),
    } as unknown as CriticalAuditorIndependentProviderEvidence;

    expect(
      validateCriticalAuditorIndependentProviderEvidence({ expected, evidence })
    ).toEqual({ ok: true, issueCodes: [] });
    expect(
      validateCriticalAuditorIndependentProviderEvidence({
        expected,
        evidence: { ...evidence, requestedModel: undefined },
      })
    ).toMatchObject({
      ok: false,
      issueCodes: expect.arrayContaining([
        'critical_auditor_requested_model_identity_mismatch',
      ]),
    });
  });

  it('accepts a positive provider-configured timeout without freezing one machine latency value', () => {
    const config = readGovernanceRemediationConfig(projectRoot);
    const registry = structuredClone(
      config.judgeRuntime
    ) as unknown as Record<string, unknown>;
    const providerRef = String(registry.activeProviderRef ?? '');
    const providers = registry.providers as Record<string, Record<string, unknown>>;
    const provider = providers[providerRef];
    const requestPolicy = provider.requestPolicy as Record<string, unknown>;
    requestPolicy.timeoutMs = 300_000;

    const result = buildCriticalAuditorJudgeRuntimeBinding(registry);

    expect(result.issueCodes).not.toContain('critical_auditor_judge_timeout_mismatch');
    expect(result.binding).not.toBeNull();
  });

  it.each([
    [
      () => buildExpectationFromJudgeSelection({ selectionReceipt: null }),
      'critical_auditor_judge_selection_receipt_required',
    ],
    [
      () =>
        buildExpectationFromJudgeSelection({
          expectedTransactionId: 'other-transaction',
        }),
      'critical_auditor_judge_selection_transaction_mismatch',
    ],
    [
      () =>
        buildExpectationFromJudgeSelection({
          expectedAuditAttemptId: 'other-audit-attempt',
        }),
      'critical_auditor_judge_selection_audit_attempt_mismatch',
    ],
  ])('blocks missing, stale, or cross-attempt Judge selection', (build, expectedIssueCode) => {
    const result = build();
    expect(result.expectation).toBeNull();
    expect(result.issueCodes).toContain(expectedIssueCode);
  });

  it('rejects a capability fallback or a Selection Receipt that does not bind its hash', () => {
    const providerRegistry = judgeProviderRegistry();
    const capabilityReceipt = judgeCapabilityReceipt(providerRegistry);
    const fallbackCapability = withReceiptHash({
      ...capabilityReceipt,
      receiptHash: undefined,
      fallbackObserved: true,
    });
    const fallback = buildExpectationFromJudgeSelection({
      providerRegistry,
      capabilityReceipt: fallbackCapability,
      selectionReceipt: judgeSelectionReceipt(providerRegistry, fallbackCapability),
    });
    const staleSelection = {
      ...judgeSelectionReceipt(providerRegistry, capabilityReceipt),
      capabilityReceiptHash:
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };
    const stale = buildExpectationFromJudgeSelection({
      providerRegistry,
      capabilityReceipt,
      selectionReceipt: staleSelection,
    });

    expect(fallback.expectation).toBeNull();
    expect(fallback.issueCodes).toContain('critical_auditor_judge_capability_fallback_observed');
    expect(stale.expectation).toBeNull();
    expect(stale.issueCodes).toEqual(
      expect.arrayContaining([
        'critical_auditor_judge_selection_receipt_hash_mismatch',
        'critical_auditor_judge_selection_capability_hash_mismatch',
      ])
    );
  });

  it('rejects credential material anywhere in the Judge public or receipt authority chain', () => {
    const providerRegistry = judgeProviderRegistry();
    const credentialBearingRegistry = {
      ...providerRegistry,
      apiKey: 'forbidden',
    };
    const result = buildExpectationFromJudgeSelection({
      providerRegistry: credentialBearingRegistry,
    });

    expect(result.expectation).toBeNull();
    expect(result.issueCodes).toContain(
      'critical_auditor_judge_authority_credential_material_forbidden'
    );
  });
});
