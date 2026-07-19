import { describe, expect, it } from 'vitest';
import {
  REQUIREMENTS_CONTRACT_BMAD_CONSUMERS,
  REQUIREMENTS_CONTRACT_BMAD_CONSUMER_REGISTRY_HASH,
  getRequirementsContractBmadConsumer,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bmad-consumer-registry';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

describe('requirements contract BMAD consumer registry', () => {
  it('freezes the exact non-authoritative consumer capabilities', () => {
    expect(REQUIREMENTS_CONTRACT_BMAD_CONSUMER_REGISTRY_HASH).toBe(
      sha256Stable(REQUIREMENTS_CONTRACT_BMAD_CONSUMERS)
    );
    expect(new Set(REQUIREMENTS_CONTRACT_BMAD_CONSUMERS.map((item) => item.consumerId)).size)
      .toBe(REQUIREMENTS_CONTRACT_BMAD_CONSUMERS.length);
    for (const consumer of REQUIREMENTS_CONTRACT_BMAD_CONSUMERS) {
      expect(getRequirementsContractBmadConsumer(consumer.consumerId)).toBe(consumer);
      expect(consumer).toMatchObject({
        directPrdWrite: false,
        localValidatorOwnership: false,
        basenameIdentityCreation: false,
        syntheticSemanticCompletion: false,
        stepsCompletedReadiness: false,
        semanticAuthorityMutation: false,
        recommendationSelection: false,
        decisionReceiptCreation: false,
        readinessGrant: false,
        passGrant: false,
      });
    }
  });

  it('rejects an unregistered consumer instead of applying fallback authority', () => {
    expect(() =>
      getRequirementsContractBmadConsumer('unregistered' as never)
    ).toThrow('unregistered requirements-contract BMAD consumer');
  });
});
