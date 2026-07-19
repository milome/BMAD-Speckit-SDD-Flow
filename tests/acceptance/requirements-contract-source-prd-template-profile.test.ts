import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyRequirementsContractArtifactRole,
  REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-artifact-role-classifier';
import { lintRequirementsContractSourceTemplate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/lint-requirements-contract-source-template';
import {
  REQUIREMENTS_CONTRACT_SOURCE_PRD_ARTIFACT_ROLE,
  REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES,
  REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH,
  REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-source-prd-rules';

describe('requirements contract Source PRD template profile', () => {
  it('binds the template to the registered requirement-source artifact role', () => {
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_ARTIFACT_ROLE).toBeTypeOf('string');
    if (typeof REQUIREMENTS_CONTRACT_SOURCE_PRD_ARTIFACT_ROLE !== 'string') return;

    expect(
      REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.allowedRoles
    ).toContain(REQUIREMENTS_CONTRACT_SOURCE_PRD_ARTIFACT_ROLE);
    const classification = classifyRequirementsContractArtifactRole({
      requestedArtifactRole: REQUIREMENTS_CONTRACT_SOURCE_PRD_ARTIFACT_ROLE,
    });
    expect(classification.ok).toBe(true);
    expect(classification.classification?.outputPolicy).toEqual(
      REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.rolePolicies[
        REQUIREMENTS_CONTRACT_SOURCE_PRD_ARTIFACT_ROLE
      ]
    );
  });

  it('uses the declared template and schema owners for production lint', () => {
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH).toBeTypeOf(
      'string'
    );
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH).toBeTypeOf('string');
    if (
      typeof REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH !== 'string' ||
      typeof REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH !== 'string'
    ) {
      return;
    }

    const result = lintRequirementsContractSourceTemplate({
      template: REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH,
      schema: REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH,
    });
    expect(result.ok, result.issues.map((issue) => issue.code).join(',')).toBe(true);
    expect(path.resolve(result.templatePath)).toBe(
      path.resolve(REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH)
    );
    expect(path.resolve(result.schemaPath)).toBe(
      path.resolve(REQUIREMENTS_CONTRACT_SOURCE_PRD_SCHEMA_OWNER_PATH)
    );
  });

  it('keeps the rule registry template binding aligned with the owner path', () => {
    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH).toBeTypeOf(
      'string'
    );
    if (typeof REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH !== 'string') {
      return;
    }

    expect(REQUIREMENTS_CONTRACT_SOURCE_PRD_RULES.templatePath).toBe(
      path.posix.join(
        'templates',
        path.posix.basename(REQUIREMENTS_CONTRACT_SOURCE_PRD_TEMPLATE_OWNER_PATH)
      )
    );
  });
});
