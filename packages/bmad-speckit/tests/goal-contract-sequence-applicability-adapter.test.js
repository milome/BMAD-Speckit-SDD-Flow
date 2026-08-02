const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  deriveSequenceArchitectureFacts,
} = require('../src/utils/goal-contract/sequence-applicability-adapter.ts');

const SOURCE_NODE = {
  id: 'SRC-001',
  nodeType: 'source',
  exactText: 'register state transition schema and validator',
};

describe('goal-contract structured Sequence applicability adapter', () => {
  it('treats the v2 core graph as closed-world and ignores source prose', () => {
    assert.deepEqual(
      deriveSequenceArchitectureFacts({
        schemaVersion: 'goal-contract-evidence-graph/v2',
        nodes: [SOURCE_NODE],
        edges: [],
      }),
      {
        branchCoverage: false,
        boundedRetry: false,
        compensation: false,
        crossParticipantInteraction: false,
        evidenceRefs: ['SRC-001'],
        integrationFanIn: false,
        interfaceBoundary: false,
        observableOrdering: false,
        stateTransition: false,
        temporalConstraint: false,
      }
    );
  });

  it('returns explicit typed facts without inspecting source text', () => {
    const graph = {
      schemaVersion: 'goal-contract-evidence-graph/v2',
      nodes: [SOURCE_NODE],
      edges: [],
      sequenceApplicabilityFacts: {
        coverage: 'complete',
        evidenceRefs: ['SEQ-FACT-01'],
        signals: {
          branchCoverage: false,
          boundedRetry: false,
          compensation: false,
          crossParticipantInteraction: false,
          integrationFanIn: false,
          interfaceBoundary: true,
          observableOrdering: false,
          stateTransition: false,
          temporalConstraint: false,
        },
      },
    };

    const facts = deriveSequenceArchitectureFacts(graph);
    assert.equal(facts.interfaceBoundary, true);
    assert.deepEqual(facts.evidenceRefs, ['SEQ-FACT-01']);
  });

  it('returns unresolved facts for partial or unsupported typed authority', () => {
    for (const graph of [
      {
        schemaVersion: 'goal-contract-evidence-graph/v2',
        nodes: [SOURCE_NODE],
        sequenceApplicabilityFacts: {
          coverage: 'partial',
          evidenceRefs: ['SEQ-FACT-01'],
          signals: { interfaceBoundary: true },
        },
      },
      {
        schemaVersion: 'goal-contract-evidence-graph/v3',
        nodes: [SOURCE_NODE],
        edges: [],
      },
    ]) {
      assert.deepEqual(deriveSequenceArchitectureFacts(graph), {
        evidenceRefs: [],
      });
    }
  });

  it('is byte-stable under node and evidence permutation', () => {
    const signals = {
      branchCoverage: false,
      boundedRetry: false,
      compensation: false,
      crossParticipantInteraction: false,
      integrationFanIn: false,
      interfaceBoundary: true,
      observableOrdering: false,
      stateTransition: false,
      temporalConstraint: false,
    };
    const left = deriveSequenceArchitectureFacts({
      schemaVersion: 'goal-contract-evidence-graph/v2',
      nodes: [
        { id: 'SRC-002', nodeType: 'source' },
        { id: 'SRC-001', nodeType: 'source' },
      ],
      edges: [
        { fromNodeId: 'SRC-002', toNodeId: 'SRC-001' },
        { fromNodeId: 'SRC-001', toNodeId: 'SRC-002' },
      ],
      sequenceApplicabilityFacts: {
        coverage: 'complete',
        evidenceRefs: ['SEQ-FACT-02', 'SEQ-FACT-01'],
        signals,
      },
    });
    const right = deriveSequenceArchitectureFacts({
      schemaVersion: 'goal-contract-evidence-graph/v2',
      nodes: [
        { id: 'SRC-001', nodeType: 'source' },
        { id: 'SRC-002', nodeType: 'source' },
      ],
      edges: [
        { fromNodeId: 'SRC-001', toNodeId: 'SRC-002' },
        { fromNodeId: 'SRC-002', toNodeId: 'SRC-001' },
      ],
      sequenceApplicabilityFacts: {
        coverage: 'complete',
        evidenceRefs: ['SEQ-FACT-01', 'SEQ-FACT-02'],
        signals,
      },
    });

    assert.deepEqual(left, right);
    assert.equal(JSON.stringify(left), JSON.stringify(right));
    assert.deepEqual(left.evidenceRefs, ['SEQ-FACT-01', 'SEQ-FACT-02']);
  });
});
