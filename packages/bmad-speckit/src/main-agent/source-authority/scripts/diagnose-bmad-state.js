#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectReviewerProjectionDiagnosis = collectReviewerProjectionDiagnosis;
exports.collectReadinessProjectionDiagnosis = collectReadinessProjectionDiagnosis;
exports.diagnoseBmadState = diagnoseBmadState;
const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");
const emit_runtime_policy_1 = require("./emit-runtime-policy");
const bmad_config_1 = require("./bmad-config");
const reviewer_registry_1 = require("./reviewer-registry");
const loader_1 = require("../packages/scoring/query/loader");
const readiness_drift_1 = require("../packages/scoring/governance/readiness-drift");
const runtime_scoring_data_path_1 = require("./runtime-scoring-data-path");
function collectReviewerProjectionDiagnosis(root) {
    try {
        const loaded = (0, emit_runtime_policy_1.loadPolicyContextFromRegistry)(root);
        const policy = (0, bmad_config_1.resolveBmadHelpRuntimePolicy)({
            projectRoot: root,
            flow: loaded.flow,
            stage: loaded.stage,
            runtimeContext: loaded.runtimeContext,
            runtimeContextPath: loaded.resolvedContextPath,
            epicId: loaded.epicId,
            storyId: loaded.storyId,
            storySlug: loaded.storySlug,
            runId: loaded.runId,
            artifactRoot: loaded.artifactRoot,
        });
        const reviewerContract = policy.reviewerContract;
        const activeConsumer = reviewerContract.activeAuditConsumer;
        const auditEntryStage = (0, reviewer_registry_1.mapFlowStageToReviewerAuditEntryStage)(loaded.flow, loaded.stage);
        const reviewerRouteExplainability = auditEntryStage
            ? [(0, reviewer_registry_1.buildReviewerRouteExplainability)({ auditEntryStage })]
            : [];
        const primaryRoute = reviewerRouteExplainability[0];
        return {
            reviewerContract,
            lines: [
                '【诊断项 4】Reviewer Projection:',
                `✅ reviewer contract: ${reviewerContract.reviewerIdentity} (${reviewerContract.version})`,
                `   shared core: ${reviewerContract.sharedCore.rootPath} [${reviewerContract.sharedCore.version}]`,
                activeConsumer
                    ? `   active consumer: ${activeConsumer.entryStage} -> ${activeConsumer.profile} -> ${activeConsumer.auditorScript} -> ${reviewerContract.closeoutRunner}`
                    : '   active consumer: (none)',
                `   cursor carrier: ${primaryRoute?.hosts.cursor.carrierSourcePath ?? '_bmad/cursor/agents/code-reviewer.md'} -> ${primaryRoute?.hosts.cursor.runtimeTargetPath ?? '.cursor/agents/code-reviewer.md'}`,
                `   cursor route: preferred=cursor-task/code-reviewer fallback=mcp_task/generalPurpose`,
                `   claude carrier: ${primaryRoute?.hosts.claude.carrierSourcePath ?? '_bmad/claude/agents/code-reviewer.md'} -> ${primaryRoute?.hosts.claude.runtimeTargetPath ?? '.claude/agents/code-reviewer.md'}`,
                `   claude route: preferred=Agent/code-reviewer fallback=Agent/general-purpose`,
                `   route reason: ${primaryRoute?.routeReasonSummary ?? '(none)'}`,
                `   fallback status: ${primaryRoute?.fallbackStatus ?? '(none)'}`,
                `   maturity: ${primaryRoute?.isomorphismMaturity ?? '(none)'}`,
                `   complexity: ${primaryRoute?.complexitySource ?? '(none)'}`,
                `   blocker: ${primaryRoute?.remainingBlocker ?? '(none)'}`,
                `   rollout gate: ${policy.reviewerContract.rolloutGate.status} -> ${policy.reviewerContract.rolloutGate.summary}`,
                loaded.runtimeContext.latestReviewerCloseout
                    ? `   latest closeout: ${loaded.runtimeContext.latestReviewerCloseout.closeoutEnvelope.resultCode} / ${loaded.runtimeContext.latestReviewerCloseout.closeoutEnvelope.packetExecutionClosureStatus} / approved=${loaded.runtimeContext.latestReviewerCloseout.closeoutApproved ? 'yes' : 'no'}`
                    : '   latest closeout: (none)',
            ],
        };
    }
    catch (error) {
        return {
            reviewerContract: null,
            lines: [
                '【诊断项 4】Reviewer Projection:',
                `⚠️ reviewer projection unavailable: ${error instanceof Error ? error.message : String(error)}`,
            ],
        };
    }
}
function collectReadinessProjectionDiagnosis(root) {
    try {
        const records = (0, loader_1.loadAndDedupeRecords)((0, runtime_scoring_data_path_1.resolveRuntimeScoringDataPath)({ root }));
        const projection = (0, readiness_drift_1.buildReadinessDriftProjection)({ allRecords: records });
        return {
            lines: [
                '【诊断项 5】Readiness Projection:',
                `✅ readiness baseline run: ${projection.readiness_baseline_run_id ?? '(none)'}`,
                `   readiness score: ${projection.readiness_score ?? '(none)'}`,
                `   effective verdict: ${projection.effective_verdict}`,
                `   drift severity: ${projection.drift_severity}`,
                `   re-readiness required: ${projection.re_readiness_required ? 'yes' : 'no'}`,
                `   drift signals: ${projection.drift_signals.join(', ') || '(none)'}`,
                `   drifted dimensions: ${projection.drifted_dimensions.join(', ') || '(none)'}`,
                `   blocking reason: ${projection.blocking_reason ?? '(none)'}`,
            ],
        };
    }
    catch (error) {
        return {
            lines: [
                '【诊断项 5】Readiness Projection:',
                `⚠️ readiness projection unavailable: ${error instanceof Error ? error.message : String(error)}`,
            ],
        };
    }
}
function diagnoseBmadState(root = process.cwd()) {
    const progressPath = path.join(root, '.claude', 'state', 'bmad-progress.yaml');
    console.log('=== BMAD 状态诊断 ===\n');
    if (!fs.existsSync(progressPath)) {
        console.error(`❌ 文件不存在: ${path.relative(root, progressPath)}`);
        console.log('建议: 运行 bmad-master 初始化流程创建状态文件');
        return 1;
    }
    const content = fs.readFileSync(progressPath, 'utf-8');
    const state = yaml.load(content);
    console.log('【诊断项 1】current_context 设置:');
    if (!state.current_context) {
        console.error('❌ current_context 未定义');
        console.log('   影响: bmad-master 无法确定当前工作上下文');
        console.log('   修复: 在 bmad-progress.yaml 中添加 current_context 节点');
    }
    else if (!state.current_context.epic || !state.current_context.story) {
        console.error('❌ current_context.epic 或 current_context.story 为空');
        console.log(`   当前值: epic=${state.current_context.epic}, story=${state.current_context.story}`);
        console.log('   修复: 设置有效的 epic 和 story 值');
    }
    else {
        console.log(`✅ current_context 正常: epic=${state.current_context.epic}, story=${state.current_context.story}`);
    }
    console.log('\n【诊断项 2】active_stories 列表:');
    if (!state.active_stories || state.active_stories.length === 0) {
        console.warn('⚠️ active_stories 为空列表');
        console.log('   说明: 当前没有活动的 Story');
    }
    else {
        console.log(`   发现 ${state.active_stories.length} 个活动 Story:\n`);
        state.active_stories.forEach((story, index) => {
            const stageValid = [
                'new',
                'story_created',
                'story_audit_passed',
                'specify_passed',
                'plan_passed',
                'gaps_passed',
                'tasks_passed',
                'implement_passed',
                'document_audit_passed',
                'commit_gate_passed',
                'commit_ready',
                'completed',
            ].includes(story.stage);
            const status = stageValid ? '✅' : '❌';
            console.log(`   ${index + 1}. ${story.epic}-${story.story}`);
            console.log(`      stage: ${story.stage} ${status}`);
            console.log(`      status: ${story.status}`);
            if (!stageValid) {
                console.log(`      ⚠️ 警告: stage 值 "${story.stage}" 不在预定义列表中`);
            }
        });
    }
    console.log('\n【诊断项 3】Story 状态文件一致性:');
    const storiesDir = path.join(root, '.claude', 'state', 'stories');
    if (fs.existsSync(storiesDir)) {
        const storyFiles = fs.readdirSync(storiesDir).filter((f) => f.endsWith('-progress.yaml'));
        console.log(`   发现 ${storyFiles.length} 个 Story 状态文件`);
        storyFiles.forEach((f) => {
            console.log(`   - ${f}`);
        });
    }
    else {
        console.warn('⚠️ stories 目录不存在');
    }
    console.log('');
    for (const line of collectReviewerProjectionDiagnosis(root).lines) {
        console.log(line);
    }
    console.log('');
    for (const line of collectReadinessProjectionDiagnosis(root).lines) {
        console.log(line);
    }
    console.log('\n=== 诊断完成 ===');
    return 0;
}
if (require.main === module) {
    process.exit(diagnoseBmadState());
}
