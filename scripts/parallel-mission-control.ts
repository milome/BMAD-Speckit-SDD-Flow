import { sha256Object, validateSubagentEvidenceEnvelope } from './subagent-evidence-envelope';

type JsonObject = Record<string, unknown>;

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
    contractHash?: string;
    gateReportHash?: string;
  };
  required_nodes: Array<{
    node_id: string;
    target_pr: string;
    depends_on: string[];
    state: 'open' | 'ready' | 'merged' | 'closed_not_needed' | 'blocked';
  }>;
  all_affected_stories_passed: boolean;
}

export interface ParallelMissionEvidenceIntegrationInput {
  plan: ParallelMissionPlan;
  prTopology: PrTopology;
  nodeEvidence: Array<{
    node_id: string;
    envelope: JsonObject;
  }>;
  integratedVerification?: {
    closeoutAttemptId: string;
    workspaceRef: {
      kind: 'main_workspace' | 'worktree' | 'external_host';
      path: string;
      commitBefore?: string;
      commitAfter?: string;
    };
    commandRuns: JsonObject[];
    artifactRefs: JsonObject[];
  };
  currentCloseoutAttemptId: string;
  record?: JsonObject;
  projectRoot?: string;
  generatedAt?: string;
}

export interface ParallelMissionEvidenceIntegrationReport {
  reportType: 'parallel_mission_evidence_integration_report';
  schemaVersion: 'parallel-mission-evidence-integration/v1';
  generatedAt: string;
  decision: 'pass' | 'blocked';
  currentCloseoutAttemptId: string;
  batchId: string;
  allAffectedStoriesPassed: boolean;
  nodeResults: Array<{
    node_id: string;
    packet_id: string;
    prState: string;
    envelopeHash: string | null;
    passed: boolean;
    issues: string[];
  }>;
  mergeOrder: string[];
  conflictProof: Array<{
    scope: string;
    contenders: string[];
    resolution: string;
    passed: boolean;
    issues: string[];
  }>;
  integratedVerification: {
    passed: boolean;
    issues: string[];
    commandCount: number;
    artifactCount: number;
  };
  checks: Array<{ id: string; passed: boolean; issues: string[] }>;
  blockingReasons: string[];
  controlWrite: 'forbidden_use_controlled_ingest';
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

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function prState(topology: PrTopology, nodeId: string): string {
  return topology.required_nodes.find((node) => node.node_id === nodeId)?.state ?? '<missing>';
}

function nodeById(plan: ParallelMissionPlan): Map<string, ParallelMissionNode> {
  return new Map(plan.nodes.map((node) => [node.node_id, node]));
}

function mergeOrderIssues(plan: ParallelMissionPlan): string[] {
  const issues: string[] = [];
  const nodes = nodeById(plan);
  const orderIndex = new Map(plan.merge_order.map((nodeId, index) => [nodeId, index]));
  for (const node of plan.nodes) {
    const blocked = plan.conflicts.some((conflict) => conflict.resolution === 'block' && conflict.contenders.includes(node.node_id));
    if (!blocked && !orderIndex.has(node.node_id)) issues.push(`merge_order_missing_node:${node.node_id}`);
    for (const dependency of node.depends_on) {
      if (!nodes.has(dependency)) {
        issues.push(`dependency_unknown:${node.node_id}:${dependency}`);
        continue;
      }
      const dependencyIndex = orderIndex.get(dependency);
      const nodeIndex = orderIndex.get(node.node_id);
      if (dependencyIndex === undefined || nodeIndex === undefined || dependencyIndex >= nodeIndex) {
        issues.push(`merge_order_dependency_not_before_node:${dependency}->${node.node_id}`);
      }
    }
  }
  return issues;
}

function writeScopeIssues(plan: ParallelMissionPlan): string[] {
  const issues: string[] = [];
  const orderIndex = new Map(plan.merge_order.map((nodeId, index) => [nodeId, index]));
  for (let leftIndex = 0; leftIndex < plan.nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < plan.nodes.length; rightIndex += 1) {
      const left = plan.nodes[leftIndex];
      const right = plan.nodes[rightIndex];
      const shared = intersects(left.write_scope, right.write_scope);
      for (const scope of shared) {
        const conflict = plan.conflicts.find(
          (candidate) => candidate.scope === scope && left.node_id && right.node_id && left.node_id !== right.node_id &&
            left.node_id && right.node_id &&
            candidate.contenders.includes(left.node_id) &&
            candidate.contenders.includes(right.node_id)
        );
        if (!conflict) {
          issues.push(`write_scope_conflict_unresolved:${scope}:${left.node_id},${right.node_id}`);
          continue;
        }
        if (conflict.resolution === 'block') {
          issues.push(`write_scope_conflict_blocked:${scope}:${left.node_id},${right.node_id}`);
        }
        if (conflict.resolution === 'serialize') {
          const leftOrder = orderIndex.get(left.node_id);
          const rightOrder = orderIndex.get(right.node_id);
          if (leftOrder === undefined || rightOrder === undefined || leftOrder === rightOrder) {
            issues.push(`write_scope_conflict_serialization_order_missing:${scope}:${left.node_id},${right.node_id}`);
          }
        }
      }
    }
  }
  return issues;
}

function topologyIssues(plan: ParallelMissionPlan, topology: PrTopology): string[] {
  const issues: string[] = [];
  if (topology.batch_id !== plan.batch_id) issues.push('pr_topology_batch_id_mismatch');
  const planIds = new Set(plan.nodes.map((node) => node.node_id));
  const topologyIds = new Set(topology.required_nodes.map((node) => node.node_id));
  for (const id of planIds) {
    if (!topologyIds.has(id)) issues.push(`pr_topology_required_node_missing:${id}`);
  }
  for (const id of topologyIds) {
    if (!planIds.has(id)) issues.push(`pr_topology_unknown_node:${id}`);
  }
  const open = topology.required_nodes.filter((node) => !['merged', 'closed_not_needed'].includes(node.state));
  if (topology.all_affected_stories_passed && open.length > 0) {
    issues.push(`pr_topology_green_with_open_nodes:${open.map((node) => node.node_id).join(',')}`);
  }
  return issues;
}

function integratedVerificationIssues(input: ParallelMissionEvidenceIntegrationInput): string[] {
  const verification = input.integratedVerification;
  const issues: string[] = [];
  if (!verification) return ['integrated_verification_missing'];
  if (verification.closeoutAttemptId !== input.currentCloseoutAttemptId) {
    issues.push('integrated_verification_closeout_attempt_mismatch');
  }
  if (verification.workspaceRef?.kind !== 'main_workspace') {
    issues.push(`integrated_verification_workspace_not_main:${verification.workspaceRef?.kind || '<missing>'}`);
  }
  if (!text(verification.workspaceRef?.path)) issues.push('integrated_verification_workspace_path_missing');
  const commandRuns = objects(verification.commandRuns);
  const artifactRefs = objects(verification.artifactRefs);
  if (commandRuns.length === 0) issues.push('integrated_verification_command_runs_missing');
  if (artifactRefs.length === 0) issues.push('integrated_verification_artifact_refs_missing');
  for (const [index, run] of commandRuns.entries()) {
    if (text(run.closeoutAttemptId) !== input.currentCloseoutAttemptId) {
      issues.push(`integrated_verification_command_attempt_mismatch:${text(run.commandId) || index}`);
    }
    if (run.exitCode !== 0) issues.push(`integrated_verification_command_failed:${text(run.commandId) || index}`);
    if (objects(run.artifactRefs).length === 0) {
      issues.push(`integrated_verification_command_artifact_refs_missing:${text(run.commandId) || index}`);
    }
  }
  return issues;
}

function conflictProof(plan: ParallelMissionPlan): ParallelMissionEvidenceIntegrationReport['conflictProof'] {
  const orderIndex = new Map(plan.merge_order.map((nodeId, index) => [nodeId, index]));
  return plan.conflicts.map((conflict) => {
    const issues: string[] = [];
    if (conflict.resolution === 'block') issues.push(`conflict_resolution_block:${conflict.scope}`);
    if (conflict.resolution === 'serialize') {
      const positions = conflict.contenders.map((nodeId) => orderIndex.get(nodeId));
      if (positions.some((item) => item === undefined) || new Set(positions).size !== positions.length) {
        issues.push(`conflict_serialization_order_missing:${conflict.scope}`);
      }
    }
    return {
      scope: conflict.scope,
      contenders: conflict.contenders,
      resolution: conflict.resolution,
      passed: issues.length === 0,
      issues,
    };
  });
}

export function evaluateParallelMissionEvidenceIntegration(
  input: ParallelMissionEvidenceIntegrationInput
): ParallelMissionEvidenceIntegrationReport {
  const evidenceByNode = new Map(input.nodeEvidence.map((item) => [item.node_id, item.envelope]));
  const nodeResults = input.plan.nodes.map((node) => {
    const envelope = evidenceByNode.get(node.node_id);
    const issues: string[] = [];
    let envelopeHash: string | null = null;
    if (!envelope) {
      issues.push(`node_envelope_missing:${node.node_id}`);
    } else {
      const validation = validateSubagentEvidenceEnvelope(envelope, {
        record: input.record,
        projectRoot: input.projectRoot,
        indexedArtifactRefs: objects(envelope.artifactRefs),
        expectedParentCloseoutAttemptId: input.currentCloseoutAttemptId,
      });
      envelopeHash = validation.envelopeHash ?? sha256Object(envelope);
      issues.push(...validation.mismatches.map((issue) => `node_envelope_invalid:${node.node_id}:${issue}`));
      if (!validation.ok) issues.push(`node_envelope_not_accepted:${node.node_id}`);
      if (text(envelope.packetId) !== node.packet_id) issues.push(`node_packet_id_mismatch:${node.node_id}`);
      if (!strings(envelope.traceRows).length) issues.push(`node_trace_rows_missing:${node.node_id}`);
      if (!objects(envelope.commandRuns).some((run) => text(run.closeoutAttemptId) === input.currentCloseoutAttemptId && run.exitCode === 0)) {
        issues.push(`node_current_attempt_command_missing:${node.node_id}`);
      }
    }
    const state = prState(input.prTopology, node.node_id);
    if (!['merged', 'closed_not_needed'].includes(state)) issues.push(`node_not_closed:${node.node_id}:${state}`);
    return {
      node_id: node.node_id,
      packet_id: node.packet_id,
      prState: state,
      envelopeHash,
      passed: issues.length === 0,
      issues: [...new Set(issues)],
    };
  });
  for (const evidence of input.nodeEvidence) {
    if (!input.plan.nodes.some((node) => node.node_id === evidence.node_id)) {
      nodeResults.push({
        node_id: evidence.node_id,
        packet_id: '<unknown>',
        prState: '<unknown>',
        envelopeHash: evidence.envelope ? sha256Object(evidence.envelope) : null,
        passed: false,
        issues: [`node_evidence_unknown:${evidence.node_id}`],
      });
    }
  }

  const mergeIssues = mergeOrderIssues(input.plan);
  const scopeIssues = writeScopeIssues(input.plan);
  const prIssues = topologyIssues(input.plan, input.prTopology);
  const verificationIssues = integratedVerificationIssues(input);
  const conflicts = conflictProof(input.plan);
  const checks = [
    { id: 'node-envelopes-accepted', passed: nodeResults.every((node) => node.passed), issues: nodeResults.flatMap((node) => node.issues) },
    { id: 'write-scope-proof', passed: scopeIssues.length === 0 && conflicts.every((conflict) => conflict.passed), issues: [...scopeIssues, ...conflicts.flatMap((conflict) => conflict.issues)] },
    { id: 'merge-order-proof', passed: mergeIssues.length === 0, issues: mergeIssues },
    { id: 'pr-topology-reconciliation', passed: prIssues.length === 0, issues: prIssues },
    { id: 'main-workspace-integrated-verification', passed: verificationIssues.length === 0, issues: verificationIssues },
  ];
  const blockingReasons = [...new Set(checks.flatMap((check) => check.issues))];
  return {
    reportType: 'parallel_mission_evidence_integration_report',
    schemaVersion: 'parallel-mission-evidence-integration/v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    currentCloseoutAttemptId: input.currentCloseoutAttemptId,
    batchId: input.plan.batch_id,
    allAffectedStoriesPassed: input.prTopology.all_affected_stories_passed,
    nodeResults,
    mergeOrder: input.plan.merge_order,
    conflictProof: conflicts,
    integratedVerification: {
      passed: verificationIssues.length === 0,
      issues: verificationIssues,
      commandCount: objects(input.integratedVerification?.commandRuns).length,
      artifactCount: objects(input.integratedVerification?.artifactRefs).length,
    },
    checks,
    blockingReasons,
    controlWrite: 'forbidden_use_controlled_ingest',
  };
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
  evidence_provenance?: PrTopology['evidence_provenance'];
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
    ...(input.evidence_provenance ? { evidence_provenance: input.evidence_provenance } : {}),
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
  if (topology.all_affected_stories_passed && !topology.evidence_provenance?.runId) {
    return {
      passed: false,
      reason: 'PR topology claims passed without evidence_provenance.runId',
    };
  }
  return { passed: true };
}
