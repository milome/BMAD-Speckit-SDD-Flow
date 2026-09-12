import { describe, expect, it } from 'vitest';
import { createTypedSourceAuthority, resolveTypedSourceAuthority, type RequirementsTypedSourceGraph } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { deriveRequirementsTypedSourceConfirmationSemantics } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-typed-source-compiler';
import { encodeGoalSemanticDictionary } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/goal-semantic-dictionary';

function graph(withDeclaration = true): RequirementsTypedSourceGraph {
  return { schemaVersion: 'requirements-contract-typed-source-graph/v2', sourceNodes: [{ sourceRootId: 'WORK-01',
    executionRole: 'action', text: 'Validate the complete delivery.', polarity: 'required', normativeStrength: 'must',
    declaredIds: ['WORK-01'], conditions: [], scope: { kind: 'work', owner: 'WORK-01' } }], sourceRelations: [],
    sourceBlocks: [{ id: 'B0001', text: withDeclaration ? 'Execution Class: aggregate_only\nOwned Production Paths: none\nAggregate Gate Phase: final_aggregate\nAggregate Validation Commands: `VERIFY-ALL`'
      : 'Run the declared verification.', disposition: 'requirement', scope: { kind: 'work', owner: 'WORK-01' } },
    { id: 'B0002', text: 'npm test', disposition: 'command_declaration', definedId: 'VERIFY-ALL', scope: { kind: 'work', owner: 'WORK-01' } }],
    workDeclarations: [{ id: 'WORK-01', commandIds: ['CMD-VERIFY-01'], dependencies: [], productPaths: [], testPaths: [],
      evidence: [{ raw: 'Verified source evidence.' }], pass: [{ text: 'The declared complete validation succeeds.' }] }],
    commandDeclarations: [{ id: 'CMD-VERIFY-01', blockId: 'B0002', owner: 'WORK-01', role: 'verification_command', expression: 'npm test' }],
    scenarioDeclarations: [], fixDeclarations: [], sections: [{ id: 0 }] };
}

describe('Requirements v2 explicit source task execution', () => {
  it('derives only explicit source metadata and preserves it in the confirmation task', () => {
    const authority = createTypedSourceAuthority(graph());
    const execution = resolveTypedSourceAuthority(authority).sourceNodes[0].taskExecution;
    expect(execution).toEqual({ executionClass: 'aggregate_only', ownedProductionPaths: 'none', aggregateGatePhase: 'final_aggregate',
      aggregateValidationCommandsValue: '`VERIFY-ALL`', aggregateValidationCommands: ['CMD-VERIFY-01'], sourceRefs: ['B0001', 'B0002'] });
    expect(deriveRequirementsTypedSourceConfirmationSemantics(authority).implementationTasks[0].taskExecution).toEqual(execution);
    expect(resolveTypedSourceAuthority(createTypedSourceAuthority(graph(false))).sourceNodes[0].taskExecution).toBeUndefined();
  });

  it('rejects unknown classes, absent provenance and rehashed metadata that contradicts its original declarations', () => {
    const authority = createTypedSourceAuthority(graph());
    for (const mutate of [
      (execution: any) => { execution.aggregateGatePhase = 'post_child_execution'; },
      (execution: any) => { execution.executionClass = 'future_class'; },
      (execution: any) => { execution.sourceRefs = []; },
      (execution: any) => { execution.omitted = true; },
    ]) {
      const decoded = resolveTypedSourceAuthority(authority);
      mutate(decoded.sourceNodes[0].taskExecution);
      const dictionary = encodeGoalSemanticDictionary(decoded);
      expect(() => resolveTypedSourceAuthority({ ...authority, graph: dictionary, graphHash: dictionary.expandedHash }))
        .toThrow('requirements_typed_source_task_execution_projection_mismatch');
    }
  });
});
