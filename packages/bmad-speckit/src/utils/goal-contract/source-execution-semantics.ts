export type GoalSourceExecutionSemanticsModule = never;

type TaskExecutionOwner = { id: string; commandRefs: string[] };
type CommandDeclaration = { id: string; [key: string]: unknown };
type TaskExecutionSourceBlock = {
  id: string;
  text: string;
  disposition: string;
  scope: { ownerId?: string | null };
  declaredId?: string | null;
  commandDeclarations?: CommandDeclaration[];
};
type TaskExecutionSourceBlockInput = Record<string, unknown>;
type SourceExecutionClause = {
  conditions: Array<{ text: string; kind: string; sourceBlockRefs: string[] }>;
  derivation: { premiseBlockRefs: string[] };
  [key: string]: unknown;
};
type SourceExecutionBlock = TaskExecutionSourceBlock & {
  clauses: SourceExecutionClause[];
  fieldRole?: string;
  scope: { ownerId?: string | null; ownerBlockRefs: string[]; [key: string]: unknown };
};
type SourceExecutionObligation = TaskExecutionOwner & {
  sourceBlockRefs: string[];
  kind: string;
  normativeStrength: string;
  polarity: string;
  exactText: string;
  [key: string]: unknown;
};

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function executionRole(row: SourceExecutionObligation, blocks: SourceExecutionBlock[], hasDeclaredTasks: boolean) {
  if (['should', 'may'].includes(row.normativeStrength)) return 'guidance';
  if (row.kind === 'declared_execution_task') return 'action';
  if (row.polarity === 'forbidden') return 'boundary';
  if (blocks.every((block) => block.disposition === 'structure') || row.polarity === 'descriptive') return 'definition';
  if (blocks.every((block) => ['association', 'scope_declaration', 'input_declaration', 'command_declaration'].includes(block.disposition))) return 'binding';
  if (blocks.some((block) => block.disposition === 'evidence_requirement' ||
    ['direct_assertions', 'pass_criterion', 'fail_criterion', 'blocked_criterion', 'fail_or_blocked_criterion'].includes(block.fieldRole || ''))) return 'acceptance';
  // Explicit work units own their steps; their nested clauses are not extra tasks.
  const imperative = /^(?:[-*+]\s+)?(?:[A-Z][A-Z0-9-]+:\s*)?(?:(?:MUST|SHALL)\s+)?(?:implement|fix|create|add|modify|build)\b/iu;
  const chineseImperative = /^(?:[-*+]\s+)?(?:[A-Z][A-Z0-9-]+[:\uFF1A]\s*)?(?:\u5FC5\u987B)?(?:\u5B9E\u73B0|\u4FEE\u590D|\u65B0\u589E|\u4FEE\u6539|\u6784\u5EFA)/u;
  if (!hasDeclaredTasks && row.normativeStrength === 'must' && row.polarity === 'required' &&
    (imperative.test(row.exactText) || chineseImperative.test(row.exactText))) return 'action';
  return 'requirement';
}

function taskExecutionError(code: string, taskId: string) {
  const error = new Error(code) as Error & { failureClass: string; sourceTaskId: string };
  error.failureClass = code;
  error.sourceTaskId = taskId;
  return error;
}

export function declaredTaskExecution(row: TaskExecutionOwner, sourceBlocks: TaskExecutionSourceBlockInput[]) {
  const blocks: TaskExecutionSourceBlock[] = sourceBlocks.map((block) => ({
    id: String(block.id ?? ''), text: String(block.text ?? ''), disposition: String(block.disposition ?? ''),
    scope: { ownerId: typeof (block.scope as Record<string, unknown> | undefined)?.ownerId === 'string'
      ? (block.scope as Record<string, unknown>).ownerId as string : null },
    declaredId: typeof block.declaredId === 'string' ? block.declaredId : null,
    commandDeclarations: Array.isArray(block.commandDeclarations)
      ? block.commandDeclarations.filter((value): value is CommandDeclaration => !!value && typeof value === 'object' &&
        typeof (value as Record<string, unknown>).id === 'string') : [],
  }));
  const names = ['Execution Class', 'Owned Production Paths', 'Aggregate Gate Phase', 'Aggregate Validation Commands'];
  const fields = new Map<string, Array<{ value: string; sourceRef: string }>>(names.map((name) => [name, []]));
  const excluded = new Set(['metadata', 'layout', 'example', 'background', 'baseline_fact',
    'observed_deviation', 'observed_user_issue', 'historical_evidence', 'review_pending', 'unresolved']);
  for (const block of blocks) {
    if (block.scope.ownerId !== row.id || excluded.has(block.disposition)) continue;
    for (const line of block.text.split(/\r?\n/u)) {
      const match = /^\s*(?:[-*+]\s+)?\*{0,2}(Execution Class|Owned Production Paths|Aggregate Gate Phase|Aggregate Validation Commands)\s*[:\uFF1A]\*{0,2}\s*(\S.*?)\s*$/iu.exec(line);
      if (!match) continue;
      const name = names.find((value) => value.toLowerCase() === match[1].toLowerCase());
      if (name) fields.get(name)!.push({ value: match[2], sourceRef: block.id });
    }
  }
  if (!['Execution Class', 'Aggregate Gate Phase', 'Aggregate Validation Commands']
    .some((name) => fields.get(name)!.length)) return undefined;
  const value = (name: string): string | undefined => {
    const values = unique(fields.get(name)!.map((field) => field.value));
    if (values.length > 1) throw taskExecutionError('source_task_execution_role_ambiguous', row.id);
    return values[0];
  };
  const identifier = (input: string | undefined) => /^`([^`\r\n]+)`$/u.exec(input || '')?.[1] || input;
  const executionClass = identifier(value('Execution Class'));
  const ownedProductionPaths = value('Owned Production Paths');
  const aggregateGatePhase = identifier(value('Aggregate Gate Phase'));
  const aggregateValidationCommandsValue = value('Aggregate Validation Commands');
  if (executionClass !== 'executable_child' && executionClass !== 'aggregate_only') {
    throw taskExecutionError('source_task_execution_role_invalid', row.id);
  }
  if (executionClass === 'executable_child' && (!ownedProductionPaths || identifier(ownedProductionPaths) === 'none' || !Array.isArray(row.commandRefs) || row.commandRefs.length === 0)) {
    throw taskExecutionError('source_executable_task_contract_invalid', row.id);
  }
  const declaredAliases = [...String(aggregateValidationCommandsValue || '').matchAll(/`([^`\r\n]+)`/gu)].map((match) => match[1]);
  const commandBlocks = blocks.filter((block) => Boolean(block.declaredId) && declaredAliases.includes(block.declaredId!));
  const commandIds = commandBlocks.flatMap((block) => block.commandDeclarations || []).map((command) => command.id);
  const unresolved = declaredAliases.some((alias) => !blocks.some((block) => block.declaredId === alias &&
    (block.commandDeclarations?.length ?? 0) > 0));
  if (executionClass === 'aggregate_only' && (identifier(ownedProductionPaths) !== 'none' ||
    !['post_child_execution', 'final_aggregate'].includes(aggregateGatePhase || '') || !commandIds.length || unresolved ||
    commandIds.some((id) => !row.commandRefs.includes(id)))) {
    throw taskExecutionError('source_aggregate_task_contract_invalid', row.id);
  }
  return { executionClass, ownedProductionPaths,
    ...(aggregateGatePhase ? { aggregateGatePhase } : {}),
    ...(aggregateValidationCommandsValue ? { aggregateValidationCommandsValue,
      aggregateValidationCommands: unique(commandIds) } : {}),
    sourceRefs: unique([...fields.values()].flatMap((values) => values.map((field) => field.sourceRef))
      .concat(commandBlocks.map((block) => block.id))) };
}

export function attachSourceExecutionSemantics(obligations: SourceExecutionObligation[], sourceBlocks: SourceExecutionBlock[]) {
  const byBlock = new Map(sourceBlocks.map((block) => [block.id, block]));
  const knownIds = new Set(obligations.map((row) => row.id));
  const hasDeclaredTasks = obligations.some((row) => row.kind === 'declared_execution_task');
  return obligations.map((row) => {
    const blocks = row.sourceBlockRefs.map((ref) => {
      const block = byBlock.get(ref);
      if (!block) throw new Error('source_execution_provenance_missing');
      return block;
    });
    if (!blocks.length) throw new Error('source_execution_provenance_missing');
    const normativeClauses = blocks.flatMap((block) => block.clauses);
    const conditions = normativeClauses.flatMap((clause) => clause.conditions.map((condition) => ({
      text: condition.text, kind: condition.kind, state: 'unevaluated', sourceRefs: [...condition.sourceBlockRefs],
    })));
    const deduplicatedConditions = [...new Map(conditions.map((condition) => [JSON.stringify(condition), condition])).values()];
    const role = executionRole(row, blocks, hasDeclaredTasks);
    const taskExecution = role === 'action' ? declaredTaskExecution(row, sourceBlocks) : undefined;
    const provenanceRefs = unique([...row.sourceBlockRefs, ...(taskExecution?.sourceRefs || []),
      ...blocks.flatMap((block) => block.scope.ownerBlockRefs),
      ...normativeClauses.flatMap((clause) => clause.derivation.premiseBlockRefs),
      ...conditions.flatMap((condition) => condition.sourceRefs)]);
    if (provenanceRefs.some((ref) => !byBlock.has(ref))) throw new Error('source_execution_context_missing');
    const scopes = [...new Map(blocks.map((block) => [JSON.stringify(block.scope), block.scope])).values()];
    if (scopes.length !== 1) throw new Error('source_execution_scope_ambiguous');
    const sourceScope = scopes[0];
    const ownerId = sourceScope.ownerId;
    return { ...row, executionRole: role, ...(taskExecution ? { taskExecution } : {}),
      commandDeclarations: structuredClone(blocks.flatMap((block) => block.commandDeclarations ?? [])),
      conditions: deduplicatedConditions, normativeClauses: structuredClone(normativeClauses), provenanceRefs,
      applicability: ownerId && knownIds.has(ownerId)
        ? { scope: 'obligations', obligationRefs: [ownerId], sourceRefs: [...row.sourceBlockRefs], sourceScope: structuredClone(sourceScope) }
        : { scope: 'source_scope', sourceRefs: [...row.sourceBlockRefs], sourceScope: structuredClone(sourceScope) } };
  });
}

if (typeof module !== 'undefined') module.exports = { attachSourceExecutionSemantics, declaredTaskExecution };
