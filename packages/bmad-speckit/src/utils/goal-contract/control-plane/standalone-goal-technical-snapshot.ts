import type { StandaloneGoalConstraintBinding, StandaloneGoalSemanticInput } from './standalone-goal-semantic-ir';
type JsonObject = Record<string, unknown>;
const objects = (value: unknown): JsonObject[] => Array.isArray(value) ? value as JsonObject[] : [];
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const strings = (value: unknown): string[] => Array.isArray(value) ? value as string[] : [];
const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};

function declarationRole(command: JsonObject, block: JsonObject, context: JsonObject[]): string {
  const invocation = text(command.invocation);
  const prefix = text(block.text).slice(0, text(block.text).indexOf(invocation));
  if (command.polarity === 'forbidden' || command.authorization === 'prohibited' ||
    /(?:禁止|不得|不允许|must not|do not|never)\s*`?$/iu.test(prefix)) return 'prohibited_command';
  if (block.disposition === 'example') return 'example_command';
  if (context.some((row) => row.normativeStrength === 'may' || row.normativeStrength === 'should')) return 'unselected_option';
  if (/\.{3}|<[^<>\r\n]+>/u.test(invocation)) return 'command_template';
  if (/^(?:\$env:[\w]+\s*=\s*[^;\r\n]+|(?:export\s+)?[A-Za-z_]\w*=\S+)\s*;?$/u.test(invocation)) return 'environment_setting';
  if (context.some((row) => objects(row.conditions).some((condition) => condition.kind === 'source_confirmation_gate')) ||
    /(?:contract|合同)\s*(?:author|作者)|authoring/iu.test(context.map((row) => text(row.text) || text(row.exactText)).join('\n'))) return 'authoring_command';
  if (['metadata', 'layout', 'baseline_fact', 'observed_deviation', 'observed_user_issue', 'historical_evidence', 'review_pending'].includes(text(block.disposition))) return 'source_reference';
  return 'verification_command';
}

export function standaloneTechnicalSnapshot(source: JsonObject, semanticRows: JsonObject[]): StandaloneGoalSemanticInput['technicalSnapshot'] {
  if (!Array.isArray(source.sourceBlocks) || !Array.isArray(source.sourceRelations)) {
    throw new Error('standalone_goal_source_provenance_missing');
  }
  const blocks = objects(source.sourceBlocks);
  const byBlock = new Map<string, JsonObject[]>();
  const byId = new Map(semanticRows.map((row) => [text(row.id), row]));
  const declaredScopeMembers = new Map<string, Set<string>>();
  for (const row of semanticRows) {
    for (const heading of strings(row.headingPath)) {
      const declaredId = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/u.exec(heading)?.[1];
      if (!declaredId) continue;
      const members = declaredScopeMembers.get(declaredId) ?? new Set<string>();
      members.add(text(row.id));
      declaredScopeMembers.set(declaredId, members);
    }
  }
  const resolveRelationRefs = (refs: string[]) => unique(refs.flatMap((ref) =>
    byId.has(ref) ? [ref] : [...(declaredScopeMembers.get(ref) ?? [])]
  ));
  const typed = semanticRows.some((row) => row.executionRole !== undefined);
  const actionIds = new Set(semanticRows.filter((row) => row.executionRole === 'action').map((row) => text(row.id)));
  const relations = objects(source.sourceRelations);
  const reverse = new Map<string, Set<string>>();
  for (const edge of relations) {
    if (edge.fromType !== 'obligation' || edge.toType !== 'obligation' ||
      !['acceptance', 'requirement', 'binding'].includes(text(edge.kind))) continue;
    const fromRefs = resolveRelationRefs([text(edge.fromId)]);
    const toRefs = resolveRelationRefs([text(edge.toId)]);
    for (const toRef of toRefs) {
      const refs = reverse.get(toRef) ?? new Set<string>();
      for (const fromRef of fromRefs) refs.add(fromRef);
      reverse.set(toRef, refs);
    }
  }
  const actionOwners = (refs: string[]) => {
    const seen = new Set<string>();
    const queue = [...refs];
    for (const ref of queue) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      if (!actionIds.has(ref)) queue.push(...(reverse.get(ref) ?? []));
    }
    return [...seen].filter((ref) => actionIds.has(ref));
  };
  for (const row of semanticRows) for (const ref of strings(row.sourceBlockRefs)) {
    const members = byBlock.get(ref) ?? [];
    members.push(row);
    byBlock.set(ref, members);
  }
  const bindings: StandaloneGoalConstraintBinding[] = [];
  const bind = (constraintId: string, blockRefs: string[], ownerRefs: string[], role?: string, explicitDeclarationSource?: JsonObject) => {
    const declaringRows = blockRefs.flatMap((ref) => byBlock.get(ref) ?? []);
    const resolvedOwnerRefs = resolveRelationRefs(ownerRefs);
    const declarationBlocks = blockRefs.map((ref) => blocks.find((block) => text(block.id) === ref)).filter(Boolean) as JsonObject[];
    const ownerRows = resolvedOwnerRefs.map((ref) => byId.get(ref)!);
    const declarationRefs = declarationBlocks.map((block) => object(block.sourceRef))
      .filter((ref) => text(ref.sourceSnapshotHash) && Number.isInteger(ref.startByte) && Number.isInteger(ref.endByteExclusive));
    if (explicitDeclarationSource && text(explicitDeclarationSource.sourceSnapshotHash)) {
      declarationRefs.push(explicitDeclarationSource);
    }
    const declarationHashes = unique(declarationRefs.map((ref) => text(ref.sourceSnapshotHash)));
    const declarationSource = declarationRefs.length > 0 && declarationHashes.length === 1 ? {
      schemaVersion: 'standalone-source-declaration-set/v1',
      sourceSnapshotHash: declarationHashes[0],
      sourceBlockRefs: unique(blockRefs),
      startByte: Math.min(...declarationRefs.map((ref) => Number(ref.startByte))),
      endByteExclusive: Math.max(...declarationRefs.map((ref) => Number(ref.endByteExclusive))),
    } : undefined;
    const sourceRows = declaringRows.length > 0 ? declaringRows : ownerRows;
    const unownedDeclaration = sourceRows.length === 0 && role && declarationSource;
    const sourceRefs = unique(sourceRows.length > 0
      ? sourceRows.flatMap((row) => strings(row.specSpanRefs))
      : unownedDeclaration ? blockRefs : []);
    if (!sourceRefs.length || (ownerRefs.length > 0 && resolvedOwnerRefs.length === 0)) {
      throw Object.assign(new Error('standalone_goal_source_relation_unresolved'), {
        constraintId,
        sourceBlockRefs: blockRefs,
        unresolvedOwnerRefs: ownerRefs.filter((ref) => !byId.has(ref) && !declaredScopeMembers.has(ref)),
      });
    }
    const declaringIds = declaringRows.map((row) => text(row.id));
    const context = [...declaringRows, ...declarationBlocks, ...ownerRows];
    const global = Boolean(role && !['authoring_command', 'example_command', 'source_reference'].includes(role)) && context.some((row) =>
      object(row.applicability).scope === 'global' ||
      /(?:required test commands|required commands|必需测试命令|必需命令)/iu.test(strings(row.headingPath).join(' ')) ||
      (object(object(row.applicability).sourceScope).kind === 'source_section' &&
        /(?:提交前检查|before (?:each |every )?commit|所有(?:任务|WORK)|每个(?:任务|WORK)|all tasks|every task)/iu.test(text(row.text) || text(row.exactText))));
    const executable = !role || role === 'verification_command' || role === 'evidence_requirement';
    const actions = typed ? global ? [...actionIds] : actionOwners([...declaringIds, ...resolvedOwnerRefs]) : [];
    bindings.push({ constraintId, sourceRefs, premiseRefs: sourceRefs,
      applicableMustRefs: unique([...declaringIds, ...resolvedOwnerRefs, ...actions]), scope: global ? 'global' : 'declared',
      ...(blockRefs.length ? { sourceDeclarationRefs: unique(blockRefs) } : {}),
      ...(declarationSource ? { declarationSource } : {}),
      ...(typed && role ? { coverageRole: executable && actions.length ? 'action_trace' : 'non_action_declaration',
        declarationRole: global && role === 'verification_command' ? 'global_verification_command' : role } : {}) });
  };
  const declarations = new Map<string, JsonObject>();
  const commandBlocks = new Map<string, string[]>();
  const excluded = new Set(['metadata', 'layout', 'example', 'baseline_fact', 'observed_deviation',
    'observed_user_issue', 'historical_evidence', 'review_pending']);
  for (const block of blocks) {
    if (!typed && excluded.has(text(block.disposition))) continue;
    for (const command of objects(block.commandDeclarations)) {
      const commandId = text(command.id);
      if (!commandId || !text(command.invocation) || declarations.has(commandId)) {
        throw new Error('standalone_goal_source_command_invalid');
      }
      declarations.set(commandId, command);
      commandBlocks.set(commandId, [text(block.id)]);
    }
  }
  const ownersFor = (edges: JsonObject[]) => unique(edges.filter((edge) => edge.fromType === 'obligation')
    .map((edge) => text(edge.fromId)));
  const pathEdges = new Map<string, JsonObject[]>();
  const commandEdges = new Map<string, JsonObject[]>();
  for (const edge of relations) {
    const target = edge.kind === 'path' ? pathEdges : edge.kind === 'command' ? commandEdges : null;
    if (!target) continue;
    const key = edge.kind === 'path' ? `${text(edge.pathRole)}:${text(edge.toId)}` : text(edge.toId);
    const members = target.get(key) ?? [];
    members.push(edge);
    target.set(key, members);
  }
  const paths = (role: string) => unique([...pathEdges.keys()].filter((key) => key.startsWith(`${role}:`))
    .map((key) => key.slice(role.length + 1)));
  const bindPath = (role: string, logicalPath: string, constraintId: string) => {
    const edges = pathEdges.get(`${role}:${logicalPath}`)!;
    bind(constraintId, unique(edges.flatMap((edge) => strings(edge.sourceBlockRefs))), ownersFor(edges));
  };
  const targetPaths = paths('owned');
  targetPaths.forEach((logicalPath, index) => bindPath('owned', logicalPath, `PATH-standalone-${index + 1}`));
  const forbiddenPaths = paths('forbidden');
  forbiddenPaths.forEach((logicalPath, index) => bindPath('forbidden', logicalPath, `STOP-standalone-${index + 1}`));
  const artifactRecords = paths('artifact').map((logicalPath, index) => {
    const artifactId = `ART-standalone-${index + 1}`;
    bindPath('artifact', logicalPath, artifactId);
    return { artifactId, logicalPath };
  });
  const commandRecords = [...declarations.keys()].sort().map((commandId) => {
    const edges = commandEdges.get(commandId) ?? [];
    const block = blocks.find((row) => row.id === commandBlocks.get(commandId)![0])!;
    const owners = resolveRelationRefs([
      ...ownersFor(edges),
      ...[text(object(block.scope).ownerId)].filter(Boolean),
    ]);
    const context = [...(byBlock.get(text(block.id)) ?? []), ...owners.map((ref) => byId.get(ref)!)];
    bind(commandId, unique([...commandBlocks.get(commandId)!, ...edges.flatMap((edge) => strings(edge.sourceBlockRefs))]), owners,
      declarationRole(declarations.get(commandId)!, block, context), object(declarations.get(commandId)!.sourceRef));
    return { commandId, invocation: String(declarations.get(commandId)!.invocation) };
  });
  const evidenceRecords = blocks.filter((block) => block.fieldRole === 'evidence' && !excluded.has(text(block.disposition)))
    .map((block) => {
      const evidenceContractId = `EVDREQ-${text(block.id)}`;
      const ownerId = text((block.scope as JsonObject | undefined)?.ownerId);
      bind(evidenceContractId, [text(block.id)], ownerId ? [ownerId] : [], 'evidence_requirement');
      return { evidenceContractId, requirement: String(block.text).trim() };
    });
  return { targetPaths, commandRecords, artifactRecords, evidenceRecords, forbiddenPaths,
    isolationMode: 'consumer_worktree', constraintBindings: bindings };
}
