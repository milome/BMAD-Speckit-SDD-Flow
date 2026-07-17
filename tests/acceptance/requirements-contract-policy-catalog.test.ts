import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  loadRequirementsPolicyCatalog,
  resolveSemanticField,
  sha256Stable,
  validateRequirementsPolicyCatalog,
  type RequirementsPolicyCatalog,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-policy-catalog.schema.json'
);
const catalogPath = path.resolve(
  '_bmad/shared/requirements-contract/requirements-policy-catalog.yaml'
);

const approvedCatalogAuthority = {
  authorityId: 'requirements-policy-catalog-approval',
  catalogId: 'requirements-policy-catalog',
  catalogVersion: '1.0.0',
  catalogHash: 'sha256:42919c526528ec0abcbb375623c3b2ba1c405977f51725bd5f4890eab9397400',
  signatureHash: 'sha256:a81351469d543f5582f6d62023a7dd9cc1f1765fe755ca21f313b58e4a988507',
  approvalReceiptHash: sha256Stable('independent-policy-catalog-approval'),
};

function trustedAuthority() {
  return { ...approvedCatalogAuthority };
}

function loadCatalogFixture() {
  const parsed = yaml.load(readFileSync(catalogPath, 'utf8')) as RequirementsPolicyCatalog;
  const authority = trustedAuthority();
  return {
    catalog: loadRequirementsPolicyCatalog(catalogPath, authority),
    authority,
  };
}

function rebindCatalog(
  catalog: RequirementsPolicyCatalog,
  policies: RequirementsPolicyCatalog['policies']
) {
  const payload = {
    schemaVersion: catalog.schemaVersion,
    catalogId: catalog.catalogId,
    catalogVersion: catalog.catalogVersion,
    policies,
  };
  const catalogHash = sha256Stable(payload);
  const signatureHash = sha256Stable({
    algorithm: catalog.signature.algorithm,
    catalogHash,
    catalogId: catalog.catalogId,
    catalogVersion: catalog.catalogVersion,
  });
  return {
    catalog: {
      ...payload,
      catalogHash,
      signature: {
        algorithm: catalog.signature.algorithm,
        signedCatalogHash: catalogHash,
        signatureHash,
      },
    } satisfies RequirementsPolicyCatalog,
    authority: { catalogHash, signatureHash },
  };
}

function policyFixture(
  catalog: ReturnType<typeof loadRequirementsPolicyCatalog>,
  facts: Record<string, unknown>
) {
  const policy = catalog.policies[0];
  const before = { requirements: { sample: { compatibilityRule: null } } };
  const after = { requirements: { sample: { compatibilityRule: policy.value } } };
  const resolverId = 'policy-resolver-test';
  const resolutionRunId = 'run-policy-fixture';
  return {
    candidate: {
      resolutionId: 'resolution-policy-fixture',
      fieldRef: 'requirements.sample.compatibilityRule',
      value: policy.value,
      semanticKind: policy.fieldKind,
      resolutionAuthorityClass: 'policy_inherited' as const,
      premises: [],
      derivationRule: policy.policyId,
      applicabilityProof: {
        policyId: policy.policyId,
        catalogHash: catalog.catalogHash,
        factsHash: sha256Stable(facts),
      },
      conflictingCandidates: [],
    },
    trustedInvocationContext: {
      resolverId,
      resolutionRunId,
      sourceModelBefore: before,
    },
  };
}

function trustedPolicyFacts(facts: Record<string, unknown>) {
  const payload = {
    facts,
    factsHash: sha256Stable(facts),
    sourceRefs: ['project-profile:test-fixture'],
    observerId: 'policy-fact-observer-test',
  };
  return {
    ...payload,
    observationReceiptHash: sha256Stable(payload),
  };
}

describe('requirements policy catalog', () => {
  it('is schema-valid, version/hash/signature-bound, and rejects extra properties', () => {
    const { catalog, authority } = loadCatalogFixture();
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const { catalogHash, signature, ...catalogPayload } = catalog;

    expect(validate(catalog), JSON.stringify(validate.errors)).toBe(true);
    expect(catalogHash).toBe(sha256Stable(catalogPayload));
    expect(signature.signedCatalogHash).toBe(catalogHash);
    expect(signature.signatureHash).toBe(
      sha256Stable({
        algorithm: signature.algorithm,
        catalogHash,
        catalogId: catalog.catalogId,
        catalogVersion: catalog.catalogVersion,
      })
    );
    expect(validate({ ...catalog, unexpected: true })).toBe(false);
    expect(validate({
      ...catalog,
      policies: [{ ...catalog.policies[0], unexpected: true }],
    })).toBe(false);
    expect(validateRequirementsPolicyCatalog(catalog, authority)).toBe(true);
    expect(validateRequirementsPolicyCatalog(catalog)).toBe(false);
  });

  it('applies a policy only when its deterministic predicates are true', () => {
    const { catalog, authority } = loadCatalogFixture();
    const applicableFacts = { targetClass: 'generated_large_document', operation: 'promotion' };
    const cases = [
      [applicableFacts, 'authorized'],
      [{ ...applicableFacts, operation: 'read' }, 'unresolved'],
      [{ targetClass: 'generated_large_document' }, 'unresolved'],
      [{ ...applicableFacts, operation: ['promotion', 'read'] }, 'unresolved'],
    ] as const;

    for (const [facts, expectedStatus] of cases) {
      const fixture = policyFixture(catalog, facts);
      const result = resolveSemanticField(fixture.candidate, {
        policyCatalog: catalog,
        trustedPolicyCatalogAuthority: authority,
        trustedPolicyFacts: trustedPolicyFacts(facts),
        trustedInvocationContext: fixture.trustedInvocationContext,
      });
      expect(result.status).toBe(expectedStatus);
    }
    const missingAuthorityFixture = policyFixture(catalog, applicableFacts);
    expect(
      resolveSemanticField(missingAuthorityFixture.candidate, {
        policyCatalog: catalog,
        trustedInvocationContext: missingAuthorityFixture.trustedInvocationContext,
      }).reasonCode
    ).toBe('policy_catalog_authority_missing');
    const mismatchedAuthorityFixture = policyFixture(catalog, applicableFacts);
    expect(
      resolveSemanticField(mismatchedAuthorityFixture.candidate, {
        policyCatalog: catalog,
        trustedPolicyCatalogAuthority: {
          ...authority,
          signatureHash: sha256Stable('mismatched-signature'),
        },
        trustedInvocationContext: mismatchedAuthorityFixture.trustedInvocationContext,
      }).reasonCode
    ).toBe('policy_catalog_authority_mismatch');
  });

  it('contains no policy capable of inventing forbidden interaction semantics', () => {
    const { catalog, authority } = loadCatalogFixture();
    const forbidden = new Set(['transport_behavior', 'target_ownership', 'failure_semantics']);
    const forgedFixture = policyFixture(catalog, {
      targetClass: 'generated_large_document',
      operation: 'promotion',
    });
    const forged = forgedFixture.candidate;
    forged.resolutionAuthorityClass = 'forged_policy_authority' as never;

    expect(catalog.policies.some((policy) => forbidden.has(policy.fieldKind))).toBe(false);
    expect(resolveSemanticField(forged, {
      policyCatalog: catalog,
      trustedPolicyCatalogAuthority: authority,
      trustedInvocationContext: forgedFixture.trustedInvocationContext,
    }).status).toBe('unresolved');
  });

  it('rejects duplicate policy identities and ambiguous duplicate predicates', () => {
    const { catalog } = loadCatalogFixture();
    const policy = catalog.policies[0];
    const [major, minor, patchVersion] = policy.policyVersion.split('.').map(Number);
    const duplicatePolicies = rebindCatalog(catalog, [
      policy,
      {
        ...policy,
        policyVersion: `${major}.${minor}.${patchVersion + 1}`,
        value: `${String(policy.value)}-alternate`,
      },
    ]);
    const predicate = policy.applicability.all[0];
    const duplicatePredicates = rebindCatalog(catalog, [{
      ...policy,
      applicability: {
        all: [
          predicate,
          { ...predicate, expected: `${String(predicate.expected)}-alternate` },
        ],
      },
    }]);

    expect(
      validateRequirementsPolicyCatalog(duplicatePolicies.catalog, duplicatePolicies.authority)
    ).toBe(false);
    expect(
      validateRequirementsPolicyCatalog(duplicatePredicates.catalog, duplicatePredicates.authority)
    ).toBe(false);
  });

  it('rejects a modified catalog even when the claimant recomputes every public hash', () => {
    const { catalog } = loadCatalogFixture();
    const policy = catalog.policies[0];
    const rebound = rebindCatalog(catalog, [{
      ...policy,
      value: `${String(policy.value)}-claimant-rebound`,
    }]);

    expect(validateRequirementsPolicyCatalog(rebound.catalog, rebound.authority)).toBe(false);
  });
});
