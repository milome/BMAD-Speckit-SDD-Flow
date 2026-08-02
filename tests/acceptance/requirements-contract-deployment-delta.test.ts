import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractDeploymentModel,
  type RequirementsContractDeploymentModelInput,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-deployment-model';
import { computeRequirementsContractDeploymentDelta } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-deployment-delta';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

let deploymentOrdinal = 0;

function nextIdentity(prefix: string): string {
  deploymentOrdinal += 1;
  return `${prefix}-${String(deploymentOrdinal).padStart(3, '0')}`;
}

function deploymentInput(): RequirementsContractDeploymentModelInput {
  const serviceId = nextIdentity('RUNTIME');
  const storeId = nextIdentity('STORE');
  const authorityRef = nextIdentity('ARCHITECTURE');
  return {
    modelId: nextIdentity('DEPLOYMENT'),
    authority: {
      kind: 'architecture_record',
      ref: authorityRef,
      hash: sha256Stable({ authorityRef }),
    },
    nodes: [
      {
        id: serviceId,
        kind: 'runtime_service',
        name: nextIdentity('SERVICE'),
        configurationHash: sha256Stable({ serviceId, version: 1 }),
        proofRefs: [authorityRef],
      },
      {
        id: storeId,
        kind: 'data_store',
        name: nextIdentity('DATABASE'),
        configurationHash: sha256Stable({ storeId, version: 1 }),
        proofRefs: [authorityRef],
      },
    ],
    connections: [
      {
        id: nextIdentity('CONNECTION'),
        from: serviceId,
        to: storeId,
        kind: 'data_access',
        configurationHash: sha256Stable({ serviceId, storeId }),
        proofRefs: [authorityRef],
      },
    ],
  };
}

describe('requirements contract deployment delta', () => {
  it('emits proof-bound not_applicable without a diagram when runtime deployment is unchanged', () => {
    const baseline = createRequirementsContractDeploymentModel(deploymentInput());
    const requirementSetId = nextIdentity('REQUIREMENT-SET');
    const requirementProof = nextIdentity('REQUIREMENT-PROOF');

    const delta = computeRequirementsContractDeploymentDelta({
      requirementSetId,
      baseline,
      target: structuredClone(baseline),
      requirementProofRefs: [requirementProof],
    });

    expect(delta).toMatchObject({
      requirementSetId,
      baselineModelHash: baseline.modelHash,
      targetModelHash: baseline.modelHash,
      applicability: 'not_applicable',
      diagramRequired: false,
      nodeDeltas: [],
      connectionDeltas: [],
    });
    expect(delta.proofRefs).toEqual(
      expect.arrayContaining([baseline.authority.ref, requirementProof])
    );
  });

  it('reports only changed runtime nodes against the bound baseline', () => {
    const baseline = createRequirementsContractDeploymentModel(deploymentInput());
    const changedNode = baseline.nodes[0];
    const target = createRequirementsContractDeploymentModel({
      modelId: nextIdentity('DEPLOYMENT'),
      authority: baseline.authority,
      nodes: baseline.nodes.map((node) =>
        node.id === changedNode.id
          ? {
              ...node,
              configurationHash: sha256Stable({
                nodeId: node.id,
                version: 2,
              }),
            }
          : node
      ),
      connections: baseline.connections,
    });

    const delta = computeRequirementsContractDeploymentDelta({
      requirementSetId: nextIdentity('REQUIREMENT-SET'),
      baseline,
      target,
      requirementProofRefs: [nextIdentity('REQUIREMENT-PROOF')],
    });

    expect(delta.applicability).toBe('required');
    expect(delta.diagramRequired).toBe(true);
    expect(delta.nodeDeltas).toEqual([
      expect.objectContaining({
        nodeId: changedNode.id,
        changeType: 'modified',
        beforeHash: sha256Stable(changedNode),
        afterHash: sha256Stable(target.nodes.find((node) => node.id === changedNode.id)),
      }),
    ]);
    expect(delta.connectionDeltas).toEqual([]);
  });

  it('rejects document and test paths as synthetic deployment nodes', () => {
    const input = deploymentInput();
    const forbiddenPath = `tests/${nextIdentity('DEPLOYMENT')}.test.ts`;
    input.nodes[0].name = forbiddenPath;

    expect(() => createRequirementsContractDeploymentModel(input)).toThrow(
      'deployment_path_node_forbidden'
    );
  });
});
