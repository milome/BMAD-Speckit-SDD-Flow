import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  deactivateSiblingActiveMappings,
  findMappingsForRequirement,
  normalizeCandidateId,
  readUserStoryMappingIndexOrDefault,
  upsertUserStoryMappingItem,
  writeUserStoryMappingIndex,
  type UserStoryMappingFlow,
  type UserStoryMappingItem,
  type UserStoryMappingSourceType,
} from './user-story-mapping';
import { readOrchestrationGovernanceContract } from './orchestration-governance-contract';

export interface AdaptiveIntakeCandidate {
  requirementId: string;
  sourceType: UserStoryMappingSourceType;
  flow: UserStoryMappingFlow;
  sprintId?: string | null;
  epicId?: string | null;
  storyId?: string | null;
  summary?: string | null;
  changedPaths?: string[];
  acceptanceRefs?: string[];
  readiness?: {
    implementationReady?: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
  };
}

export interface AdaptiveIntakeRouteScore {
  route: Pick<
    UserStoryMappingItem,
    'requirementId' | 'epicId' | 'storyId' | 'flow' | 'sprintId' | 'allowedWriteScope' | 'status'
  >;
  scoreBreakdown: {
    domainFit: number;
    dependencyFit: number;
    sprintFit: number;
    riskFit: number;
    readinessFit: number;
    impact: number;
    dependency: number;
    capacity: number;
    weightedTotal: number;
  };
  reasons: string[];
}

export interface AdaptiveIntakeGateResult {
  candidate: AdaptiveIntakeCandidate;
  scoring: AdaptiveIntakeRouteScore[];
  consistency: Record<string, { passed: boolean; failed: string[] }>;
  decision: {
    verdict: 'pass' | 'warn' | 'block' | 'reroute';
    confidence: number;
    reason: string;
    route: AdaptiveIntakeRouteScore['route'] | null;
    queueSyncPath: string;
    draftPath: string | null;
    applied: boolean;
  };
}

interface SprintStatusSnapshot {
  developmentStatus: Record<string, string>;
  activeDemandCount: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .toLowerCase();
}

function globToRegExp(pattern: string): RegExp {
  const escaped = normalizePath(pattern).replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  const withStars = escaped.replace(/\*\*/g, '::DOUBLE_STAR::').replace(/\*/g, '[^/]*');
  return new RegExp(`^${withStars.replace(/::DOUBLE_STAR::/g, '.*')}$`, 'i');
}

function pathMatchesScope(filePath: string, scopes: string[]): boolean {
  const normalized = normalizePath(filePath);
  return scopes.some((scope) => globToRegExp(scope).test(normalized));
}

function readSprintStatusSnapshot(projectRoot: string): SprintStatusSnapshot {
  const file = path.join(
    projectRoot,
    '_bmad-output',
    'implementation-artifacts',
    'sprint-status.yaml'
  );
  if (!fs.existsSync(file)) {
    return { developmentStatus: {}, activeDemandCount: 0 };
  }
  const parsed = (yaml.load(fs.readFileSync(file, 'utf8')) ?? {}) as {
    development_status?: Record<string, string>;
  };
  const developmentStatus = parsed.development_status ?? {};
  const activeDemandCount = Object.values(developmentStatus).filter(
    (status) => status !== 'done' && status !== 'optional'
  ).length;
  return { developmentStatus, activeDemandCount };
}

function scoreRoute(
  candidate: AdaptiveIntakeCandidate,
  route: UserStoryMappingItem,
  sprint: SprintStatusSnapshot,
  requirementMappings: UserStoryMappingItem[],
  weights: ReturnType<
    typeof readOrchestrationGovernanceContract
  >['adaptiveIntakeGovernanceGate']['matchScoring']
): AdaptiveIntakeRouteScore {
  const storyMatch = candidate.storyId != null && candidate.storyId === route.storyId;
  const epicMatch = candidate.epicId != null && candidate.epicId === route.epicId;
  const exactRequirement = route.requirementId === candidate.requirementId;
  const dependencyHits = (candidate.changedPaths ?? []).filter((file) =>
    pathMatchesScope(file, route.allowedWriteScope)
  ).length;
  const dependencyFit =
    (candidate.changedPaths?.length ?? 0) === 0
      ? storyMatch || epicMatch
        ? 0.8
        : 0.5
      : dependencyHits / Math.max(1, candidate.changedPaths?.length ?? 1);
  const sprintStatus =
    sprint.developmentStatus[route.storyId] ?? sprint.developmentStatus[route.epicId];
  const domainFit = clamp01(
    (storyMatch ? 0.6 : 0.25) + (epicMatch ? 0.25 : 0) + (exactRequirement ? 0.15 : 0)
  );
  const sprintFit = clamp01(
    (candidate.sprintId === route.sprintId ? 0.8 : 0) +
      (sprintStatus && sprintStatus !== 'done' ? 0.2 : sprintStatus === 'done' ? -0.2 : 0)
  );
  const riskPenalty =
    candidate.readiness?.riskLevel === 'high'
      ? 0.35
      : candidate.readiness?.riskLevel === 'medium'
        ? 0.15
        : 0;
  const siblingConflict = requirementMappings.some(
    (item) =>
      item.storyId !== route.storyId && (item.status === 'planned' || item.status === 'in_progress')
  );
  const riskFit = clamp01(
    (route.status === 'done' ? 0.35 : route.status === 'blocked' ? 0.45 : 0.9) -
      riskPenalty -
      (siblingConflict ? 0.15 : 0)
  );
  const readinessFit = clamp01(
    (candidate.readiness?.implementationReady === false ? 0.15 : 0.85) -
      (route.status === 'done' ? 0.25 : 0)
  );
  const weightedTotal =
    domainFit * weights.domainFit +
    dependencyFit * weights.dependencyFit +
    sprintFit * weights.sprintFit +
    riskFit * weights.riskFit +
    readinessFit * weights.readinessFit;

  return {
    route: {
      requirementId: route.requirementId,
      epicId: route.epicId,
      storyId: route.storyId,
      flow: route.flow,
      sprintId: route.sprintId,
      allowedWriteScope: route.allowedWriteScope,
      status: route.status,
    },
    scoreBreakdown: {
      domainFit,
      dependencyFit,
      sprintFit,
      riskFit,
      readinessFit,
      impact: domainFit,
      dependency: dependencyFit,
      capacity: sprintFit,
      weightedTotal: Number(weightedTotal.toFixed(4)),
    },
    reasons: [
      storyMatch ? 'story hint matched' : 'story hint not matched',
      epicMatch ? 'epic hint matched' : 'epic hint not matched',
      exactRequirement ? 'existing requirement mapping reused' : 'new route candidate',
      dependencyHits > 0
        ? `changed paths matched ${dependencyHits} scoped entries`
        : 'no scoped path match',
      candidate.sprintId === route.sprintId
        ? 'candidate sprint aligned'
        : 'candidate sprint misaligned',
    ],
  };
}

function decideVerdict(
  candidate: AdaptiveIntakeCandidate,
  topScore: AdaptiveIntakeRouteScore | null,
  requirementMappings: UserStoryMappingItem[],
  queueSyncPath: string,
  thresholds: ReturnType<
    typeof readOrchestrationGovernanceContract
  >['adaptiveIntakeGovernanceGate']['decisionThresholds']
): AdaptiveIntakeGateResult['decision'] {
  const mappingConsistency: string[] = [];
  const lifecycleConsistency: string[] = [];
  const sprintConsistency: string[] = [];

  if (requirementMappings.length > 1) {
    mappingConsistency.push('requirement_to_story_unique_active');
  }
  if (topScore && topScore.route.allowedWriteScope.length === 0) {
    mappingConsistency.push('allowed_write_scope_consistent');
  }
  if (topScore && topScore.route.flow !== candidate.flow) {
    mappingConsistency.push('flow_to_story_type_consistent');
  }
  if (topScore && topScore.route.status === 'done') {
    lifecycleConsistency.push('orchestration_state_aligned_with_mapping_status');
  }
  if (!candidate.sprintId || (topScore && candidate.sprintId !== topScore.route.sprintId)) {
    sprintConsistency.push('sprint_id_valid');
  }
  if (queueSyncPath === '') {
    sprintConsistency.push('backlog_sync_record_present');
  }

  const hasFailure =
    mappingConsistency.length > 0 ||
    lifecycleConsistency.length > 0 ||
    sprintConsistency.length > 0;
  const currentActive = requirementMappings[0]?.storyId ?? null;
  const routeChanged =
    currentActive != null && topScore != null && topScore.route.storyId !== currentActive;
  const needsDraft = topScore == null;

  return {
    verdict: hasFailure
      ? 'block'
      : needsDraft
        ? 'warn'
        : routeChanged
          ? 'reroute'
          : topScore != null &&
              topScore.scoreBreakdown.weightedTotal >= thresholds.minConfidenceForAutoMatch
            ? 'pass'
            : topScore != null &&
                topScore.scoreBreakdown.weightedTotal >= thresholds.minConfidenceForWarn
              ? 'warn'
              : 'block',
    confidence: topScore?.scoreBreakdown.weightedTotal ?? 0,
    reason: hasFailure
      ? [...mappingConsistency, ...lifecycleConsistency, ...sprintConsistency].join(', ')
      : needsDraft
        ? 'draft_pending_readiness_required'
        : routeChanged
          ? 'existing active mapping must reroute through the unified main loop'
          : topScore != null &&
              topScore.scoreBreakdown.weightedTotal >= thresholds.minConfidenceForAutoMatch
            ? 'adaptive intake route satisfied auto-match threshold'
            : topScore != null &&
                topScore.scoreBreakdown.weightedTotal >= thresholds.minConfidenceForWarn
              ? 'adaptive intake route is matchable but below auto-match threshold'
              : 'adaptive intake route confidence is below governance threshold',
    route: topScore?.route ?? null,
    queueSyncPath,
    draftPath: null,
    applied: false,
  };
}

function queueSyncPath(projectRoot: string, requirementId: string): string {
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'adaptive-intake-queue-sync',
    `${normalizeCandidateId(requirementId)}.json`
  );
}

function writeQueueSyncArtifact(projectRoot: string, result: AdaptiveIntakeGateResult): string {
  const file = queueSyncPath(projectRoot, result.candidate.requirementId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return file;
}

function writeDraftArtifact(projectRoot: string, candidate: AdaptiveIntakeCandidate): string {
  const file = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'adaptive-intake-drafts',
    `${normalizeCandidateId(candidate.requirementId)}.json`
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        requirementId: candidate.requirementId,
        flow: candidate.flow,
        epicId: candidate.epicId ?? null,
        storyId: candidate.storyId ?? null,
        sprintId: candidate.sprintId ?? null,
        status: 'draft_pending_readiness',
        changedPaths: candidate.changedPaths ?? [],
        summary: candidate.summary ?? null,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  return file;
}

function applyDecision(
  projectRoot: string,
  result: AdaptiveIntakeGateResult
): AdaptiveIntakeGateResult {
  if (result.decision.route == null || result.decision.verdict === 'block') {
    return result;
  }
  const current = readUserStoryMappingIndexOrDefault(projectRoot);
  const nextRoute: UserStoryMappingItem = {
    requirementId: result.candidate.requirementId,
    sourceType: result.candidate.sourceType,
    epicId: result.decision.route.epicId,
    storyId: result.decision.route.storyId,
    flow: result.candidate.flow,
    sprintId: result.candidate.sprintId ?? result.decision.route.sprintId,
    allowedWriteScope: result.decision.route.allowedWriteScope,
    status: 'planned',
    acceptanceRefs: result.candidate.acceptanceRefs ?? [],
    lastPacketId: null,
  };
  const deactivated = deactivateSiblingActiveMappings(
    current,
    nextRoute.requirementId,
    nextRoute.storyId
  );
  const updated = upsertUserStoryMappingItem(deactivated, nextRoute);
  writeUserStoryMappingIndex(projectRoot, updated);
  return {
    ...result,
    decision: {
      ...result.decision,
      applied: true,
    },
  };
}

export function runAdaptiveIntakeGovernanceGate(
  projectRoot: string,
  candidate: AdaptiveIntakeCandidate,
  options: { apply?: boolean } = {}
): AdaptiveIntakeGateResult {
  const contract = readOrchestrationGovernanceContract(projectRoot);
  const mappingIndex = readUserStoryMappingIndexOrDefault(projectRoot);
  const sprint = readSprintStatusSnapshot(projectRoot);
  const requirementMappings = findMappingsForRequirement(
    mappingIndex,
    candidate.requirementId
  ).filter((item) => item.status === 'planned' || item.status === 'in_progress');
  const scoring = mappingIndex.items
    .filter((item) => item.flow === candidate.flow)
    .map((item) =>
      scoreRoute(
        candidate,
        item,
        sprint,
        requirementMappings,
        contract.adaptiveIntakeGovernanceGate.matchScoring
      )
    )
    .sort((left, right) => {
      if (right.scoreBreakdown.weightedTotal !== left.scoreBreakdown.weightedTotal) {
        return right.scoreBreakdown.weightedTotal - left.scoreBreakdown.weightedTotal;
      }
      return left.route.storyId.localeCompare(right.route.storyId);
    });

  const initial: AdaptiveIntakeGateResult = {
    candidate,
    scoring,
    consistency: {
      mappingConsistency: { passed: true, failed: [] },
      lifecycleConsistency: { passed: true, failed: [] },
      sprintConsistency: { passed: true, failed: [] },
    },
    decision: decideVerdict(
      candidate,
      scoring[0] ?? null,
      requirementMappings,
      queueSyncPath(projectRoot, candidate.requirementId),
      contract.adaptiveIntakeGovernanceGate.decisionThresholds
    ),
  };

  initial.consistency.mappingConsistency.failed = initial.decision.reason
    .split(', ')
    .filter((value) =>
      [
        'requirement_to_story_unique_active',
        'allowed_write_scope_consistent',
        'flow_to_story_type_consistent',
      ].includes(value)
    );
  initial.consistency.lifecycleConsistency.failed = initial.decision.reason
    .split(', ')
    .filter((value) => ['orchestration_state_aligned_with_mapping_status'].includes(value));
  initial.consistency.sprintConsistency.failed = initial.decision.reason
    .split(', ')
    .filter((value) => ['sprint_id_valid', 'backlog_sync_record_present'].includes(value));
  initial.consistency.mappingConsistency.passed =
    initial.consistency.mappingConsistency.failed.length === 0;
  initial.consistency.lifecycleConsistency.passed =
    initial.consistency.lifecycleConsistency.failed.length === 0;
  initial.consistency.sprintConsistency.passed =
    initial.consistency.sprintConsistency.failed.length === 0;

  if (initial.decision.reason === 'draft_pending_readiness_required') {
    initial.decision.draftPath = writeDraftArtifact(projectRoot, candidate);
  }

  const applied = options.apply ? applyDecision(projectRoot, initial) : initial;
  const reportPath = writeQueueSyncArtifact(projectRoot, applied);
  return {
    ...applied,
    decision: {
      ...applied.decision,
      queueSyncPath: reportPath,
    },
  };
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--')) {
      out[token.slice(2)] = argv[index + 1]?.startsWith('--') ? 'true' : (argv[++index] ?? 'true');
    }
  }
  return out;
}

export function mainAdaptiveIntakeGovernanceGate(argv: string[]): number {
  const args = parseArgs(argv);
  const projectRoot = path.resolve(args.cwd ?? process.cwd());
  const inputPath = args.input ? path.resolve(projectRoot, args.input) : null;
  if (
    !args.payload &&
    (!inputPath || !fs.existsSync(inputPath) || fs.statSync(inputPath).isDirectory())
  ) {
    process.stdout.write(
      `${JSON.stringify(
        {
          skipped: true,
          reason: 'adaptive intake candidate not provided',
        },
        null,
        2
      )}\n`
    );
    return 0;
  }
  const candidate = JSON.parse(
    args.payload ?? fs.readFileSync(inputPath as string, 'utf8')
  ) as AdaptiveIntakeCandidate;
  const result = runAdaptiveIntakeGovernanceGate(projectRoot, candidate, {
    apply: args.apply === 'true',
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.decision.verdict === 'block' ? 1 : 0;
}

function isAdaptiveIntakeGovernanceGateEntry(entry: string | undefined): boolean {
  return /(^|[\\/])adaptive-intake-governance-gate(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

if (require.main === module && isAdaptiveIntakeGovernanceGateEntry(process.argv[1])) {
  process.exit(mainAdaptiveIntakeGovernanceGate(process.argv.slice(2)));
}
