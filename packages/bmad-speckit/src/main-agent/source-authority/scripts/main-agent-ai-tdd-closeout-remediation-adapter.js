"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNoLocalRequiredCommandExecution = assertNoLocalRequiredCommandExecution;
exports.remediateAiTddRequiredCommandEvidenceGap = remediateAiTddRequiredCommandEvidenceGap;
const path = require("node:path");
function normalizePath(value) {
    return path.normalize(value).replace(/\\/g, '/');
}
function requireNonEmpty(value, field) {
    const normalized = String(value ?? '').trim();
    if (!normalized)
        throw new Error(`main-agent-ai-tdd-closeout-remediation-adapter:${field}_missing`);
    return normalized;
}
function assertNoLocalRequiredCommandExecution(candidate = {}) {
    const forbidden = [
        'executedRequiredCommands',
        'requiredCommandResults',
        'synthesizedDeliveryEvidence',
        'deliveryEvidence',
    ];
    for (const key of forbidden) {
        if (candidate[key] !== undefined) {
            throw new Error(`main-agent-ai-tdd-closeout-remediation-adapter:forbidden_${key}`);
        }
    }
}
function remediateAiTddRequiredCommandEvidenceGap(input) {
    const projectRoot = path.resolve(input.projectRoot ?? process.cwd());
    const runnerScript = normalizePath(path.join(projectRoot, 'scripts', 'run-required-commands-from-ai-tdd-manifest.ts'));
    const sourcePath = normalizePath(requireNonEmpty(input.sourcePath, 'sourcePath'));
    const requirementRecordPath = normalizePath(requireNonEmpty(input.requirementRecordPath, 'requirementRecordPath'));
    const closeoutAttemptId = requireNonEmpty(input.closeoutAttemptId, 'closeoutAttemptId');
    const runId = requireNonEmpty(input.runId, 'runId');
    const evidenceDir = normalizePath(requireNonEmpty(input.evidenceDir, 'evidenceDir'));
    return {
        adapter: 'main-agent-ai-tdd-closeout-remediation-adapter',
        lane: 'ai_tdd_closeout_remediation',
        status: 'dynamic_runner_required',
        runnerScript,
        runnerArgs: [
            '--source',
            sourcePath,
            '--requirement-record',
            requirementRecordPath,
            '--mode',
            'closeout',
            '--attempt-id',
            closeoutAttemptId,
            '--run-id',
            runId,
            '--evidence-dir',
            evidenceDir,
            '--json',
        ],
        forbiddenActions: [
            'execute_required_commands_locally',
            'synthesize_deliveryEvidence.requiredCommands',
            'repair_blocked_closeout_attempt_in_place',
        ],
    };
}
