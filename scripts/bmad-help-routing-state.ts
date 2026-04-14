import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  readRuntimeContext,
  type RuntimeContextFile,
} from '../packages/runtime-context/src/context';
import type {
  ContextMaturity,
  ContextMaturityEvidence,
  RuntimeSourceMode,
} from '../packages/runtime-context/src/types';
import {
  listGovernancePacketExecutionRecords,
  type GovernancePacketExecutionRecord,
} from './governance-packet-execution-store';
import {
  deriveBmadHelpComplexity,
  deriveBmadHelpContextMaturity,
  deriveImplementationReadinessStatus,
  implementationReadinessPassed,
  shouldUpgradeStandaloneTasksToStory,
  resolveRuntimePolicy,
  type BmadHelpComplexity,
  type BmadHelpComplexityFactors,
  type ImplementationReadinessEvidence,
  type ImplementationReadinessStatus,
  type ResolveRuntimePolicyInput,
  type RuntimeFlowId,
  type RuntimePolicy,
} from './runtime-governance';
import type { RuntimeConfig, StageName } from './bmad-config';
import { readRegistryOrDefault, syncAuditIndexFromAllReports } from './runtime-context-registry';
import {
  buildReviewerContractProjection,
  mapFlowStageToReviewerAuditEntryStage,
} from './reviewer-registry';

const READINESS_REPORT_PATTERN = /^implementation-readiness-report-\d{4}-\d{2}-\d{2}\.md$/i;
const IMPLEMENTATION_GATE_NAME = 'implementation-readiness' as const;
const ACTIVE_REMEDIATION_STATUSES = new Set([
  'pending_dispatch',
  'leased',
  'running',
  'awaiting_rerun_gate',
  'retry_pending',
]);
const READY_STATUSES = new Set(['READY']);
const BLOCKED_STATUSES = new Set(['NEEDS WORK', 'NOT READY']);

export interface BmadHelpRoutingEvidenceSources {
  readinessReportPath: string | null;
  remediationArtifactPath: string | null;
  executionRecordPath: string | null;
}

export interface BmadHelpRoutingState {
  sourceMode: RuntimeSourceMode | null;
  contextMaturity: ContextMaturity;
  complexity: BmadHelpComplexity;
  complexityScore: number;
  complexityForcedReasons: string[];
  implementationReadinessStatus: ImplementationReadinessStatus;
  implementationEntryRecommended: boolean;
  shouldUpgradeStandaloneTasks: boolean;
  recommendedFlow: RuntimeFlowId;
  recommendationLabel: 'recommended' | 'allowed but not recommended' | 'blocked';
  canonicalImplementationGate: typeof IMPLEMENTATION_GATE_NAME;
  evidence: {
    contextMaturity: ContextMaturityEvidence;
    implementationReadiness: ImplementationReadinessEvidence;
    complexityFactors: BmadHelpComplexityFactors;
  };
  evidenceSources: BmadHelpRoutingEvidenceSources;
  executionRecordId: string | null;
}

export interface ResolveBmadHelpRoutingStateInput {
  projectRoot?: string;
  runtimeContext?: Partial<RuntimeContextFile> | null;
  runtimeContextPath?: string;
  flow: RuntimeFlowId;
  stage: StageName;
  config?: RuntimeConfig;
  sourceMode?: RuntimeSourceMode;
  contextMaturityEvidence?: Partial<ContextMaturityEvidence>;
  implementationReadinessEvidence?: Partial<ImplementationReadinessEvidence>;
  complexityFactors?: Partial<BmadHelpComplexityFactors>;
  basePolicy?: RuntimePolicy;
  epicId?: string;
  storyId?: string;
  storySlug?: string;
  runId?: string;
  artifactRoot?: string;
  contextSource?: string;
}

export type RuntimePolicyWithBmadHelp = RuntimePolicy & {
  contextMaturity: ContextMaturity;
  complexity: BmadHelpComplexity;
  implementationReadinessStatus: ImplementationReadinessStatus;
  implementationEntryRecommended: boolean;
  helpRouting: BmadHelpRoutingState;
  reviewerContract: ReturnType<typeof buildReviewerContractProjection>;
};

interface LatestReadinessReportSummary {
  reportPath: string;
  overallStatus: 'READY' | 'NEEDS WORK' | 'NOT READY' | null;
  blockerCount: number;
}

interface AuditFactSummary {
  artifactDocPath: string | null;
  reportPath: string | null;
  stage: 'bugfix' | 'standalone_tasks' | null;
  auditPassed: boolean | null;
  closeoutApproved: boolean | null;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function dateSortValue(filePath: string): number {
  const match = path.basename(filePath).match(/(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const time = Date.parse(`${match[1]}T00:00:00Z`);
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function listReadinessReports(projectRoot?: string): string[] {
  if (!projectRoot) {
    return [];
  }
  const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  if (!fs.existsSync(planningRoot)) {
    return [];
  }
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (READINESS_REPORT_PATTERN.test(entry.name)) {
        found.push(fullPath);
      }
    }
  };
  walk(planningRoot);
  return found.sort((left, right) => dateSortValue(right) - dateSortValue(left));
}

function pathSegments(value: string): string[] {
  return value
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function sharedPathScore(left: string, right: string): number {
  const leftSegments = pathSegments(path.normalize(left).toLowerCase());
  const rightSegments = pathSegments(path.normalize(right).toLowerCase());
  let score = 0;
  let leftIndex = leftSegments.length - 1;
  let rightIndex = rightSegments.length - 1;

  while (leftIndex >= 0 && rightIndex >= 0) {
    if (leftSegments[leftIndex] !== rightSegments[rightIndex]) {
      break;
    }
    score += 1;
    leftIndex -= 1;
    rightIndex -= 1;
  }
  return score;
}

function fileContainsAnyPattern(filePath: string, patterns: RegExp[]): boolean {
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  return patterns.some((pattern) => pattern.test(text));
}

function selectBestScopedPath(
  candidates: string[],
  hints: Array<string | undefined | null>
): string | null {
  if (candidates.length === 0) {
    return null;
  }

  const normalizedHints = hints
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .map((value) => path.normalize(value));

  const scored = candidates.map((candidate) => {
    const candidatePath = path.normalize(candidate);
    const candidateLower = candidatePath.toLowerCase();
    let score = 0;

    for (const hint of normalizedHints) {
      const hintLower = hint.toLowerCase();
      if (!hintLower) {
        continue;
      }
      if (candidateLower.includes(hintLower)) {
        score += 1000;
      }
      score += sharedPathScore(candidatePath, hint) * 10;
    }

    return { candidate, score, sortValue: dateSortValue(candidate) };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return right.sortValue - left.sortValue;
  });

  return scored[0]?.candidate ?? null;
}

function readMarkdownSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `^##\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`,
    'im'
  );
  const match = markdown.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function parseOverallReadinessStatus(
  markdown: string
): LatestReadinessReportSummary['overallStatus'] {
  const match = markdown.match(
    /^###\s+Overall Readiness Status\s*$\s*^(READY|NEEDS WORK|NOT READY)$/im
  );
  return (match?.[1] as LatestReadinessReportSummary['overallStatus']) ?? null;
}

function parseBlockerCount(markdown: string): number {
  const metricMatch = markdown.match(/^- Blocker count:\s*(\d+)\s*$/im);
  if (metricMatch) {
    return Number(metricMatch[1]);
  }
  const section = readMarkdownSection(markdown, 'Blockers Requiring Immediate Action');
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') && !/^- none$/i.test(line));
  return lines.length;
}

function readLatestReadinessReport(projectRoot?: string): LatestReadinessReportSummary | null {
  const reportPath = listReadinessReports(projectRoot)[0];
  if (!reportPath) {
    return null;
  }
  const markdown = fs.readFileSync(reportPath, 'utf8');
  return {
    reportPath,
    overallStatus: parseOverallReadinessStatus(markdown),
    blockerCount: parseBlockerCount(markdown),
  };
}

function resolveScopedReadinessReport(
  projectRoot: string | undefined,
  runtimeContext: Partial<RuntimeContextFile> | null
): LatestReadinessReportSummary | null {
  const reports = listReadinessReports(projectRoot);
  if (reports.length === 0) {
    return null;
  }

  const scopedReportPath = selectBestScopedPath(reports, [
    runtimeContext?.artifactRoot,
    runtimeContext?.artifactPath,
    runtimeContext?.runId,
    runtimeContext?.storyId,
    runtimeContext?.epicId,
  ]);
  if (!scopedReportPath) {
    return readLatestReadinessReport(projectRoot);
  }

  const markdown = fs.readFileSync(scopedReportPath, 'utf8');
  return {
    reportPath: scopedReportPath,
    overallStatus: parseOverallReadinessStatus(markdown),
    blockerCount: parseBlockerCount(markdown),
  };
}

function remediationPathFromReport(reportPath: string | null): string | null {
  if (!reportPath) {
    return null;
  }
  const remediationPath = reportPath.replace(
    /implementation-readiness-report-/i,
    'implementation-readiness-remediation-'
  );
  return fs.existsSync(remediationPath) ? remediationPath : null;
}

function selectExecutionRecord(
  projectRoot: string | undefined,
  remediationArtifactPath: string | null,
  runtimeContext: Partial<RuntimeContextFile> | null
): GovernancePacketExecutionRecord | null {
  if (!projectRoot) {
    return null;
  }

  const records = listGovernancePacketExecutionRecords(projectRoot)
    .filter((record) => record.rerunGate === IMPLEMENTATION_GATE_NAME)
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt || right.createdAt || '') -
        Date.parse(left.updatedAt || left.createdAt || '')
    );

  if (remediationArtifactPath) {
    const matched = records.find(
      (record) => normalizeText(record.artifactPath) === normalizeText(remediationArtifactPath)
    );
    if (matched) {
      return matched;
    }
  }

  const hintedRecords = records.filter((record) => {
    if (runtimeContext?.runId && record.loopStateId.includes(runtimeContext.runId)) {
      return true;
    }
    if (
      runtimeContext?.storyId &&
      normalizeText(record.artifactPath)
        .toLowerCase()
        .includes(runtimeContext.storyId.toLowerCase())
    ) {
      return true;
    }
    if (
      runtimeContext?.artifactRoot &&
      record.artifactPath &&
      sharedPathScore(record.artifactPath, runtimeContext.artifactRoot) > 0
    ) {
      return true;
    }
    return false;
  });

  return hintedRecords[0] ?? null;
}

function findImplementationArtifactDocs(
  projectRoot: string | undefined,
  patterns: RegExp[]
): string[] {
  if (!projectRoot) {
    return [];
  }
  const root = path.join(projectRoot, '_bmad-output', 'implementation-artifacts');
  if (!fs.existsSync(root)) {
    return [];
  }
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) {
        continue;
      }
      if (fileContainsAnyPattern(fullPath, patterns)) {
        found.push(fullPath);
      }
    }
  };
  walk(root);
  return found.sort((left, right) => dateSortValue(right) - dateSortValue(left));
}

function resolveAuditFactSummary(input: {
  projectRoot?: string;
  flow: RuntimeFlowId;
  runtimeContext: Partial<RuntimeContextFile> | null;
}): AuditFactSummary {
  if (input.flow !== 'bugfix' && input.flow !== 'standalone_tasks') {
    return {
      artifactDocPath: null,
      reportPath: null,
      stage: null,
      auditPassed: null,
      closeoutApproved: null,
    };
  }

  if (!input.projectRoot) {
    return {
      artifactDocPath: null,
      reportPath: null,
      stage: null,
      auditPassed: false,
      closeoutApproved: false,
    };
  }

  syncAuditIndexFromAllReports(input.projectRoot);
  const registry = readRegistryOrDefault(input.projectRoot);
  const currentArtifactPath = selectBestScopedPath(Object.keys(registry.auditIndex[input.flow]), [
    input.runtimeContext?.artifactPath,
    input.runtimeContext?.artifactRoot,
    input.runtimeContext?.storyId,
    input.runtimeContext?.runId,
  ]);

  if (!currentArtifactPath) {
    return {
      artifactDocPath: null,
      reportPath: null,
      stage: null,
      auditPassed: false,
      closeoutApproved: false,
    };
  }

  const entry = registry.auditIndex[input.flow][path.normalize(currentArtifactPath)];
  const expectedStage = input.flow;
  const closeoutApproved = entry?.closeoutApproved === true && entry?.stage === expectedStage;
  return {
    artifactDocPath: entry?.artifactDocPath ?? null,
    reportPath: entry?.reportPath ?? null,
    stage: entry?.stage ?? null,
    auditPassed: entry?.status === 'PASS' && closeoutApproved,
    closeoutApproved,
  };
}

function inferReadinessEvidence(input: {
  flow: RuntimeFlowId;
  report: LatestReadinessReportSummary | null;
  remediationArtifactPath: string | null;
  executionRecord: GovernancePacketExecutionRecord | null;
  auditFact: AuditFactSummary;
  overrides?: Partial<ImplementationReadinessEvidence>;
}): ImplementationReadinessEvidence {
  const fromArtifacts: ImplementationReadinessEvidence = {
    readinessReportPresent: input.report !== null,
    blockerCount: input.report?.blockerCount,
    remediationState:
      input.executionRecord?.status === 'gate_passed'
        ? 'closed'
        : input.executionRecord && ACTIVE_REMEDIATION_STATUSES.has(input.executionRecord.status)
          ? 'in_progress'
          : input.remediationArtifactPath
            ? 'in_progress'
            : 'none',
    rerunGateStatus:
      input.executionRecord?.lastRerunGateResult?.status === 'pass'
        ? 'pass'
        : input.executionRecord?.lastRerunGateResult?.status === 'fail'
          ? 'fail'
          : 'unknown',
  };

  if (input.report?.overallStatus) {
    if (READY_STATUSES.has(input.report.overallStatus)) {
      fromArtifacts.blockerCount = 0;
    } else if (
      BLOCKED_STATUSES.has(input.report.overallStatus) &&
      fromArtifacts.blockerCount === 0
    ) {
      fromArtifacts.blockerCount = 1;
    }
  }

  if (
    (input.flow === 'bugfix' || input.flow === 'standalone_tasks') &&
    input.overrides?.documentAuditPassed === undefined
  ) {
    fromArtifacts.documentAuditPassed = input.auditFact.auditPassed ?? false;
  }

  return {
    ...fromArtifacts,
    ...(input.overrides ?? {}),
  };
}

function mergeRuntimeContext(
  input: ResolveBmadHelpRoutingStateInput
): Partial<RuntimeContextFile> | null {
  if (input.runtimeContext) {
    return input.runtimeContext;
  }
  if (!input.projectRoot) {
    return null;
  }
  try {
    return readRuntimeContext(input.projectRoot, input.runtimeContextPath);
  } catch {
    return null;
  }
}

function inferContextMaturityEvidence(input: {
  runtimeContext: Partial<RuntimeContextFile> | null;
  implementationReadinessStatus: ImplementationReadinessStatus;
  report: LatestReadinessReportSummary | null;
  overrides?: Partial<ContextMaturityEvidence>;
}): ContextMaturityEvidence {
  const runtimeContext = input.runtimeContext;
  const fromArtifacts: ContextMaturityEvidence = {
    artifactComplete: Boolean(
      input.report || runtimeContext?.artifactRoot || runtimeContext?.artifactPath
    ),
    fourSignalsComplete: Boolean(
      runtimeContext?.flow &&
      runtimeContext?.stage &&
      runtimeContext?.sourceMode &&
      (runtimeContext?.storyId || runtimeContext?.runId || runtimeContext?.epicId)
    ),
    executionSpecific: Boolean(
      runtimeContext?.storyId || runtimeContext?.runId || runtimeContext?.artifactRoot
    ),
    governanceHealthy: implementationReadinessPassed(input.implementationReadinessStatus),
    runtimeScopeComplete: Boolean(
      runtimeContext?.flow && runtimeContext?.stage && runtimeContext?.contextScope
    ),
  };

  return {
    ...fromArtifacts,
    ...(input.overrides ?? {}),
  };
}

function inferComplexityFactors(input: {
  flow: RuntimeFlowId;
  stage: StageName;
  basePolicy: RuntimePolicy;
  runtimeContext: Partial<RuntimeContextFile> | null;
  contextMaturity: ContextMaturity;
  implementationReadinessStatus: ImplementationReadinessStatus;
  overrides?: Partial<BmadHelpComplexityFactors>;
}): BmadHelpComplexityFactors {
  const fallback: BmadHelpComplexityFactors = {
    impactSurface: input.runtimeContext?.contextScope === 'project' ? 1 : 0,
    sharedContract: 0,
    verificationCost:
      input.basePolicy.validationLevel === 'full_validation'
        ? 2
        : input.basePolicy.validationLevel === 'test_only'
          ? 1
          : 0,
    uncertainty:
      input.contextMaturity === 'unclassified' || input.implementationReadinessStatus === 'missing'
        ? 2
        : input.implementationReadinessStatus === 'blocked' || input.contextMaturity === 'minimal'
          ? 1
          : 0,
    rollbackDifficulty:
      input.stage === 'implement' || input.stage === 'post_audit'
        ? 1
        : input.flow === 'story'
          ? 1
          : 0,
    forcedReasons: [],
  };

  return {
    ...fallback,
    ...(input.overrides ?? {}),
    forcedReasons: [...(input.overrides?.forcedReasons ?? fallback.forcedReasons ?? [])],
  };
}

export function resolveBmadHelpRoutingState(
  input: ResolveBmadHelpRoutingStateInput
): BmadHelpRoutingState {
  const basePolicy =
    input.basePolicy ??
    resolveRuntimePolicy({
      flow: input.flow,
      stage: input.stage,
      config: input.config,
      epicId: input.epicId,
      storyId: input.storyId,
      storySlug: input.storySlug,
      runId: input.runId,
      artifactRoot: input.artifactRoot,
      contextSource: input.contextSource,
    });

  const runtimeContext = mergeRuntimeContext(input);
  const sourceMode = input.sourceMode ?? runtimeContext?.sourceMode ?? null;
  const report = resolveScopedReadinessReport(input.projectRoot, runtimeContext);
  const remediationArtifactPath = remediationPathFromReport(report?.reportPath ?? null);
  const executionRecord = selectExecutionRecord(
    input.projectRoot,
    remediationArtifactPath,
    runtimeContext
  );
  const auditFact = resolveAuditFactSummary({
    projectRoot: input.projectRoot,
    flow: input.flow,
    runtimeContext,
  });

  const implementationEvidence = inferReadinessEvidence({
    flow: input.flow,
    report,
    remediationArtifactPath,
    executionRecord,
    auditFact,
    overrides: input.implementationReadinessEvidence,
  });
  const implementationReadinessStatus = deriveImplementationReadinessStatus(
    input.flow,
    implementationEvidence
  );
  const contextEvidence = inferContextMaturityEvidence({
    runtimeContext,
    implementationReadinessStatus,
    report,
    overrides: input.contextMaturityEvidence,
  });
  const contextMaturity = deriveBmadHelpContextMaturity(sourceMode ?? undefined, contextEvidence);
  const complexityFactors = inferComplexityFactors({
    flow: input.flow,
    stage: input.stage,
    basePolicy,
    runtimeContext,
    contextMaturity,
    implementationReadinessStatus,
    overrides: input.complexityFactors,
  });
  const complexity = deriveBmadHelpComplexity(complexityFactors);

  const shouldUpgradeStandaloneTasks = shouldUpgradeStandaloneTasksToStory(
    input.flow,
    complexity.level
  );
  const recommendedFlow: RuntimeFlowId =
    shouldUpgradeStandaloneTasks && input.flow === 'standalone_tasks' ? 'story' : input.flow;
  const recommendationLabel: BmadHelpRoutingState['recommendationLabel'] =
    implementationReadinessPassed(implementationReadinessStatus)
      ? shouldUpgradeStandaloneTasks
        ? 'allowed but not recommended'
        : 'recommended'
      : 'blocked';

  return {
    sourceMode,
    contextMaturity,
    complexity: complexity.level,
    complexityScore: complexity.score,
    complexityForcedReasons: complexity.forcedReasons,
    implementationReadinessStatus,
    implementationEntryRecommended:
      implementationReadinessPassed(implementationReadinessStatus) && !shouldUpgradeStandaloneTasks,
    shouldUpgradeStandaloneTasks,
    recommendedFlow,
    recommendationLabel,
    canonicalImplementationGate: IMPLEMENTATION_GATE_NAME,
    evidence: {
      contextMaturity: contextEvidence,
      implementationReadiness: implementationEvidence,
      complexityFactors,
    },
    evidenceSources: {
      readinessReportPath: report?.reportPath ?? null,
      remediationArtifactPath,
      executionRecordPath:
        executionRecord && input.projectRoot
          ? path.join(
              input.projectRoot,
              '_bmad-output',
              'runtime',
              'governance',
              'executions',
              executionRecord.loopStateId,
              `${String(executionRecord.attemptNumber).padStart(4, '0')}.json`
            )
          : null,
    },
    executionRecordId: executionRecord?.executionId ?? null,
  };
}

export interface ResolveBmadHelpRuntimePolicyInput extends ResolveRuntimePolicyInput {
  projectRoot?: string;
  runtimeContext?: Partial<RuntimeContextFile> | null;
  runtimeContextPath?: string;
  contextMaturityEvidence?: Partial<ContextMaturityEvidence>;
  implementationReadinessEvidence?: Partial<ImplementationReadinessEvidence>;
  complexityFactors?: Partial<BmadHelpComplexityFactors>;
}

export function resolveBmadHelpRuntimePolicy(
  input: ResolveBmadHelpRuntimePolicyInput
): RuntimePolicyWithBmadHelp {
  const basePolicy = resolveRuntimePolicy(input);
  const helpRouting = resolveBmadHelpRoutingState({
    projectRoot: input.projectRoot,
    runtimeContext: input.runtimeContext,
    runtimeContextPath: input.runtimeContextPath,
    flow: input.flow,
    stage: input.stage,
    config: input.config,
    sourceMode: input.runtimeContext?.sourceMode ?? undefined,
    contextMaturityEvidence: input.contextMaturityEvidence,
    implementationReadinessEvidence: input.implementationReadinessEvidence,
    complexityFactors: input.complexityFactors,
    basePolicy,
    epicId: input.epicId,
    storyId: input.storyId,
    storySlug: input.storySlug,
    runId: input.runId,
    artifactRoot: input.artifactRoot,
    contextSource: input.contextSource,
  });

  return {
    ...basePolicy,
    contextMaturity: helpRouting.contextMaturity,
    complexity: helpRouting.complexity,
    implementationReadinessStatus: helpRouting.implementationReadinessStatus,
    implementationEntryRecommended: helpRouting.implementationEntryRecommended,
    helpRouting,
    reviewerContract: buildReviewerContractProjection({
      auditEntryStage: mapFlowStageToReviewerAuditEntryStage(input.flow, input.stage),
    }),
  };
}
