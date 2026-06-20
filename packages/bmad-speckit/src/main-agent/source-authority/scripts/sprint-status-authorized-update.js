"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSprintStatusAuthorizedUpdate = runSprintStatusAuthorizedUpdate;
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_path_1 = __importDefault(require("node:path"));
const evidence_provenance_1 = require("./evidence-provenance");
const TOKEN_PREFIX = 'release-gate:pass:';
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const value = argv[index + 1];
        if (token === '--storyKey' && value) {
            out.storyKey = value;
            index += 1;
        }
        else if (token === '--status' && value) {
            out.status = value;
            index += 1;
        }
        else if (token === '--releaseGateReportPath' && value) {
            out.releaseGateReportPath = value;
            index += 1;
        }
        else if (token === '--token' && value) {
            out.token = value;
            index += 1;
        }
        else if (token === '--auditPath' && value) {
            out.auditPath = value;
            index += 1;
        }
        else if (token === '--runId' && value) {
            out.runId = value;
            index += 1;
        }
        else if (token === '--evidenceBundleId' && value) {
            out.evidenceBundleId = value;
            index += 1;
        }
    }
    return out;
}
function requireInput(input) {
    for (const key of ['storyKey', 'status', 'releaseGateReportPath', 'token']) {
        if (!input[key]) {
            throw new Error(`missing required argument: --${key}`);
        }
    }
    return input;
}
function readReleaseGateReport(root, reportPath) {
    const fullPath = node_path_1.default.isAbsolute(reportPath) ? reportPath : node_path_1.default.resolve(root, reportPath);
    return JSON.parse(node_fs_1.default.readFileSync(fullPath, 'utf8'));
}
function sha256File(filePath) {
    return node_crypto_1.default.createHash('sha256').update(node_fs_1.default.readFileSync(filePath)).digest('hex');
}
function releaseGateReportHash(report) {
    return node_crypto_1.default
        .createHash('sha256')
        .update(JSON.stringify({
        generatedAt: report.generatedAt,
        checks: report.checks ?? [],
        blocking_reasons: report.blocking_reasons ?? [],
    }))
        .digest('hex');
}
function contractHash(root) {
    return sha256File(node_path_1.default.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml'));
}
function assertAuthorized(root, input) {
    if (!input.token.startsWith(TOKEN_PREFIX)) {
        throw new Error('sprint-status update denied: invalid release token');
    }
    const reportPath = node_path_1.default.isAbsolute(input.releaseGateReportPath)
        ? input.releaseGateReportPath
        : node_path_1.default.resolve(root, input.releaseGateReportPath);
    const report = readReleaseGateReport(root, reportPath);
    if (report.critical_failures !== 0 || report.blocked_sprint_status_update) {
        throw new Error('sprint-status update denied: release gate did not pass');
    }
    const auditPath = input.auditPath ??
        node_path_1.default.join(root, '_bmad-output', 'runtime', 'governance', 'sprint-status-update-audit.json');
    if (node_fs_1.default.existsSync(auditPath)) {
        const audit = JSON.parse(node_fs_1.default.readFileSync(auditPath, 'utf8'));
        if (audit.token === input.token) {
            throw new Error('sprint-status update denied: completion intent token already used');
        }
    }
    const intent = report.completion_intent;
    if (!intent) {
        throw new Error('sprint-status update denied: missing completion intent');
    }
    if (intent.token !== input.token ||
        intent.storyKey !== input.storyKey ||
        intent.singleUse !== true ||
        Date.parse(intent.expiresAt) <= Date.now()) {
        throw new Error('sprint-status update denied: completion intent mismatch');
    }
    if (intent.gateReportHash !== releaseGateReportHash(report)) {
        throw new Error('sprint-status update denied: release gate hash mismatch');
    }
    if (intent.contractHash !== contractHash(root)) {
        throw new Error('sprint-status update denied: contract hash mismatch');
    }
}
function sprintStatusPath(root) {
    return node_path_1.default.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
}
function updateSprintStatus(root, input) {
    const target = sprintStatusPath(root);
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(target), { recursive: true });
    const existing = node_fs_1.default.existsSync(target)
        ? node_fs_1.default.readFileSync(target, 'utf8')
        : 'development_status:\n';
    const line = `  ${input.storyKey}: ${input.status}`;
    const next = existing.includes(`${input.storyKey}:`)
        ? existing.replace(new RegExp(`^\\s*${input.storyKey}:.*$`, 'm'), line)
        : `${existing.replace(/\s*$/, '\n')}${line}\n`;
    node_fs_1.default.writeFileSync(target, next, 'utf8');
    return target;
}
function currentStoryStatus(root, storyKey) {
    const target = sprintStatusPath(root);
    if (!node_fs_1.default.existsSync(target))
        return null;
    const match = node_fs_1.default
        .readFileSync(target, 'utf8')
        .match(new RegExp(`^\\s*${storyKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(.+?)\\s*$`, 'm'));
    return match?.[1] ?? null;
}
function writeAudit(root, input, targetPath, fromStatus) {
    const auditPath = input.auditPath ??
        node_path_1.default.join(root, '_bmad-output', 'runtime', 'governance', 'sprint-status-update-audit.json');
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(auditPath), { recursive: true });
    const reportPath = node_path_1.default.isAbsolute(input.releaseGateReportPath)
        ? input.releaseGateReportPath
        : node_path_1.default.resolve(root, input.releaseGateReportPath);
    const report = readReleaseGateReport(root, reportPath);
    const evidence_provenance = (0, evidence_provenance_1.buildEvidenceProvenance)({
        root,
        runId: input.runId ?? report.evidence_provenance?.runId,
        storyKey: input.storyKey,
        evidenceBundleId: input.evidenceBundleId ?? report.evidence_provenance?.evidenceBundleId,
        gateReportHash: report.completion_intent?.gateReportHash ?? releaseGateReportHash(report),
        prefix: 'sprint-status-update',
    });
    node_fs_1.default.writeFileSync(auditPath, `${JSON.stringify({
        storyKey: input.storyKey,
        status: input.status,
        authorized: true,
        evidence_provenance,
        targetPath,
        releaseGateReportPath: reportPath,
        gateReportHash: report.completion_intent?.gateReportHash ?? releaseGateReportHash(report),
        contractHash: report.completion_intent?.contractHash ?? contractHash(root),
        fromStatus: fromStatus ?? 'missing',
        toStatus: input.status,
        token: input.token,
        singleUse: true,
        expiresAt: report.completion_intent?.expiresAt ?? null,
        updatedAt: new Date().toISOString(),
    }, null, 2)}\n`, 'utf8');
}
function runSprintStatusAuthorizedUpdate(root, input) {
    assertAuthorized(root, input);
    const fromStatus = currentStoryStatus(root, input.storyKey);
    const targetPath = updateSprintStatus(root, input);
    writeAudit(root, input, targetPath, fromStatus);
    return { updated: true, sprintStatusPath: targetPath };
}
function main() {
    try {
        const input = requireInput(parseArgs(process.argv.slice(2)));
        const result = runSprintStatusAuthorizedUpdate(process.cwd(), input);
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return 0;
    }
    catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
if (require.main === module) {
    process.exit(main());
}
