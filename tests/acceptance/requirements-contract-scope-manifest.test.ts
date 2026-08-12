import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsAuditScopeManifest,
  requirementsContractScopeManifestCanonicalBytes,
  validateRequirementsAuditScopeManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-scope-manifest';

const hash = (character: string) => `sha256:${character.repeat(64)}`;

function requirementsInput() {
  return {
    purpose: 'frozen_scope_assessment',
    attemptId: 'attempt-001',
    includedRequirementRefs: ['REQ-002', 'REQ-001'],
    requiredCoverageUnits: ['coverage:delivery', 'coverage:security'],
    mandatoryDimensions: ['correctness', 'security'],
    requiredVetoItems: ['veto:scope-gap', 'veto:tampered-evidence'],
    allowedEvidenceRefs: ['EVD-002', 'EVD-001'],
    explicitOutOfScope: ['future-feature', 'unrelated-package'],
    priorFindingLedgerHash: hash('a'),
    sourceAuthorityHash: hash('b'),
    policyHash: hash('c'),
    currentAuthority: {
      sourceAuthorityHash: hash('b'),
      policyHash: hash('c'),
    },
    actorClass: 'requirements_critical_auditor_judge' as const,
    judgeRole: 'requirements_critical_auditor' as const,
    sourceDocumentHash: hash('d'),
    semanticModelHash: hash('e'),
    projectionSetHash: hash('f'),
    confirmationCandidateHash: hash('1'),
    requirementsQualityRulesHash: hash('2'),
    priorRequirementsFindingsHash: hash('3'),
    kernelImplementationLineage: {
      applicability: 'not_applicable' as const,
      authorityReason: 'requirements_scope_has_no_kernel_implementation_authority' as const,
    },
  };
}

function reversed<T>(values: T[]): T[] {
  return [...values].reverse();
}

describe('requirements contract Requirements-only ScopeManifest', () => {
  it('produces byte-identical manifests for input permutations', () => {
    const input = requirementsInput();
    const permuted = {
      ...input,
      includedRequirementRefs: reversed(input.includedRequirementRefs),
      requiredCoverageUnits: reversed(input.requiredCoverageUnits),
      mandatoryDimensions: reversed(input.mandatoryDimensions),
      requiredVetoItems: reversed(input.requiredVetoItems),
      allowedEvidenceRefs: reversed(input.allowedEvidenceRefs),
      explicitOutOfScope: reversed(input.explicitOutOfScope),
    };

    const first = compileRequirementsAuditScopeManifest(input);
    const second = compileRequirementsAuditScopeManifest(permuted);

    expect(second).toEqual(first);
    expect(requirementsContractScopeManifestCanonicalBytes(second)).toBe(
      requirementsContractScopeManifestCanonicalBytes(first)
    );
  });

  it('keeps scope authority separate from evidence allowlists', () => {
    const first = compileRequirementsAuditScopeManifest(requirementsInput());
    const second = compileRequirementsAuditScopeManifest({
      ...requirementsInput(),
      allowedEvidenceRefs: ['EVD-999', ...requirementsInput().allowedEvidenceRefs],
    });

    expect(second.requiredCoverageUnits).toEqual(first.requiredCoverageUnits);
    expect(second.includedRequirementRefs).toEqual(first.includedRequirementRefs);
    expect(second.allowedEvidenceRefs).toContain('EVD-999');
    expect(second.scopeManifestHash).not.toBe(first.scopeManifestHash);
  });

  it.each([
    ['missing', 'scope_manifest_field_missing'],
    ['duplicate', 'scope_manifest_duplicate_value'],
    ['stale', 'scope_manifest_stale'],
    ['model', 'scope_manifest_model_authority_forbidden'],
    ['caller-hash', 'scope_manifest_expected_hash_forbidden'],
    ['role', 'judge_role_actor_mismatch'],
  ])('fails closed for %s requirements scope with stable code', (kind, code) => {
    const input = requirementsInput() as Record<string, unknown>;
    if (kind === 'missing') delete input.explicitOutOfScope;
    if (kind === 'duplicate') input.requiredCoverageUnits = ['coverage:security', 'coverage:security'];
    if (kind === 'stale') input.sourceAuthorityHash = hash('0');
    if (kind === 'model') input.modelProvidedScope = { requiredCoverageUnits: ['coverage:model'] };
    if (kind === 'caller-hash') input.expectedScopeManifestHash = hash('0');
    if (kind === 'role') input.judgeRole = 'final_acceptance_judge';

    expect(() => compileRequirementsAuditScopeManifest(input as never)).toThrow(code);
  });

  it('rejects tampering and final-acceptance replay', () => {
    const requirements = compileRequirementsAuditScopeManifest(requirementsInput());
    const tampered = {
      ...requirements,
      requiredCoverageUnits: [...requirements.requiredCoverageUnits, 'coverage:injected'],
    };
    const crossRole = {
      ...requirements,
      actorClass: 'final_acceptance_judge',
      judgeRole: 'final_acceptance_judge',
    };

    expect(() =>
      validateRequirementsAuditScopeManifest(tampered, requirementsInput().currentAuthority)
    ).toThrow('scope_manifest_hash_mismatch');
    expect(() =>
      validateRequirementsAuditScopeManifest(crossRole, requirementsInput().currentAuthority)
    ).toThrow('scope_manifest_role_mismatch');
  });

  it('validates compiler output against the Requirements scope schema', () => {
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-requirements-audit-scope-manifest.schema.json'
        ),
        'utf8'
      )
    );
    const ajv = new Ajv2020({ allErrors: true, strict: false });

    expect(ajv.compile(schema)(compileRequirementsAuditScopeManifest(requirementsInput()))).toBe(
      true
    );
  });
});
