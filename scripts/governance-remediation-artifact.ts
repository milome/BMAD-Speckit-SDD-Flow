import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolvePromptHintUsageFromText,
  type PromptHintUsageRecord,
} from './prompt-routing-governance';
import * as deferredGapGovernance from './deferred-gap-governance.cjs';
const {
  readDeferredGapsFromReport,
} = deferredGapGovernance as {
  readDeferredGapsFromReport: (reportPath: string) => {
    gaps: Array<Record<string, string>>;
    explicit: boolean;
    report_path: string;
  };
};
import { type ModelGovernanceHintCandidate } from './model-governance-hints-schema';
import type {
  ExecutionIntentCandidate,
  ExecutionPlanDecision,
  ExecutionSkillSemanticFeature,
  ExecutionSkillInventoryEntry,
} from './execution-intent-schema';
import type { JourneyContractRemediationHint } from '../packages/scoring/analytics/journey-contract-remediation';

export interface GovernanceRemediationArtifactInput {
  projectRoot: string;
  outputPath: string;
  promptText?: string;
  modelHintsCandidate?: ModelGovernanceHintCandidate | null;
  availableSkills?: string[] | null;
  skillPaths?: string[] | null;
  skillInventory?: ExecutionSkillInventoryEntry[] | null;
  stageContextKnown: boolean;
  gateFailureExists: boolean;
  blockerOwnershipLocked: boolean;
  rootTargetLocked: boolean;
  equivalentAdapterCount: number;
  attemptId: string;
  sourceGateFailureIds: string[];
  capabilitySlot: string;
  canonicalAgent: string;
  actualExecutor: string;
  adapterPath: string;
  targetArtifacts: string[];
  expectedDelta: string;
  rerunOwner: string;
  rerunGate: string;
  outcome: string;
  sharedArtifactsUpdated?: string[];
  contradictionsDelta?: string;
  externalProofAdded?: string;
  readyToRerunGate?: boolean;
  stopReason?: string;
  journeyContractHints?: JourneyContractRemediationHint[];
  deferredGaps?: Array<Record<string, unknown>>;
  deferredGapCount?: number;
  deferredGapsExplicit?: boolean;
  previousReportPath?: string | null;
  executorRouting?: {
    routingMode: 'targeted' | 'generic';
    executorRoute: 'journey-contract-remediation' | 'default-gate-remediation';
    prioritizedSignals: string[];
    packetStrategy?: string;
    reason?: string;
  };
}

export interface GovernanceRemediationArtifactResult {
  markdown: string;
  promptHintUsage: PromptHintUsageRecord;
  executionIntentCandidate: ExecutionIntentCandidate | null;
  executionPlanDecision: ExecutionPlanDecision | null;
  journeyContractHints: JourneyContractRemediationHint[];
}

function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function bulletList(items: string[]): string {
  if (items.length === 0) {
    return '- (none)';
  }
  return items.map((item) => `- ${item}`).join('\n');
}

function buildPromptHintUsageLines(usage: PromptHintUsageRecord): string[] {
  return [
    '- Prompt hint present: ' + (usage.promptHintPresent ? 'yes' : 'no'),
    `- Hint confidence: ${usage.hintConfidence}`,
    `- Consumed after: \`${usage.consumedAfter}\``,
    '- Hint applied to:',
    ...(
      usage.hintAppliedTo.length > 0
        ? usage.hintAppliedTo.map((item) => `  - ${item}`)
        : ['  - (none)']
    ),
    '- Hint ignored because:',
    ...(
      usage.hintIgnoredBecause.length > 0
        ? usage.hintIgnoredBecause.map((item) => `  - ${item}`)
        : ['  - (none)']
    ),
    '- Blocker ownership affected: no',
  ];
}

function buildModelHintUsageLines(usage: PromptHintUsageRecord): string[] {
  return [
    '- Model hint present: ' + (usage.modelHintPresent ? 'yes' : 'no'),
    `- Model hint confidence: ${usage.modelHintConfidence}`,
    '- Model hint applied to:',
    ...(
      usage.modelHintAppliedTo.length > 0
        ? usage.modelHintAppliedTo.map((item) => `  - ${item}`)
        : ['  - (none)']
    ),
    '- Model hint ignored because:',
    ...(
      usage.modelHintIgnoredBecause.length > 0
        ? usage.modelHintIgnoredBecause.map((item) => `  - ${item}`)
        : ['  - (none)']
    ),
    '- Model hint debug:',
    ...(usage.modelHintDebug
      ? [
          `  - Stripped forbidden overrides: ${
            usage.modelHintDebug.strippedForbiddenOverrides.join(', ') || '(none)'
          }`,
          `  - Policy ignored because: ${
            usage.modelHintDebug.ignoredBecause.join(', ') || '(none)'
          }`,
        ]
      : ['  - (none)']),
    '- Model hints remain advisory only: yes',
  ];
}

function formatSemanticSkillFeaturesCompact(
  semanticSkillFeatures: ExecutionSkillSemanticFeature[]
): string {
  if (semanticSkillFeatures.length === 0) {
    return '(none)';
  }

  const renderedFeatures = semanticSkillFeatures.map((feature) => {
    const details = [
      feature.stageHints.length > 0 ? `stage=${feature.stageHints.join('|')}` : null,
      feature.actionHints.length > 0 ? `action=${feature.actionHints.join('|')}` : null,
      feature.interactionHints.length > 0
        ? `interaction=${feature.interactionHints.join('|')}`
        : null,
      feature.researchPolicyHints.length > 0
        ? `research=${feature.researchPolicyHints.join('|')}`
        : null,
      feature.delegationHints.length > 0
        ? `delegation=${feature.delegationHints.join('|')}`
        : null,
      feature.constraintHints.length > 0
        ? `constraints=${feature.constraintHints.join('|')}`
        : null,
    ]
      .filter((detail): detail is string => Boolean(detail))
      .join('; ');

    return `${feature.skillId}${details ? ` [${details}]` : ''}`;
  });

  return [...new Set(renderedFeatures)].join(' || ');
}

function buildExecutionIntentCandidateLines(
  candidate: ExecutionIntentCandidate | null
): string[] {
  if (!candidate) {
    return ['- (none)'];
  }

  const compactSkillMatchLines =
    candidate.skillMatchReasons.length > 0
      ? candidate.skillMatchReasons.map((reason) => {
          const flags = [
            reason.exactIdMatch ? 'exact' : null,
            reason.substringMatch ? 'substr' : null,
            reason.overlapTokens.length > 0 ? `tokens=${reason.overlapTokens.join('|')}` : null,
          ]
            .filter((flag): flag is string => Boolean(flag))
            .join(', ');
          return `  - ${reason.requestedSkill} -> ${reason.matchedSkillId} [score=${reason.score}${flags ? `; ${flags}` : ''}]`;
        })
      : ['  - (none)'];

  const compactTopN = [
    ['stageHints', candidate.semanticFeatureTopN.stageHints],
    ['actionHints', candidate.semanticFeatureTopN.actionHints],
    ['interactionHints', candidate.semanticFeatureTopN.interactionHints],
    ['researchPolicyHints', candidate.semanticFeatureTopN.researchPolicyHints],
    ['delegationHints', candidate.semanticFeatureTopN.delegationHints],
    ['constraintHints', candidate.semanticFeatureTopN.constraintHints],
  ]
    .map(([label, items]) => {
      const rendered = (items as Array<{ value: string; score: number; provenanceSkillIds: string[] }>)
        .map((item) => `${item.value}@${item.score}<-${item.provenanceSkillIds.join('|')}`)
        .join(', ');
      return rendered ? `  - ${label}: ${rendered}` : null;
    })
    .filter((line): line is string => Boolean(line));

  return [
    `- Source: ${candidate.source}`,
    `- Stage: ${candidate.stage ?? '(none)'}`,
    `- Action: ${candidate.action ?? '(none)'}`,
    `- Interaction Mode: ${candidate.interactionMode}`,
    `- Skill Availability Mode: ${candidate.skillAvailabilityMode}`,
    `- Available Skills: ${candidate.availableSkills.join(', ') || '(none)'}`,
    `- Skill Paths: ${candidate.skillPaths.join(', ') || '(none)'}`,
    `- Matched Available Skills: ${candidate.matchedAvailableSkills.join(', ') || '(none)'}`,
    `- Missing Skills: ${candidate.missingSkills.join(', ') || '(none)'}`,
    '- Skill Match Reasons:',
    ...compactSkillMatchLines,
    `- Semantic Skill Features: ${formatSemanticSkillFeaturesCompact(candidate.semanticSkillFeatures)}`,
    '- Semantic Feature Top-N:',
    ...(compactTopN.length > 0 ? compactTopN : ['  - (none)']),
    `- Research Policy: ${candidate.researchPolicy}`,
    `- Delegation Preference: ${candidate.delegationPreference}`,
    `- Provider Recommended Skill Chain: ${candidate.providerRecommendedSkillChain.join(', ') || '(none)'}`,
    `- Provider Recommended Subagent Roles: ${candidate.providerRecommendedSubagentRoles.join(', ') || '(none)'}`,
    '- Provider Recommendation Items (Skills):',
    ...(
      candidate.providerRecommendationItems.skills.length > 0
        ? candidate.providerRecommendationItems.skills.map(
            (item) =>
              `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? 'yes' : 'no'}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join('|') || '(none)'}]`
          )
        : ['  - (none)']
    ),
    '- Provider Recommendation Items (Subagent Roles):',
    ...(
      candidate.providerRecommendationItems.subagentRoles.length > 0
        ? candidate.providerRecommendationItems.subagentRoles.map(
            (item) =>
              `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? 'yes' : 'no'}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join('|') || '(none)'}]`
          )
        : ['  - (none)']
    ),
    `- Skill Chain: ${candidate.skillChain.join(', ') || '(none)'}`,
    `- Subagent Roles: ${candidate.subagentRoles.join(', ') || '(none)'}`,
    `- Constraints: ${candidate.constraints.join(', ') || '(none)'}`,
    `- Advisory Only: ${candidate.advisoryOnly ? 'yes' : 'no'}`,
  ];
}

function buildExecutionPlanDecisionLines(
  decision: ExecutionPlanDecision | null
): string[] {
  if (!decision) {
    return ['- (none)'];
  }

  const compactSkillMatchLines =
    decision.skillMatchReasons.length > 0
      ? decision.skillMatchReasons.map((reason) => {
          const flags = [
            reason.exactIdMatch ? 'exact' : null,
            reason.substringMatch ? 'substr' : null,
            reason.overlapTokens.length > 0 ? `tokens=${reason.overlapTokens.join('|')}` : null,
          ]
            .filter((flag): flag is string => Boolean(flag))
            .join(', ');
          return `  - ${reason.requestedSkill} -> ${reason.matchedSkillId} [score=${reason.score}${flags ? `; ${flags}` : ''}]`;
        })
      : ['  - (none)'];

  const compactTopN = [
    ['stageHints', decision.semanticFeatureTopN.stageHints],
    ['actionHints', decision.semanticFeatureTopN.actionHints],
    ['interactionHints', decision.semanticFeatureTopN.interactionHints],
    ['researchPolicyHints', decision.semanticFeatureTopN.researchPolicyHints],
    ['delegationHints', decision.semanticFeatureTopN.delegationHints],
    ['constraintHints', decision.semanticFeatureTopN.constraintHints],
  ]
    .map(([label, items]) => {
      const rendered = (items as Array<{ value: string; score: number; provenanceSkillIds: string[] }>)
        .map((item) => `${item.value}@${item.score}<-${item.provenanceSkillIds.join('|')}`)
        .join(', ');
      return rendered ? `  - ${label}: ${rendered}` : null;
    })
    .filter((line): line is string => Boolean(line));

  return [
    `- Source: ${decision.source}`,
    `- Stage: ${decision.stage ?? '(none)'}`,
    `- Action: ${decision.action ?? '(none)'}`,
    `- Interaction Mode: ${decision.interactionMode}`,
    `- Skill Availability Mode: ${decision.skillAvailabilityMode}`,
    `- Available Skills: ${decision.availableSkills.join(', ') || '(none)'}`,
    `- Skill Paths: ${decision.skillPaths.join(', ') || '(none)'}`,
    `- Matched Available Skills: ${decision.matchedAvailableSkills.join(', ') || '(none)'}`,
    `- Missing Skills: ${decision.missingSkills.join(', ') || '(none)'}`,
    '- Skill Match Reasons:',
    ...compactSkillMatchLines,
    `- Semantic Skill Features: ${formatSemanticSkillFeaturesCompact(decision.semanticSkillFeatures)}`,
    '- Semantic Feature Top-N:',
    ...(compactTopN.length > 0 ? compactTopN : ['  - (none)']),
    `- Research Policy: ${decision.researchPolicy}`,
    `- Delegation Preference: ${decision.delegationPreference}`,
    `- Provider Recommended Skill Chain: ${decision.providerRecommendedSkillChain.join(', ') || '(none)'}`,
    `- Provider Recommended Subagent Roles: ${decision.providerRecommendedSubagentRoles.join(', ') || '(none)'}`,
    '- Provider Recommendation Items (Skills):',
    ...(
      decision.providerRecommendationItems.skills.length > 0
        ? decision.providerRecommendationItems.skills.map(
            (item) =>
              `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? 'yes' : 'no'}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join('|') || '(none)'}]`
          )
        : ['  - (none)']
    ),
    '- Provider Recommendation Items (Subagent Roles):',
    ...(
      decision.providerRecommendationItems.subagentRoles.length > 0
        ? decision.providerRecommendationItems.subagentRoles.map(
            (item) =>
              `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? 'yes' : 'no'}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join('|') || '(none)'}]`
          )
        : ['  - (none)']
    ),
    `- Skill Chain: ${decision.skillChain.join(', ') || '(none)'}`,
    `- Subagent Roles: ${decision.subagentRoles.join(', ') || '(none)'}`,
    `- Governance Constraints: ${decision.governanceConstraints.join(', ') || '(none)'}`,
    `- Blocked By Governance: ${decision.blockedByGovernance.join(', ') || '(none)'}`,
    `- Advisory Only: ${decision.advisoryOnly ? 'yes' : 'no'}`,
  ];
}

function buildJourneyContractHintLines(hints: JourneyContractRemediationHint[]): string[] {
  if (hints.length === 0) {
    return ['- (none)'];
  }

  return hints.flatMap((hint) => [
    `- ${hint.signal}: ${hint.recommendation}`,
    `  - Count: ${hint.count}`,
    `  - Affected stages: ${hint.affected_stages.join(', ') || '(none)'}`,
    `  - Stories: ${hint.epic_stories.join(', ') || '(none)'}`,
  ]);
}

function resolveDeferredGapContext(input: GovernanceRemediationArtifactInput): {
  sourceReportPath: string | null;
  gaps: Array<Record<string, unknown>>;
  explicit: boolean;
  count: number;
} {
  if (Array.isArray(input.deferredGaps) && input.deferredGaps.length > 0) {
    return {
      sourceReportPath: null,
      gaps: input.deferredGaps,
      explicit: input.deferredGapsExplicit ?? true,
      count: input.deferredGapCount ?? input.deferredGaps.length,
    };
  }

  const candidateReportPath = input.outputPath.replace(
    /implementation-readiness-remediation-/i,
    'implementation-readiness-report-'
  );

  if (fs.existsSync(candidateReportPath)) {
    const report = readDeferredGapsFromReport(candidateReportPath);
    return {
      sourceReportPath: report.report_path,
      gaps: report.gaps,
      explicit: report.explicit,
      count: report.gaps.length,
    };
  }

  return {
    sourceReportPath: null,
    gaps: [],
    explicit: input.deferredGapsExplicit ?? false,
    count: input.deferredGapCount ?? 0,
  };
}

function buildStructuredDeferredGapLines(input: {
  sourceReportPath: string | null;
  previousReportPath?: string | null;
  gaps: Array<Record<string, unknown>>;
  explicit: boolean;
  count: number;
}): string[] {
  const lines = [
    `- Source report: ${input.sourceReportPath ?? '(none)'}`,
    `- Previous report: ${input.previousReportPath ?? '(none)'}`,
    `- Deferred gap count: ${input.count}`,
    `- Deferred gaps explicit: ${yesNo(input.explicit)}`,
    '',
    '```yaml',
    'deferred_gaps:',
  ];

  if (input.gaps.length === 0) {
    lines.push('  []');
    lines.push('```');
    return lines;
  }

  for (const gap of input.gaps) {
    const journeyRefs = Array.isArray(gap.journey_refs)
      ? gap.journey_refs.map((value) => normalizeText(value)).filter(Boolean)
      : [];
    const prodPathRefs = Array.isArray(gap.prod_path_refs)
      ? gap.prod_path_refs.map((value) => normalizeText(value)).filter(Boolean)
      : [];
    const smokeTestRefs = Array.isArray(gap.smoke_test_refs)
      ? gap.smoke_test_refs.map((value) => normalizeText(value)).filter(Boolean)
      : [];
    const fullE2ERefs = Array.isArray(gap.full_e2e_refs)
      ? gap.full_e2e_refs.map((value) => normalizeText(value)).filter(Boolean)
      : [];
    const closureNoteRefs = Array.isArray(gap.closure_note_refs)
      ? gap.closure_note_refs.map((value) => normalizeText(value)).filter(Boolean)
      : [];
    lines.push(`  - gap_id: ${normalizeText(gap.gap_id) || '(missing)'}`);
    lines.push(`    status: ${normalizeText(gap.status) || 'deferred'}`);
    lines.push(`    reason: ${normalizeText(gap.reason) || '(none)'}`);
    lines.push(`    resolution_target: ${normalizeText(gap.resolution_target) || '(none)'}`);
    lines.push(`    owner: ${normalizeText(gap.owner) || '(missing)'}`);
    lines.push(`    current_risk: ${normalizeText(gap.current_risk) || '(none)'}`);
    if (journeyRefs.length > 0) lines.push(`    journey_refs: [${journeyRefs.join(', ')}]`);
    if (prodPathRefs.length > 0) lines.push(`    prod_path_refs: [${prodPathRefs.join(', ')}]`);
    if (smokeTestRefs.length > 0) lines.push(`    smoke_test_refs: [${smokeTestRefs.join(', ')}]`);
    if (fullE2ERefs.length > 0) lines.push(`    full_e2e_refs: [${fullE2ERefs.join(', ')}]`);
    if (closureNoteRefs.length > 0) lines.push(`    closure_note_refs: [${closureNoteRefs.join(', ')}]`);
  }
  lines.push('```');
  return lines;
}

function defaultExecutorRouting(
  hints: JourneyContractRemediationHint[]
): NonNullable<GovernanceRemediationArtifactInput['executorRouting']> {
  if (hints.length > 0) {
    return {
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals: hints.map((hint) => hint.signal).sort(),
      packetStrategy: 'journey-contract-remediation-packet',
      reason:
        'journey contract hints detected; use targeted remediation routing before generic blocker cleanup',
    };
  }

  return {
    routingMode: 'generic',
    executorRoute: 'default-gate-remediation',
    prioritizedSignals: [],
    packetStrategy: 'default-remediation-packet',
    reason: 'no journey contract hints detected; use the default gate remediation route',
  };
}

function buildExecutorRoutingLines(
  executorRouting: NonNullable<GovernanceRemediationArtifactInput['executorRouting']>
): string[] {
  return [
    `- Routing Mode: ${executorRouting.routingMode}`,
    `- Executor Route: ${executorRouting.executorRoute}`,
    `- Packet Strategy: ${executorRouting.packetStrategy ?? '(none)'}`,
    `- Prioritized Signals: ${executorRouting.prioritizedSignals.join(', ') || '(none)'}`,
    `- Routing Reason: ${executorRouting.reason ?? '(none)'}`,
  ];
}

export function buildRemediationAuditTraceSummaryLines(
  stopReason: string | undefined,
  journeyContractHints: JourneyContractRemediationHint[],
  executorRouting: NonNullable<GovernanceRemediationArtifactInput['executorRouting']>
): string[] {
  return [
    `Routing Mode: ${executorRouting.routingMode}`,
    `Executor Route: ${executorRouting.executorRoute}`,
    `Stop Reason: ${stopReason ?? '(none)'}`,
    `Journey Contract Signals: ${journeyContractHints.map((hint) => hint.signal).join(', ') || '(none)'}`,
  ];
}

export function buildGovernanceRemediationArtifact(
  input: GovernanceRemediationArtifactInput
): GovernanceRemediationArtifactResult {
  const promptHintUsage = resolvePromptHintUsageFromText({
    projectRoot: input.projectRoot,
    promptText: input.promptText,
    stageContextKnown: input.stageContextKnown,
    gateFailure: {
      exists: input.gateFailureExists,
      blockerOwnershipLocked: input.blockerOwnershipLocked,
    },
    artifactState: {
      rootTargetLocked: input.rootTargetLocked,
      equivalentAdapterCount: input.equivalentAdapterCount,
    },
    modelHintsCandidate: input.modelHintsCandidate,
    availableSkills: input.availableSkills,
    skillPaths: input.skillPaths,
    skillInventory: input.skillInventory,
  });
  const executionIntentCandidate = promptHintUsage.executionIntentCandidate;
  const executionPlanDecision = promptHintUsage.executionPlanDecision;
  const journeyContractHints = input.journeyContractHints ?? [];
  const executorRouting = input.executorRouting ?? defaultExecutorRouting(journeyContractHints);
  const deferredGapContext = resolveDeferredGapContext(input);
  const remediationAuditTraceSummaryLines = buildRemediationAuditTraceSummaryLines(
    input.stopReason,
    journeyContractHints,
    executorRouting
  );
  const markdown = [
    '# Remediation Attempt',
    '',
    '## PM Routing Resolution',
    '',
    '- Resolution order: `stage context -> gate failure -> artifact state -> PromptRoutingHints`',
    `- Stage context known: ${yesNo(input.stageContextKnown)}`,
    `- Gate failure exists: ${yesNo(input.gateFailureExists)}`,
    `- Blocker ownership locked: ${yesNo(input.blockerOwnershipLocked)}`,
    `- Root target locked: ${yesNo(input.rootTargetLocked)}`,
    `- Equivalent adapter count: ${input.equivalentAdapterCount}`,
    `- Prompt hints confidence: ${promptHintUsage.hintConfidence}`,
    '',
    '## Core Fields',
    '',
    `- Attempt ID: ${input.attemptId}`,
    `- Source GateFailure IDs: ${input.sourceGateFailureIds.join(', ') || '(none)'}`,
    `- Capability Slot: ${input.capabilitySlot}`,
    `- Canonical Agent: ${input.canonicalAgent}`,
    `- Actual Executor: ${input.actualExecutor}`,
    `- Adapter Path: ${input.adapterPath}`,
    '- Target Artifact(s):',
    bulletList(input.targetArtifacts),
    `- Expected Delta: ${input.expectedDelta}`,
    `- Rerun Owner: ${input.rerunOwner}`,
    `- Rerun Gate: ${input.rerunGate}`,
    `- Outcome: ${input.outcome}`,
    '',
    '## Prompt Hint Usage',
    '',
    ...buildPromptHintUsageLines(promptHintUsage),
    '',
    '## Model Hint Debug',
    '',
    ...buildModelHintUsageLines(promptHintUsage),
    '',
    '## Execution Intent Candidate',
    '',
    ...buildExecutionIntentCandidateLines(executionIntentCandidate),
    '',
    '## Execution Plan Decision',
    '',
    ...buildExecutionPlanDecisionLines(executionPlanDecision),
    '',
    '## Executor Routing Trace',
    '',
    ...buildExecutorRoutingLines(executorRouting),
    '',
    '## Remediation Audit Trace Summary',
    '',
    ...remediationAuditTraceSummaryLines,
    '',
    '## Journey Contract Remediation Hints',
    '',
    ...buildJourneyContractHintLines(journeyContractHints),
    '',
    '## Structured Deferred Gaps',
    '',
    ...buildStructuredDeferredGapLines({
      sourceReportPath: deferredGapContext.sourceReportPath,
      previousReportPath: input.previousReportPath,
      gaps: deferredGapContext.gaps,
      explicit: deferredGapContext.explicit,
      count: deferredGapContext.count,
    }),
    '',
    '## Evidence Delta',
    '',
    '- Shared artifacts updated:',
    bulletList(input.sharedArtifactsUpdated ?? []),
    `- Contradictions opened/closed: ${input.contradictionsDelta ?? '(none)'}`,
    `- External proof added: ${input.externalProofAdded ?? '(none)'}`,
    '',
    '## Next Action',
    '',
    `- Ready to rerun gate: ${yesNo(input.readyToRerunGate ?? false)}`,
    `- If no, stop reason: ${input.stopReason ?? '(none)'}`,
    '',
  ].join('\n');

  return {
    markdown,
    promptHintUsage,
    executionIntentCandidate,
    executionPlanDecision,
    journeyContractHints,
  };
}

export function writeGovernanceRemediationArtifact(
  input: GovernanceRemediationArtifactInput
): GovernanceRemediationArtifactResult {
  const result = buildGovernanceRemediationArtifact(input);
  const absoluteOutputPath = path.isAbsolute(input.outputPath)
    ? input.outputPath
    : path.join(input.projectRoot, input.outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, result.markdown, 'utf8');
  return result;
}

function parseBooleanFlag(value: string | undefined, flagName: string): boolean {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`Invalid ${flagName}: expected true|false`);
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function argValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function main(): void {
  const argvTokens = process.argv.map((value) => path.basename(String(value)).toLowerCase());
  const isDirectArtifactCli = argvTokens.some((value) => value.includes('governance-remediation-artifact'));
  if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === '1') {
    return;
  }
  if (require.main !== module || !isDirectArtifactCli) {
    return;
  }

  const args = process.argv.slice(2);
  const outputPath = argValue(args, '--outputPath');
  if (!outputPath) {
    throw new Error(
      'Usage: npx ts-node --transpile-only scripts/governance-remediation-artifact.ts --outputPath <path> --attemptId <id> --capabilitySlot <slot> --canonicalAgent <agent> --actualExecutor <executor> --adapterPath <path> --expectedDelta <text> --rerunOwner <owner> --rerunGate <gate> --outcome <text> --stageContextKnown true|false --gateFailureExists true|false --blockerOwnershipLocked true|false --rootTargetLocked true|false --equivalentAdapterCount <n> [--promptText <text>] [--sourceGateFailureIds a,b] [--targetArtifacts a,b]'
    );
  }

  const projectRoot = process.cwd();
  writeGovernanceRemediationArtifact({
    projectRoot,
    outputPath,
    promptText: argValue(args, '--promptText'),
    stageContextKnown: parseBooleanFlag(argValue(args, '--stageContextKnown'), '--stageContextKnown'),
    gateFailureExists: parseBooleanFlag(argValue(args, '--gateFailureExists'), '--gateFailureExists'),
    blockerOwnershipLocked: parseBooleanFlag(
      argValue(args, '--blockerOwnershipLocked'),
      '--blockerOwnershipLocked'
    ),
    rootTargetLocked: parseBooleanFlag(argValue(args, '--rootTargetLocked'), '--rootTargetLocked'),
    equivalentAdapterCount: Number(argValue(args, '--equivalentAdapterCount') ?? '0'),
    attemptId: argValue(args, '--attemptId') ?? 'attempt-unknown',
    sourceGateFailureIds: parseList(argValue(args, '--sourceGateFailureIds')),
    capabilitySlot: argValue(args, '--capabilitySlot') ?? 'unknown-slot',
    canonicalAgent: argValue(args, '--canonicalAgent') ?? 'unknown-agent',
    actualExecutor: argValue(args, '--actualExecutor') ?? 'unknown-executor',
    adapterPath: argValue(args, '--adapterPath') ?? 'unknown-adapter',
    targetArtifacts: parseList(argValue(args, '--targetArtifacts')),
    expectedDelta: argValue(args, '--expectedDelta') ?? 'n/a',
    rerunOwner: argValue(args, '--rerunOwner') ?? 'PM',
    rerunGate: argValue(args, '--rerunGate') ?? 'n/a',
    outcome: argValue(args, '--outcome') ?? 'n/a',
    sharedArtifactsUpdated: parseList(argValue(args, '--sharedArtifactsUpdated')),
    contradictionsDelta: argValue(args, '--contradictionsDelta'),
    externalProofAdded: argValue(args, '--externalProofAdded'),
    readyToRerunGate: argValue(args, '--readyToRerunGate')
      ? parseBooleanFlag(argValue(args, '--readyToRerunGate'), '--readyToRerunGate')
      : undefined,
    stopReason: argValue(args, '--stopReason'),
  });
}

main();
