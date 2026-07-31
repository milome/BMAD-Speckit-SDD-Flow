import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'6'.repeat(64)}`;
const schemaRoot = path.resolve('packages/bmad-speckit/src/main-agent/source-authority/schemas');
const schemaFiles = {
  runtime: 'requirements-contract-judge-runtime.schema.json',
  credentials: 'requirements-contract-judge-credentials.schema.json',
  normalizedResponse: 'requirements-contract-normalized-judge-response.schema.json',
  capability: 'requirements-contract-judge-capability-receipt.schema.json',
  selection: 'requirements-contract-judge-selection-receipt.schema.json',
};

function validator(name: keyof typeof schemaFiles) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(path.join(schemaRoot, schemaFiles[name]), 'utf8')));
}

function runtimeConfig() {
  return {
    schemaVersion: 'requirements-contract-judge-runtime/v1',
    enabled: true,
    activeProviderRef: 'local-sonnet-judge',
    selectionPolicy: {
      mode: 'contract_locked',
      runtimeFallbackAllowed: false,
      runtimeAutoDiscoveryAllowed: false,
      environmentOverrideAllowed: false,
      cliTransportAllowed: false,
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
        transport: 'openai-compatible',
        apiStyle: 'chat_completions',
        model: 'claude-sonnet-5',
        credentialRef: 'local-sonnet-judge',
        endpoint: {
          baseUrl: 'http://localhost:3010',
          resolutionMode: 'transport_managed',
          routingOwnership: 'transport_adapter',
          upstreamVersioning: 'gateway_managed',
          explicitOperationPath: null,
        },
        authentication: {
          type: 'bearer',
          sensitivity: 'placeholder',
          arbitraryNonEmptyValueAllowed: true,
        },
        auditPolicy: {
          independenceClass: 'different_provider_different_model',
          blindReview: true,
          allowPassAuthority: false,
          toolsAllowed: false,
          implementationWritesAllowed: false,
        },
        requestPolicy: {
          timeoutMs: 120000,
          maximumAttempts: 1,
          structuredResponseRequired: true,
        },
      },
    },
  };
}

it('publishes every DSA-16 judge schema boundary', () => {
  expect(Object.values(schemaFiles).every((name) => existsSync(path.join(schemaRoot, name)))).toBe(
    true
  );
});

describe.runIf(Object.values(schemaFiles).every((name) => existsSync(path.join(schemaRoot, name))))(
  'DSA-16 judge schemas',
  () => {
    it('accepts the frozen public runtime and private credential contracts', () => {
      const validateRuntime = validator('runtime');
      const validateCredentials = validator('credentials');

      expect(validateRuntime(runtimeConfig()), JSON.stringify(validateRuntime.errors)).toBe(true);
      expect(
        validateCredentials({
          schemaVersion: 'requirements-contract-judge-credentials/v1',
          credentialRevision: 1,
          providers: {
            'local-sonnet-judge': {
              authenticationType: 'bearer',
              apiKey: 'placeholder-secret',
            },
          },
        }),
        JSON.stringify(validateCredentials.errors)
      ).toBe(true);
    });

    it('rejects fallback, environment override, and transport-managed explicit paths', () => {
      const validate = validator('runtime');
      const fallback = runtimeConfig();
      fallback.selectionPolicy.runtimeFallbackAllowed = true;
      const environment = runtimeConfig();
      environment.selectionPolicy.environmentOverrideAllowed = true;
      const explicitPath = runtimeConfig();
      explicitPath.providers['local-sonnet-judge'].endpoint.explicitOperationPath =
        '/v1/chat/completions';

      expect(validate(fallback)).toBe(false);
      expect(validate(environment)).toBe(false);
      expect(validate(explicitPath)).toBe(false);
    });

    it('treats the configured provider and request model as routing inputs rather than frozen model identity', () => {
      const validate = validator('normalizedResponse');
      const providerRef = `gateway-${randomUUID()}`;
      const requestedModel = `route-${randomUUID()}`;
      const returnedModel = `decision-${randomUUID()}`;
      const response = {
        schemaVersion: 'requirements-contract-normalized-judge-response/v1',
        providerRef,
        transport: 'openai-compatible',
        configuredModel: requestedModel,
        returnedModel,
        decision: 'pass',
        findings: [],
        challengeRequests: [],
        evidenceRefs: [],
        providerRequestId: 'request-1',
        requestHash: HASH,
        responseHash: HASH,
      };

      expect(validate(response), JSON.stringify(validate.errors)).toBe(true);
      expect(validate({ ...response, returnedModel: '' })).toBe(false);
    });

    it('requires attempt-bound capability and frozen selection receipts', () => {
      const validateCapability = validator('capability');
      const validateSelection = validator('selection');
      const providerRef = `gateway-${randomUUID()}`;
      const returnedModel = `decision-${randomUUID()}`;
      const capability = {
        schemaVersion: 'requirements-contract-judge-capability-receipt/v1',
        transactionId: 'TX-001',
        auditAttemptId: 'AUD-001',
        providerRef,
        publicProviderConfigHash: HASH,
        credentialRevision: 1,
        credentialResolutionDecision: 'pass',
        credentialRedactionDecision: 'pass',
        configuredBaseUrlHash: HASH,
        transport: 'claude-code-cli',
        apiStyle: 'cli',
        endpointResolutionMode: 'path_search',
        upstreamVersioning: 'gateway_managed',
        configuredModel: null,
        returnedModel,
        transportSuccess: true,
        structuredOutputSupport: true,
        originPreservationDecision: 'pass',
        fallbackObserved: false,
        probeRequestHash: HASH,
        probeResponseHash: HASH,
        decision: 'pass',
      };
      const selection = {
        schemaVersion: 'requirements-contract-judge-selection-receipt/v1',
        transactionId: 'TX-001',
        auditAttemptId: 'AUD-001',
        providerRegistryHash: HASH,
        publicProviderConfigHash: HASH,
        capabilityReceiptHash: HASH,
        providerRef,
        configuredBaseUrlHash: HASH,
        transport: 'claude-code-cli',
        apiStyle: 'cli',
        model: null,
        credentialRevision: 1,
        independenceClass: 'different_provider_different_model',
        blindReview: true,
        allowPassAuthority: false,
        runtimeFallbackAllowed: false,
        rubricHash: HASH,
        systemPromptHash: HASH,
        sourceHash: HASH,
        traceHash: HASH,
        redHash: HASH,
        baseEvidenceHash: HASH,
        auditUniverseHash: HASH,
        judgeAuditUnitSetRef: {
          path: 'audit/AUD-001/judge-audit-unit-set.json',
          hash: HASH,
          schemaVersion: 'requirements-contract-judge-audit-unit-set/v1',
        },
        judgeAuditUnitSetHash: HASH,
        baseJudgeInputBundleHash: HASH,
        authorizedChallengeDerivationProtocolHash: HASH,
        decision: 'frozen',
      };

      expect(validateCapability(capability), JSON.stringify(validateCapability.errors)).toBe(true);
      expect(validateSelection(selection), JSON.stringify(validateSelection.errors)).toBe(true);
      expect(validateCapability({ ...capability, fallbackObserved: true })).toBe(false);
      expect(validateSelection({ ...selection, allowPassAuthority: true })).toBe(false);
    });

    it('allows a gateway-managed Claude CLI provider to delegate model selection', () => {
      const validate = validator('runtime');
      const providerRef = `gateway-${randomUUID()}`;
      const base = runtimeConfig();
      base.activeProviderRef = providerRef;
      base.selectionPolicy.cliTransportAllowed = true;
      base.providers = {
        [providerRef]: {
          enabled: true,
          transport: 'claude-code-cli',
          apiStyle: 'cli',
          credentialRef: `credential-${randomUUID()}`,
          endpoint: {
            command: 'claude',
            baseUrl: `https://${randomUUID()}.example.test`,
            resolutionMode: 'path_search',
            routingOwnership: 'transport_adapter',
            upstreamVersioning: 'gateway_managed',
            explicitOperationPath: null,
          },
          authentication: {
            type: 'bearer',
            sensitivity: 'secret',
            arbitraryNonEmptyValueAllowed: false,
          },
          auditPolicy: {
            independenceClass: `independent-${randomUUID()}`,
            blindReview: true,
            allowPassAuthority: false,
            toolsAllowed: true,
            allowedTools: ['Read'],
            implementationWritesAllowed: false,
          },
          requestPolicy: {
            timeoutMs: 120_000,
            maximumAttempts: 1,
            structuredResponseRequired: true,
          },
        },
      };

      expect(validate(base), JSON.stringify(validate.errors)).toBe(true);
      const explicitNull = structuredClone(base);
      explicitNull.providers[providerRef].model = null;
      expect(validate(explicitNull), JSON.stringify(validate.errors)).toBe(true);
      const fixedModel = structuredClone(base);
      fixedModel.providers[providerRef].model = `fixed-${randomUUID()}`;
      expect(validate(fixedModel)).toBe(false);
    });
  }
);
