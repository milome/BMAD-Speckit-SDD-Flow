import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REQUIREMENT_HASH = `sha256:${'a'.repeat(64)}`;
const SCENARIO_HASH = `sha256:${'b'.repeat(64)}`;
const PROOF_HASH = `sha256:${'c'.repeat(64)}`;
const EDGE_HASH = `sha256:${'d'.repeat(64)}`;
const MODEL_HASH = `sha256:${'e'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-normalized-package.schema.json'
);

function normalizedPackage() {
  return {
    semanticBodies: {
      [REQUIREMENT_HASH]: {
        text: 'The fixture operation returns a stable result identifier.',
      },
      [SCENARIO_HASH]: {
        actor: 'fixture actor',
        outcome: 'the fixture result can be read by its identifier',
      },
      [PROOF_HASH]: {
        sourceSpanRef: 'SOURCE-SPAN-001',
      },
    },
    nodes: {
      'MUST-FR-001': {
        nodeType: 'requirement',
        bodySchemaVersion: 'requirement-contract-requirement/v2',
        bodyHash: REQUIREMENT_HASH,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_authorized',
          proofRefs: ['PROOF-SOURCE-001'],
        },
        proofBindings: ['PROOF-SOURCE-001'],
      },
      'SCN-FIXTURE-001': {
        nodeType: 'scenario',
        bodySchemaVersion: 'requirements-contract-scenario/v1',
        bodyHash: SCENARIO_HASH,
        applicability: {
          decision: 'applicable',
          reasonCode: 'requirement_bound',
          proofRefs: ['PROOF-SOURCE-001'],
        },
        proofBindings: ['PROOF-SOURCE-001'],
      },
      'PROOF-SOURCE-001': {
        nodeType: 'proof',
        bodySchemaVersion: 'requirements-contract-proof/v1',
        bodyHash: PROOF_HASH,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_span_verified',
          proofRefs: ['SOURCE-SPAN-001'],
        },
        proofBindings: ['SOURCE-SPAN-001'],
      },
    },
    edges: {
      'EDGE-REQ-SCENARIO-001': {
        edgeType: 'requirement_to_scenario',
        fromRef: 'MUST-FR-001',
        fromHash: REQUIREMENT_HASH,
        toRef: 'SCN-FIXTURE-001',
        toHash: SCENARIO_HASH,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_authorized',
          proofRefs: ['PROOF-SOURCE-001'],
        },
        proofBindings: ['PROOF-SOURCE-001'],
        edgeHash: EDGE_HASH,
      },
    },
  };
}

function schemaValidator() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

it('publishes the G01 Normalized Contract Package schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))('requirement-contract-model/v2 normalized graph fragment', () => {
  it('defines only the canonical model v2 graph fragment and no alternate Semantic IR identity', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as {
      required?: string[];
      properties?: Record<string, unknown>;
    };
    const schemaText = JSON.stringify(schema);

    expect(schema.required).toEqual(['semanticBodies', 'nodes', 'edges']);
    expect(Object.keys(schema.properties ?? {})).toEqual(['semanticBodies', 'nodes', 'edges']);
    expect(schemaText).not.toContain('requirements-contract-normalized-package/v1');
    expect(schemaText).not.toContain('"semanticModelHash"');
  });

  it('accepts unique semantic bodies, stable typed nodes and edges, and no authority', () => {
    const validate = schemaValidator();

    expect(validate(normalizedPackage()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('requires hash-keyed semantic bodies and stable-ID-keyed node and edge maps', () => {
    const validate = schemaValidator();
    const arrayNodes = normalizedPackage() as Record<string, unknown>;
    arrayNodes.nodes = Object.values(normalizedPackage().nodes);
    const invalidBodyKey = normalizedPackage();
    invalidBodyKey.semanticBodies = {
      not_a_hash: invalidBodyKey.semanticBodies[REQUIREMENT_HASH],
    } as never;
    const invalidNodeId = normalizedPackage();
    invalidNodeId.nodes = {
      'not-a-stable-reference': invalidNodeId.nodes['MUST-FR-001'],
    } as never;
    const invalidEdgeId = normalizedPackage();
    invalidEdgeId.edges = {
      unstable_edge_id: invalidEdgeId.edges['EDGE-REQ-SCENARIO-001'],
    } as never;

    expect(validate(arrayNodes)).toBe(false);
    expect(validate(invalidBodyKey)).toBe(false);
    expect(validate(invalidNodeId)).toBe(false);
    expect(validate(invalidEdgeId)).toBe(false);
  });

  it('rejects copied semantic bodies in node and relationship objects', () => {
    const validate = schemaValidator();
    const copiedNodeBody = normalizedPackage();
    copiedNodeBody.nodes['MUST-FR-001'] = {
      ...copiedNodeBody.nodes['MUST-FR-001'],
      body: copiedNodeBody.semanticBodies[REQUIREMENT_HASH],
    } as never;
    const copiedEdgeBody = normalizedPackage();
    copiedEdgeBody.edges['EDGE-REQ-SCENARIO-001'] = {
      ...copiedEdgeBody.edges['EDGE-REQ-SCENARIO-001'],
      copiedSemanticBody: copiedEdgeBody.semanticBodies[SCENARIO_HASH],
    } as never;

    expect(validate(copiedNodeBody)).toBe(false);
    expect(validate(copiedEdgeBody)).toBe(false);
  });

  it('rejects invalid authority, semantic node types, hashes, and applicability proofs', () => {
    const validate = schemaValidator();
    const invalidNodeType = normalizedPackage();
    invalidNodeType.nodes['MUST-FR-001'].nodeType = 'relationship';
    const invalidEndpointHash = normalizedPackage();
    invalidEndpointHash.edges['EDGE-REQ-SCENARIO-001'].toHash = 'sha256:short';
    const missingProof = normalizedPackage();
    missingProof.edges['EDGE-REQ-SCENARIO-001'].proofBindings = [];

    expect(validate(invalidNodeType)).toBe(false);
    expect(validate(invalidEndpointHash)).toBe(false);
    expect(validate(missingProof)).toBe(false);
  });

  it('rejects self-hash claims and unknown package, node, or edge fields', () => {
    const validate = schemaValidator();
    const selfHashed = {
      ...normalizedPackage(),
      normalizedPackageHash: MODEL_HASH,
    };
    const extraNodeField = normalizedPackage();
    extraNodeField.nodes['MUST-FR-001'] = {
      ...extraNodeField.nodes['MUST-FR-001'],
      sourceText: 'copied source text',
    } as never;
    const extraEdgeField = normalizedPackage();
    extraEdgeField.edges['EDGE-REQ-SCENARIO-001'] = {
      ...extraEdgeField.edges['EDGE-REQ-SCENARIO-001'],
      command: 'npm test',
    } as never;

    expect(validate(selfHashed)).toBe(false);
    expect(validate(extraNodeField)).toBe(false);
    expect(validate(extraEdgeField)).toBe(false);
  });
});
