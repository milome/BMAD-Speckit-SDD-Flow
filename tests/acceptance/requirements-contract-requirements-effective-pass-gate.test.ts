import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsEffectivePassReceipt,
  validateRequirementsEffectivePassReceipt,
  writeRequirementsEffectivePassReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

const HASHES = {
  request: sha256Stable({ field: 'request' }),
  attempt: sha256Stable({ field: 'attempt' }),
  scope: sha256Stable({ field: 'scope' }),
  evidence: sha256Stable({ field: 'evidence' }),
  providerInvocation: sha256Stable({ field: 'providerInvocation' }),
  prompt: sha256Stable({ field: 'prompt' }),
  schema: sha256Stable({ field: 'schema' }),
  providerConfiguration: sha256Stable({ field: 'providerConfiguration' }),
  ledger: sha256Stable({ field: 'ledger' }),
};

const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-requirements-effective-pass-receipt.schema.json'
);

function validInput(overrides: JsonRecord = {}) {
  const coverageUnitRefs = ['coverage/dimension', 'coverage/must', 'coverage/projection'];
  return {
    request: {
      actorClass: 'requirements_critical_auditor_judge',
      judgeRole: 'requirements_critical_auditor',
      requestHash: HASHES.request,
      attemptKeyHash: HASHES.attempt,
      scopeManifestHash: HASHES.scope,
      promptTemplateHash: HASHES.prompt,
      assessmentSchemaHash: HASHES.schema,
      providerAuthority: {
        providerRef: 'provider/requirements',
        providerRegistryHash: sha256Stable({ field: 'providerRegistry' }),
        providerConfigurationHash: HASHES.providerConfiguration,
        credentialRevision: 1,
      },
    },
    assessment: {
      schemaVersion: 'critical-auditor-judge-assessment/v1',
      actorClass: 'requirements_critical_auditor_judge',
      judgeRole: 'requirements_critical_auditor',
      verdict: 'no_new_valid_gap',
      validatedGaps: [],
    },
    frozenScope: {
      coverageUnitRefs,
    },
    coverage: {
      observedCoverageUnitRefs: [...coverageUnitRefs],
      unassessedScopeRefs: [],
      blockingConditionRefs: [],
    },
    evidence: {
      evidenceManifestHash: HASHES.evidence,
      providerInvocationReceiptHash: HASHES.providerInvocation,
      missingEvidenceRefs: [],
    },
    priorFindings: {
      ledgerEntryHash: HASHES.ledger,
      requiredPriorFindingRefs: ['finding/1', 'finding/2'],
      currentDispositionRefs: ['finding/1', 'finding/2'],
      unresolvedPriorFindingRefs: [],
    },
    veto: {
      requirementsVetoRefs: ['veto/security', 'veto/scope'],
      passedVetoRefs: ['veto/security', 'veto/scope'],
    },
    currentAuthority: {
      attemptKeyHash: HASHES.attempt,
      scopeManifestHash: HASHES.scope,
      evidenceManifestHash: HASHES.evidence,
      providerInvocationReceiptHash: HASHES.providerInvocation,
      promptTemplateHash: HASHES.prompt,
      assessmentSchemaHash: HASHES.schema,
      providerConfigurationHash: HASHES.providerConfiguration,
    },
    identity: {
      replayDetected: false,
      duplicateIdentityDetected: false,
    },
    ...overrides,
  };
}

describe('Requirements EffectivePass gate', () => {
  it('writes only a complete current Requirements authority tuple as EffectivePass', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-effective-pass-'));
    const receiptPath = path.join(root, 'requirements-effective-pass.receipt.json');
    try {
      const receipt = writeRequirementsEffectivePassReceipt({
        receiptPath,
        evidence: validInput(),
      });
      const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
        JSON.parse(readFileSync(schemaPath, 'utf8'))
      );

      expect(receipt.schemaVersion).toBe('requirements-effective-pass-receipt/v1');
      expect(receipt.decision).toBe('pass');
      expect(receipt.decisionFieldOrigin).toBe('package_calculated');
      expect(receipt.writeSemantics).toBe('create_only');
      expect(Object.values(receipt.effectivePassConditions).every(Boolean)).toBe(true);
      expect(validate(receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
      expect(validateRequirementsEffectivePassReceipt(receipt)).toEqual(receipt);
      expect(() =>
        writeRequirementsEffectivePassReceipt({ receiptPath, evidence: validInput() })
      ).toThrow('requirements_effective_pass_receipt_exists');
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it.each([
    [
      'cross-role request',
      { request: { actorClass: 'final_acceptance_judge' } },
      'role_specific_request_invalid',
    ],
    [
      'insufficient audit',
      { assessment: { verdict: 'insufficient_audit' } },
      'model_verdict_not_pass',
    ],
    [
      'blocked assessment',
      { assessment: { verdict: 'blocked', validatedGaps: [] } },
      'model_verdict_not_pass',
    ],
    [
      'missing coverage',
      { coverage: { observedCoverageUnitRefs: ['coverage/dimension'] } },
      'observed_coverage_not_exact',
    ],
    [
      'missing evidence',
      { evidence: { missingEvidenceRefs: ['evidence/missing'] } },
      'missing_evidence_not_empty',
    ],
    [
      'validated gap',
      { assessment: { validatedGaps: [{ id: 'gap/1' }] } },
      'validated_gaps_not_empty',
    ],
    [
      'unresolved prior finding',
      { priorFindings: { unresolvedPriorFindingRefs: ['finding/1'] } },
      'unresolved_prior_findings_not_empty',
    ],
    [
      'missing prior disposition',
      { priorFindings: { currentDispositionRefs: ['finding/1'] } },
      'prior_finding_disposition_incomplete',
    ],
    [
      'failed veto',
      { veto: { passedVetoRefs: ['veto/security'] } },
      'requirements_veto_not_passed',
    ],
    [
      'stale provider receipt',
      {
        currentAuthority: {
          providerInvocationReceiptHash: sha256Stable({ stale: 'providerInvocation' }),
        },
      },
      'provider_invocation_receipt_stale',
    ],
    [
      'replay',
      { identity: { replayDetected: true, duplicateIdentityDetected: false } },
      'replay_or_duplicate_identity',
    ],
  ])('fails closed for %s', (_name, patch, expectedCode) => {
    const evidence = validInput();
    for (const [key, value] of Object.entries(patch as JsonRecord)) {
      evidence[key] = {
        ...((evidence[key] as JsonRecord | undefined) ?? {}),
        ...(value as JsonRecord),
      };
    }

    expect(() => compileRequirementsEffectivePassReceipt(evidence)).toThrow(expectedCode);
  });

  it.each([
    'pass',
    'decision',
    'expectedHash',
    'expectedCoverageUnitRefs',
    'expectedDispositionRefs',
  ])('rejects caller-injected authority field %s', (field) => {
    expect(() =>
      compileRequirementsEffectivePassReceipt({
        ...validInput(),
        [field]: field === 'decision' ? 'pass' : true,
      })
    ).toThrow('requirements_effective_pass_caller_authority_injection');
  });

  it('rejects tampered receipt self-hashes', () => {
    const receipt = compileRequirementsEffectivePassReceipt(validInput());

    expect(() =>
      validateRequirementsEffectivePassReceipt({
        ...receipt,
        requestHash: sha256Stable({ tampered: true }),
      })
    ).toThrow('requirements_effective_pass_receipt_hash_mismatch');
  });
});
