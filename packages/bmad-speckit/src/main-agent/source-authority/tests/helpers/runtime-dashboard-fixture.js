"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REAL_TOOL_TRACE_VARIANT_CONFIG = void 0;
exports.createRuntimeDashboardFixture = createRuntimeDashboardFixture;
const node_fs_1 = require("node:fs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const node_child_process_1 = require("node:child_process");
const cli_1 = require("../../packages/runtime-context/src/cli");
const registry_1 = require("../../packages/runtime-context/src/registry");
const parse_and_write_1 = require("../../packages/scoring/orchestrator/parse-and-write");
const loader_1 = require("../../packages/scoring/query/loader");
const candidate_builder_1 = require("../../packages/scoring/analytics/candidate-builder");
const bundle_writer_1 = require("../../packages/scoring/analytics/bundle-writer");
const runtime_dashboard_fixture_manifest_1 = require("./runtime-dashboard-fixture-manifest");
Object.defineProperty(exports, "REAL_TOOL_TRACE_VARIANT_CONFIG", { enumerable: true, get: function () { return runtime_dashboard_fixture_manifest_1.REAL_TOOL_TRACE_FIXTURE_MANIFEST; } });
function initGitRepoWithCommittedDiff(root) {
    const workFile = path.join(root, 'src', 'runtime-dashboard.ts');
    fs.mkdirSync(path.dirname(workFile), { recursive: true });
    (0, node_child_process_1.execSync)('git init', { cwd: root, stdio: 'ignore' });
    (0, node_child_process_1.execSync)('git config user.email "vitest@example.com"', { cwd: root, stdio: 'ignore' });
    (0, node_child_process_1.execSync)('git config user.name "Vitest"', { cwd: root, stdio: 'ignore' });
    fs.writeFileSync(workFile, "export const renderDashboard = () => 'legacy-runtime-dashboard';\n", 'utf-8');
    (0, node_child_process_1.execSync)('git add .', { cwd: root, stdio: 'ignore' });
    (0, node_child_process_1.execSync)('git commit -m "base runtime dashboard"', { cwd: root, stdio: 'ignore' });
    const baseCommitHash = (0, node_child_process_1.execSync)('git rev-parse HEAD', {
        cwd: root,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    fs.writeFileSync(workFile, [
        'export const renderDashboard = () => ({',
        "  status: 'live',",
        "  panels: ['overview', 'runtime', 'timeline', 'score', 'sft'],",
        '});',
        '',
    ].join('\n'), 'utf-8');
    (0, node_child_process_1.execSync)('git add src/runtime-dashboard.ts', { cwd: root, stdio: 'ignore' });
    (0, node_child_process_1.execSync)('git commit -m "wire sft dashboard"', { cwd: root, stdio: 'ignore' });
    return baseCommitHash;
}
function buildCanonicalFixtureSample(runId, stage, sourcePath, variant) {
    const common = {
        sample_version: 'v1',
        source: {
            run_id: runId,
            stage,
            flow: 'dev_story',
            epic_id: 'epic-15',
            story_id: '15-1-runtime-dashboard-sft',
            story_slug: 'runtime-dashboard-sft',
            event_ids: [`evt-${variant}-${runId}`],
            artifact_refs: [
                {
                    path: sourcePath,
                    content_hash: `sha256:${variant}-artifact`,
                    source_hash: `sha256:${variant}-source`,
                    kind: 'plan_doc',
                },
            ],
        },
        provenance: {
            base_commit_hash: 'ad245b7',
            content_hash: `sha256:${variant}-content`,
            source_hash: `sha256:${variant}-source`,
            source_path: sourcePath,
            patch_ref: null,
            generator_version: 'candidate-builder.v3',
            schema_version: 'canonical-sft-sample.v1',
            lineage: [runId, `evt-${variant}-${runId}`],
            generated_at: '2026-03-28T00:00:00.000Z',
        },
        metadata: {
            schema_targets: ['openai_chat', 'hf_conversational', 'hf_tool_calling'],
            host_kind: 'cursor',
            language: 'zh-CN',
            tags: ['runtime-dashboard', 'sft', `variant:${variant}`],
        },
        split: {
            assignment: variant === 'clean' ? 'train' : variant === 'redacted' ? 'validation' : 'test',
            seed: 42,
            strategy: 'story_hash_v1',
            group_key: `epic-15/story-15-1-runtime-dashboard-sft/${variant}`,
        },
    };
    if (variant === 'clean') {
        return {
            ...common,
            sample_id: `sample-clean-${runId}`,
            messages: [
                { role: 'system', content: 'You are a coding agent.' },
                { role: 'user', content: '请修复 runtime dashboard 的问题。' },
                {
                    role: 'assistant',
                    content: "export const renderDashboard = () => ({ panels: ['overview', 'runtime', 'timeline', 'score', 'sft'] });",
                    tool_calls: [
                        {
                            id: `call-clean-${runId}`,
                            type: 'function',
                            function: {
                                name: 'apply_patch',
                                arguments: JSON.stringify({ file_path: sourcePath, patch: 'renderDashboard' }),
                            },
                        },
                    ],
                },
                {
                    role: 'tool',
                    tool_call_id: `call-clean-${runId}`,
                    content: 'Patch applied successfully.',
                },
            ],
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'apply_patch',
                        description: 'Apply code changes to a file.',
                        parameters: {
                            type: 'object',
                            properties: {
                                file_path: { type: 'string' },
                                patch: { type: 'string' },
                            },
                        },
                    },
                },
            ],
            quality: {
                acceptance_decision: 'accepted',
                phase_score: 96,
                raw_phase_score: 96,
                trace_completeness: 'complete',
                training_ready: true,
                training_blockers: [],
                veto_triggered: false,
                iteration_count: 0,
                has_code_pair: true,
                token_estimate: 40,
                dedupe_cluster_id: null,
                safety_flags: [],
                rejection_reasons: [],
                warnings: [],
            },
            redaction: {
                status: 'clean',
                applied_rules: [],
                findings: [],
                redacted_fields: [],
            },
            export_compatibility: {
                openai_chat: { compatible: true, reasons: [], warnings: [] },
                hf_conversational: { compatible: true, reasons: [], warnings: [] },
                hf_tool_calling: { compatible: true, reasons: [], warnings: [] },
            },
        };
    }
    if (variant === 'redacted') {
        return {
            ...common,
            sample_id: `sample-redacted-${runId}`,
            messages: [
                { role: 'system', content: 'You are a coding agent.' },
                { role: 'user', content: '请修复 runtime dashboard 的问题。' },
                {
                    role: 'assistant',
                    content: 'export const apiKey = "[REDACTED_SECRET]";',
                    tool_calls: [
                        {
                            id: `call-redacted-${runId}`,
                            type: 'function',
                            function: {
                                name: 'apply_patch',
                                arguments: JSON.stringify({ file_path: sourcePath, patch: 'redacted-secret' }),
                            },
                        },
                    ],
                },
                {
                    role: 'tool',
                    tool_call_id: `call-redacted-${runId}`,
                    content: 'Sensitive token detected and redacted.',
                },
            ],
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'apply_patch',
                        description: 'Apply code changes to a file.',
                        parameters: {
                            type: 'object',
                            properties: {
                                file_path: { type: 'string' },
                                patch: { type: 'string' },
                            },
                        },
                    },
                },
            ],
            quality: {
                acceptance_decision: 'accepted',
                phase_score: 96,
                raw_phase_score: 96,
                trace_completeness: 'complete',
                training_ready: true,
                training_blockers: [],
                veto_triggered: false,
                iteration_count: 0,
                has_code_pair: true,
                token_estimate: 20,
                dedupe_cluster_id: null,
                safety_flags: [],
                rejection_reasons: [],
                warnings: ['warning_redacted_noncritical'],
            },
            redaction: {
                status: 'redacted',
                applied_rules: ['secret-token'],
                findings: [
                    {
                        kind: 'secret_token',
                        severity: 'high',
                        field_path: 'messages[2].content',
                        action: 'redact',
                    },
                ],
                redacted_fields: ['messages[2].content'],
            },
            export_compatibility: {
                openai_chat: { compatible: true, reasons: [], warnings: ['warning_redacted_noncritical'] },
                hf_conversational: {
                    compatible: true,
                    reasons: [],
                    warnings: ['warning_redacted_noncritical'],
                },
                hf_tool_calling: {
                    compatible: true,
                    reasons: [],
                    warnings: ['warning_redacted_noncritical'],
                },
            },
        };
    }
    return {
        ...common,
        sample_id: `sample-blocked-${runId}`,
        messages: [
            { role: 'system', content: 'You are a coding agent.' },
            { role: 'user', content: '请修复 runtime dashboard 的问题。' },
            { role: 'assistant', content: 'export const privateKey = "[BLOCKED_PRIVATE_KEY]";' },
        ],
        quality: {
            acceptance_decision: 'rejected',
            phase_score: 96,
            raw_phase_score: 96,
            trace_completeness: 'blocked',
            training_ready: false,
            training_blockers: ['redaction_blocked', 'tool_trace_blocked'],
            veto_triggered: false,
            iteration_count: 0,
            has_code_pair: true,
            token_estimate: 20,
            dedupe_cluster_id: null,
            safety_flags: [],
            rejection_reasons: ['redaction_blocked', 'secret_detected_unresolved'],
            warnings: [],
        },
        redaction: {
            status: 'blocked',
            applied_rules: ['private-key'],
            findings: [
                {
                    kind: 'private_key',
                    severity: 'critical',
                    field_path: 'messages[2].content',
                    action: 'block',
                },
            ],
            redacted_fields: ['messages[2].content'],
        },
        export_compatibility: {
            openai_chat: { compatible: false, reasons: ['redaction_blocked'], warnings: [] },
            hf_conversational: { compatible: false, reasons: ['redaction_blocked'], warnings: [] },
            hf_tool_calling: { compatible: false, reasons: ['redaction_blocked'], warnings: [] },
        },
    };
}
function writeBugfixDoc(root) {
    const docPath = path.join(root, 'docs', 'plans', 'BUGFIX_runtime-dashboard-sft.md');
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(docPath, [
        '## §1 问题',
        '当前 runtime dashboard 无法看到 canonical SFT builder 的真实状态。',
        '',
        '## §4 修复方案',
        '把 live dashboard、MCP 和 canonical candidate pipeline 串起来，展示 accepted/rejected、bundle 和 target availability。',
        '',
    ].join('\n'), 'utf-8');
    return docPath;
}
function replayRealCursorToolTraceFixture(root, runId, variant) {
    const config = (0, runtime_dashboard_fixture_manifest_1.getRealToolTraceVariantConfig)(variant);
    const runContextRelativePath = path.join('_bmad-output', 'runtime', 'context', 'runs', 'epic-15', '15-1-runtime-dashboard-sft', `${runId}.json`);
    const runContextPath = path.join(root, runContextRelativePath);
    fs.mkdirSync(path.dirname(runContextPath), { recursive: true });
    fs.writeFileSync(runContextPath, JSON.stringify({
        version: 1,
        flow: 'story',
        stage: config.stage,
        sourceMode: 'full_bmad',
        epicId: 'epic-15',
        storyId: '15-1-runtime-dashboard-sft',
        storySlug: 'runtime-dashboard-sft',
        runId,
        contextScope: 'story',
        updatedAt: '2026-03-28T12:00:00.000Z',
    }, null, 2) + '\n', 'utf-8');
    const registry = fs.existsSync((0, registry_1.runtimeContextRegistryPath)(root))
        ? (0, registry_1.readRuntimeContextRegistry)(root)
        : (0, registry_1.defaultRuntimeContextRegistry)(root);
    registry.runContexts[runId] = {
        path: runContextRelativePath,
        epicId: 'epic-15',
        storyId: '15-1-runtime-dashboard-sft',
        runId,
        lifecycleStage: 'dev_story',
    };
    registry.activeScope = {
        scopeType: 'run',
        epicId: 'epic-15',
        storyId: '15-1-runtime-dashboard-sft',
        runId,
        resolvedContextPath: runContextRelativePath,
        reason: 'runtime-dashboard-fixture real cursor tool trace',
    };
    (0, registry_1.writeRuntimeContextRegistry)(root, registry);
    const artifactDir = path.join(root, '_bmad-output', 'runtime', 'artifacts', 'tool-traces', runId);
    fs.mkdirSync(artifactDir, { recursive: true });
    const sourcePath = 'docs/plans/BUGFIX_runtime-dashboard-sft.md';
    const toolTracePath = path.join(artifactDir, `${config.stage}.json`);
    fs.writeFileSync(toolTracePath, JSON.stringify(buildCanonicalFixtureSample(runId, config.stage, sourcePath, variant), null, 2) +
        '\n', 'utf-8');
    if (config.stage !== 'implement') {
        fs.copyFileSync(toolTracePath, path.join(artifactDir, 'implement.json'));
    }
    return toolTracePath;
}
async function createRuntimeDashboardFixture(options = {}) {
    const root = (0, node_fs_1.mkdtempSync)(path.join(os.tmpdir(), 'runtime-dashboard-fixture-'));
    (0, cli_1.runEnsureRunCli)({
        cwd: root,
        storyKey: '15-1-runtime-dashboard-sft',
        lifecycle: 'dev_story',
    });
    const lastRun = JSON.parse(fs.readFileSync(path.join(root, '_bmad-output', 'runtime', 'last-dev-story-run.json'), 'utf-8'));
    const dataPath = path.join(root, 'packages', 'scoring', 'data');
    let lastBundleId = null;
    if (options.withSftDataset) {
        const bugfixDocPath = writeBugfixDoc(root);
        const artifactDocPath = path.relative(root, bugfixDocPath).replace(/\\/g, '/');
        const baseCommitHash = initGitRepoWithCommittedDiff(root);
        if (options.withRealToolTraceFixture) {
            const variants = options.realToolTraceVariants ?? ['clean'];
            for (const variant of variants) {
                const config = (0, runtime_dashboard_fixture_manifest_1.getRealToolTraceVariantConfig)(variant);
                replayRealCursorToolTraceFixture(root, lastRun.runId, variant);
                await (0, parse_and_write_1.parseAndWriteScore)({
                    content: fs.readFileSync(config.reportFixturePath, 'utf-8'),
                    stage: config.stage,
                    runId: lastRun.runId,
                    scenario: 'real_dev',
                    writeMode: 'jsonl',
                    dataPath,
                    artifactDocPath,
                    baseCommitHash,
                });
            }
        }
        else {
            await (0, parse_and_write_1.parseAndWriteScore)({
                content: fs.readFileSync(path.join(runtime_dashboard_fixture_manifest_1.RUNTIME_DASHBOARD_REPORT_FIXTURE_ROOT, 'sample-story-report.md'), 'utf-8'),
                stage: 'story',
                runId: lastRun.runId,
                scenario: 'real_dev',
                writeMode: 'jsonl',
                dataPath,
                artifactDocPath,
                baseCommitHash,
            });
            await (0, parse_and_write_1.parseAndWriteScore)({
                content: fs.readFileSync(path.join(runtime_dashboard_fixture_manifest_1.RUNTIME_DASHBOARD_REPORT_FIXTURE_ROOT, 'sample-prd-report-veto.md'), 'utf-8'),
                stage: 'prd',
                runId: lastRun.runId,
                scenario: 'real_dev',
                writeMode: 'jsonl',
                dataPath,
                artifactDocPath,
                baseCommitHash,
            });
        }
        if (options.withBundle) {
            const samples = (0, candidate_builder_1.buildCanonicalCandidatesFromRecordsSync)((0, loader_1.loadAndDedupeRecords)(dataPath), {
                cwd: root,
                minScore: 90,
            }).samples;
            const bundle = await (0, bundle_writer_1.writeDatasetBundle)(samples, {
                exportTarget: 'openai_chat',
                outputRoot: path.join(root, '_bmad-output', 'datasets'),
                exporterVersion: 'v1-test',
                filterSettings: {
                    min_score: 90,
                },
            });
            lastBundleId = bundle.manifest.bundle_id;
        }
    }
    else {
        await (0, parse_and_write_1.parseAndWriteScore)({
            content: fs.readFileSync((0, runtime_dashboard_fixture_manifest_1.getReportFixturePathForStage)('implement'), 'utf-8'),
            stage: 'implement',
            runId: lastRun.runId,
            scenario: 'real_dev',
            writeMode: 'single_file',
            dataPath,
            artifactDocPath: 'docs/plans/BUGFIX_runtime-dashboard-sft.md',
            baseCommitHash: 'ad245b7',
        });
    }
    return {
        root,
        runId: lastRun.runId,
        dataPath,
        lastBundleId,
    };
}
