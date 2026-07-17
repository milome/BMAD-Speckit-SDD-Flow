import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validateDiagramSet,
  validateSequenceContract,
  type RequirementsContractDiagramSet,
  type RequirementsContractSequenceContract,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-model';

const HASH = `sha256:${'d'.repeat(64)}`;
const sequenceSchemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-sequence-contract.schema.json'
);
const diagramSetSchemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-diagram-set.schema.json'
);

function proof(requirementRefs = ['MUST-FR-001']) {
  return {
    sourceSpanRefs: ['SRC-ORDER-001'],
    sourceHashes: [HASH],
    semanticResolutionReceiptRefs: ['RESOLUTION-001'],
    repositoryRefs: ['REP-ORDER-001'],
    policyApplicabilityReceiptRefs: ['POLICY-001'],
    decisionReceiptRefs: [],
    requirementRefs,
    targetRefs: ['TARGET-ORDER-001'],
    verificationBindings: {
      oracleRef: 'ORACLE-ORDER-001',
      redTestRef: 'RED-ORDER-001',
      commandRefs: ['CMD-ORDER-001'],
      evidenceRefs: ['EVD-ORDER-001'],
    },
    semanticModelHash: HASH,
  };
}

function sequenceContract(): RequirementsContractSequenceContract {
  return {
    schemaVersion: 'requirements-contract-sequence-contract/v1',
    projectKind: 'consumer_product',
    projectProfileHash: HASH,
    semanticModelHash: HASH,
    sequenceContractHash: HASH,
    integrationBoundaries: [],
    sequenceScenarios: [
      {
        id: 'SCN-ORDER-SUBMIT-001',
        owningSystem: 'order-platform',
        requirementRefs: ['MUST-FR-001'],
        trigger: {
          actorRef: 'ACTOR-CUSTOMER',
          event: 'customer_submits_order',
          sourceRefs: ['SRC-ORDER-001'],
        },
        participants: [
          {
            id: 'ACTOR-CUSTOMER',
            kind: 'human_actor',
            label: 'Customer',
            owningSystem: 'order-platform',
            ...proof(),
          },
          {
            id: 'API-ORDER',
            kind: 'runtime_component',
            label: 'Order API',
            owningSystem: 'order-platform',
            ...proof(),
          },
        ],
        steps: [
          {
            id: 'MSG-001',
            order: 1,
            type: 'command',
            from: 'ACTOR-CUSTOMER',
            to: 'API-ORDER',
            operation: 'submit_order',
            owningSystem: 'order-platform',
            integrationBoundaryRef: null,
            ...proof(),
          },
        ],
        branches: [
          {
            id: 'BR-001',
            condition: 'order_is_valid',
            testScenarioRefs: ['RED-BR-001'],
            owningSystem: 'order-platform',
            ...proof(),
          },
        ],
        orderingConstraints: [],
        temporalConstraints: [],
        stateTransitions: [
          {
            id: 'STATE-001',
            fromState: 'draft',
            toState: 'submitted',
            triggerStepRef: 'MSG-001',
            owningSystem: 'order-platform',
            ...proof(),
          },
        ],
      },
    ],
  };
}

function diagramSet(): RequirementsContractDiagramSet {
  return {
    schemaVersion: 'requirements-contract-diagram-set/v1',
    diagramSetId: 'DSET-ORDER-001',
    rootDiagramRef: 'DGM-ORDER-OVERVIEW-001',
    diagrams: [
      {
        diagramRef: 'DGM-ORDER-OVERVIEW-001',
        role: 'scenario_overview',
        scenarioRef: 'SCN-ORDER-SUBMIT-001',
        messageRefs: ['SCN-ORDER-SUBMIT-001#MSG-001'],
        blockingChildRefs: [],
        projectionHash: HASH,
      },
    ],
    transitionEdges: [],
    expandedMessageRefs: ['SCN-ORDER-SUBMIT-001#MSG-001'],
    blockingChildRefs: [],
    sequenceContractHash: HASH,
    projectionHashes: [HASH],
  };
}

describe('proof-carrying Sequence Contract schemas', () => {
  it('validates stable scenario, participant, message, branch, and state-transition bindings', () => {
    const schema = JSON.parse(readFileSync(sequenceSchemaPath, 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const value = sequenceContract();

    expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    expect(validateSequenceContract(value)).toEqual({ ok: true, issues: [] });
  });

  it('rejects duplicate IDs, unknown participant refs, unknown step refs, and ownership bypasses', () => {
    const invalid = sequenceContract();
    invalid.projectKind = 'hybrid';
    invalid.sequenceScenarios[0].participants[1].id = 'ACTOR-CUSTOMER';
    invalid.sequenceScenarios[0].participants[1].owningSystem = 'payment-platform';
    invalid.sequenceScenarios[0].steps[0].to = 'API-MISSING';
    invalid.sequenceScenarios[0].stateTransitions[0].triggerStepRef = 'MSG-404';

    const result = validateSequenceContract(invalid);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'duplicate_participant_id',
        'unknown_participant_ref',
        'unknown_sequence_step_ref',
        'unauthorized_ownership_crossing',
      ])
    );
  });

  it('validates one hash-bound Diagram Set and rejects unknown roots', () => {
    const schema = JSON.parse(readFileSync(diagramSetSchemaPath, 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const valid = diagramSet();
    const invalid = diagramSet();
    invalid.rootDiagramRef = 'DGM-MISSING-001';

    expect(validate(valid), JSON.stringify(validate.errors)).toBe(true);
    expect(validateDiagramSet(valid)).toEqual({ ok: true, issues: [] });
    expect(validateDiagramSet(invalid).issues).toContainEqual(
      expect.objectContaining({ code: 'unknown_root_diagram_ref' })
    );
  });
});
