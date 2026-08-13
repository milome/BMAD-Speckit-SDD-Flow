import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

const HASH = (digit: string) => `sha256:${digit.repeat(64)}`;
const schemaRoot = path.resolve('packages/bmad-speckit/src/main-agent/source-authority/schemas');
const schemaFiles = {
  selection: 'requirements-contract-judge-selection-receipt.schema.json',
  request: 'requirements-contract-judge-request.schema.json',
  attempt: 'requirements-contract-judge-attempt.schema.json',
  activeRequest: 'requirements-contract-judge-active-request.schema.json',
  response: 'requirements-contract-judge-response.schema.json',
};

type SchemaName = keyof typeof schemaFiles;

function validator(name: SchemaName) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(path.join(schemaRoot, schemaFiles[name]), 'utf8')));
}

function selection() {
  return {
    schemaVersion: 'requirements-contract-judge-selection-receipt/v1',
    decision: 'selected',
    providerRef: 'judge-a',
    transport: 'openai-compatible',
    apiStyle: 'chat_completions',
    model: 'judge-model',
    adapterRef: 'OpenAICompatibleJudgeAdapter',
    providerRegistryHash: HASH('1'),
    providerConfigurationHash: HASH('2'),
    declaredCapacity: null,
    issueCodes: [],
    providerSelectionHash: HASH('3'),
  };
}

function request() {
  return {
    schemaVersion: 'requirements-contract-judge-request/v2',
    authority: {
      activeSemanticRevisionId: 'sem-1',
      activeScopeSemanticHash: HASH('1'),
      activeBindingRevisionId: 'binding-1',
      activeSourceBindingHash: HASH('2'),
      activeAuthoringAttemptId: 'attempt-1',
      activeBuildManifestHash: HASH('3'),
    },
    providerSelection: selection(),
    prompt: {
      systemPrompt: 'Audit the complete requirements contract.',
      rubric: {},
      structuredOutputSchema: {},
      outputTokenReserve: 4096,
    },
    auditPacket: {
      schemaVersion: 'requirements-contract-judge-audit-packet/v1',
      semanticRevisionId: 'sem-1',
      scopeSemanticHash: HASH('1'),
      body: {},
    },
    auditPacketArtifactManifest: [],
    remediation: null,
    judgeRequestHash: HASH('4'),
  };
}

describe('requirements contract Judge authority schemas', () => {
  it('publishes only the selection, request, attempt, active request, and response contracts', () => {
    expect(Object.values(schemaFiles).every((name) => existsSync(path.join(schemaRoot, name)))).toBe(
      true
    );
  });

  it('accepts optional provider capacity and does not require a guessed capacity', () => {
    const validate = validator('selection');
    expect(validate(selection()), JSON.stringify(validate.errors)).toBe(true);
    expect(
      validate({
        ...selection(),
        declaredCapacity: {
          transportByteLimit: 2_000_000,
          contextWindowTokens: 200_000,
          maximumOutputTokens: 16_384,
        },
      }),
      JSON.stringify(validate.errors)
    ).toBe(true);
    expect(validate({ ...selection(), estimatedTokens: 1234 })).toBe(false);
  });

  it('accepts the complete canonical request and rejects unknown summary identities', () => {
    const validate = validator('request');
    expect(validate(request()), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...request(), inputSummaryHash: HASH('5') })).toBe(false);
  });

  it('records transport failures without accepting an evaluation or creating a response', () => {
    const validate = validator('attempt');
    const attempt = {
      schemaVersion: 'requirements-contract-judge-attempt/v1',
      judgeRequestHash: HASH('4'),
      providerSelectionHash: HASH('3'),
      attemptOrdinal: 1,
      outcome: 'transport_failure',
      acceptedEvaluation: false,
      requestSerializedBytes: 2048,
      auditPacketSerializedBytes: 1024,
      validationIssueCodes: ['judge_provider_payload_rejected'],
      nextEligibleAt: null,
      rawResponse: null,
    };
    expect(validate(attempt), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...attempt, acceptedEvaluation: true })).toBe(false);
  });

  it('keeps a closed current-state pointer without a ledger or pointer history', () => {
    const validate = validator('activeRequest');
    const active = {
      schemaVersion: 'requirements-contract-judge-active-request/v1',
      version: 1,
      previousVersion: null,
      semanticRevisionId: 'sem-1',
      auditPolicyHash: HASH('1'),
      providerSelectionHash: HASH('3'),
      judgeRequestHash: HASH('4'),
      requestPath: `quality/requests/${HASH('4').replace(':', '-')}/judge-request.json`,
      status: 'audit_pending',
      acceptedEvaluation: false,
      attemptCount: 1,
      lastAttemptPath: `quality/requests/${HASH('4').replace(':', '-')}/dispatch-attempts/1.json`,
      lastIssueCode: 'judge_provider_payload_rejected',
      responseRef: null,
      aggregateRef: null,
      effectivePassRef: null,
      remediationPlanRef: null,
      remediationDeltaRef: null,
    };
    expect(validate(active), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...active, pointerHistory: [] })).toBe(false);
  });
});
