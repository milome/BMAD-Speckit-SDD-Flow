"use strict";
/* eslint-disable no-console, @typescript-eslint/no-require-imports */
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
exports.runAuditorHost = runAuditorHost;
exports.mainRunAuditorHost = mainRunAuditorHost;
const child_process_1 = require("child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const parse_bmad_audit_result_1 = require("./parse-bmad-audit-result");
const auditor_post_actions_1 = require("./auditor-post-actions");
const reviewer_registry_1 = require("./reviewer-registry");
const runtime_context_registry_1 = require("./runtime-context-registry");
const reviewer_schema_1 = require("./reviewer-schema");
const continue_state_contract_1 = require("./continue-state-contract");
const version_lock_1 = require("../packages/scoring/gate/version-lock");
const requirement_record_control_store_1 = require("./requirement-record-control-store");
const { scoreCommand: defaultScoreCommand } = require('../packages/bmad-speckit/src/commands/score.js');
function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--projectRoot' && argv[i + 1]) {
            out.projectRoot = argv[++i];
        }
        else if (token === '--stage' && argv[i + 1]) {
            out.stage = argv[++i];
        }
        else if (token === '--artifactPath' && argv[i + 1]) {
            out.artifactPath = argv[++i];
        }
        else if (token === '--reportPath' && argv[i + 1]) {
            out.reportPath = argv[++i];
        }
        else if (token === '--iterationCount' && argv[i + 1]) {
            out.iterationCount = argv[++i];
        }
    }
    return out;
}
function syncLatestReviewerCloseoutToRequirementRecord(projectRoot, closeout) {
    try {
        const indexPath = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
        if (!fs.existsSync(indexPath))
            return;
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const requirementSetId = index.active?.requirementSetId;
        if (!requirementSetId)
            return;
        const recordPath = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', requirementSetId, 'requirement-record.json');
        if (!fs.existsSync(recordPath))
            return;
        (0, requirement_record_control_store_1.appendControlEventAndReplay)({
            recordPath,
            writerId: 'run-auditor-host-closeout-sync',
            eventType: 'latest_reviewer_closeout_synced',
            payload: closeout,
            reduce: (record) => ({
                ...record,
                latestReviewerCloseout: closeout,
                lastEventType: 'latest_reviewer_closeout_synced',
                updatedAt: closeout.updatedAt,
            }),
            skipSchemaGate: true,
        });
    }
    catch {
        // Legacy closeout surfaces may not have an active requirement record; keep existing registry behavior.
    }
}
function inferScoreStage(stage, artifactDocPath) {
    const mapped = (0, reviewer_registry_1.getReviewerConsumerByAuditStage)(stage)?.scoreStage;
    if (mapped) {
        return mapped;
    }
    if (/tasks/i.test(artifactDocPath ?? '')) {
        return 'tasks';
    }
    if (/gaps/i.test(artifactDocPath ?? '')) {
        return 'gaps';
    }
    if (/plan/i.test(artifactDocPath ?? '')) {
        return 'plan';
    }
    if (/spec/i.test(artifactDocPath ?? '')) {
        return 'spec';
    }
    return 'implement';
}
function inferTriggerStage(stage) {
    return (0, reviewer_registry_1.getReviewerConsumerByAuditStage)(stage)?.triggerStage;
}
function inferEvent(stage) {
    if (stage === 'story') {
        return 'story_status_change';
    }
    return 'stage_audit_complete';
}
function isOrphanCloseoutStage(stage) {
    return stage === 'bugfix' || stage === 'standalone_tasks';
}
function normalizeComparablePath(value) {
    return path.normalize(value).replace(/\\/g, '/');
}
function isStoryFlowSpecArtifact(artifactPath) {
    return /^spec-E[^\\/]+-S[^\\/]+\.md$/i.test(path.basename(artifactPath));
}
function buildStorySpecVersionLockMessage(storyPath, result) {
    const normalizedStoryPath = storyPath.replace(/\\/g, '/');
    switch (result.reason) {
        case 'hash mismatch':
            return `Story→Spec source_hash lock blocked: storyPath drift detected for ${normalizedStoryPath}. Re-run Story audit or regenerate spec against the latest Story document.`;
        case 'no prior record':
            return `Story→Spec source_hash lock warning: no prior story audit record found for ${normalizedStoryPath}; proceed with explicit caution.`;
        default:
            return `Story→Spec source_hash lock blocked: ${result.reason} (${normalizedStoryPath}).`;
    }
}
function validateOrphanCloseoutReport(input) {
    const missingFields = [];
    if (!input.parsedStage?.trim()) {
        missingFields.push('stage');
    }
    if (!input.parsedReportPath?.trim()) {
        missingFields.push('reportPath');
    }
    if (!input.parsedArtifactDocPath?.trim()) {
        missingFields.push('artifactDocPath');
    }
    if (missingFields.length > 0) {
        throw new Error(`orphan closeout missing required fields for stage=${input.expectedStage}: ${missingFields.join(', ')}`);
    }
    if (input.parsedStage !== input.expectedStage) {
        throw new Error(`orphan closeout stage mismatch: expected ${input.expectedStage}, got ${input.parsedStage}`);
    }
    if (normalizeComparablePath(input.parsedReportPath) !== normalizeComparablePath(input.reportPath)) {
        throw new Error(`orphan closeout reportPath mismatch: expected ${input.reportPath}, got ${input.parsedReportPath}`);
    }
    if (normalizeComparablePath(input.parsedArtifactDocPath) !==
        normalizeComparablePath(input.artifactPath)) {
        throw new Error(`orphan closeout artifactDocPath mismatch: expected ${input.artifactPath}, got ${input.parsedArtifactDocPath}`);
    }
}
function resolveDefaultReportPath(stage, artifactPath) {
    if (stage === 'spec' || stage === 'plan' || stage === 'tasks') {
        return artifactPath.replace(/\.md$/i, '-audit.md');
    }
    return artifactPath.replace(/\.md$/i, '.audit.md');
}
async function runAuditorHost(input, deps = {}) {
    const consumer = (0, reviewer_registry_1.getReviewerConsumerByAuditStage)(input.stage);
    const normalizedInput = (0, reviewer_schema_1.buildRunAuditorHostInput)((0, reviewer_schema_1.buildReviewHostCloseoutV1)({
        projectRoot: input.projectRoot,
        profile: consumer.profile,
        stage: consumer.closeoutStage,
        artifactPath: input.artifactPath,
        reportPath: input.reportPath ?? resolveDefaultReportPath(input.stage, input.artifactPath),
        ...(input.iterationCount !== undefined ? { iterationCount: input.iterationCount } : {}),
    }));
    const hostStage = input.stage;
    const resolvedReportPath = normalizedInput.reportPath;
    const auditorScript = path.resolve(normalizedInput.projectRoot, `scripts/${consumer.auditorScript}.ts`);
    if (!fs.existsSync(resolvedReportPath)) {
        if (!auditorScript || !fs.existsSync(auditorScript)) {
            throw new Error(`missing audit report at ${resolvedReportPath} and no local auditor script is available for stage=${hostStage}`);
        }
        const iteration = String(normalizedInput.iterationCount ?? '1');
        const executeAuditorScript = deps.executeAuditorScript ??
            ((args) => {
                (0, child_process_1.execSync)(`npx ts-node ${args.auditorScript} ${args.artifactPath} ${args.iteration}`, {
                    cwd: args.projectRoot,
                    stdio: 'inherit',
                });
            });
        executeAuditorScript({
            projectRoot: normalizedInput.projectRoot,
            auditorScript,
            artifactPath: normalizedInput.artifactPath,
            iteration,
        });
    }
    const content = fs.readFileSync(resolvedReportPath, 'utf8');
    const parsed = (0, parse_bmad_audit_result_1.parseBmadAuditResult)(content);
    const status = parsed.status ?? 'UNKNOWN';
    const parsedArtifactDocPath = parsed.artifactDocPath?.trim();
    const parsedStoryPath = parsed.storyPath?.trim();
    const effectiveArtifactDocPath = parsedArtifactDocPath || normalizedInput.artifactPath;
    const expectedCloseoutStage = consumer.closeoutStage;
    if (isOrphanCloseoutStage(expectedCloseoutStage)) {
        validateOrphanCloseoutReport({
            expectedStage: expectedCloseoutStage,
            reportPath: resolvedReportPath,
            artifactPath: normalizedInput.artifactPath,
            parsedStage: parsed.stage,
            parsedReportPath: parsed.reportPath,
            parsedArtifactDocPath,
        });
    }
    const governanceClosure = (0, reviewer_schema_1.buildReviewGovernanceClosureV1)();
    const requiredFixesFromReport = parsed.requiredFixes && parsed.requiredFixes.length > 0
        ? parsed.requiredFixes
        : parsed.requiredFixesCount && parsed.requiredFixesCount > 0
            ? Array.from({ length: parsed.requiredFixesCount }, (_, index) => `Required fix #${index + 1}`)
            : [];
    const scoreCommand = deps.scoreCommand ?? defaultScoreCommand;
    const loadLatestRecordForStage = deps.loadLatestRecordByStage ?? version_lock_1.loadLatestRecordByStage;
    const checkPreconditionHashFn = deps.checkPreconditionHash ?? version_lock_1.checkPreconditionHash;
    let scoreRecord;
    let scoreError;
    let scoringFailureMode = parsed.scoreTriggerPresent ? 'succeeded' : 'not_run';
    let storySpecVersionLock;
    if (hostStage === 'spec' && isStoryFlowSpecArtifact(effectiveArtifactDocPath)) {
        if (!parsedStoryPath) {
            throw new Error('story-flow spec closeout missing required fields: storyPath');
        }
        const priorStoryRecord = loadLatestRecordForStage('story', undefined, parsedStoryPath);
        storySpecVersionLock = checkPreconditionHashFn('spec', parsedStoryPath, priorStoryRecord?.source_hash ?? null);
        if (storySpecVersionLock.action === 'warn_and_proceed') {
            console.warn(buildStorySpecVersionLockMessage(parsedStoryPath, storySpecVersionLock));
        }
    }
    if (storySpecVersionLock?.action === 'block') {
        const blockingReason = buildStorySpecVersionLockMessage(parsedStoryPath, storySpecVersionLock);
        scoreRecord = {
            effective_verdict: 'blocked',
            blocking_reason: blockingReason,
        };
        scoringFailureMode = 'not_run';
    }
    else if (parsed.scoreTriggerPresent) {
        try {
            const scoreResult = await scoreCommand({
                reportPath: resolvedReportPath,
                stage: inferScoreStage(hostStage, effectiveArtifactDocPath),
                artifactDocPath: effectiveArtifactDocPath,
                sourceHashFilePath: effectiveArtifactDocPath,
                event: inferEvent(hostStage),
                triggerStage: inferTriggerStage(hostStage),
                iterationCount: String(normalizedInput.iterationCount ?? parsed.iterationCount ?? '0'),
                skipTriggerCheck: true,
            });
            if (scoreResult && typeof scoreResult === 'object') {
                const candidate = scoreResult;
                scoreRecord = candidate.parsedRecord ?? candidate.record;
            }
        }
        catch (error) {
            scoringFailureMode = 'non_blocking_failure';
            scoreError = error instanceof Error ? error.message : String(error);
            console.error(`run-auditor-host: score write failure blocks closeout: ${scoreError}`);
        }
    }
    (0, auditor_post_actions_1.mainAuditorPostActions)([
        '--projectRoot',
        normalizedInput.projectRoot,
        '--reportPath',
        resolvedReportPath,
        '--stage',
        hostStage,
    ]);
    const closeoutEnvelope = (0, reviewer_schema_1.deriveReviewCloseoutEnvelopeV1)({
        auditStatus: status,
        scoringFailureMode,
        ...(scoreError ? { scoringFailureReason: `Score write failed: ${scoreError}` } : {}),
        requiredFixes: requiredFixesFromReport,
        scoreRecord: scoreRecord && typeof scoreRecord.effective_verdict === 'string'
            ? {
                effective_verdict: scoreRecord.effective_verdict,
                blocking_reason: typeof scoreRecord.blocking_reason === 'string'
                    ? scoreRecord.blocking_reason
                    : undefined,
                re_readiness_required: typeof scoreRecord.re_readiness_required === 'boolean'
                    ? scoreRecord.re_readiness_required
                    : undefined,
                drift_severity: scoreRecord.drift_severity === 'major' || scoreRecord.drift_severity === 'critical'
                    ? scoreRecord.drift_severity
                    : scoreRecord.drift_severity === 'none'
                        ? 'none'
                        : undefined,
            }
            : null,
    });
    const latestCloseout = {
        canMainAgentContinue: (0, continue_state_contract_1.canMainAgentContinueFromCloseout)({
            closeoutApproved: (0, reviewer_schema_1.isReviewCloseoutApproved)(closeoutEnvelope),
            scoreWriteResult: scoringFailureMode === 'succeeded'
                ? 'ok'
                : scoringFailureMode === 'non_blocking_failure'
                    ? 'failed'
                    : null,
            handoffPersisted: true,
            latestGateDecision: (0, reviewer_schema_1.isReviewCloseoutApproved)(closeoutEnvelope) ? 'pass' : 'true_blocker',
            fourSignalStatus: requiredFixesFromReport.length > 0 ? 'block' : 'pass',
        }),
        updatedAt: new Date().toISOString(),
        runner: 'runAuditorHost',
        profile: consumer.profile,
        stage: consumer.closeoutStage,
        artifactPath: effectiveArtifactDocPath,
        reportPath: resolvedReportPath,
        auditStatus: status,
        closeoutApproved: (0, reviewer_schema_1.isReviewCloseoutApproved)(closeoutEnvelope),
        governanceClosure,
        closeoutEnvelope,
        scoreWriteResult: scoringFailureMode === 'succeeded'
            ? 'ok'
            : scoringFailureMode === 'non_blocking_failure'
                ? 'failed'
                : null,
        handoffPersisted: true,
        ...(typeof scoreRecord?.readiness_baseline_run_id === 'string'
            ? { readinessBaselineRunId: scoreRecord.readiness_baseline_run_id }
            : {}),
        ...(Array.isArray(scoreRecord?.drift_signals)
            ? { driftSignals: scoreRecord.drift_signals }
            : {}),
        ...(Array.isArray(scoreRecord?.drifted_dimensions)
            ? { driftedDimensions: scoreRecord.drifted_dimensions }
            : {}),
        ...(typeof scoreRecord?.drift_severity === 'string'
            ? {
                driftSeverity: scoreRecord.drift_severity === 'major' ||
                    scoreRecord.drift_severity === 'critical' ||
                    scoreRecord.drift_severity === 'none'
                    ? scoreRecord.drift_severity
                    : null,
            }
            : {}),
        ...(typeof scoreRecord?.re_readiness_required === 'boolean'
            ? { reReadinessRequired: scoreRecord.re_readiness_required }
            : {}),
        ...(typeof scoreRecord?.blocking_reason === 'string'
            ? { blockingReason: scoreRecord.blocking_reason }
            : {}),
        ...(typeof scoreRecord?.effective_verdict === 'string'
            ? { effectiveVerdict: scoreRecord.effective_verdict }
            : {}),
        ...(scoreError ? { scoreError } : {}),
    };
    (0, runtime_context_registry_1.recordLatestReviewerCloseout)(normalizedInput.projectRoot, latestCloseout);
    syncLatestReviewerCloseoutToRequirementRecord(normalizedInput.projectRoot, latestCloseout);
    if (isOrphanCloseoutStage(consumer.closeoutStage)) {
        (0, runtime_context_registry_1.recordAuthoritativeAuditCloseout)(normalizedInput.projectRoot, {
            flow: consumer.closeoutStage,
            artifactDocPath: effectiveArtifactDocPath,
            reportPath: resolvedReportPath,
            status,
            closeoutApproved: (0, reviewer_schema_1.isReviewCloseoutApproved)(closeoutEnvelope),
        });
        (0, runtime_context_registry_1.invalidateImplementationEntryGates)(normalizedInput.projectRoot, {
            flow: consumer.closeoutStage,
        });
    }
    else if (consumer.closeoutStage === 'story') {
        (0, runtime_context_registry_1.invalidateImplementationEntryGates)(normalizedInput.projectRoot, {
            flow: 'story',
        });
    }
    return {
        status,
        governanceClosure,
        closeoutEnvelope,
        ...(scoreRecord ? { scoreRecord } : {}),
        ...(scoreError ? { scoreError } : {}),
    };
}
async function mainRunAuditorHost(argv) {
    const args = parseArgs(argv);
    const projectRoot = args.projectRoot?.trim();
    const stage = args.stage?.trim();
    const artifactPath = args.artifactPath?.trim();
    if (!projectRoot || !stage || !artifactPath) {
        console.error('run-auditor-host: usage --projectRoot <path> --stage <stage> --artifactPath <path> [--reportPath <path>] [--iterationCount <n>]');
        return 1;
    }
    try {
        const result = await runAuditorHost({
            projectRoot,
            stage: stage,
            artifactPath,
            reportPath: args.reportPath,
            iterationCount: args.iterationCount,
        });
        process.stdout.write(JSON.stringify(result));
        return result.status === 'PASS' && (0, reviewer_schema_1.isReviewCloseoutApproved)(result.closeoutEnvelope) ? 0 : 1;
    }
    catch (error) {
        console.error(`run-auditor-host: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
}
function isDirectRunAuditorHostCli(entry) {
    return /(^|[\\/])run-auditor-host(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}
if (require.main === module && isDirectRunAuditorHostCli(process.argv[1])) {
    mainRunAuditorHost(process.argv.slice(2)).then((code) => process.exit(code));
}
