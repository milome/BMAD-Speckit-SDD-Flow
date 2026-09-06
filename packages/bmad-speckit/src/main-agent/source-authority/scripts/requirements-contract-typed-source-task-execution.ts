import type { RequirementsTypedSourceGraph } from './requirements-contract-typed-source-semantics';
import { stableStringify } from './requirements-contract-semantic-resolver';
import { declaredTaskExecution } from '../../../utils/goal-contract/source-execution-semantics';

export function deriveTypedSourceTaskExecutions(graph: RequirementsTypedSourceGraph): Map<string, Record<string, unknown>> {
  const blocks = graph.sourceBlocks.map((block) => ({ ...block,
    scope: { ...(block.scope as Record<string, unknown>), ownerId: (block.scope as Record<string, unknown>)?.ownerId ??
      (block.scope as Record<string, unknown>)?.owner ?? null },
    declaredId: block.definedId ?? null,
    commandDeclarations: graph.commandDeclarations.filter((command) => command.blockId === block.id).map((command) => ({ id: command.id })),
  }));
  const children = new Map<string, string[]>();
  for (const relation of graph.sourceRelations.filter((relation) => relation.kind === 'command_set_includes')) {
    children.set(relation.from, [...(children.get(relation.from) ?? []), relation.to]);
  }
  const result = new Map<string, Record<string, unknown>>();
  for (const node of graph.sourceNodes.filter((entry) => entry.executionRole === 'action')) {
    const work = graph.workDeclarations.find((entry) => entry.id === node.sourceRootId);
    const refs = new Set<string>();
    const include = (id: string) => {
      if (refs.has(id)) return;
      refs.add(id);
      for (const child of children.get(id) ?? []) include(child);
    };
    for (const id of Array.isArray(work?.commandIds) ? work.commandIds : []) include(String(id));
    for (const command of graph.commandDeclarations.filter((entry) => entry.owner === node.sourceRootId)) include(String(command.id));
    for (const scenario of graph.scenarioDeclarations) if (Array.isArray(scenario.works) && scenario.works.includes(node.sourceRootId)) {
      for (const id of Array.isArray(scenario.commandIds) ? scenario.commandIds : []) include(String(id));
    }
    const execution = declaredTaskExecution({ id: node.sourceRootId, commandRefs: [...refs] }, blocks);
    if (execution) result.set(node.sourceRootId, execution);
  }
  return result;
}

export function assertTypedSourceTaskExecutions(graph: RequirementsTypedSourceGraph): void {
  const expected = deriveTypedSourceTaskExecutions(graph);
  for (const node of graph.sourceNodes) if (stableStringify(node.taskExecution ?? null) !== stableStringify(expected.get(node.sourceRootId) ?? null)) {
    throw new Error('requirements_typed_source_task_execution_projection_mismatch');
  }
}

export function attachTypedSourceTaskExecutions(graph: RequirementsTypedSourceGraph): RequirementsTypedSourceGraph {
  const declared = deriveTypedSourceTaskExecutions(graph);
  const result = { ...graph, sourceNodes: graph.sourceNodes.map((node) => {
    const execution = declared.get(node.sourceRootId);
    if (node.taskExecution !== undefined && stableStringify(node.taskExecution) !== stableStringify(execution ?? null)) {
      throw new Error('requirements_typed_source_task_execution_projection_mismatch');
    }
    return execution ? { ...node, taskExecution: execution } : node;
  }) };
  assertTypedSourceTaskExecutions(result);
  return result;
}
