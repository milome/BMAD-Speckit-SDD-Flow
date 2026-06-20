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
exports.evaluateDeliveryTruthGate = evaluateDeliveryTruthGate;
exports.main = main;
/* eslint-disable no-console */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const parallel_mission_control_1 = require("./parallel-mission-control");
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token.startsWith('--') && argv[index + 1]) {
            out[token.slice(2)] = argv[++index];
        }
    }
    return out;
}
function readJson(filePath) {
    if (!filePath)
        return { value: null, missing: true };
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved))
        return { value: null, missing: true };
    try {
        return { value: JSON.parse(fs.readFileSync(resolved, 'utf8')), missing: false };
    }
    catch (error) {
        return {
            value: null,
            missing: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
function defaultEvidencePaths(root) {
    return {
        releaseGate: path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-release-gate-report.json'),
        hostMatrix: path.join(root, '_bmad-output', 'runtime', 'e2e', 'multi-host-pr-orchestration-report.json'),
        prTopology: path.join(root, '_bmad-output', 'runtime', 'pr', 'pr_topology.json'),
        sprintAudit: path.join(root, '_bmad-output', 'runtime', 'governance', 'sprint-status-update-audit.json'),
        qualityGate: path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-quality-gate-report.json'),
    };
}
function checkReleaseGate(evidence) {
    return {
        passed: evidence != null &&
            evidence.critical_failures === 0 &&
            evidence.blocked_sprint_status_update === false &&
            evidence.completion_intent != null &&
            evidence.completion_intent.token !== '' &&
            evidence.completion_intent.storyKey !== '' &&
            evidence.completion_intent.contractHash !== '' &&
            evidence.completion_intent.gateReportHash !== '' &&
            evidence.completion_intent.singleUse === true &&
            Date.parse(evidence.completion_intent.expiresAt) > Date.now(),
        summary: evidence
            ? `critical_failures=${evidence.critical_failures}, blocked_sprint_status_update=${evidence.blocked_sprint_status_update}, completion_intent=${evidence.completion_intent ? 'present' : 'missing'}`
            : 'missing',
    };
}
function checkHostMatrix(evidence) {
    const requiredHosts = new Set(evidence?.hostMatrix?.requiredHosts ?? []);
    const hasAllRequiredHosts = requiredHosts.has('cursor') && requiredHosts.has('claude') && requiredHosts.has('codex');
    return {
        passed: evidence != null &&
            evidence.journeyMode === 'real' &&
            evidence.journeyE2EPassed === true &&
            evidence.hostMatrix?.matrixType === 'main_agent_multi_host_matrix' &&
            hasAllRequiredHosts &&
            evidence.hostMatrix.hostsPassed.cursor === true &&
            evidence.hostMatrix.hostsPassed.claude === true &&
            evidence.hostMatrix.hostsPassed.codex === true &&
            evidence.hostMatrix.allRequiredHostsPassed === true,
        summary: evidence
            ? `mode=${evidence.journeyMode}, journey=${evidence.journeyE2EPassed}, cursor=${evidence.hostMatrix?.hostsPassed.cursor}, claude=${evidence.hostMatrix?.hostsPassed.claude}, codex=${evidence.hostMatrix?.hostsPassed.codex}, allRequiredHostsPassed=${evidence.hostMatrix?.allRequiredHostsPassed}`
            : 'missing',
    };
}
function checkPrTopology(evidence) {
    const validation = evidence ? (0, parallel_mission_control_1.validatePrTopologyForReleaseGate)(evidence) : { passed: false };
    const allClosed = evidence?.required_nodes.every((node) => ['merged', 'closed_not_needed'].includes(node.state)) === true;
    return {
        passed: evidence != null && validation.passed && evidence.all_affected_stories_passed && allClosed,
        summary: evidence
            ? `all_affected_stories_passed=${evidence.all_affected_stories_passed}, nodes=${evidence.required_nodes
                .map((node) => `${node.node_id}:${node.state}`)
                .join(',')}`
            : 'missing',
    };
}
function checkSprintAudit(evidence) {
    return {
        passed: evidence != null &&
            evidence.authorized === true &&
            evidence.storyKey !== '' &&
            evidence.releaseGateReportPath != null &&
            evidence.gateReportHash != null &&
            evidence.gateReportHash !== '' &&
            evidence.contractHash != null &&
            evidence.contractHash !== '' &&
            evidence.fromStatus != null &&
            evidence.fromStatus !== '' &&
            evidence.toStatus === evidence.status &&
            evidence.token != null &&
            evidence.token !== '' &&
            evidence.singleUse === true &&
            evidence.expiresAt != null &&
            Date.parse(evidence.expiresAt) > Date.now(),
        summary: evidence
            ? `storyKey=${evidence.storyKey}, status=${evidence.status}, authorized=${evidence.authorized}, strongAudit=${Boolean(evidence.gateReportHash && evidence.contractHash && evidence.singleUse)}`
            : 'missing',
    };
}
function checkQualityGate(evidence) {
    return {
        passed: evidence != null && evidence.critical_failures === 0,
        summary: evidence ? `critical_failures=${evidence.critical_failures}` : 'missing',
    };
}
function checkEvidenceProvenance(input) {
    const entries = [
        ['releaseGate', input.releaseGate?.evidence_provenance],
        ['hostMatrix', input.hostMatrix?.evidence_provenance],
        ['prTopology', input.prTopology?.evidence_provenance],
        ['sprintAudit', input.sprintAudit?.evidence_provenance],
        ['qualityGate', input.qualityGate?.evidence_provenance],
    ];
    const present = entries.filter(([, value]) => value != null);
    if (present.length === 0) {
        return { passed: false, summary: 'missing evidence_provenance on all delivery artifacts' };
    }
    if (present.length !== entries.length) {
        return {
            passed: false,
            summary: `partial evidence_provenance: ${present.map(([id]) => id).join(',')}`,
        };
    }
    const first = present[0][1];
    const mismatches = present.filter(([, value]) => value == null ||
        value.runId !== first.runId ||
        value.storyKey !== first.storyKey ||
        value.evidenceBundleId !== first.evidenceBundleId ||
        value.gateReportHash == null ||
        value.gateReportHash === '');
    return {
        passed: mismatches.length === 0 &&
            first.runId !== '' &&
            first.storyKey !== '' &&
            first.evidenceBundleId !== '' &&
            first.gateReportHash != null &&
            first.gateReportHash !== '',
        summary: mismatches.length === 0
            ? `runId=${first.runId}, storyKey=${first.storyKey}, evidenceBundleId=${first.evidenceBundleId}, gateReportHash=present`
            : `provenance mismatch: ${mismatches.map(([id]) => id).join(',')}`,
    };
}
function evaluateDeliveryTruthGate(input) {
    const env = input.env ?? process.env;
    const checks = [
        { id: 'release-gate', ...checkReleaseGate(input.releaseGate) },
        { id: 'multi-host-host-matrix', ...checkHostMatrix(input.hostMatrix ?? null) },
        { id: 'pr-topology-closed', ...checkPrTopology(input.prTopology) },
        { id: 'authorized-sprint-status-write', ...checkSprintAudit(input.sprintAudit) },
        { id: 'quality-gate', ...checkQualityGate(input.qualityGate ?? null) },
        {
            id: 'same-run-evidence-provenance',
            ...checkEvidenceProvenance({ ...input, hostMatrix: input.hostMatrix ?? null }),
        },
        {
            id: 'test-dev-seams-disabled',
            passed: env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT !== 'true' &&
                env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE !== 'true',
            summary: env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT === 'true' ||
                env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE === 'true'
                ? `unsafe seam enabled: MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT=${env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT ?? 'unset'}, MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE=${env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE ?? 'unset'}`
                : 'test/dev seams disabled',
        },
    ];
    const failedEvidence = checks
        .filter((check) => !check.passed)
        .map((check) => `${check.id}: ${check.summary}`);
    const missingEvidence = input.missingEvidence ?? [];
    const completionAllowed = failedEvidence.length === 0 && missingEvidence.length === 0;
    const deliveryStatus = completionAllowed
        ? 'complete'
        : missingEvidence.length > 0
            ? 'blocked'
            : 'partial';
    return {
        reportType: 'main_agent_delivery_truth_gate',
        generatedAt: new Date().toISOString(),
        completionAllowed,
        deliveryStatus,
        completionLanguage: completionAllowed
            ? 'complete_allowed'
            : deliveryStatus === 'partial'
                ? 'partial_only'
                : 'blocked_only',
        missingEvidence,
        failedEvidence,
        evidencePaths: input.evidencePaths ?? {},
        checks,
    };
}
function main(argv) {
    const args = parseArgs(argv);
    const root = path.resolve(args.cwd ?? process.cwd());
    const defaults = defaultEvidencePaths(root);
    const missingEvidence = [];
    const evidencePaths = {
        releaseGate: args.releaseGatePath ?? defaults.releaseGate,
        hostMatrix: args.hostMatrixPath ?? defaults.hostMatrix,
        prTopology: args.prTopologyPath ?? defaults.prTopology,
        sprintAudit: args.sprintAuditPath ?? defaults.sprintAudit,
        qualityGate: args.qualityGatePath ?? defaults.qualityGate,
    };
    const releaseGate = readJson(evidencePaths.releaseGate);
    const hostMatrix = readJson(evidencePaths.hostMatrix);
    const prTopology = readJson(evidencePaths.prTopology);
    const sprintAudit = readJson(evidencePaths.sprintAudit);
    const qualityGate = readJson(evidencePaths.qualityGate);
    for (const [id, result] of Object.entries({
        releaseGate,
        hostMatrix,
        prTopology,
        sprintAudit,
        qualityGate,
    })) {
        const evidencePath = evidencePaths[id];
        if (result.missing)
            missingEvidence.push(`${id}: ${evidencePath}`);
        if (result.error)
            missingEvidence.push(`${id}: ${evidencePath}: ${result.error}`);
    }
    const report = evaluateDeliveryTruthGate({
        releaseGate: releaseGate.value,
        hostMatrix: hostMatrix.value,
        prTopology: prTopology.value,
        sprintAudit: sprintAudit.value,
        qualityGate: qualityGate.value,
        missingEvidence,
        evidencePaths,
    });
    const reportPath = path.resolve(args.reportPath ??
        path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-delivery-truth-gate-report.json'));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(report, null, 2));
    return report.completionAllowed || args.allowPartialExitZero === 'true' ? 0 : 1;
}
if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}
