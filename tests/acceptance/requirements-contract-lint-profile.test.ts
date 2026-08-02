import { describe, expect, it } from 'vitest';
import * as validationFacade from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-validation-facade';
import {
  createRequirementsConfirmationRenderInput,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-render-input';
import {
  evaluateRequirementsContractLintProfile,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-lint-profile-registry';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

type RenderLintFacade = {
  validateRequirementsContractRenderInput: typeof evaluateRequirementsContractLintProfile;
};

const facade = validationFacade as unknown as Partial<RenderLintFacade>;

describe('requirements contract lint profiles', () => {
  it('routes draft and confirmation-ready render lint through the canonical registry', () => {
    expect(typeof facade.validateRequirementsContractRenderInput).toBe('function');
    const semanticModelHash = sha256Stable({
      requirementSetId: 'requirements-lint-profile',
    });
    const renderInput = createRequirementsConfirmationRenderInput({
      requirementSetId: 'requirements-lint-profile',
      semanticModelHash,
      requiredFieldRefs: ['requirements.actor'],
      fields: [{
        fieldRef: 'requirements.actor',
        value: null,
        semanticModelHash,
        authorityClass: 'none',
        provenanceRefs: ['issue:actor-unresolved'],
        applicability: 'unresolved',
        derivationRule: null,
        synthetic: false,
      }],
    });

    for (const profile of ['draft', 'confirmation-ready'] as const) {
      expect(facade.validateRequirementsContractRenderInput!(renderInput, profile)).toEqual(
        evaluateRequirementsContractLintProfile(renderInput, profile)
      );
    }
  });
});
