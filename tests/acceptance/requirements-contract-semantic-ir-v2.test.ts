import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as requirementContractModel from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';
import {
  REQUIREMENT_CONTRACT_MODEL_V2_ACTIVATION_STATE,
  migrateRequirementContractV1ToV2,
  validateRequirementContractModelV2,
  type RequirementContractModelV2,
  type RequirementContractRequirementV2,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';
import {
  sha256Stable,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const HASH = `sha256:${'a'.repeat(64)}`;
interface SemanticIrFixtureIdentity {
  recordId: string;
  requirementSetId: string;
  requirementId: string;
  sourceRequirementId: string;
  targetId: string;
  edgeId: string;
  requirementSourceSpanRef: string;
  targetSourceSpanRef: string;
  oracleRef: string;
  commandRef: string;
  observationRef: string;
  artifactRef: string;
}

const DEFAULT_SEMANTIC_IR_FIXTURE_IDENTITY: SemanticIrFixtureIdentity = {
  recordId: 'REQ-SEMANTIC-FIXTURE',
  requirementSetId: 'semantic-fixture-set',
  requirementId: 'MUST-FR-001',
  sourceRequirementId: 'FR-001',
  targetId: 'TARGET-001',
  edgeId: 'EDGE-001',
  requirementSourceSpanRef: 'SOURCE-SPAN-001',
  targetSourceSpanRef: 'SOURCE-SPAN-002',
  oracleRef: 'ORACLE-001',
  commandRef: 'CMD-001',
  observationRef: 'OBS-001',
  artifactRef: 'ARTIFACT-001',
};

const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirement-contract-model-v2.schema.json'
);
const stageSchemaNames = [
  'requirements-contract-stage-five-star-audit-matrix.schema.json',
  'requirements-contract-stage-gap-ledger.schema.json',
  'requirements-contract-real-consumer-journey-evidence.schema.json',
  'requirements-contract-confirmation-receipt-bundle.schema.json',
  'requirements-contract-stage-final-gate-report.schema.json',
] as const;
const stageSchemaRoot = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas'
);

function validRequirement(
  overrides: Partial<RequirementContractRequirementV2> = {},
  identity: SemanticIrFixtureIdentity = DEFAULT_SEMANTIC_IR_FIXTURE_IDENTITY
): RequirementContractRequirementV2 {
  return {
    id: identity.requirementId,
    kind: 'functional',
    schemaVersion: 'requirement-contract-requirement/v2',
    text: 'The fixture actor can invoke the fixture operation.',
    source: {
      sourcePath: 'docs/requirements/semantic-fixture.md',
      sourceSpan: { startLine: 10, endLine: 12 },
      sourceHash: HASH,
      sourceRequirementId: identity.sourceRequirementId,
      headingPath: ['Fixture operation'],
    },
    semantics: {
      actor: 'fixture actor',
      trigger: 'invokes the fixture operation',
      preconditions: ['the fixture precondition holds'],
      action: 'perform the fixture operation',
      postconditions: ['the fixture result has a stable identifier'],
      invariants: ['the fixture invariant is preserved'],
      thresholds: [],
    },
    authority: {
      authorityState: 'source_grounded',
      derivation: 'copied_from_source',
      decisionReceiptRef: null,
    },
    applicability: {
      state: 'applicable',
      reasonCode: 'source_declared',
    },
    unresolved: [],
    verification: {
      method: 'behavior_test',
      oracleRef: identity.oracleRef,
      commandRefs: [identity.commandRef],
      expectedObservationRefs: [identity.observationRef],
    },
    bindings: {
      targetRefs: [identity.targetId],
      artifactRefs: [identity.artifactRef],
      traceEdgeRefs: [identity.edgeId],
    },
    ...overrides,
  };
}

function validFixture(
  overrides: Partial<SemanticIrFixtureIdentity> = {}
): {
  model: RequirementContractModelV2;
  refs: SemanticIrFixtureIdentity;
} {
  const refs = {
    ...DEFAULT_SEMANTIC_IR_FIXTURE_IDENTITY,
    ...overrides,
  };
  const requirementBody = validRequirement({}, refs);
  const targetBody = {
    id: refs.targetId,
    path: 'src/semantic-target.ts',
  };
  const requirementBodyHash = sha256Stable(requirementBody);
  const targetBodyHash = sha256Stable(targetBody);
  const edgePreimage = {
    edgeType: 'implemented_in',
    fromRef: refs.requirementId,
    fromHash: requirementBodyHash,
    toRef: refs.targetId,
    toHash: targetBodyHash,
    applicability: {
      decision: 'applicable' as const,
      reasonCode: 'source_authorized' as const,
      proofRefs: [refs.requirementSourceSpanRef, refs.targetSourceSpanRef],
    },
    proofBindings: [refs.requirementSourceSpanRef, refs.targetSourceSpanRef],
  };
  const preimage: Omit<RequirementContractModelV2, 'semanticModelHash'> = {
    schemaVersion: 'requirement-contract-model/v2',
    activationState: 'inactive_schema_boundary',
    recordId: refs.recordId,
    requirementSetId: refs.requirementSetId,
    sourceAuthorityHash: HASH,
    edgeTypeRegistryHash: sha256Stable(['implemented_in']),
    authority: 'none',
    semanticBodies: {
      [requirementBodyHash]: requirementBody,
      [targetBodyHash]: targetBody,
    },
    nodes: {
      [refs.requirementId]: {
        nodeType: 'requirement',
        bodySchemaVersion: 'requirement-contract-requirement/v2',
        bodyHash: requirementBodyHash,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_authorized',
          proofRefs: [refs.requirementSourceSpanRef],
        },
        proofBindings: [refs.requirementSourceSpanRef],
      },
      [refs.targetId]: {
        nodeType: 'target',
        bodySchemaVersion: 'requirements-contract-target-root/v1',
        bodyHash: targetBodyHash,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_authorized',
          proofRefs: [refs.targetSourceSpanRef],
        },
        proofBindings: [refs.targetSourceSpanRef],
      },
    },
    edges: {
      [refs.edgeId]: {
        ...edgePreimage,
        edgeHash: sha256Stable(edgePreimage),
      },
    },
  };
  return {
    model: {
      ...preimage,
      semanticModelHash: sha256Stable(preimage),
    },
    refs,
  };
}

function validModel(
  overrides: Partial<SemanticIrFixtureIdentity> = {}
): RequirementContractModelV2 {
  return validFixture(overrides).model;
}

function withNodeBody(
  model: RequirementContractModelV2,
  nodeId: string,
  body: Record<string, unknown>
): RequirementContractModelV2 {
  const next = structuredClone(model);
  const node = next.nodes[nodeId];
  const previousBodyHash = node.bodyHash;
  const bodyHash = sha256Stable(body);
  delete next.semanticBodies[previousBodyHash];
  next.semanticBodies[bodyHash] = body;
  node.bodyHash = bodyHash;
  for (const edge of Object.values(next.edges)) {
    if (edge.fromRef === nodeId) edge.fromHash = bodyHash;
    if (edge.toRef === nodeId) edge.toHash = bodyHash;
    const { edgeHash: _edgeHash, ...edgePreimage } = edge;
    edge.edgeHash = sha256Stable(edgePreimage);
  }
  const { semanticModelHash: _semanticModelHash, ...preimage } = next;
  next.semanticModelHash = sha256Stable(preimage);
  return next;
}

describe('requirement-contract-model/v2 inactive semantic boundary', () => {
  it('publishes the five strict AMEND-09 stage recovery schema boundaries', () => {
    const schemaPaths = stageSchemaNames.map((name) => path.join(stageSchemaRoot, name));

    expect(
      schemaPaths.map((candidate) => existsSync(candidate)),
      'G01 must publish every AMEND-09 schema before CMD-34 can consume stage evidence'
    ).toEqual([true, true, true, true, true]);

    for (const candidate of schemaPaths) {
      const schema = JSON.parse(readFileSync(candidate, 'utf8')) as {
        $id?: string;
        additionalProperties?: boolean;
      };
      expect(schema.$id).toMatch(/^requirements-contract-/u);
      expect(schema.additionalProperties).toBe(false);
    }
  });

  it('forbids default PASS, nullable evidence substitution, and Consumer identity escape', () => {
    const schemaTexts = Object.fromEntries(
      stageSchemaNames.map((name) => {
        const candidate = path.join(stageSchemaRoot, name);
        return [name, existsSync(candidate) ? readFileSync(candidate, 'utf8') : '{}'];
      })
    );
    const matrixSchema =
      schemaTexts['requirements-contract-stage-five-star-audit-matrix.schema.json'];
    const gapSchema = schemaTexts['requirements-contract-stage-gap-ledger.schema.json'];
    const consumerSchema =
      schemaTexts['requirements-contract-real-consumer-journey-evidence.schema.json'];
    const confirmationSchema =
      schemaTexts['requirements-contract-confirmation-receipt-bundle.schema.json'];
    const finalGateSchema =
      schemaTexts['requirements-contract-stage-final-gate-report.schema.json'];

    for (const schemaText of Object.values(schemaTexts)) {
      expect(schemaText).not.toMatch(/"default"\s*:\s*"(?:PASS|pass)"/u);
      expect(schemaText).not.toMatch(/"type"\s*:\s*\[[^\]]*"null"/u);
    }
    expect(matrixSchema).toContain('"PASS"');
    expect(matrixSchema).toContain('"BLOCK"');
    expect(matrixSchema).toContain('"consumerJourneyEvidenceRefs"');
    expect(gapSchema).toContain('"failureSignatureHash"');
    expect(gapSchema).toContain('"statusTransitions"');
    expect(consumerSchema).toContain(
      String.raw`"const": "D:\\Dev\\BMAD-Speckit-Consumer-Evidence-Closure"`
    );
    expect(confirmationSchema).toContain('"preConfirmationEvidenceSetHash"');
    expect(confirmationSchema).toContain('"preConfirmationStageSnapshotHash"');
    expect(finalGateSchema).toContain('"stageScoreFabricationCount"');
    expect(finalGateSchema).toContain('"terminalReceiptPending"');
  });

  it('exports the exact stage and task-owner registries without a default PASS state', () => {
    const stageRegistry = Reflect.get(
      requirementContractModel,
      'REQUIREMENTS_CONTRACT_STAGE_REGISTRY'
    );
    const taskOwnerRegistry = Reflect.get(
      requirementContractModel,
      'REQUIREMENTS_CONTRACT_TASK_OWNER_STAGE_REGISTRY'
    );
    const starDecisions = Reflect.get(
      requirementContractModel,
      'REQUIREMENTS_CONTRACT_STAR_DECISIONS'
    );

    expect(stageRegistry).toEqual([
      expect.objectContaining({ stageId: 'STAGE-01', predecessorStageIds: [] }),
      expect.objectContaining({ stageId: 'STAGE-02', predecessorStageIds: ['STAGE-01'] }),
      expect.objectContaining({
        stageId: 'STAGE-03',
        predecessorStageIds: ['STAGE-01', 'STAGE-02'],
      }),
      expect.objectContaining({ stageId: 'STAGE-04', predecessorStageIds: ['STAGE-03'] }),
      expect.objectContaining({ stageId: 'STAGE-05', predecessorStageIds: ['STAGE-04'] }),
      expect.objectContaining({ stageId: 'STAGE-06', predecessorStageIds: ['STAGE-05'] }),
      expect.objectContaining({ stageId: 'STAGE-07', predecessorStageIds: ['STAGE-06'] }),
      expect.objectContaining({ stageId: 'STAGE-08', predecessorStageIds: ['STAGE-07'] }),
      expect.objectContaining({ stageId: 'STAGE-09', predecessorStageIds: ['STAGE-08'] }),
      expect.objectContaining({ stageId: 'STAGE-10', predecessorStageIds: ['STAGE-09'] }),
      expect.objectContaining({ stageId: 'STAGE-11', predecessorStageIds: ['STAGE-10'] }),
    ]);
    expect(taskOwnerRegistry).toEqual({
      G00: 'STAGE-01',
      G01: 'STAGE-03',
      G02: 'STAGE-03',
      G03: 'STAGE-04',
      G04: 'STAGE-04',
      G05: 'STAGE-07',
      G06: 'STAGE-09',
      G07: 'STAGE-10',
      G08: 'STAGE-08',
      G09: 'STAGE-05',
      G10: 'STAGE-06',
      G11: 'STAGE-02',
      G12: 'STAGE-10',
      G13: 'STAGE-10',
      G14: 'STAGE-10',
      G15: 'STAGE-11',
    });
    expect(starDecisions).toEqual(['PASS', 'BLOCK']);
    expect(Reflect.has(requirementContractModel, 'DEFAULT_STAGE_PASS')).toBe(false);
  });

  it('validates the complete DSA-01 requirement groups through the published JSON Schema', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const model = validModel();

    expect(validate(model), JSON.stringify(validate.errors)).toBe(true);
    expect(validateRequirementContractModelV2(model)).toEqual({
      ok: true,
      issues: [],
    });
    expect(REQUIREMENT_CONTRACT_MODEL_V2_ACTIVATION_STATE).toBe('inactive_schema_boundary');
  });

  it('builds a validator-clean canonical graph from caller-supplied fixture identities', () => {
    const { model, refs } = validFixture({
      recordId: 'REQ-ALTERNATE-SEMANTIC-FIXTURE',
      requirementSetId: 'alternate-semantic-fixture-set',
      requirementId: 'MUST-FR-042',
      sourceRequirementId: 'FR-042',
      targetId: 'TARGET-ALTERNATE',
      edgeId: 'EDGE-ALTERNATE',
    });

    expect(model.recordId).toBe(refs.recordId);
    expect(model.requirementSetId).toBe(refs.requirementSetId);
    expect(Object.keys(model.nodes)).toEqual([refs.requirementId, refs.targetId]);
    expect(Object.keys(model.edges)).toEqual([refs.edgeId]);
    expect(validateRequirementContractModelV2(model)).toEqual({
      ok: true,
      issues: [],
    });
  });

  it('owns normalized semantic bodies, typed nodes, and hash-bound edges in the canonical v2 identity', () => {
    const { model, refs } = validFixture();

    expect(validateRequirementContractModelV2(model)).toEqual({
      ok: true,
      issues: [],
    });
    const requirementBody = model.semanticBodies[model.nodes[refs.requirementId].bodyHash];
    const copiedBodyEdge = structuredClone(model) as unknown as Record<string, any>;
    copiedBodyEdge.edges[refs.edgeId].semanticBody = requirementBody;
    expect(validateRequirementContractModelV2(copiedBodyEdge).ok).toBe(false);
  });

  it('rejects missing semantic groups and extra machine-contract properties', () => {
    const { model, refs } = validFixture();
    const requirementBody = structuredClone(
      model.semanticBodies[model.nodes[refs.requirementId].bodyHash]
    );
    delete requirementBody.semantics;
    const missingSemantics = withNodeBody(model, refs.requirementId, requirementBody);
    const extraProperty = {
      ...validModel(),
      syntheticAuthority: true,
    };

    expect(validateRequirementContractModelV2(missingSemantics).ok).toBe(false);
    expect(validateRequirementContractModelV2(extraProperty).ok).toBe(false);
  });

  it('accepts only the canonical G01 namespace and rejects legacy authority values', () => {
    const { model, refs } = validFixture();
    const mixedNamespace = withNodeBody(
      model,
      refs.requirementId,
      validRequirement({ id: 'MUST-001' }, refs)
    );
    const legacyRequirement = validRequirement({}, refs);
    legacyRequirement.authority.authorityState = 'source_authorized' as never;
    const legacyAuthority = withNodeBody(model, refs.requirementId, legacyRequirement);

    expect(validateRequirementContractModelV2(mixedNamespace).issues).toContainEqual(
      expect.objectContaining({ code: 'mixed_requirement_id_namespace' })
    );
    expect(validateRequirementContractModelV2(legacyAuthority).issues).toContainEqual(
      expect.objectContaining({ code: 'invalid_authority_state' })
    );
  });

  it('rejects invalid source spans, non-SHA256 hashes, node/body drift, and unknown endpoints', () => {
    const { model, refs } = validFixture();
    const invalidRequirement = validRequirement({}, refs);
    invalidRequirement.source.sourceSpan = { startLine: 12, endLine: 10 };
    invalidRequirement.source.sourceHash = 'md5:bad';
    const invalidSource = withNodeBody(model, refs.requirementId, invalidRequirement);
    const mismatchedBody = withNodeBody(
      model,
      refs.requirementId,
      validRequirement({ id: 'MUST-FR-002' }, refs)
    );
    const unknownEndpoint = structuredClone(model);
    unknownEndpoint.edges[refs.edgeId].fromRef = 'MUST-FR-404';
    const { edgeHash: _edgeHash, ...edgePreimage } = unknownEndpoint.edges[refs.edgeId];
    unknownEndpoint.edges[refs.edgeId].edgeHash = sha256Stable(edgePreimage);
    const { semanticModelHash: _semanticModelHash, ...modelPreimage } = unknownEndpoint;
    unknownEndpoint.semanticModelHash = sha256Stable(modelPreimage);

    expect(
      [
        ...validateRequirementContractModelV2(invalidSource).issues,
        ...validateRequirementContractModelV2(mismatchedBody).issues,
        ...validateRequirementContractModelV2(unknownEndpoint).issues,
      ].map((issue) => issue.code)
    ).toEqual(
      expect.arrayContaining([
        'invalid_source_span',
        'invalid_sha256',
        'node_body_id_mismatch',
        'unknown_graph_endpoint',
      ])
    );
  });

  it('migrates v1 source text deterministically and blocks unavailable semantics', () => {
    const legacySourceRequirementId = 'FR-001';
    const migratedRequirementId = `MUST-${legacySourceRequirementId}`;
    const migrated = migrateRequirementContractV1ToV2({
      schemaVersion: 'requirement-contract-model/v1',
      recordId: 'REQ-MIGRATION',
      requirementSetId: 'migration',
      must: [
        {
          id: legacySourceRequirementId,
          text: 'The fixture actor can invoke the fixture operation.',
          sourceRequirementId: legacySourceRequirementId,
          sourcePath: 'docs/requirements/semantic-fixture.md',
          sourceSpan: { startLine: 10, endLine: 12 },
          headingPath: ['Fixture operation'],
          authorityState: 'source_authorized',
          provenance: { sourceHash: HASH },
        },
      ],
      notDone: [],
      outOfScope: [],
      evidence: [],
      acceptanceCriteria: [],
      requiredCommands: [],
      traceRows: [],
      businessViews: [],
      sequenceViews: [],
      flowViews: [],
      edgeCaseViews: [],
      boundaryViews: [],
      targetModificationPaths: [],
      applicability: {},
      invariantClosure: {
        appliedPasses: [],
        remainingIssueCount: 0,
        rendererBlockerPolicy: 'renderer_blocker_release_failure',
        issues: [],
      },
    });

    const migratedRequirement = migrated.semanticBodies[
      migrated.nodes[migratedRequirementId].bodyHash
    ] as unknown as RequirementContractRequirementV2;
    expect(migratedRequirement.id).toBe(migratedRequirementId);
    expect(migratedRequirement.text).toBe(
      'The fixture actor can invoke the fixture operation.'
    );
    expect(migratedRequirement.authority.authorityState).toBe('source_grounded');
    expect(migratedRequirement.unresolved.map((item) => item.field)).toEqual(
      expect.arrayContaining([
        'semantics.actor',
        'semantics.trigger',
        'semantics.action',
        'verification.oracleRef',
      ])
    );
    expect(migratedRequirement.unresolved.every((item) => item.blocking)).toBe(true);
    expect(validateRequirementContractModelV2(migrated).ok).toBe(true);
  });
});
