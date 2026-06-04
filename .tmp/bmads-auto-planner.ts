export interface BmadsAutoStoryNode {
  storyKey: string;
  epicKey: string;
  dependsOn: string[];
  writeScope: string[];
}

export interface BmadsAutoWavePlan {
  wave: number;
  mode: 'parallel' | 'serial';
  storyKeys: string[];
}

export interface BmadsAutoBoundaryInfo {
  normalizedWriteScope: string[];
  serialOnly: boolean;
  serialReasons: string[];
}

export interface BmadsAutoHostAssignment {
  assignedHost: 'codex' | 'cursor' | 'claude';
  assignmentReason: string;
  fallbackHosts: Array<'cursor' | 'claude'>;
  requiresTaskReport: true;
  wave: number;
}

export interface BmadsAutoPrTopologyPlan {
  strategy: 'single_story_pr' | 'epic_prs' | 'foundation_plus_story_prs' | 'integration_pr';
  blockedRealClosure: boolean;
  branches: Array<{
    prId: string;
    branchName: string;
    baseBranch: string;
    storyKeys: string[];
    dependsOn: string[];
    mergeOrder: number;
    requiredChecks: string[];
    reviewOwner: string;
    rollbackPlan: string;
  }>;
}

export interface BmadsAutoPlanResult {
  schemaVersion: 'bmads_auto_epic_story_plan/v1';
  resultCode:
    | 'OK'
    | 'BLOCKED_EMPTY_STORY_SET'
    | 'BLOCKED_INVALID_STORY_NODE'
    | 'BLOCKED_DUPLICATE_STORY_KEY'
    | 'BLOCKED_DAG_CYCLE'
    | 'BLOCKED_MISSING_DEPENDENCY'
    | 'BLOCKED_AMBIGUOUS_WRITE_SCOPE';
  storyNodes: BmadsAutoStoryNode[];
  waves: BmadsAutoWavePlan[];
  blockers: string[];
  epicDag: { nodes: Array<{ epicKey: string; storyKeys: string[] }>; edges: Array<{ from: string; to: string }> };
  parallelBoundaries: Record<string, BmadsAutoBoundaryInfo>;
  hostAssignments: Record<string, BmadsAutoHostAssignment>;
  prTopology: BmadsAutoPrTopologyPlan;
}

type ProtectedReason =
  | 'dependency_manifest'
  | 'lockfile'
  | 'root_config'
  | 'shared_schema'
  | 'shared_contract'
  | 'shared_types'
  | 'root_entry'
  | 'ci'
  | 'migration';

function normalizeScope(scope: string): string {
  return scope.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function scopePrefix(scope: string): string {
  const wildcard = scope.search(/[*?]/);
  if (wildcard < 0) return scope;
  return scope.slice(0, Math.max(scope.lastIndexOf('/', wildcard), wildcard)).replace(/\/$/, '');
}

function scopesOverlap(left: string, right: string): boolean {
  const a = normalizeScope(left);
  const b = normalizeScope(right);
  const aPrefix = scopePrefix(a);
  const bPrefix = scopePrefix(b);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`) || aPrefix.startsWith(`${bPrefix}/`) || bPrefix.startsWith(`${aPrefix}/`) || a.startsWith(bPrefix) || b.startsWith(aPrefix);
}

function intersects(left: string[], right: string[]): boolean {
  return left.some((l) => right.some((r) => scopesOverlap(l, r)));
}

function classifyScope(scope: string): ProtectedReason[] {
  const hit = (pattern: RegExp): boolean => pattern.test(scope);
  const reasons = new Set<ProtectedReason>();
  if (hit(/(^|\/)package\.json$/)) reasons.add('dependency_manifest');
  if (hit(/(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/)) reasons.add('lockfile');
  if (hit(/(^|\/)(tsconfig|turbo\.json|nx\.json|lerna\.json|vite\.config|vitest\.config|jest\.config|eslint|prettier|pnpm-workspace|\.npmrc|\.nvmrc)/)) reasons.add('root_config');
  if (hit(/(^|\/)(\.github|\.circleci|\.codex)\//)) reasons.add('ci');
  if (hit(/(^|\/)(schema|schemas)\b|\.schema\./)) reasons.add('shared_schema');
  if (hit(/(^|\/)contracts?\b/)) reasons.add('shared_contract');
  if (hit(/(^|\/)shared\/types\b|(^|\/)types\/|\.d\.ts$/)) reasons.add('shared_types');
  if (hit(/(^|\/)(migrations?|prisma)\//)) reasons.add('migration');
  if (hit(/(^|\/)src\/(index|main|app)\.[^/]+$|(^|\/)index\.(ts|tsx|js|jsx)$/)) reasons.add('root_entry');
  return [...reasons];
}

function findCycle(nodes: Map<string, BmadsAutoStoryNode>, remaining: Set<string>): string[] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const trail: string[] = [];
  const dfs = (storyKey: string): string[] | null => {
    visited.add(storyKey);
    stack.add(storyKey);
    trail.push(storyKey);
    for (const dependency of nodes.get(storyKey)?.dependsOn ?? []) {
      if (!remaining.has(dependency)) continue;
      if (!visited.has(dependency)) {
        const cycle = dfs(dependency);
        if (cycle) return cycle;
      } else if (stack.has(dependency)) {
        const start = trail.indexOf(dependency);
        return trail.slice(start).concat(dependency);
      }
    }
    stack.delete(storyKey);
    trail.pop();
    return null;
  };
  for (const storyKey of remaining) {
    if (!visited.has(storyKey)) {
      const cycle = dfs(storyKey);
      if (cycle) return cycle;
    }
  }
  return [];
}

export function buildBmadsAutoEpicStoryPlan(storyNodes: BmadsAutoStoryNode[]): BmadsAutoPlanResult {
  const nodes = storyNodes.map((node) => ({ ...node, dependsOn: [...node.dependsOn], writeScope: [...node.writeScope] }));
  const empty = { schemaVersion: 'bmads_auto_epic_story_plan/v1' as const, storyNodes: nodes, waves: [], blockers: [], epicDag: { nodes: [], edges: [] }, parallelBoundaries: {}, hostAssignments: {}, prTopology: { strategy: 'single_story_pr' as const, blockedRealClosure: true, branches: [] } };
  if (nodes.length === 0) return { ...empty, resultCode: 'BLOCKED_EMPTY_STORY_SET', blockers: ['BLOCKED_EMPTY_STORY_SET'] };

  const seenKeys = new Set<string>();
  const duplicateKeys = nodes.map((node) => node.storyKey).filter((storyKey) => (seenKeys.has(storyKey) ? true : !seenKeys.add(storyKey)));
  if (duplicateKeys.length > 0) return { ...empty, resultCode: 'BLOCKED_DUPLICATE_STORY_KEY', blockers: ['BLOCKED_DUPLICATE_STORY_KEY', ...duplicateKeys] };

  const nodeBlockers: string[] = [];
  const parallelBoundaries = Object.fromEntries(
    nodes.map((node) => {
      const normalizedScopes = node.writeScope.map(normalizeScope);
      const reasons = [...new Set(normalizedScopes.flatMap(classifyScope))];
      const duplicates = normalizedScopes.filter((scope, index) => scope && normalizedScopes.indexOf(scope) !== index);
      if (!node.storyKey.trim()) nodeBlockers.push(`index:${nodes.indexOf(node)}->EMPTY_STORY_KEY`);
      if (!node.epicKey.trim()) nodeBlockers.push(`${node.storyKey}->EMPTY_EPIC_KEY`);
      if (node.dependsOn.includes(node.storyKey)) nodeBlockers.push(`${node.storyKey}->SELF_DEPENDENCY`);
      if (normalizedScopes.length === 0) {
        nodeBlockers.push(node.storyKey);
        nodeBlockers.push(`${node.storyKey}->EMPTY_SCOPE`);
      }
      if (normalizedScopes.some((scope) => !scope)) nodeBlockers.push(`${node.storyKey}->EMPTY_SCOPE_ENTRY`);
      for (const dependency of node.dependsOn.filter((dep, index) => node.dependsOn.indexOf(dep) !== index)) nodeBlockers.push(`${node.storyKey}->DUPLICATE_DEPENDENCY:${dependency}`);
      for (const duplicate of [...new Set(duplicates)]) nodeBlockers.push(`${node.storyKey}->DUPLICATE_SCOPE:${duplicate}`);
      return [node.storyKey, { normalizedWriteScope: normalizedScopes.filter(Boolean), serialOnly: reasons.length > 0, serialReasons: reasons }];
    })
  ) as Record<string, BmadsAutoBoundaryInfo>;
  if (nodeBlockers.length > 0) {
    const hasInvalid = nodeBlockers.some((blocker) =>
      ['EMPTY_EPIC_KEY', 'EMPTY_STORY_KEY', 'SELF_DEPENDENCY', 'EMPTY_SCOPE_ENTRY'].some((token) =>
        blocker.includes(token)
      )
    );
    const ambiguous = !hasInvalid && nodeBlockers.some((blocker) => blocker.includes('SCOPE') || nodes.some((node) => blocker === node.storyKey));
    return { ...empty, resultCode: ambiguous ? 'BLOCKED_AMBIGUOUS_WRITE_SCOPE' : 'BLOCKED_INVALID_STORY_NODE', blockers: [...new Set(nodeBlockers)], parallelBoundaries };
  }

  const byKey = new Map(nodes.map((node) => [node.storyKey, node]));
  const missingDependencies = nodes.flatMap((node) => node.dependsOn.filter((dependency) => !byKey.has(dependency)).map((dependency) => `${node.storyKey}->${dependency}`));
  if (missingDependencies.length > 0) return { ...empty, resultCode: 'BLOCKED_MISSING_DEPENDENCY', blockers: ['BLOCKED_MISSING_DEPENDENCY', ...missingDependencies], parallelBoundaries };

  const remaining = new Set(nodes.map((node) => node.storyKey));
  const completed = new Set<string>();
  const waves: BmadsAutoWavePlan[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].map((storyKey) => byKey.get(storyKey)!).filter((node) => node.dependsOn.every((dependency) => completed.has(dependency)));
    if (ready.length === 0) {
      const cycle = findCycle(byKey, remaining);
      return { ...empty, resultCode: 'BLOCKED_DAG_CYCLE', blockers: ['BLOCKED_DAG_CYCLE', cycle.join('->')], parallelBoundaries };
    }
    const selected: BmadsAutoStoryNode[] = [];
    for (const candidate of ready) {
      const boundary = parallelBoundaries[candidate.storyKey];
      const selectedSerial = selected.some((node) => parallelBoundaries[node.storyKey].serialOnly);
      const selectedConflict = selected.some((node) => intersects(parallelBoundaries[node.storyKey].normalizedWriteScope, boundary.normalizedWriteScope));
      if (selected.length === 0 || (!boundary.serialOnly && !selectedSerial && !selectedConflict)) selected.push(candidate);
    }
    waves.push({ wave: waves.length + 1, mode: selected.length > 1 ? 'parallel' : 'serial', storyKeys: selected.map((node) => node.storyKey) });
    for (const node of selected) {
      remaining.delete(node.storyKey);
      completed.add(node.storyKey);
    }
  }

  const waveByStory = Object.fromEntries(waves.flatMap((wave) => wave.storyKeys.map((storyKey) => [storyKey, wave.wave])));
  const hostAssignments = Object.fromEntries(
    nodes.map((node) => [
      node.storyKey,
      {
        assignedHost: 'codex' as const,
        assignmentReason: parallelBoundaries[node.storyKey].serialOnly ? `serial_only:${parallelBoundaries[node.storyKey].serialReasons.join(',')}` : 'packet_driven_default',
        fallbackHosts: ['cursor', 'claude'] as Array<'cursor' | 'claude'>,
        requiresTaskReport: true as const,
        wave: waveByStory[node.storyKey],
      },
    ])
  ) as Record<string, BmadsAutoHostAssignment>;

  const epicDagNodes = [...new Map(nodes.map((node) => [node.epicKey, { epicKey: node.epicKey, storyKeys: [] as string[] }])).values()];
  for (const node of nodes) epicDagNodes.find((epic) => epic.epicKey === node.epicKey)?.storyKeys.push(node.storyKey);
  const epicEdges = [...new Set(nodes.flatMap((node) => node.dependsOn.map((dependency) => ({ from: byKey.get(dependency)!.epicKey, to: node.epicKey })).filter((edge) => edge.from !== edge.to).map((edge) => `${edge.from}->${edge.to}`)))].map((edge) => ({ from: edge.split('->')[0], to: edge.split('->')[1] }));

  const foundationStories = nodes.filter((node) => parallelBoundaries[node.storyKey].serialOnly).map((node) => node.storyKey);
  const strategy =
    nodes.length === 1 ? 'single_story_pr' : foundationStories.length > 0 ? 'foundation_plus_story_prs' : new Set(nodes.map((node) => node.epicKey)).size === 1 ? 'epic_prs' : 'integration_pr';
  const prIdByStory = Object.fromEntries(nodes.map((node) => [node.storyKey, `pr-${slug(node.storyKey)}`]));
  const prBranches =
    strategy === 'epic_prs'
      ? epicDagNodes.map((epic, index) => ({ prId: `pr-${slug(epic.epicKey)}`, branchName: `bmads/${slug(epic.epicKey)}`, baseBranch: 'main', storyKeys: epic.storyKeys, dependsOn: epicEdges.filter((edge) => edge.to === epic.epicKey).map((edge) => `pr-${slug(edge.from)}`), mergeOrder: index + 1, requiredChecks: ['tests', 'audit', 'taskreport'], reviewOwner: 'engineering', rollbackPlan: `revert-${slug(epic.epicKey)}` }))
      : nodes.map((node, index) => ({ prId: prIdByStory[node.storyKey], branchName: `bmads/${slug(node.storyKey)}`, baseBranch: 'main', storyKeys: [node.storyKey], dependsOn: strategy === 'foundation_plus_story_prs' && !foundationStories.includes(node.storyKey) ? foundationStories.map((storyKey) => prIdByStory[storyKey]) : node.dependsOn.map((dependency) => prIdByStory[dependency]).filter(Boolean), mergeOrder: index + 1, requiredChecks: ['tests', 'audit', 'taskreport'], reviewOwner: 'engineering', rollbackPlan: `revert-${slug(node.storyKey)}` }));

  return { schemaVersion: 'bmads_auto_epic_story_plan/v1', resultCode: 'OK', storyNodes: nodes, waves, blockers: [], epicDag: { nodes: epicDagNodes, edges: epicEdges }, parallelBoundaries, hostAssignments, prTopology: { strategy, blockedRealClosure: true, branches: prBranches } };
}
