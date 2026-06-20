"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEvidenceText = normalizeEvidenceText;
exports.sha256 = sha256;
exports.sha256FileIfExists = sha256FileIfExists;
exports.defaultEvidenceRunId = defaultEvidenceRunId;
exports.defaultEvidenceBundleId = defaultEvidenceBundleId;
exports.buildEvidenceProvenance = buildEvidenceProvenance;
exports.sameRunSummary = sameRunSummary;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function normalizeEvidenceText(value) {
    return (value ?? '').trim();
}
function sha256(value) {
    return node_crypto_1.default.createHash('sha256').update(value).digest('hex');
}
function sha256FileIfExists(filePath) {
    if (!node_fs_1.default.existsSync(filePath))
        return undefined;
    return sha256(node_fs_1.default.readFileSync(filePath));
}
function defaultEvidenceRunId(prefix = 'main-agent-run') {
    return `${prefix}-${Date.now()}-${node_crypto_1.default.randomBytes(4).toString('hex')}`;
}
function defaultEvidenceBundleId(runId) {
    return `${runId}:bundle`;
}
function buildEvidenceProvenance(input) {
    const root = node_path_1.default.resolve(input.root ?? process.cwd());
    const runId = normalizeEvidenceText(input.runId) || defaultEvidenceRunId(input.prefix);
    const storyKey = normalizeEvidenceText(input.storyKey) || 'S-release-gate';
    const evidenceBundleId = normalizeEvidenceText(input.evidenceBundleId) || defaultEvidenceBundleId(runId);
    const contractHash = sha256FileIfExists(node_path_1.default.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml'));
    return {
        runId,
        storyKey,
        evidenceBundleId,
        ...(contractHash ? { contractHash } : {}),
        ...(normalizeEvidenceText(input.gateReportHash)
            ? { gateReportHash: normalizeEvidenceText(input.gateReportHash) }
            : {}),
    };
}
function sameRunSummary(expected) {
    return `runId=${expected.runId}, storyKey=${expected.storyKey}, evidenceBundleId=${expected.evidenceBundleId}`;
}
