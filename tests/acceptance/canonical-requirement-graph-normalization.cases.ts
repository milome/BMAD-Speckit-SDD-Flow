import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import {
  createTypedSourceAuthority,
  resolveTypedSourceAuthority,
  type RequirementsTypedSourceGraph,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { canonicalSpecSpanId } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-span-registry';
import {
  indexTypedTechnicalRelations,
  resolveTypedTechnicalDeclarations,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-technical-planning-capability';
import {
  canonicalRequirementGraphRef,
  normalizeCanonicalRequirementGraph,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/canonical-requirement-graph';
import {
  projectRequirementsTypedGoalObligations,
  requirementsTypedSemanticSource,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-requirements-typed-bridge';
import {
  compileGoalExecutionIR,
  validateGoalExecutionIR,
  type GoalExecutionCompilerInput,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-execution-ir';
import { validateGoalContractSchema } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/schema-registry';

const hash = (character: string) => `sha256:${character.repeat(64)}`;

function attestedReferences(
  canonicalProjection: Record<string, unknown>,
  canonicalNodeHash: string,
  canonicalRequirementGraphHash: string
) {
  return {
    canonicalProjection,
    canonicalProjectionHash: sha256Stable(canonicalProjection),
    canonicalNodeHash,
    canonicalRequirementGraphHash,
    derivationManifestHash: hash('d'),
  };
}

function standaloneGraph() {
  const graph = {
    schemaVersion: 'CanonicalRequirementGraph/v1',
    sourcePlanId: 'PLAN-GRAPH-001',
    sourcePlanVersion: 'standalone-source-plan/v1',
    goal: 'Normalize one requirement and its task.',
    scope: ['src/graph.ts'],
    nonGoals: ['Do not change unrelated paths.'],
    nodes: [
      {
        id: 'REQ-GRAPH-001',
        kind: 'REQ',
        title: 'Normalized requirement',
        statement: 'The compiler MUST preserve graph identity.',
        normativeStrength: 'MUST',
        polarity: 'required',
        applicability: { mode: 'always' },
        scope: 'local',
        aliases: ['REQ-LEGACY-1'],
        ownerRef: null,
        references: { taskRefs: ['TASK-GRAPH-001'] },
        attributes: {},
        sourceSpanRefs: ['SPAN-AAAAAAAAAAAAAAAA'],
      },
      {
        id: 'TASK-GRAPH-001',
        kind: 'TASK',
        title: 'Implement normalization',
        statement: 'Implement graph normalization.',
        normativeStrength: 'MUST',
        polarity: 'required',
        applicability: { mode: 'always' },
        scope: 'local',
        aliases: ['WORK-1'],
        ownerRef: 'REQ-GRAPH-001',
        references: { requirementRefs: ['REQ-GRAPH-001'] },
        attributes: {
          executionClass: 'executable_child',
          ownedProductionPaths: 'src/graph.ts',
        },
        sourceSpanRefs: ['SPAN-BBBBBBBBBBBBBBBB'],
      },
    ],
    relations: [
      {
        id: 'REL-AAAAAAAAAAAAAAAA',
        type: 'implemented_by',
        fromRef: 'REQ-GRAPH-001',
        toRef: 'TASK-GRAPH-001',
        scope: 'local',
        sourceSpanRefs: ['SPAN-AAAAAAAAAAAAAAAA'],
      },
    ],
    aliases: [
      {
        alias: 'REQ-LEGACY-1',
        canonicalRef: 'REQ-GRAPH-001',
        sourceSpanRefs: ['SPAN-AAAAAAAAAAAAAAAA'],
      },
      {
        alias: 'WORK-1',
        canonicalRef: 'TASK-GRAPH-001',
        sourceSpanRefs: ['SPAN-BBBBBBBBBBBBBBBB'],
      },
    ],
    graphHash: '',
  };
  const { graphHash: _graphHash, ...payload } = graph;
  graph.graphHash = sha256Stable({
    ...payload,
    nodes: graph.nodes.map(({ sourceSpanRefs: _spans, ...node }) => node),
    relations: graph.relations.map(({ sourceSpanRefs: _spans, ...relation }) => relation),
    aliases: graph.aliases.map(({ sourceSpanRefs: _spans, ...alias }) => alias),
  });
  return graph;
}

function typedGraphFromStandalone(): RequirementsTypedSourceGraph {
  const source = standaloneGraph();
  return {
    schemaVersion: 'requirements-contract-typed-source-graph/v2',
    sourceNodes: source.nodes.map((node) => {
      const canonicalProjection = Object.fromEntries(
        Object.entries(node).filter(([key]) => key !== 'sourceSpanRefs' && key !== 'references')
      );
      return {
        sourceRootId: node.id,
        executionRole: node.kind === 'TASK' ? 'action' : 'requirement',
        text: node.statement,
        polarity: node.polarity,
        normativeStrength: node.normativeStrength.toLowerCase(),
        conditions: [],
        scope: node.ownerRef
          ? { kind: 'canonical_owner', ownerId: node.ownerRef }
          : { kind: 'canonical_owner' },
        declaredIds: [node.id, ...node.aliases],
        sourceBlockId: `BLOCK-${node.id}`,
        typedReferences: attestedReferences(
          canonicalProjection,
          hash(node.kind === 'TASK' ? 'c' : 'b'),
          source.graphHash
        ),
      };
    }),
    sourceRelations: source.relations.map((relation) => ({
      relationId: relation.id,
      kind: relation.type,
      from: relation.fromRef,
      to: relation.toRef,
      blockId: `BLOCK-${relation.fromRef}`,
    })),
    sourceBlocks: source.nodes.map((node) => ({
      id: `BLOCK-${node.id}`,
      definedId: node.id,
      disposition: 'canonical_node',
      scope: {},
      text: node.statement,
    })),
    commandDeclarations: [],
    workDeclarations: [
      {
        id: 'TASK-GRAPH-001',
        text: 'Implement graph normalization.',
        pass: [{ text: 'The canonical and typed hash domains remain distinct.' }],
      },
    ],
    scenarioDeclarations: [],
    fixDeclarations: [],
    sections: [{ id: 0, orderedPosition: 0, scope: 'test' }],
  };
}

function typedSemanticIrWithCommandDeclarations() {
  const graph = typedGraphFromStandalone();
  graph.sourceNodes.push(
    {
      sourceRootId: 'CMD-GRAPH-001',
      executionRole: 'binding',
      text: 'Run the global graph verification command.',
      polarity: 'required',
      normativeStrength: 'must',
      conditions: [],
      scope: { kind: 'global', ownerId: 'REQ-GRAPH-001' },
      declaredIds: ['CMD-GRAPH-001'],
      sourceBlockId: 'BLOCK-CMD-GRAPH-001',
      typedReferences: attestedReferences(
        {
          id: 'CMD-GRAPH-001',
          kind: 'CMD',
          title: 'Global verification',
          statement: 'Run the global graph verification command.',
          normativeStrength: 'MUST',
          polarity: 'required',
          applicability: { mode: 'always' },
          scope: 'global',
          aliases: [],
          ownerRef: 'REQ-GRAPH-001',
          attributes: {
            command: 'npm test',
            commandRole: 'global_verification_command',
            commandDeclarationClass: 'executable_expression',
            executionMode: 'executable',
          },
        },
        hash('e'),
        standaloneGraph().graphHash
      ),
    },
    {
      sourceRootId: 'CMD-GRAPH-002',
      executionRole: 'binding',
      text: 'Preserve the command template.',
      polarity: 'descriptive',
      normativeStrength: 'must',
      conditions: [],
      scope: { kind: 'canonical_owner', ownerId: 'REQ-GRAPH-001' },
      declaredIds: ['CMD-GRAPH-002'],
      sourceBlockId: 'BLOCK-CMD-GRAPH-002',
      typedReferences: attestedReferences(
        {
          id: 'CMD-GRAPH-002',
          kind: 'CMD',
          title: 'Command template',
          statement: 'Preserve the command template.',
          normativeStrength: 'MUST',
          polarity: 'descriptive',
          applicability: { mode: 'always' },
          scope: 'local',
          aliases: [],
          ownerRef: 'REQ-GRAPH-001',
          attributes: {
            command: 'npm test <selector>',
            commandRole: 'command_template',
            commandDeclarationClass: 'executable_expression',
            executionMode: 'template',
          },
        },
        hash('f'),
        standaloneGraph().graphHash
      ),
    }
  );
  graph.sourceBlocks.push(
    {
      id: 'BLOCK-CMD-GRAPH-001',
      definedId: 'CMD-GRAPH-001',
      disposition: 'canonical_node',
      scope: {},
      text: 'Run the global graph verification command.',
    },
    {
      id: 'BLOCK-CMD-GRAPH-002',
      definedId: 'CMD-GRAPH-002',
      disposition: 'canonical_node',
      scope: {},
      text: 'Preserve the command template.',
    }
  );
  graph.sourceRelations.push(
    {
      relationId: 'REL-CMD-GRAPH-001',
      kind: 'owned_by',
      from: 'CMD-GRAPH-001',
      to: 'REQ-GRAPH-001',
      blockId: 'BLOCK-CMD-GRAPH-001',
    },
    {
      relationId: 'REL-CMD-GRAPH-002',
      kind: 'owned_by',
      from: 'CMD-GRAPH-002',
      to: 'REQ-GRAPH-001',
      blockId: 'BLOCK-CMD-GRAPH-002',
    }
  );
  graph.commandDeclarations.push(
    {
      id: 'CMD-GRAPH-001',
      blockId: 'BLOCK-CMD-GRAPH-001',
      owner: 'REQ-GRAPH-001',
      role: 'verification_command',
      expression: 'npm test',
    },
    {
      id: 'CMD-GRAPH-002',
      blockId: 'BLOCK-CMD-GRAPH-002',
      owner: 'REQ-GRAPH-001',
      role: 'verification_command',
      expression: 'npm test <selector>',
    }
  );
  const authority = createTypedSourceAuthority(graph);
  return {
    schemaVersion: 'requirements-contract-semantic-ir/v2',
    semanticRevisionId: 'SEMREV-GRAPH-001',
    scopeSemanticHash: hash('2'),
    semanticPayload: {
      semantics: {
        typedSourceAuthority: authority,
        atoms: [
          {
            id: 'TASK-GRAPH-001-A1',
            requirementRef: 'TASK-GRAPH-001',
            action: 'Implement graph normalization.',
            oracle: 'The canonical and typed hash domains remain distinct.',
            dependencies: [],
          },
        ],
      },
      executionConstraints: [
        {
          constraintId: 'CMD-GRAPH-RUNTIME-001',
          kind: 'CMD',
          canonicalValue: 'npm test',
          applicableMustRefs: [],
          applicableAtomRefs: [],
          applicableSourceRefs: [],
          premiseRefs: ['CMD-GRAPH-001'],
          sourceDeclarationRefs: ['CMD-GRAPH-001'],
          modality: 'required',
          scope: { kind: 'source_command', owner: 'REQ-GRAPH-001' },
        },
        {
          constraintId: 'CMD-GRAPH-RUNTIME-002',
          kind: 'CMD',
          canonicalValue: 'npm test <selector>',
          applicableMustRefs: [],
          applicableAtomRefs: [],
          applicableSourceRefs: [],
          premiseRefs: ['CMD-GRAPH-002'],
          sourceDeclarationRefs: ['CMD-GRAPH-002'],
          modality: 'required',
          scope: { kind: 'source_command', owner: 'REQ-GRAPH-001' },
        },
      ],
      semanticProvenance: { typedSourceGraph: authority.graphHash },
    },
  };
}

function typedSemanticIrWithCompleteExecutionDeclarations() {
  const semanticIr = typedSemanticIrWithCommandDeclarations();
  const authority = (
    semanticIr.semanticPayload.semantics as Record<string, unknown>
  ).typedSourceAuthority as ReturnType<typeof createTypedSourceAuthority>;
  const graph = structuredClone(resolveTypedSourceAuthority(authority));
  const declarations = [
    {
      id: 'ART-GRAPH-001',
      kind: 'ART',
      statement: 'Persist the graph verification report.',
      attributes: { path: '.artifacts/graph-verification.json' },
      relationType: 'produces_artifact',
    },
    {
      id: 'EVD-GRAPH-001',
      kind: 'EVD',
      statement: 'Record graph verification evidence.',
      attributes: { expectedFields: ['status', 'contentHash'] },
      relationType: 'evidenced_by',
    },
    {
      id: 'DEP-GRAPH-001',
      kind: 'DEP',
      statement: 'Require the graph task dependency.',
      attributes: {
        dependency: 'TASK-GRAPH-001',
        requiredState: 'The dependency is closed with evidence.',
      },
      relationType: 'depends_on',
    },
    {
      id: 'STOP-GRAPH-001',
      kind: 'STOP',
      statement: 'Stop when graph authority is ambiguous.',
      attributes: { trigger: 'The canonical graph authority is ambiguous.' },
      relationType: 'guarded_by',
    },
  ];
  for (const [index, declaration] of declarations.entries()) {
    const blockId = `BLOCK-${declaration.id}`;
    graph.sourceNodes.push({
      sourceRootId: declaration.id,
      executionRole: 'binding',
      text: declaration.statement,
      polarity: 'required',
      normativeStrength: 'must',
      conditions: [],
      scope: { kind: 'canonical_owner', ownerId: 'TASK-GRAPH-001' },
      declaredIds: [declaration.id],
      sourceBlockId: blockId,
      typedReferences: attestedReferences(
        {
          id: declaration.id,
          kind: declaration.kind,
          title: declaration.statement,
          statement: declaration.statement,
          normativeStrength: 'MUST',
          polarity: 'required',
          applicability: { mode: 'always' },
          scope: 'local',
          aliases: [],
          ownerRef: 'TASK-GRAPH-001',
          attributes: declaration.attributes,
        },
        hash(String(index + 1)),
        standaloneGraph().graphHash
      ),
    });
    graph.sourceBlocks.push({
      id: blockId,
      definedId: declaration.id,
      disposition: 'canonical_node',
      scope: {},
      text: declaration.statement,
    });
    graph.sourceRelations.push({
      relationId: `REL-${declaration.id}`,
      kind: declaration.relationType,
      from: 'TASK-GRAPH-001',
      to: declaration.id,
      blockId,
    });
  }
  const updatedAuthority = createTypedSourceAuthority(graph);
  (
    semanticIr.semanticPayload.semantics as Record<string, unknown>
  ).typedSourceAuthority = updatedAuthority;
  (
    semanticIr.semanticPayload.semanticProvenance as Record<string, unknown>
  ).typedSourceGraph = updatedAuthority.graphHash;
  return semanticIr;
}

function scaledTechnicalAuthority(size: number) {
  const sourceNodes = Array.from({ length: size }, (_, index) => ({
    sourceRootId: `WORK-SCALE-${index}`,
    executionRole: 'action' as const,
    text: `Implement scale target ${index}.`,
    polarity: 'required',
    normativeStrength: 'must',
    conditions: [],
    scope: { kind: 'work' },
    declaredIds: [`WORK-SCALE-${index}`],
    sourceBlockId: `BLOCK-SCALE-${index}`,
  }));
  return createTypedSourceAuthority({
    schemaVersion: 'requirements-contract-typed-source-graph/v2',
    sourceNodes,
    sourceRelations: sourceNodes.map((node, index) => ({
      relationId: `REL-SCALE-${index}`,
      kind: 'allows_product_file',
      from: node.sourceRootId,
      to: `src/scale-${index}.ts`,
      blockId: node.sourceBlockId,
    })),
    sourceBlocks: sourceNodes.map((node) => ({
      id: node.sourceBlockId,
      definedId: node.sourceRootId,
      disposition: 'requirement',
      scope: { kind: 'work', owner: node.sourceRootId },
      text: node.text,
    })),
    commandDeclarations: [],
    workDeclarations: sourceNodes.map((node, index) => ({
      id: node.sourceRootId,
      text: node.text,
      productPaths: [`src/scale-${index}.ts`],
      pass: [{ text: `Scale target ${index} is preserved.` }],
    })),
    scenarioDeclarations: [],
    fixDeclarations: [],
    sections: [],
  });
}

describe('CanonicalRequirementGraph normalization boundary', () => {
  it('treats declared canonical node IDs as direct identities and keeps aliases unambiguous', () => {
    const graph = typedGraphFromStandalone();
    for (const node of graph.sourceNodes) delete node.typedReferences;
    graph.sourceNodes[0].declaredIds = [
      'REQ-GRAPH-001',
      'TASK-GRAPH-001',
      'REQ-LEGACY-1',
    ];
    graph.sourceNodes[1].declaredIds = ['TASK-GRAPH-001', 'WORK-1'];
    graph.sourceNodes[1].scope = {
      kind: 'source_section',
      ownerId: 'SOURCE-OWNER-UNKNOWN',
    };
    const authority = createTypedSourceAuthority(graph);
    const canonical = normalizeCanonicalRequirementGraph({
      sourceAuthority: {
        kind: 'requirements_semantic_ir',
        schemaVersion: 'requirements-contract-semantic-ir/v2',
        authorityId: 'SEMREV-GRAPH-DIRECT-IDENTITY',
        authorityHash: hash('2'),
      },
      typedSourceAuthority: authority,
      expectedTypedSourceGraphHash: authority.graphHash,
    });

    expect(canonical.aliases).toEqual([
      { alias: 'REQ-LEGACY-1', canonicalRef: 'REQ-GRAPH-001' },
      { alias: 'WORK-1', canonicalRef: 'TASK-GRAPH-001' },
    ]);
    expect(canonical.nodes.find((node) => node.id === 'TASK-GRAPH-001')?.ownerRef)
      .toBeNull();

    graph.sourceNodes[1].declaredIds.push('REQ-LEGACY-1');
    const ambiguous = createTypedSourceAuthority(graph);
    expect(() => normalizeCanonicalRequirementGraph({
      sourceAuthority: {
        kind: 'requirements_semantic_ir',
        schemaVersion: 'requirements-contract-semantic-ir/v2',
        authorityId: 'SEMREV-GRAPH-AMBIGUOUS-ALIAS',
        authorityHash: hash('3'),
      },
      typedSourceAuthority: ambiguous,
      expectedTypedSourceGraphHash: ambiguous.graphHash,
    })).toThrow('canonical_requirement_graph_alias_reference_invalid');
  });

  it('restores sparse ART/EVD/DEP/STOP constraints from canonical owner bindings', () => {
    const semanticSource = requirementsTypedSemanticSource(
      typedSemanticIrWithCompleteExecutionDeclarations()
    );
    const constraints = semanticSource.typedExecutionConstraints as Array<
      Record<string, unknown>
    >;
    const expected = [
      ['ART', 'ART-GRAPH-001'],
      ['EVDREQ', 'EVD-GRAPH-001'],
      ['CTM', 'DEP-GRAPH-001'],
      ['STOP', 'STOP-GRAPH-001'],
    ] as const;

    for (const [kind, sourceRef] of expected) {
      const matches = constraints.filter(
        (constraint) =>
          constraint.kind === kind &&
          (constraint.sourceDeclarationRefs as string[]).includes(sourceRef)
      );
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        applicableSourceRefs: ['TASK-GRAPH-001'],
        applicableAtomRefs: ['TASK-GRAPH-001-A1'],
        authorityKind: 'source_declared',
        disposition: 'proven',
      });
    }
  });

  it('classifies command coverage in the Requirements producer before semantic IR creation', () => {
    const semanticIr = typedSemanticIrWithCommandDeclarations();
    const authority = (
      semanticIr.semanticPayload.semantics as Record<string, unknown>
    ).typedSourceAuthority as Parameters<typeof resolveTypedTechnicalDeclarations>[0];
    const commands = resolveTypedTechnicalDeclarations(authority).filter(
      (entry) => entry.kind === 'CMD'
    );

    expect(commands).toHaveLength(2);
    expect(commands.find((entry) => entry.value === 'npm test')).toMatchObject({
      value: 'npm test',
      coverageRole: 'action_trace',
      declarationRole: 'global_verification_command',
      modality: 'required',
      applicableSourceRefs: ['TASK-GRAPH-001'],
    });
    expect(commands.find((entry) => entry.value === 'npm test <selector>')).toMatchObject({
      value: 'npm test <selector>',
      coverageRole: 'non_action_declaration',
      declarationRole: 'command_template',
      modality: 'template',
      applicableSourceRefs: [],
    });
  });

  it('keeps typed declaration relation lookups sub-quadratic at N/2N/4N', () => {
    const sizes = [512, 1024, 2048];
    const authorities = sizes.map(scaledTechnicalAuthority);
    const outputs = authorities.map((authority) => resolveTypedTechnicalDeclarations(authority));
    expect(outputs.map((entries) => entries.length)).toEqual(sizes);
    expect(new Set(outputs.map((entries) => sha256Stable(entries))).size).toBe(sizes.length);
    authorities.forEach((authority, index) => {
      const graph = resolveTypedSourceAuthority(authority);
      const relationIndex = indexTypedTechnicalRelations(graph.sourceRelations);
      expect(relationIndex).toMatchObject({
        relationCount: sizes[index],
        buildVisitCount: sizes[index],
        indexedReferenceCount: sizes[index] * 4,
      });
      expect(relationIndex.byKind('allows_product_file')).toHaveLength(sizes[index]);
      expect(relationIndex.byKindFromTo(
        'allows_product_file',
        `WORK-SCALE-${sizes[index] - 1}`,
        `src/scale-${sizes[index] - 1}.ts`
      ).map((relation) => relation.relationId)).toEqual([`REL-SCALE-${sizes[index] - 1}`]);
    });
    const durations = authorities.map((authority, index) => {
      expect(resolveTypedTechnicalDeclarations(authority)).toHaveLength(sizes[index]);
      const samples = Array.from({ length: 3 }, () => {
        const startedAt = performance.now();
        resolveTypedTechnicalDeclarations(authority);
        return performance.now() - startedAt;
      }).sort((left, right) => left - right);
      return samples[0];
    });
    const ratios = [durations[1] / durations[0], durations[2] / durations[1]];
    const totalGrowth = durations[2] / durations[0];
    const growthExponent = Math.log(totalGrowth) / Math.log(sizes[2] / sizes[0]);
    console.info(JSON.stringify({
      evidence: 'typed-relation-scaling',
      sizes,
      durations,
      ratios,
      totalGrowth,
      growthExponent,
    }));
    expect(growthExponent, JSON.stringify({ sizes, durations, ratios, totalGrowth })).toBeLessThan(1.8);
    expect(totalGrowth, JSON.stringify({ sizes, durations, ratios, growthExponent })).toBeLessThan(8);
  }, 120_000);

  it('recovers explicit global command bindings and preserves templates as non-action declarations', () => {
    const source = requirementsTypedSemanticSource(typedSemanticIrWithCommandDeclarations());
    const constraints = source.typedExecutionConstraints as Array<Record<string, unknown>>;

    expect(constraints).toHaveLength(2);
    expect(constraints[0]).toMatchObject({
      constraintId: 'CMD-GRAPH-RUNTIME-001',
      coverageRole: 'action_trace',
      declarationRole: 'global_verification_command',
      modality: 'required',
      applicableMustRefs: ['REQ-GRAPH-001', 'TASK-GRAPH-001'],
      applicableAtomRefs: ['TASK-GRAPH-001-A1'],
      applicableSourceRefs: ['TASK-GRAPH-001'],
    });
    expect(constraints[1]).toMatchObject({
      constraintId: 'CMD-GRAPH-RUNTIME-002',
      coverageRole: 'non_action_declaration',
      declarationRole: 'command_template',
      modality: 'template',
      applicableMustRefs: ['REQ-GRAPH-001'],
      applicableAtomRefs: [],
      applicableSourceRefs: [],
    });
  });

  it('produces the same semantic hash for standalone and confirmed Requirements projections', () => {
    const standalone = normalizeCanonicalRequirementGraph({
      sourceAuthority: {
        kind: 'standalone_source_plan',
        schemaVersion: 'standalone-source-plan/v1',
        authorityId: 'PLAN-GRAPH-001',
        authorityHash: hash('1'),
      },
      standaloneGraph: standaloneGraph(),
    });
    const authority = createTypedSourceAuthority(typedGraphFromStandalone());
    const requirements = normalizeCanonicalRequirementGraph({
      sourceAuthority: {
        kind: 'requirements_semantic_ir',
        schemaVersion: 'requirements-contract-semantic-ir/v2',
        authorityId: 'SEMREV-GRAPH-001',
        authorityHash: hash('2'),
      },
      typedSourceAuthority: authority,
      expectedTypedSourceGraphHash: authority.graphHash,
    });

    expect(requirements.semanticHash).toBe(standalone.semanticHash);
    expect(requirements.graphHash).not.toBe(standalone.graphHash);
    expect(requirements.graphHash).not.toBe(authority.graphHash);
    expect(requirements.upstreamCanonicalRequirementGraphHash).toBe(standaloneGraph().graphHash);
    expect(canonicalRequirementGraphRef(requirements)).toMatchObject({
      schemaVersion: 'CanonicalRequirementGraphRef/v1',
      graphSchemaVersion: 'CanonicalRequirementGraph/v2',
      graphHash: requirements.graphHash,
      semanticHash: requirements.semanticHash,
      typedSourceGraphHash: authority.graphHash,
    });
  });

  it('rejects incomplete or mixed canonical attestations instead of trusting one node', () => {
    const missing = typedGraphFromStandalone();
    delete (missing.sourceNodes[1].typedReferences as Record<string, unknown>).canonicalProjection;
    const missingAuthority = createTypedSourceAuthority(missing);
    expect(() =>
      normalizeCanonicalRequirementGraph({
        sourceAuthority: {
          kind: 'requirements_semantic_ir',
          schemaVersion: 'requirements-contract-semantic-ir/v2',
          authorityId: 'SEMREV-GRAPH-001',
          authorityHash: hash('2'),
        },
        typedSourceAuthority: missingAuthority,
        expectedTypedSourceGraphHash: missingAuthority.graphHash,
      })
    ).toThrow('canonical_requirement_graph_attestation_incomplete');

    const mixed = typedGraphFromStandalone();
    (mixed.sourceNodes[1].typedReferences as Record<string, unknown>)
      .canonicalRequirementGraphHash = hash('f');
    const mixedAuthority = createTypedSourceAuthority(mixed);
    expect(() =>
      normalizeCanonicalRequirementGraph({
        sourceAuthority: {
          kind: 'requirements_semantic_ir',
          schemaVersion: 'requirements-contract-semantic-ir/v2',
          authorityId: 'SEMREV-GRAPH-001',
          authorityHash: hash('2'),
        },
        typedSourceAuthority: mixedAuthority,
        expectedTypedSourceGraphHash: mixedAuthority.graphHash,
      })
    ).toThrow('canonical_requirement_graph_attestation_mixed');
  });

  it('rejects a canonical projection whose attested projection hash no longer matches', () => {
    const tampered = typedGraphFromStandalone();
    const references = tampered.sourceNodes[0].typedReferences as Record<string, unknown>;
    references.canonicalProjection = {
      ...(references.canonicalProjection as Record<string, unknown>),
      statement: 'Tampered after the canonical node hash was issued.',
    };
    const tamperedAuthority = createTypedSourceAuthority(tampered);

    expect(() =>
      normalizeCanonicalRequirementGraph({
        sourceAuthority: {
          kind: 'requirements_semantic_ir',
          schemaVersion: 'requirements-contract-semantic-ir/v2',
          authorityId: 'SEMREV-GRAPH-001',
          authorityHash: hash('2'),
        },
        typedSourceAuthority: tamperedAuthority,
        expectedTypedSourceGraphHash: tamperedAuthority.graphHash,
      })
    ).toThrow('canonical_requirement_graph_attestation_projection_hash_mismatch');
  });

  it('rejects a consensus upstream graph hash that is not bound by the trusted typed graph anchor', () => {
    const trustedGraph = typedGraphFromStandalone();
    const trustedAuthority = createTypedSourceAuthority(trustedGraph);
    const tamperedGraph = structuredClone(trustedGraph);
    for (const node of tamperedGraph.sourceNodes) {
      (node.typedReferences as Record<string, unknown>).canonicalRequirementGraphHash = hash('f');
    }
    const tamperedAuthority = createTypedSourceAuthority(tamperedGraph);

    expect(() =>
      normalizeCanonicalRequirementGraph({
        sourceAuthority: {
          kind: 'requirements_semantic_ir',
          schemaVersion: 'requirements-contract-semantic-ir/v2',
          authorityId: 'SEMREV-GRAPH-001',
          authorityHash: hash('2'),
        },
        typedSourceAuthority: tamperedAuthority,
        expectedTypedSourceGraphHash: trustedAuthority.graphHash,
      })
    ).toThrow('canonical_requirement_graph_attestation_upstream_anchor_mismatch');

    const semanticIr = typedSemanticIrWithCommandDeclarations();
    (
      semanticIr.semanticPayload.semanticProvenance as Record<string, unknown>
    ).typedSourceGraph = hash('a');
    expect(() => requirementsTypedSemanticSource(semanticIr)).toThrow(
      'requirements_goal_typed_typed_source_graph_anchor_mismatch'
    );
  });

  it('validates the v2 wire schema without changing the frozen v1 reader contract', () => {
    const graph = normalizeCanonicalRequirementGraph({
      sourceAuthority: {
        kind: 'standalone_source_plan',
        schemaVersion: 'standalone-source-plan/v1',
        authorityId: 'PLAN-GRAPH-001',
        authorityHash: hash('1'),
      },
      standaloneGraph: standaloneGraph(),
    });

    expect(
      validateGoalContractSchema('canonical-requirement-graph-v2.schema.json', graph)
    ).toBe(graph);
    expect(() =>
      validateGoalContractSchema('canonical-requirement-graph-v2.schema.json', {
        ...graph,
        schemaVersion: 'CanonicalRequirementGraph/v1',
      })
    ).toThrow('canonical_schema_invalid');
    expect(() =>
      validateGoalContractSchema('canonical-requirement-graph-v2.schema.json', {
        ...graph,
        undeclaredWireField: true,
      })
    ).toThrow('canonical_schema_invalid');
  });

  it('binds GoalExecutionIR lineage to distinct typed and canonical graph hashes', () => {
    const lineageGraph = typedGraphFromStandalone();
    lineageGraph.commandDeclarations = [
      { id: 'CMD-GRAPH-001' },
      { id: 'PATH-GRAPH-001' },
    ];
    const typedSourceAuthority = createTypedSourceAuthority(lineageGraph);
    const specSpan = {
      authorityClass: 'source_grounded' as const,
      normalizedClaimHash: typedSourceAuthority.graphHash,
      boundTypedSourceGraphHash: typedSourceAuthority.graphHash,
      boundSemanticNodeIds: ['TASK-GRAPH-001', 'TASK-GRAPH-001-A1'],
      boundObligationIds: ['TASK-GRAPH-001'],
      evidenceClaimRefs: [],
      decisionReceiptRefs: [],
      derivationReceiptRefs: [],
    };
    const input: GoalExecutionCompilerInput = {
      profile: 'requirements_backed',
      semanticSource: {
        kind: 'requirements_semantic_ir',
        schemaVersion: 'requirements-contract-semantic-ir/v2',
        semanticRevisionId: 'SEMREV-GRAPH-001',
        scopeSemanticHash: hash('2'),
        typedSourceAuthority,
        typedSourceGraphHash: typedSourceAuthority.graphHash,
        typedRelationProjections: [
          {
            relationId: 'REL-AAAAAAAAAAAAAAAA',
            relationKind: 'implemented_by',
            fromRef: 'REQ-GRAPH-001',
            toRef: 'TASK-GRAPH-001',
            mandatory: true,
            disposition: 'canonical_relation',
            carrierRefs: [
              'canonical_relation:REL-AAAAAAAAAAAAAAAA',
              'obligation:REQ-GRAPH-001',
              'obligation:TASK-GRAPH-001',
            ],
          },
        ],
        typedAtoms: [
          {
            id: 'TASK-GRAPH-001-A1',
            requirementRef: 'TASK-GRAPH-001',
            action: 'Implement graph normalization.',
            oracle: 'The canonical and typed hash domains remain distinct.',
            dependencies: [],
          },
        ],
        typedExecutionConstraints: [
          {
            constraintId: 'CMD-GRAPH-001',
            kind: 'CMD',
            canonicalValue: 'npm test',
            applicableMustRefs: ['TASK-GRAPH-001'],
            applicableAtomRefs: ['TASK-GRAPH-001-A1'],
            premiseRefs: ['TASK-GRAPH-001'],
            sourceRefs: ['TASK-GRAPH-001'],
            disposition: 'proven',
            authorityKind: 'source_declared',
            applicableSourceRefs: ['TASK-GRAPH-001'],
            conditions: [],
            scope: { kind: 'work', owner: 'TASK-GRAPH-001' },
            modality: 'required',
            sourceDeclarationRefs: ['CMD-GRAPH-001'],
            declarationStatus: 'source_declared_not_executed',
            derivationReceiptRefs: [],
          },
          {
            constraintId: 'PATH-GRAPH-001',
            kind: 'PATH',
            canonicalValue: 'src/graph.ts',
            applicableMustRefs: ['TASK-GRAPH-001'],
            applicableAtomRefs: ['TASK-GRAPH-001-A1'],
            premiseRefs: ['TASK-GRAPH-001'],
            sourceRefs: ['TASK-GRAPH-001'],
            disposition: 'proven',
            authorityKind: 'source_declared',
            applicableSourceRefs: ['TASK-GRAPH-001'],
            conditions: [],
            scope: { kind: 'work', owner: 'TASK-GRAPH-001' },
            modality: 'required',
            sourceDeclarationRefs: ['PATH-GRAPH-001'],
            declarationStatus: 'source_declared_not_executed',
            derivationReceiptRefs: [],
          },
        ],
      },
      requirementsLineage: { sourceBindingHash: hash('3') },
      technicalAuthority: { executionConstraintRegistryHash: hash('4') },
      obligations: [],
      atoms: [],
      logicalSpecSpans: [
        {
          ...specSpan,
          specSpanId: canonicalSpecSpanId({
            normalizedClaimHash: specSpan.normalizedClaimHash,
            obligationIds: specSpan.boundObligationIds,
            boundTypedSourceGraphHash: specSpan.boundTypedSourceGraphHash,
          }),
        },
      ],
      executionConstraints: [],
      architecture: {
        isolation: { mode: 'test' },
        ownership: [
          {
            targetPath: 'src/graph.ts',
            owner: 'TASK-GRAPH-001',
            basisRefs: ['PATH-GRAPH-001'],
          },
        ],
        architectureDecisions: [],
      },
    };

    const graph = normalizeCanonicalRequirementGraph({
      sourceAuthority: {
        kind: 'requirements_semantic_ir',
        schemaVersion: 'requirements-contract-semantic-ir/v2',
        authorityId: 'SEMREV-GRAPH-001',
        authorityHash: hash('2'),
      },
      typedSourceAuthority,
      expectedTypedSourceGraphHash: typedSourceAuthority.graphHash,
    });
    input.semanticSource.canonicalRequirementGraphRef = canonicalRequirementGraphRef(graph);
    input.obligations = projectRequirementsTypedGoalObligations(
      input.semanticSource,
      input.logicalSpecSpans
    );
    input.atoms = input.semanticSource.typedAtoms as Record<string, unknown>[];
    input.executionConstraints = input.semanticSource
      .typedExecutionConstraints as Record<string, unknown>[];
    input.canonicalRequirementGraph = graph;

    const ir = compileGoalExecutionIR(input);
    const authority = ir.sourceLineage!.authorities[0];
    expect(ir.semanticSource.canonicalRequirementGraphRef).toEqual(
      canonicalRequirementGraphRef(graph)
    );
    expect(authority.typedSourceGraphHash).toBe(typedSourceAuthority.graphHash);
    expect(authority.canonicalRequirementGraphHash).toBe(graph.graphHash);
    expect(authority.canonicalRequirementGraphHash).not.toBe(authority.typedSourceGraphHash);
    expect(authority.sourceBindingHash).toBe(hash('3'));
    expect(validateGoalExecutionIR(ir)).toEqual({ decision: 'pass', issueCodes: [] });
  });
});
