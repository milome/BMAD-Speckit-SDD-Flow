"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRemediationAuditTraceSummaryLines = buildRemediationAuditTraceSummaryLines;
exports.buildGovernanceRemediationArtifact = buildGovernanceRemediationArtifact;
exports.writeGovernanceRemediationArtifact = writeGovernanceRemediationArtifact;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const prompt_routing_governance_1 = require("./prompt-routing-governance");
const deferredGapGovernance = __importStar(require("./deferred-gap-governance.cjs"));
const { readDeferredGapsFromReport } = deferredGapGovernance;
const readiness_drift_1 = require("../packages/scoring/governance/readiness-drift");
const loader_1 = require("../packages/scoring/query/loader");
const runtime_scoring_data_path_1 = require("./runtime-scoring-data-path");
function yesNo(value) {
    return value ? 'yes' : 'no';
}
function normalizeText(value) {
    return String(value ?? '').trim();
}
function bulletList(items) {
    if (items.length === 0) {
        return '- (none)';
    }
    return items.map((item) => `- ${item}`).join('\n');
}
function buildPromptHintUsageLines(usage) {
    return [
        '- Prompt hint present: ' + (usage.promptHintPresent ? 'yes' : 'no'),
        `- Hint confidence: ${usage.hintConfidence}`,
        `- Consumed after: \`${usage.consumedAfter}\``,
        '- Hint applied to:',
        ...(usage.hintAppliedTo.length > 0
            ? usage.hintAppliedTo.map((item) => `  - ${item}`)
            : ['  - (none)']),
        '- Hint ignored because:',
        ...(usage.hintIgnoredBecause.length > 0
            ? usage.hintIgnoredBecause.map((item) => `  - ${item}`)
            : ['  - (none)']),
        '- Blocker ownership affected: no',
    ];
}
function buildModelHintUsageLines(usage) {
    return [
        '- Model hint present: ' + (usage.modelHintPresent ? 'yes' : 'no'),
        `- Model hint confidence: ${usage.modelHintConfidence}`,
        '- Model hint applied to:',
        ...(usage.modelHintAppliedTo.length > 0
            ? usage.modelHintAppliedTo.map((item) => `  - ${item}`)
            : ['  - (none)']),
        '- Model hint ignored because:',
        ...(usage.modelHintIgnoredBecause.length > 0
            ? usage.modelHintIgnoredBecause.map((item) => `  - ${item}`)
            : ['  - (none)']),
        '- Model hint debug:',
        ...(usage.modelHintDebug
            ? [
                `  - Stripped forbidden overrides: ${usage.modelHintDebug.strippedForbiddenOverrides.join(', ') || '(none)'}`,
                `  - Policy ignored because: ${usage.modelHintDebug.ignoredBecause.join(', ') || '(none)'}`,
            ]
            : ['  - (none)']),
        '- Model hints remain advisory only: yes',
    ];
}
function formatSemanticSkillFeaturesCompact(semanticSkillFeatures) {
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
            feature.delegationHints.length > 0 ? `delegation=${feature.delegationHints.join('|')}` : null,
            feature.constraintHints.length > 0
                ? `constraints=${feature.constraintHints.join('|')}`
                : null,
        ]
            .filter((detail) => Boolean(detail))
            .join('; ');
        return `${feature.skillId}${details ? ` [${details}]` : ''}`;
    });
    return [...new Set(renderedFeatures)].join(' || ');
}
function buildExecutionIntentCandidateLines(candidate) {
    if (!candidate) {
        return ['- (none)'];
    }
    const compactSkillMatchLines = candidate.skillMatchReasons.length > 0
        ? candidate.skillMatchReasons.map((reason) => {
            const flags = [
                reason.exactIdMatch ? 'exact' : null,
                reason.substringMatch ? 'substr' : null,
                reason.overlapTokens.length > 0 ? `tokens=${reason.overlapTokens.join('|')}` : null,
            ]
                .filter((flag) => Boolean(flag))
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
        const rendered = items
            .map((item) => `${item.value}@${item.score}<-${item.provenanceSkillIds.join('|')}`)
            .join(', ');
        return rendered ? `  - ${label}: ${rendered}` : null;
    })
        .filter((line) => Boolean(line));
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
        ...(candidate.providerRecommendationItems.skills.length > 0
            ? candidate.providerRecommendationItems.skills.map((item) => `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? 'yes' : 'no'}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join('|') || '(none)'}]`)
            : ['  - (none)']),
        '- Provider Recommendation Items (Subagent Roles):',
        ...(candidate.providerRecommendationItems.subagentRoles.length > 0
            ? candidate.providerRecommendationItems.subagentRoles.map((item) => `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? 'yes' : 'no'}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join('|') || '(none)'}]`)
            : ['  - (none)']),
        `- Skill Chain: ${candidate.skillChain.join(', ') || '(none)'}`,
        `- Subagent Roles: ${candidate.subagentRoles.join(', ') || '(none)'}`,
        '- Reviewer Route Explainability:',
        ...(candidate.reviewerRouteExplainability && candidate.reviewerRouteExplainability.length > 0
            ? candidate.reviewerRouteExplainability.flatMap((item) => [
                `  - ${item.requestedSkillId} => identity=${item.reviewerIdentity}; registry=${item.registryVersion}; closeout=${item.closeoutRunner}; maturity=${item.isomorphismMaturity}`,
                `    - shared core: ${item.sharedCore.rootPath} [${item.sharedCore.version}]`,
                `    - cursor carrier: ${item.hosts.cursor.carrierSourcePath} -> ${item.hosts.cursor.runtimeTargetPath}`,
                `      preferred=${item.hosts.cursor.preferredRoute.tool}/${item.hosts.cursor.preferredRoute.subtypeOrExecutor} | fallback=${item.hosts.cursor.fallbackRoute.tool}/${item.hosts.cursor.fallbackRoute.subtypeOrExecutor}`,
                `      fallback reason: ${item.hosts.cursor.fallbackReason}`,
                `    - claude carrier: ${item.hosts.claude.carrierSourcePath} -> ${item.hosts.claude.runtimeTargetPath}`,
                `      preferred=${item.hosts.claude.preferredRoute.tool}/${item.hosts.claude.preferredRoute.subtypeOrExecutor} | fallback=${item.hosts.claude.fallbackRoute.tool}/${item.hosts.claude.fallbackRoute.subtypeOrExecutor}`,
                `      fallback reason: ${item.hosts.claude.fallbackReason}`,
                `    - route reason: ${item.routeReasonSummary}`,
                `    - fallback status: ${item.fallbackStatus}`,
                `    - complexity: ${item.complexitySource}`,
                `    - blocker: ${item.remainingBlocker}`,
                `    - rollout gate: ${item.rolloutGate.status} -> ${item.rolloutGate.summary}`,
            ])
            : ['  - (none)']),
        `- Constraints: ${candidate.constraints.join(', ') || '(none)'}`,
        `- Advisory Only: ${candidate.advisoryOnly ? 'yes' : 'no'}`,
    ];
}
function buildExecutionPlanDecisionLines(decision) {
    if (!decision) {
        return ['- (none)'];
    }
    const compactSkillMatchLines = decision.skillMatchReasons.length > 0
        ? decision.skillMatchReasons.map((reason) => {
            const flags = [
                reason.exactIdMatch ? 'exact' : null,
                reason.substringMatch ? 'substr' : null,
                reason.overlapTokens.length > 0 ? `tokens=${reason.overlapTokens.join('|')}` : null,
            ]
                .filter((flag) => Boolean(flag))
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
        const rendered = items
            .map((item) => `${item.value}@${item.score}<-${item.provenanceSkillIds.join('|')}`)
            .join(', ');
        return rendered ? `  - ${label}: ${rendered}` : null;
    })
        .filter((line) => Boolean(line));
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
        ...(decision.providerRecommendationItems.skills.length > 0
            ? decision.providerRecommendationItems.skills.map((item) => `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? 'yes' : 'no'}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join('|') || '(none)'}]`)
            : ['  - (none)']),
        '- Provider Recommendation Items (Subagent Roles):',
        ...(decision.providerRecommendationItems.subagentRoles.length > 0
            ? decision.providerRecommendationItems.subagentRoles.map((item) => `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? 'yes' : 'no'}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join('|') || '(none)'}]`)
            : ['  - (none)']),
        `- Skill Chain: ${decision.skillChain.join(', ') || '(none)'}`,
        `- Subagent Roles: ${decision.subagentRoles.join(', ') || '(none)'}`,
        '- Reviewer Route Explainability:',
        ...(decision.reviewerRouteExplainability && decision.reviewerRouteExplainability.length > 0
            ? decision.reviewerRouteExplainability.flatMap((item) => [
                `  - ${item.requestedSkillId} => identity=${item.reviewerIdentity}; registry=${item.registryVersion}; closeout=${item.closeoutRunner}; maturity=${item.isomorphismMaturity}`,
                `    - shared core: ${item.sharedCore.rootPath} [${item.sharedCore.version}]`,
                `    - cursor carrier: ${item.hosts.cursor.carrierSourcePath} -> ${item.hosts.cursor.runtimeTargetPath}`,
                `      preferred=${item.hosts.cursor.preferredRoute.tool}/${item.hosts.cursor.preferredRoute.subtypeOrExecutor} | fallback=${item.hosts.cursor.fallbackRoute.tool}/${item.hosts.cursor.fallbackRoute.subtypeOrExecutor}`,
                `      fallback reason: ${item.hosts.cursor.fallbackReason}`,
                `    - claude carrier: ${item.hosts.claude.carrierSourcePath} -> ${item.hosts.claude.runtimeTargetPath}`,
                `      preferred=${item.hosts.claude.preferredRoute.tool}/${item.hosts.claude.preferredRoute.subtypeOrExecutor} | fallback=${item.hosts.claude.fallbackRoute.tool}/${item.hosts.claude.fallbackRoute.subtypeOrExecutor}`,
                `      fallback reason: ${item.hosts.claude.fallbackReason}`,
                `    - route reason: ${item.routeReasonSummary}`,
                `    - fallback status: ${item.fallbackStatus}`,
                `    - complexity: ${item.complexitySource}`,
                `    - blocker: ${item.remainingBlocker}`,
                `    - rollout gate: ${item.rolloutGate.status} -> ${item.rolloutGate.summary}`,
            ])
            : ['  - (none)']),
        `- Governance Constraints: ${decision.governanceConstraints.join(', ') || '(none)'}`,
        `- Blocked By Governance: ${decision.blockedByGovernance.join(', ') || '(none)'}`,
        `- Advisory Only: ${decision.advisoryOnly ? 'yes' : 'no'}`,
    ];
}
function buildJourneyContractHintLines(hints) {
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
function resolveDeferredGapContext(input) {
    if (Array.isArray(input.deferredGaps) && input.deferredGaps.length > 0) {
        return {
            sourceReportPath: null,
            gaps: input.deferredGaps,
            explicit: input.deferredGapsExplicit ?? true,
            count: input.deferredGapCount ?? input.deferredGaps.length,
        };
    }
    const candidateReportPath = input.outputPath.replace(/implementation-readiness-remediation-/i, 'implementation-readiness-report-');
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
function buildStructuredDeferredGapLines(input) {
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
        if (journeyRefs.length > 0)
            lines.push(`    journey_refs: [${journeyRefs.join(', ')}]`);
        if (prodPathRefs.length > 0)
            lines.push(`    prod_path_refs: [${prodPathRefs.join(', ')}]`);
        if (smokeTestRefs.length > 0)
            lines.push(`    smoke_test_refs: [${smokeTestRefs.join(', ')}]`);
        if (fullE2ERefs.length > 0)
            lines.push(`    full_e2e_refs: [${fullE2ERefs.join(', ')}]`);
        if (closureNoteRefs.length > 0)
            lines.push(`    closure_note_refs: [${closureNoteRefs.join(', ')}]`);
    }
    lines.push('```');
    return lines;
}
function defaultExecutorRouting(hints) {
    if (hints.length > 0) {
        return {
            routingMode: 'targeted',
            executorRoute: 'journey-contract-remediation',
            prioritizedSignals: hints.map((hint) => hint.signal).sort(),
            packetStrategy: 'journey-contract-remediation-packet',
            reason: 'journey contract hints detected; use targeted remediation routing before generic blocker cleanup',
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
function buildExecutorRoutingLines(executorRouting) {
    return [
        `- Routing Mode: ${executorRouting.routingMode}`,
        `- Executor Route: ${executorRouting.executorRoute}`,
        `- Packet Strategy: ${executorRouting.packetStrategy ?? '(none)'}`,
        `- Prioritized Signals: ${executorRouting.prioritizedSignals.join(', ') || '(none)'}`,
        `- Routing Reason: ${executorRouting.reason ?? '(none)'}`,
    ];
}
function buildReadinessProjectionLines(projectRoot) {
    try {
        const records = (0, loader_1.loadAndDedupeRecords)((0, runtime_scoring_data_path_1.resolveRuntimeScoringDataPath)({ root: projectRoot }));
        const projection = (0, readiness_drift_1.buildReadinessDriftProjection)({ allRecords: records });
        return [
            `- Readiness Baseline Run ID: ${projection.readiness_baseline_run_id ?? '(none)'}`,
            `- Readiness Score: ${projection.readiness_score ?? '(none)'}`,
            `- Effective Verdict: ${projection.effective_verdict}`,
            `- Drift Severity: ${projection.drift_severity}`,
            `- Re-Readiness Required: ${projection.re_readiness_required ? 'yes' : 'no'}`,
            `- Drift Signals: ${projection.drift_signals.join(', ') || '(none)'}`,
            `- Drifted Dimensions: ${projection.drifted_dimensions.join(', ') || '(none)'}`,
            `- Blocking Reason: ${projection.blocking_reason ?? '(none)'}`,
        ];
    }
    catch (error) {
        return [
            `- Readiness projection unavailable: ${error instanceof Error ? error.message : String(error)}`,
        ];
    }
}
function buildRemediationAuditTraceSummaryLines(stopReason, journeyContractHints, executorRouting) {
    return [
        `Routing Mode: ${executorRouting.routingMode}`,
        `Executor Route: ${executorRouting.executorRoute}`,
        `Stop Reason: ${stopReason ?? '(none)'}`,
        `Journey Contract Signals: ${journeyContractHints.map((hint) => hint.signal).join(', ') || '(none)'}`,
    ];
}
function buildGovernanceRemediationArtifact(input) {
    const promptHintUsage = (0, prompt_routing_governance_1.resolvePromptHintUsageFromText)({
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
    const remediationAuditTraceSummaryLines = buildRemediationAuditTraceSummaryLines(input.stopReason, journeyContractHints, executorRouting);
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
        '## Readiness Drift Projection',
        '',
        ...buildReadinessProjectionLines(input.projectRoot),
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
function writeGovernanceRemediationArtifact(input) {
    const result = buildGovernanceRemediationArtifact(input);
    const absoluteOutputPath = path.isAbsolute(input.outputPath)
        ? input.outputPath
        : path.join(input.projectRoot, input.outputPath);
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    fs.writeFileSync(absoluteOutputPath, result.markdown, 'utf8');
    return result;
}
function parseBooleanFlag(value, flagName) {
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    throw new Error(`Invalid ${flagName}: expected true|false`);
}
function parseList(value) {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
function argValue(args, flag) {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
}
function main() {
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
        throw new Error('Usage: npx ts-node --transpile-only scripts/governance-remediation-artifact.ts --outputPath <path> --attemptId <id> --capabilitySlot <slot> --canonicalAgent <agent> --actualExecutor <executor> --adapterPath <path> --expectedDelta <text> --rerunOwner <owner> --rerunGate <gate> --outcome <text> --stageContextKnown true|false --gateFailureExists true|false --blockerOwnershipLocked true|false --rootTargetLocked true|false --equivalentAdapterCount <n> [--promptText <text>] [--sourceGateFailureIds a,b] [--targetArtifacts a,b]');
    }
    const projectRoot = process.cwd();
    writeGovernanceRemediationArtifact({
        projectRoot,
        outputPath,
        promptText: argValue(args, '--promptText'),
        stageContextKnown: parseBooleanFlag(argValue(args, '--stageContextKnown'), '--stageContextKnown'),
        gateFailureExists: parseBooleanFlag(argValue(args, '--gateFailureExists'), '--gateFailureExists'),
        blockerOwnershipLocked: parseBooleanFlag(argValue(args, '--blockerOwnershipLocked'), '--blockerOwnershipLocked'),
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
