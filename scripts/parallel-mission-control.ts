export interface ParallelMissionNode {
  node_id: string;
  story_key: string;
  packet_id: string;
  write_scope: string[];
  protected_write_paths: string[];
  depends_on: string[];
  assigned_agent: string;
  target_branch: string;
  target_pr: string;
}

export interface ParallelMissionPlan {
  batch_id: string;
  nodes: ParallelMissionNode[];
  conflicts: Array<{
    scope: string;
    contenders: string[];
    resolution: 'serialize' | 'repartition' | 'block';
  }>;
  merge_order: string[];
  sprint_status_write_allowed: false;
}

export interface PrTopology {
  version: 1;
  batch_id: string;
  evidence_provenance?: {
    runId: string;
    storyKey: string;
    evidenceBundleId: string;
  };
  required_nodes: Array<{
    node_id: string;
    target_pr: string;
    depends_on: string[];
    state: 'open' | 'ready' | 'merged' | 'closed_not_needed' | 'blocked';
  }>;
  all_affected_stories_passed: boolean;
}

export const DEFAULT_PROTECTED_WRITE_PATHS = [
  '_bmad-output/implementation-artifacts/sprint-status.yaml',
  '_bmad/_config/orchestration-governance.contract.yaml',
  'docs/reference/runtime-policy-index.md',
  'schemas/',
  '.github/workflows/',
];

function intersects(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

export function buildParallelMissionPlan(input: {
  batchId: string;
  nodes: Omit<ParallelMissionNode, 'protected_write_paths'>[];
}): ParallelMissionPlan {
  const nodes = input.nodes.map((node) => ({
    ...node,
    protected_write_paths: DEFAULT_PROTECTED_WRITE_PATHS,
  }));
  const conflicts: ParallelMissionPlan['conflicts'] = [];

  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex];
      const right = nodes[rightIndex];
      const shared = intersects(left.write_scope, right.write_scope);
      const protectedShared = intersects(
        [...left.write_scope, ...right.write_scope],
        DEFAULT_PROTECTED_WRITE_PATHS
      );
      const hasDependency =
        left.depends_on.includes(right.node_id) || right.depends_on.includes(left.node_id);

      for (const scope of [...new Set([...shared, ...protectedShared])]) {
        conflicts.push({
          scope,
          contenders: [left.node_id, right.node_id],
          resolution: protectedShared.includes(scope) ? 'block' : hasDependency ? 'serialize' : 'serialize',
        });
      }
    }
  }

  const blocked = new Set(
    conflicts
      .filter((conflict) => conflict.resolution === 'block')
      .flatMap((conflict) => conflict.contenders)
  );
  const merge_order = nodes
    .filter((node) => !blocked.has(node.node_id))
    .sort((left, right) => left.depends_on.length - right.depends_on.length)
    .map((node) => node.node_id);

  return {
    batch_id: input.batchId,
    nodes,
    conflicts,
    merge_order,
    sprint_status_write_allowed: false,
  };
}

export function buildPrTopology(input: {
  plan: ParallelMissionPlan;
  states?: Record<string, PrTopology['required_nodes'][number]['state']>;
}): PrTopology {
  const required_nodes = input.plan.nodes.map((node) => ({
    node_id: node.node_id,
    target_pr: node.target_pr,
    depends_on: node.depends_on,
    state: input.states?.[node.node_id] ?? 'open',
  }));
  const all_affected_stories_passed = required_nodes.every((node) =>
    ['merged', 'closed_not_needed'].includes(node.state)
  );
  return {
    version: 1,
    batch_id: input.plan.batch_id,
    required_nodes,
    all_affected_stories_passed,
  };
}

export function validatePrTopologyForReleaseGate(topology: PrTopology): {
  passed: boolean;
  reason?: string;
} {
  const notClosed = topology.required_nodes.filter(
    (node) => !['merged', 'closed_not_needed'].includes(node.state)
  );
  if (topology.all_affected_stories_passed && notClosed.length > 0) {
    return {
      passed: false,
      reason: `PR topology claims passed while nodes are still open: ${notClosed
        .map((node) => node.node_id)
        .join(', ')}`,
    };
  }
  return { passed: true };
}
