import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validateDiagramApplicability,
  validateRequirementsContractProjectProfile,
  type RequirementsContractDiagramApplicability,
  type RequirementsContractProjectProfile,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-project-profile';

const HASH = `sha256:${'c'.repeat(64)}`;
const projectProfileSchemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-project-profile.schema.json'
);
const diagramApplicabilitySchemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-diagram-applicability.schema.json'
);

function projectProfile(
  overrides: Partial<RequirementsContractProjectProfile> = {}
): RequirementsContractProjectProfile {
  return {
    schemaVersion: 'requirements-contract-project-profile/v1',
    projectKind: 'consumer_product',
    owningSystem: 'order-platform',
    governanceFramework: 'BMAD-Speckit',
    classificationAuthority: {
      kind: 'decision_receipt',
      ref: '_bmad-output/runtime/decisions/project-kind.json',
      hash: HASH,
    },
    diagramPolicyRegistryHash: HASH,
    ...overrides,
  };
}

function applicability(): RequirementsContractDiagramApplicability {
  return {
    schemaVersion: 'requirements-contract-diagram-applicability/v1',
    projectProfileHash: HASH,
    decisions: [
      {
        view: 'primary_business_sequence',
        applicability: 'required',
        reasonCode: 'critical_interaction_present',
        proofRefs: ['MUST-FR-001'],
      },
      {
        view: 'failure_compensation_sequence',
        applicability: 'not_applicable',
        reasonCode: 'no_failure_semantics',
        proofRefs: ['PROFILE-001'],
      },
      {
        view: 'state_lifecycle',
        applicability: 'not_applicable',
        reasonCode: 'no_state_transition',
        proofRefs: ['PROFILE-001'],
      },
      {
        view: 'deployment_delta',
        applicability: 'not_applicable',
        reasonCode: 'no_deployment_change',
        proofRefs: ['PROFILE-001'],
      },
      {
        view: 'data_security_flow',
        applicability: 'not_applicable',
        reasonCode: 'no_data_security_change',
        proofRefs: ['PROFILE-001'],
      },
      {
        view: 'scope_boundary',
        applicability: 'required',
        reasonCode: 'scope_table_required',
        proofRefs: ['PROFILE-001'],
      },
      {
        view: 'governance_flow',
        applicability: 'forbidden',
        reasonCode: 'consumer_product_scope',
        proofRefs: ['PROFILE-001'],
      },
    ],
  };
}

describe('project profile and diagram applicability contracts', () => {
  it('accepts only hash-authorized consumer, governance, and hybrid project profiles', () => {
    const schema = JSON.parse(readFileSync(projectProfileSchemaPath, 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    for (const projectKind of ['consumer_product', 'governance_framework', 'hybrid'] as const) {
      const profile = projectProfile({ projectKind });
      expect(validate(profile), JSON.stringify(validate.errors)).toBe(true);
      expect(validateRequirementsContractProjectProfile(profile).ok).toBe(true);
    }

    expect(
      validateRequirementsContractProjectProfile(
        projectProfile({ projectKind: 'generic' as never })
      ).issues
    ).toContainEqual(expect.objectContaining({ code: 'invalid_project_kind' }));
  });

  it('requires owning system, authorized classification, and consumer governance-flow exclusion', () => {
    const missingOwner = projectProfile({ owningSystem: '' });
    const inferred = projectProfile({
      classificationAuthority: {
        kind: 'heading_keyword',
        ref: 'Governance Gate',
        hash: HASH,
      } as never,
    });
    const invalidApplicability = applicability();
    invalidApplicability.decisions[6].applicability = 'required';

    expect(validateRequirementsContractProjectProfile(missingOwner).ok).toBe(false);
    expect(validateRequirementsContractProjectProfile(inferred).issues).toContainEqual(
      expect.objectContaining({ code: 'unauthorized_project_classification' })
    );
    expect(
      validateDiagramApplicability(invalidApplicability, projectProfile()).issues
    ).toContainEqual(expect.objectContaining({ code: 'consumer_governance_flow_forbidden' }));
  });

  it('publishes an AJV-valid diagram applicability schema', () => {
    const schema = JSON.parse(readFileSync(diagramApplicabilitySchemaPath, 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const value = applicability();

    expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    expect(validateDiagramApplicability(value, projectProfile())).toEqual({
      ok: true,
      issues: [],
    });
  });
});
