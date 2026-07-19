import { describe, expect, it } from 'vitest';
import { sequenceCompilerFixture } from './helpers/requirements-contract-sequence-compiler-fixture';
import { planRequirementsContractDiagramApplicability } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-diagram-applicability-planner';
import { planRequirementsContractDiagramSet } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-diagram-set-planner';
import { resolveRequirementsContractProjectProfile } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-project-profile-resolver';
import { compileRequirementsContractSequenceContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-compiler';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateRequirementsContractInteractionArtifacts } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-validation-facade';

function fixture() {
  const authorityRef = 'PROJECT-PROFILE-AUTHORITY';
  const resolvedProfile = resolveRequirementsContractProjectProfile({
    projectKind: 'consumer_product',
    owningSystem: 'checkout',
    governanceFramework: 'BMAD-Speckit',
    classificationAuthority: {
      kind: 'decision_receipt',
      ref: authorityRef,
      hash: sha256Stable({ authorityRef }),
    },
    diagramPolicyRegistryHash: sha256Stable({ registry: authorityRef }),
  });
  const sequenceInput = sequenceCompilerFixture(30);
  sequenceInput.projectProfileHash = resolvedProfile.projectProfileHash;
  const sequenceContract = compileRequirementsContractSequenceContract(sequenceInput);
  const criticalProof = sequenceContract.sequenceScenarios[0].steps[0].sourceSpanRefs[0];
  const diagramApplicability = planRequirementsContractDiagramApplicability({
    projectProfile: resolvedProfile.profile,
    projectProfileHash: resolvedProfile.projectProfileHash,
    viewEvidence: {
      primary_business_sequence: { proofRefs: [criticalProof] },
    },
  });
  const diagramSet = planRequirementsContractDiagramSet({
    sequenceContract,
    scenarioId: sequenceContract.sequenceScenarios[0].id,
  });
  return {
    ...resolvedProfile,
    sequenceContract,
    diagramApplicability,
    diagramSet,
  };
}

describe('requirements contract interaction validation facade', () => {
  it('validates profile, applicability, sequence, transitions, child closure, and projection hashes together', () => {
    const input = fixture();

    expect(
      validateRequirementsContractInteractionArtifacts({
        projectProfile: input.profile,
        projectProfileHash: input.projectProfileHash,
        diagramApplicability: input.diagramApplicability,
        sequenceContract: input.sequenceContract,
        diagramSets: [input.diagramSet],
      })
    ).toEqual({
      ok: true,
      decision: 'pass',
      issues: [],
    });
  });

  it('fails closed on transition and projection drift derived from the current diagram set', () => {
    const input = fixture();
    const drifted = structuredClone(input.diagramSet);
    const transition = drifted.transitionEdges[0];
    const diagram = drifted.diagrams.find(
      (candidate) => candidate.diagramRef === transition.expandsTo
    );
    if (!diagram) throw new Error('expected blocking child diagram');
    transition.messageRef = `${diagram.scenarioRef}#MSG-999`;
    diagram.projectionHash = sha256Stable({
      diagramRef: diagram.diagramRef,
      drift: true,
    });

    const result = validateRequirementsContractInteractionArtifacts({
      projectProfile: input.profile,
      projectProfileHash: input.projectProfileHash,
      diagramApplicability: input.diagramApplicability,
      sequenceContract: input.sequenceContract,
      diagramSets: [drifted],
    });

    expect(result.decision).toBe('block');
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'unknown_diagram_transition_message_ref',
        'diagram_projection_hash_mismatch',
      ])
    );
  });
});
