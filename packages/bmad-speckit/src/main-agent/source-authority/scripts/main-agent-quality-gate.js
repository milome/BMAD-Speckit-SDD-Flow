"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const evidence_provenance_1 = require("./evidence-provenance");
const ROOT = process.cwd();
const SOURCE_ROOT = node_path_1.default.resolve(__dirname, '..');
const THRESHOLDS_PATH = '_bmad/_config/main-agent-quality-gate.thresholds.json';
const EXPECTED_VERSION = 1;
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
function normalizeText(value) {
    return (value ?? '').trim();
}
function readThresholds() {
    const fullPath = node_path_1.default.join(SOURCE_ROOT, THRESHOLDS_PATH);
    const parsed = JSON.parse(node_fs_1.default.readFileSync(fullPath, 'utf8'));
    return parsed;
}
function runtimePathExists(relativePath) {
    const requestedId = requirementRecordPathId(relativePath);
    if (requestedId !== null) {
        return activeRequirementRecordExists(requestedId);
    }
    const absolute = node_path_1.default.join(ROOT, relativePath);
    if (node_fs_1.default.existsSync(absolute))
        return true;
    return false;
}
function requirementRecordPathId(relativePath) {
    const match = relativePath
        .replace(/\\/g, '/')
        .match(/(?:^|\/)_bmad-output\/runtime\/requirement-records\/([^/]+)\/requirement-record\.json$/u);
    if (!match)
        return null;
    const recordId = match[1];
    return recordId?.startsWith('<') ? undefined : recordId;
}
function activeRequirementRecordExists(requestedRequirementSetId) {
    const indexPath = node_path_1.default.join(ROOT, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
    if (!node_fs_1.default.existsSync(indexPath))
        return false;
    try {
        const index = readJsonFile(indexPath);
        const active = index.active;
        const activeRequirementSetId = normalizeText(active?.requirementSetId ?? active?.recordId);
        const activeRecordId = normalizeText(active?.recordId);
        const requestedId = normalizeText(requestedRequirementSetId);
        const activeRecordPath = normalizeText(active?.recordPath);
        const activePathRecordId = normalizeText(requirementRecordPathId(activeRecordPath) ?? undefined);
        if (requestedId &&
            [activeRequirementSetId, activeRecordId, activePathRecordId].some(Boolean) &&
            ![activeRequirementSetId, activeRecordId, activePathRecordId].includes(requestedId)) {
            return false;
        }
        if (activeRecordPath && node_fs_1.default.existsSync(node_path_1.default.resolve(ROOT, activeRecordPath))) {
            return true;
        }
        const matched = (index.records ?? []).find((record) => {
            const requirementSetId = normalizeText(record.requirementSetId ?? record.recordId);
            const recordId = normalizeText(record.recordId);
            return ((activeRequirementSetId && requirementSetId === activeRequirementSetId) ||
                (activeRecordId && recordId === activeRecordId));
        });
        const matchedPath = normalizeText(matched?.recordPath);
        if (matchedPath && node_fs_1.default.existsSync(node_path_1.default.resolve(ROOT, matchedPath)))
            return true;
        if (activeRequirementSetId) {
            return node_fs_1.default.existsSync(node_path_1.default.join(ROOT, '_bmad-output', 'runtime', 'requirement-records', activeRequirementSetId, 'requirement-record.json'));
        }
        return false;
    }
    catch {
        return false;
    }
}
function exists(relativePath) {
    if (relativePath.startsWith('_bmad-output/')) {
        return runtimePathExists(relativePath);
    }
    return node_fs_1.default.existsSync(node_path_1.default.join(SOURCE_ROOT, relativePath));
}
function readIfExists(relativePath) {
    const fullPath = node_path_1.default.join(SOURCE_ROOT, relativePath);
    return node_fs_1.default.existsSync(fullPath) ? node_fs_1.default.readFileSync(fullPath, 'utf8') : '';
}
function readJsonFile(filePath) {
    return JSON.parse(node_fs_1.default.readFileSync(filePath, 'utf8'));
}
function resolvePath(raw) {
    const normalized = normalizeText(raw);
    if (!normalized) {
        return null;
    }
    return node_path_1.default.isAbsolute(normalized) ? normalized : node_path_1.default.resolve(ROOT, normalized);
}
function buildRunScopedCodexProofCheck(args) {
    const runId = normalizeText(args.runId);
    const storyKey = normalizeText(args.storyKey);
    const evidenceBundleId = normalizeText(args.evidenceBundleId);
    const proofPath = resolvePath(args.codexProofPath);
    if (!runId && !storyKey && !evidenceBundleId && !proofPath) {
        return null;
    }
    if (!runId || !storyKey || !evidenceBundleId || !proofPath) {
        return {
            id: 'codex-run-scoped-proof',
            passed: false,
            summary: 'run-scoped Codex proof requires --runId, --storyKey, --evidenceBundleId, and --codexProofPath',
        };
    }
    if (!node_fs_1.default.existsSync(proofPath)) {
        return {
            id: 'codex-run-scoped-proof',
            passed: false,
            summary: `missing Codex run-scoped proof: ${proofPath}`,
        };
    }
    try {
        const proof = readJsonFile(proofPath);
        const provenance = proof.evidence_provenance;
        const mismatches = [
            provenance?.runId === runId ? null : `runId=${provenance?.runId ?? 'missing'}`,
            provenance?.storyKey === storyKey ? null : `storyKey=${provenance?.storyKey ?? 'missing'}`,
            provenance?.evidenceBundleId === evidenceBundleId
                ? null
                : `evidenceBundleId=${provenance?.evidenceBundleId ?? 'missing'}`,
            proof.codex?.hostKind === 'codex' ? null : `hostKind=${proof.codex?.hostKind ?? 'missing'}`,
            proof.codex?.mode === 'codex_exec' ? null : `mode=${proof.codex?.mode ?? 'missing'}`,
            proof.codex?.taskReportStatus === 'done'
                ? null
                : `taskReportStatus=${proof.codex?.taskReportStatus ?? 'missing'}`,
        ].filter((item) => item !== null);
        return {
            id: 'codex-run-scoped-proof',
            passed: mismatches.length === 0,
            summary: mismatches.length === 0
                ? `runId=${runId}, storyKey=${storyKey}, evidenceBundleId=${evidenceBundleId}, proof=${node_path_1.default.relative(ROOT, proofPath)}`
                : `Codex run-scoped proof mismatch: ${mismatches.join(', ')}`,
        };
    }
    catch (error) {
        return {
            id: 'codex-run-scoped-proof',
            passed: false,
            summary: error instanceof Error ? error.message : String(error),
        };
    }
}
function buildChecks(thresholds, args) {
    const missingKeyPaths = thresholds.requiredKeyPaths.filter((item) => !exists(item));
    const missingAcceptanceTests = thresholds.requiredAcceptanceTests.filter((item) => !exists(item));
    const missingCodexProofs = (thresholds.requiredCodexProofPaths ?? []).filter((item) => !exists(item));
    const gateSource = readIfExists('scripts/main-agent-quality-gate.ts');
    const forbiddenMarkers = thresholds.forbiddenTodoMarkers.filter((marker) => gateSource.includes(marker));
    const checks = [
        {
            id: 'threshold-version',
            passed: thresholds.version === EXPECTED_VERSION && thresholds.gateId === 'main-agent-quality-gate',
            summary: `threshold version=${thresholds.version}, gateId=${thresholds.gateId}`,
        },
        {
            id: 'missing-key-paths',
            passed: missingKeyPaths.length <= thresholds.maxMissingKeyPaths,
            summary: missingKeyPaths.length === 0
                ? 'all required key paths exist'
                : `missing key paths: ${missingKeyPaths.join(', ')}`,
        },
        {
            id: 'acceptance-coverage',
            passed: missingAcceptanceTests.length === 0,
            summary: missingAcceptanceTests.length === 0
                ? 'all required acceptance tests exist'
                : `missing acceptance tests: ${missingAcceptanceTests.join(', ')}`,
        },
        {
            id: 'codex-parity-proof-artifacts',
            passed: missingCodexProofs.length === 0,
            summary: missingCodexProofs.length === 0
                ? 'all required Codex proof artifacts exist'
                : `missing Codex proof artifacts: ${missingCodexProofs.join(', ')}`,
        },
        {
            id: 'todo-stub-markers',
            passed: forbiddenMarkers.length <= thresholds.maxForbiddenTodoMarkers &&
                forbiddenMarkers.length <= thresholds.maxTodoStubs,
            summary: forbiddenMarkers.length === 0
                ? 'no forbidden TODO stub markers found'
                : `forbidden markers: ${forbiddenMarkers.join(', ')}`,
        },
    ];
    const runScopedCodexProof = buildRunScopedCodexProofCheck(args);
    if (runScopedCodexProof) {
        checks.push(runScopedCodexProof);
    }
    return checks;
}
function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    const thresholds = readThresholds();
    const checks = buildChecks(thresholds, args);
    const failed = checks.filter((check) => !check.passed);
    const evidence_provenance = (0, evidence_provenance_1.buildEvidenceProvenance)({
        root: SOURCE_ROOT,
        runId: args.runId,
        storyKey: args.storyKey,
        evidenceBundleId: args.evidenceBundleId,
        prefix: 'quality-gate',
    });
    const report = {
        reportType: 'main_agent_quality_gate',
        thresholdsPath: THRESHOLDS_PATH,
        evidence_provenance,
        critical_failures: failed.length,
        checks,
    };
    report.evidence_provenance = {
        ...report.evidence_provenance,
        gateReportHash: (0, evidence_provenance_1.sha256)(JSON.stringify({
            thresholdsPath: report.thresholdsPath,
            critical_failures: report.critical_failures,
            checks: report.checks,
        })),
    };
    const reportPath = node_path_1.default.join(ROOT, '_bmad-output', 'runtime', 'gates', 'main-agent-quality-gate-report.json');
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(reportPath), { recursive: true });
    node_fs_1.default.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (failed.length > 0) {
        console.error('[main-agent-quality-gate] BLOCKED: quality thresholds failed');
        for (const check of failed) {
            console.error(`- ${check.id}: ${check.summary}`);
        }
        return 1;
    }
    return 0;
}
if (require.main === module) {
    process.exit(main());
}
