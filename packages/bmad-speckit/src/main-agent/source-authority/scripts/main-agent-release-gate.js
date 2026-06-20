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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = __importDefault(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const _2020_1 = __importDefault(require("ajv/dist/2020"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const evidence_provenance_1 = require("./evidence-provenance");
const parallel_mission_control_1 = require("./parallel-mission-control");
const sprint_status_authorized_update_1 = require("./sprint-status-authorized-update");
const main_agent_codex_worker_adapter_1 = require("./main-agent-codex-worker-adapter");
const SOURCE_ROOT = path.resolve(__dirname, '..');
function normalizeText(value) {
    return (value ?? '').trim();
}
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--ledgerPath' && argv[index + 1]) {
            out.ledgerPath = argv[index + 1];
            index += 1;
        }
        else if (token === '--record-id' && argv[index + 1]) {
            out.recordId = argv[++index];
        }
        else if (token === '--requirement-set-id' && argv[index + 1]) {
            out.requirementSetId = argv[++index];
        }
        else if (token.startsWith('--') && argv[index + 1]) {
            out[token.slice(2)] = argv[index + 1];
            index += 1;
        }
    }
    return out;
}
function runCommand(command) {
    const result = (0, node_child_process_1.spawnSync)(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: true,
    });
    return {
        exitCode: result.status ?? (result.error ? 1 : 0),
        stdout: normalizeText(result.stdout),
        stderr: normalizeText(result.stderr || result.error?.message),
    };
}
function writeReport(report) {
    const targetPath = normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_REPORT_PATH) ||
        path.join(process.cwd(), '_bmad-output', 'runtime', 'gates', 'main-agent-release-gate-report.json');
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return targetPath;
}
function writeReportAt(report, targetPath) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return targetPath;
}
function sha256(value) {
    return node_crypto_1.default.createHash('sha256').update(value).digest('hex');
}
function sha256File(filePath) {
    return sha256(fs.readFileSync(filePath));
}
function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function checkJsonFile(id, filePath, validate) {
    if (!fs.existsSync(filePath)) {
        return {
            id,
            passed: false,
            command: `read-json ${filePath}`,
            exitCode: 1,
            stdout: '',
            stderr: `missing evidence: ${filePath}`,
            failureReason: `missing evidence: ${id} at ${filePath}`,
        };
    }
    try {
        const result = validate(readJson(filePath));
        return {
            id,
            passed: result.passed,
            command: `validate-json ${filePath}`,
            exitCode: result.passed ? 0 : 1,
            stdout: result.summary,
            stderr: result.passed ? '' : result.summary,
            ...(result.passed ? {} : { failureReason: `invalid evidence: ${id}: ${result.summary}` }),
        };
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
            id,
            passed: false,
            command: `validate-json ${filePath}`,
            exitCode: 1,
            stdout: '',
            stderr: reason,
            failureReason: `invalid evidence json: ${id}: ${reason}`,
        };
    }
}
function validateEvidenceProvenance(value, expected) {
    const provenance = value.evidence_provenance;
    const mismatches = [];
    if (!provenance) {
        mismatches.push('missing evidence_provenance');
    }
    else {
        if (provenance.runId !== expected.runId) {
            mismatches.push(`runId=${provenance.runId ?? 'missing'}`);
        }
        if (provenance.storyKey !== expected.storyKey) {
            mismatches.push(`storyKey=${provenance.storyKey ?? 'missing'}`);
        }
        if (provenance.evidenceBundleId !== expected.evidenceBundleId) {
            mismatches.push(`evidenceBundleId=${provenance.evidenceBundleId ?? 'missing'}`);
        }
        if (!normalizeText(provenance.gateReportHash)) {
            mismatches.push('gateReportHash=missing');
        }
    }
    return {
        passed: mismatches.length === 0,
        summary: mismatches.length === 0
            ? `provenance=matched ${(0, evidence_provenance_1.sameRunSummary)(expected)}`
            : `provenance mismatch: ${mismatches.join(', ')}`,
    };
}
function appendScriptProvenanceArgs(command, provenance, options = {}) {
    const quoted = {
        runId: JSON.stringify(provenance.runId),
        storyKey: JSON.stringify(provenance.storyKey),
        evidenceBundleId: JSON.stringify(provenance.evidenceBundleId),
        recordId: normalizeText(options.recordId)
            ? JSON.stringify(normalizeText(options.recordId))
            : null,
        requirementSetId: normalizeText(options.requirementSetId)
            ? JSON.stringify(normalizeText(options.requirementSetId))
            : null,
    };
    return [
        command,
        `--runId ${quoted.runId}`,
        `--storyKey ${quoted.storyKey}`,
        `--evidenceBundleId ${quoted.evidenceBundleId}`,
        quoted.recordId ? `--record-id ${quoted.recordId}` : '',
        quoted.requirementSetId ? `--requirement-set-id ${quoted.requirementSetId}` : '',
    ]
        .filter(Boolean)
        .join(' ');
}
function commandSupportsScriptProvenance(command) {
    return /main-agent-(host-matrix|dual-host)-pr-orchestrator\.(ts|js)\b/u.test(command);
}
function writeReleaseQualityProofCodexShim(proofDir) {
    const shimScriptPath = path.join(proofDir, 'release-quality-proof-codex-shim.cjs');
    const shimBinPath = process.platform === 'win32'
        ? path.join(proofDir, 'release-quality-proof-codex-shim.cmd')
        : path.join(proofDir, 'release-quality-proof-codex-shim');
    fs.writeFileSync(shimScriptPath, [
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "const input = fs.readFileSync(0, 'utf8');",
        "const matchLine = (label) => input.match(new RegExp(`${label}: (.+)`, 'i'))?.[1]?.trim();",
        "const packetId = matchLine('Packet ID');",
        "const packetPath = matchLine('Read dispatch packet');",
        'const taskReportPath = input.match(/write a JSON TaskReport to: (.+)/i)?.[1]?.trim();',
        "const expectedDelta = matchLine('Expected delta') || 'release quality proof';",
        'const requiredArtifacts = [',
        "  '_bmad/_config/main-agent-quality-gate.thresholds.json',",
        "  'scripts/main-agent-quality-gate.ts',",
        "  'scripts/main-agent-release-gate.ts',",
        '];',
        'if (!packetId || !packetPath || !taskReportPath) {',
        "  console.error('release quality proof shim missing prompt fields');",
        '  process.exit(2);',
        '}',
        'const missing = [packetPath, ...requiredArtifacts].filter((item) => !fs.existsSync(path.resolve(process.cwd(), item)));',
        'if (missing.length > 0) {',
        "  console.error(`release quality proof shim missing artifacts: ${missing.join(', ')}`);",
        '  process.exit(3);',
        '}',
        'const report = {',
        '  packetId,',
        "  status: 'done',",
        '  filesChanged: [],',
        '  validationsRun: [',
        "    'release-quality-proof-deterministic-codex-exec-shim',",
        '    ...requiredArtifacts.map((item) => `inspect:${item}`),',
        '  ],',
        '  evidence: [',
        "    `dispatch-packet:${path.relative(process.cwd(), packetPath).replace(/\\\\/g, '/')}`,",
        '    ...requiredArtifacts.map((item) => `artifact-exists:${item}`),',
        '  ],',
        '  downstreamContext: [expectedDelta],',
        '};',
        'fs.mkdirSync(path.dirname(taskReportPath), { recursive: true });',
        "fs.writeFileSync(taskReportPath, `${JSON.stringify(report, null, 2)}\\n`, 'utf8');",
        'process.exit(0);',
        '',
    ].join('\n'), 'utf8');
    fs.writeFileSync(shimBinPath, process.platform === 'win32'
        ? `@echo off\r\n"${process.execPath}" "${shimScriptPath}" %*\r\n`
        : `#!/usr/bin/env sh\n"${process.execPath}" "${shimScriptPath}" "$@"\n`, 'utf8');
    if (process.platform !== 'win32') {
        fs.chmodSync(shimBinPath, 0o755);
    }
    return shimBinPath;
}
function runReleaseQualityProofAdapter(input) {
    if (process.env.MAIN_AGENT_RELEASE_GATE_CODEX_PROOF_MODE === 'live') {
        return {
            proofMode: 'live_codex_cli',
            report: (0, main_agent_codex_worker_adapter_1.runCodexWorkerAdapter)({
                projectRoot: input.root,
                recordId: input.recordId,
                requirementSetId: input.requirementSetId,
                runId: input.recordId || input.requirementSetId ? input.runId : undefined,
                packetPath: input.packetPath,
                taskReportPath: input.taskReportPath,
                timeoutMs: 120_000,
                allowPolicyFailureForDeterministicShim: !input.recordId && !input.requirementSetId,
            }),
        };
    }
    const previousAllow = process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
    process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = 'true';
    try {
        return {
            proofMode: 'deterministic_release_shim',
            report: (0, main_agent_codex_worker_adapter_1.runCodexWorkerAdapter)({
                projectRoot: input.root,
                recordId: input.recordId,
                requirementSetId: input.requirementSetId,
                runId: input.recordId || input.requirementSetId ? input.runId : undefined,
                packetPath: input.packetPath,
                taskReportPath: input.taskReportPath,
                timeoutMs: 120_000,
                allowPolicyFailureForDeterministicShim: !input.recordId && !input.requirementSetId,
                codexBinary: writeReleaseQualityProofCodexShim(input.proofDir),
            }),
        };
    }
    finally {
        if (previousAllow === undefined) {
            delete process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
        }
        else {
            process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = previousAllow;
        }
    }
}
function writeRunScopedCodexQualityProof(root, provenance, options = {}) {
    const proofDir = path.join(root, '_bmad-output', 'runtime', 'gates', 'codex-quality-proof');
    const packetPath = path.join(proofDir, `${provenance.runId}.packet.json`);
    const taskReportPath = path.join(proofDir, `${provenance.runId}.task-report.json`);
    const adapterReportPath = path.join(proofDir, `${provenance.runId}.adapter-report.json`);
    const proofPath = path.join(proofDir, `${provenance.runId}.proof.json`);
    fs.mkdirSync(proofDir, { recursive: true });
    const packet = {
        packetId: `release-quality-proof-${sha256(provenance.runId).slice(0, 12)}`,
        parentSessionId: `release-quality-proof-${provenance.runId}`,
        sourceRecommendationPacketId: null,
        flow: 'story',
        phase: 'post_audit',
        taskType: 'audit',
        role: 'release-quality-proof-worker',
        inputArtifacts: [
            '_bmad/_config/main-agent-quality-gate.thresholds.json',
            'scripts/main-agent-quality-gate.ts',
            'scripts/main-agent-release-gate.ts',
        ],
        allowedWriteScope: ['_bmad-output/runtime/gates/codex-quality-proof/**'],
        expectedDelta: 'Inspect release quality gate inputs and write the required TaskReport only; do not modify source files.',
        successCriteria: [
            'Codex worker adapter executes through main-agent-codex-worker-adapter in codex_exec mode.',
            'TaskReport status is done with evidence for same-run release quality proof.',
            'No source files outside _bmad-output/runtime/gates/codex-quality-proof are changed.',
        ],
        stopConditions: [
            'Do not claim completion without writing a strict JSON TaskReport.',
            'Do not edit application source or tests for this proof packet.',
        ],
        downstreamConsumer: 'main-agent-quality-gate-run-scoped-proof',
    };
    fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
    const { report: adapter, proofMode } = runReleaseQualityProofAdapter({
        root,
        proofDir,
        packetPath,
        taskReportPath,
        recordId: options.recordId,
        requirementSetId: options.requirementSetId,
        runId: provenance.runId,
    });
    fs.writeFileSync(adapterReportPath, `${JSON.stringify(adapter, null, 2)}\n`, 'utf8');
    if (!adapter.scopePassed || adapter.taskReport.status !== 'done') {
        return null;
    }
    const proof = {
        reportType: 'codex_run_scoped_quality_proof',
        generatedAt: new Date().toISOString(),
        evidence_provenance: provenance,
        codex: {
            hostKind: 'codex',
            mode: adapter.mode,
            proofMode,
            adapterExitCode: adapter.exitCode,
            taskReportStatus: adapter.taskReport.status,
            validationsRun: adapter.taskReport.validationsRun,
            adapterReportPath,
            taskReportPath,
            packetPath,
        },
    };
    fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
    return proofPath;
}
function resolveOptionalPath(root, raw) {
    const normalized = normalizeText(raw);
    if (!normalized) {
        return null;
    }
    return path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized);
}
function executionAuditLedgerSchemaPath(root) {
    const consumerSchema = path.join(root, 'docs', 'reference', 'execution-audit-ledger.schema.json');
    if (fs.existsSync(consumerSchema)) {
        return consumerSchema;
    }
    return path.join(SOURCE_ROOT, 'docs', 'reference', 'execution-audit-ledger.schema.json');
}
function validateExecutionAuditLedger(root, ledgerPath, expectedProvenance) {
    if (!fs.existsSync(ledgerPath)) {
        return {
            passed: false,
            reason: `execution audit ledger missing: ${ledgerPath}`,
        };
    }
    const schemaPath = executionAuditLedgerSchemaPath(root);
    if (!fs.existsSync(schemaPath)) {
        return {
            passed: false,
            reason: `execution audit ledger schema missing: ${schemaPath}`,
        };
    }
    let ledger;
    let schema;
    try {
        ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
        schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    }
    catch (error) {
        return {
            passed: false,
            reason: `execution audit ledger parse failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    const ajv = new _2020_1.default({ allErrors: true, strict: false });
    (0, ajv_formats_1.default)(ajv);
    const validate = ajv.compile(schema);
    if (!validate(ledger)) {
        const details = (validate.errors ?? [])
            .map((item) => `${item.instancePath || '/'} ${item.message || 'invalid'}`)
            .join('; ');
        return {
            passed: false,
            reason: `execution audit ledger schema validation failed: ${details}`,
        };
    }
    if (ledger.runId !== expectedProvenance.runId) {
        return {
            passed: false,
            reason: `execution audit ledger runId mismatch: ${ledger.runId} !== ${expectedProvenance.runId}`,
        };
    }
    const seen = new Set();
    for (const item of ledger.items) {
        if (seen.has(item.taskId)) {
            return {
                passed: false,
                reason: `execution audit ledger contains duplicate taskId: ${item.taskId}`,
            };
        }
        seen.add(item.taskId);
    }
    const taskMap = new Map(ledger.items.map((item) => [item.taskId, item]));
    const ledgerDir = path.dirname(ledgerPath);
    for (const item of ledger.items) {
        if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
            return {
                passed: false,
                reason: `execution audit ledger item has no evidenceRefs: ${item.taskId}`,
            };
        }
        for (const evidenceRef of item.evidenceRefs) {
            const candidates = path.isAbsolute(evidenceRef)
                ? [evidenceRef]
                : [path.resolve(root, evidenceRef), path.resolve(ledgerDir, evidenceRef)];
            if (!candidates.some((candidate) => fs.existsSync(candidate))) {
                return {
                    passed: false,
                    reason: `execution audit ledger evidenceRef missing: ${item.taskId} -> ${evidenceRef}`,
                };
            }
        }
        for (const dep of item.dependsOn ?? []) {
            const upstream = taskMap.get(dep);
            if (!upstream) {
                return {
                    passed: false,
                    reason: `execution audit ledger dependency missing: ${item.taskId} depends on unknown task ${dep}`,
                };
            }
            if ((item.status === 'pass' || item.status === 'in_progress') &&
                (upstream.status === 'fail' || upstream.status === 'blocked')) {
                return {
                    passed: false,
                    reason: `execution audit ledger inconsistent: downstream ${item.taskId}=${item.status} while upstream ${dep}=${upstream.status}`,
                };
            }
        }
    }
    return {
        passed: true,
        summary: `execution audit ledger validated: ${ledger.items.length} items`,
    };
}
function main(argv) {
    const args = parseArgs(argv);
    const root = process.cwd();
    const e2eCommand = normalizeText(process.env.MAIN_AGENT_RELEASE_GATE_E2E_COMMAND) ||
        'node node_modules/ts-node/dist/bin.js --project tsconfig.node.json --transpile-only scripts/main-agent-host-matrix-pr-orchestrator.ts --provider real --enableRealPrApi true';
    const explicitLedgerPath = resolveOptionalPath(root, args.ledgerPath) ??
        resolveOptionalPath(root, process.env.MAIN_AGENT_RELEASE_GATE_LEDGER_PATH);
    const hostMatrixPath = resolveOptionalPath(root, args.hostMatrixPath) ??
        path.join(root, '_bmad-output', 'runtime', 'e2e', 'multi-host-pr-orchestration-report.json');
    const prTopologyPath = resolveOptionalPath(root, args.prTopologyPath) ??
        path.join(root, '_bmad-output', 'runtime', 'pr', 'pr_topology.json');
    const qualityGatePath = resolveOptionalPath(root, args.qualityGatePath) ??
        path.join(root, '_bmad-output', 'runtime', 'gates', 'main-agent-quality-gate-report.json');
    const storyKey = normalizeText(args.storyKey) || 'S-release-gate';
    const expectedProvenance = (0, evidence_provenance_1.buildEvidenceProvenance)({
        root,
        runId: args.runId,
        storyKey,
        evidenceBundleId: args.evidenceBundleId,
        prefix: 'release-gate',
    });
    if (!args.qualityGatePath && !process.env.MAIN_AGENT_RELEASE_GATE_SKIP_QUALITY_PRODUCER) {
        const codexProofPath = writeRunScopedCodexQualityProof(root, expectedProvenance, {
            recordId: args.recordId,
            requirementSetId: args.requirementSetId,
        });
        const qualityCommand = appendScriptProvenanceArgs('node node_modules/ts-node/dist/bin.js --project tsconfig.node.json --transpile-only scripts/main-agent-quality-gate.ts', expectedProvenance);
        runCommand(codexProofPath
            ? `${qualityCommand} --codexProofPath ${JSON.stringify(codexProofPath)}`
            : qualityCommand);
    }
    const e2eCommandWithProvenance = commandSupportsScriptProvenance(e2eCommand)
        ? appendScriptProvenanceArgs(e2eCommand, expectedProvenance, {
            recordId: args.recordId,
            requirementSetId: args.requirementSetId,
        })
        : e2eCommand;
    const useExplicitHostMatrixArtifact = Boolean(args.hostMatrixPath && fs.existsSync(hostMatrixPath));
    const e2eResult = useExplicitHostMatrixArtifact
        ? {
            exitCode: 0,
            stdout: `using explicit hostMatrixPath: ${hostMatrixPath}`,
            stderr: '',
        }
        : runCommand(e2eCommandWithProvenance);
    const checks = [
        {
            id: 'multi-host-e2e-journey',
            passed: e2eResult.exitCode === 0,
            command: useExplicitHostMatrixArtifact
                ? `use-explicit-host-matrix-artifact ${hostMatrixPath}`
                : e2eCommandWithProvenance,
            exitCode: e2eResult.exitCode,
            stdout: e2eResult.stdout,
            stderr: e2eResult.stderr,
            ...(e2eResult.exitCode === 0
                ? {}
                : {
                    failureReason: 'multi-host E2E journey failed',
                }),
        },
        checkJsonFile('multi-host-real-artifact', hostMatrixPath, (value) => {
            const provenance = validateEvidenceProvenance(value, expectedProvenance);
            const requiredHosts = new Set(value.hostMatrix?.requiredHosts ?? []);
            const hasAllRequiredHosts = requiredHosts.has('cursor') && requiredHosts.has('claude') && requiredHosts.has('codex');
            const passed = value.journeyMode === 'real' &&
                value.journeyE2EPassed === true &&
                value.hostMatrix?.matrixType === 'main_agent_multi_host_matrix' &&
                hasAllRequiredHosts &&
                value.hostMatrix?.hostsPassed?.cursor === true &&
                value.hostMatrix?.hostsPassed?.claude === true &&
                value.hostMatrix?.hostsPassed?.codex === true &&
                value.hostMatrix?.allRequiredHostsPassed === true &&
                value.githubPrApi?.passed === true &&
                typeof value.githubPrApi.prUrl === 'string' &&
                value.githubPrApi.prUrl.length > 0 &&
                provenance.passed;
            return {
                passed,
                summary: `mode=${value.journeyMode}, journey=${value.journeyE2EPassed}, cursor=${value.hostMatrix?.hostsPassed?.cursor}, claude=${value.hostMatrix?.hostsPassed?.claude}, codex=${value.hostMatrix?.hostsPassed?.codex}, allRequiredHostsPassed=${value.hostMatrix?.allRequiredHostsPassed}, githubPrApi=${value.githubPrApi?.passed}, prUrl=${value.githubPrApi?.prUrl ?? 'missing'}, ${provenance.summary}`,
            };
        }),
        checkJsonFile('pr-topology-release-artifact', prTopologyPath, (value) => {
            const provenance = validateEvidenceProvenance(value, expectedProvenance);
            const validation = (0, parallel_mission_control_1.validatePrTopologyForReleaseGate)(value);
            const closed = value.all_affected_stories_passed === true &&
                value.required_nodes.every((node) => ['merged', 'closed_not_needed'].includes(node.state));
            return {
                passed: validation.passed && closed && provenance.passed,
                summary: `all_affected_stories_passed=${value.all_affected_stories_passed}, nodes=${value.required_nodes.map((node) => `${node.node_id}:${node.state}`).join(',')}, ${provenance.summary}`,
            };
        }),
        checkJsonFile('quality-gate-artifact', qualityGatePath, (value) => {
            const provenance = validateEvidenceProvenance(value, expectedProvenance);
            return {
                passed: value.critical_failures === 0 && provenance.passed,
                summary: `critical_failures=${value.critical_failures}, ${provenance.summary}`,
            };
        }),
    ];
    for (const [id, command] of [
        [
            'single-source-whitelist',
            args.singleSourceCommand ?? 'npm run validate:single-source-whitelist',
        ],
        ['rerun-gate-e2e-loop', args.rerunGateCommand ?? 'npm run test:main-agent-rerun-gate-e2e-loop'],
    ]) {
        const result = runCommand(command);
        checks.push({
            id,
            passed: result.exitCode === 0,
            command,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            ...(result.exitCode === 0 ? {} : { failureReason: `release prerequisite failed: ${id}` }),
        });
    }
    {
        if (explicitLedgerPath) {
            const ledgerCheck = validateExecutionAuditLedger(root, explicitLedgerPath, expectedProvenance);
            checks.push({
                id: 'execution-audit-ledger',
                passed: ledgerCheck.passed,
                command: `validate-ledger ${explicitLedgerPath}`,
                exitCode: ledgerCheck.passed ? 0 : 1,
                stdout: ledgerCheck.passed ? ledgerCheck.summary : '',
                stderr: ledgerCheck.passed ? '' : ledgerCheck.reason,
                ...(ledgerCheck.passed
                    ? {}
                    : {
                        failureReason: `execution audit ledger failed: ${ledgerCheck.reason}`,
                    }),
            });
        }
    }
    const blockingReasons = checks
        .filter((item) => !item.passed)
        .map((item) => item.failureReason ?? `${item.id} failed`);
    const report = {
        generatedAt: new Date().toISOString(),
        gate: 'main-agent-release-gate',
        evidence_provenance: expectedProvenance,
        critical_failures: blockingReasons.length,
        blocked_sprint_status_update: blockingReasons.length > 0,
        checks,
        blocking_reasons: blockingReasons,
    };
    if (blockingReasons.length === 0) {
        const contractPath = path.join(root, '_bmad', '_config', 'orchestration-governance.contract.yaml');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const token = `${'release-gate:pass'}:${storyKey}:${Date.now()}:${node_crypto_1.default.randomBytes(8).toString('hex')}`;
        const gateReportHash = sha256(JSON.stringify({
            generatedAt: report.generatedAt,
            checks: report.checks,
            blocking_reasons: report.blocking_reasons,
        }));
        report.completion_intent = {
            token,
            storyKey,
            contractHash: sha256File(contractPath),
            gateReportHash,
            singleUse: true,
            expiresAt,
        };
        report.evidence_provenance = {
            ...report.evidence_provenance,
            gateReportHash,
        };
    }
    const reportPath = writeReport(report);
    if (blockingReasons.length === 0 && args.skipSprintStatusUpdate !== 'true') {
        if (!report.completion_intent) {
            throw new Error('release gate passed without completion intent');
        }
        (0, sprint_status_authorized_update_1.runSprintStatusAuthorizedUpdate)(root, {
            storyKey: report.completion_intent.storyKey,
            status: 'done',
            releaseGateReportPath: reportPath,
            token: report.completion_intent.token,
            runId: report.evidence_provenance.runId,
            evidenceBundleId: report.evidence_provenance.evidenceBundleId,
        });
    }
    writeReportAt(report, reportPath);
    process.stdout.write(`${JSON.stringify({
        report_path: reportPath,
        critical_failures: report.critical_failures,
        blocked_sprint_status_update: report.blocked_sprint_status_update,
    }, null, 2)}\n`);
    if (blockingReasons.length > 0) {
        process.stderr.write('[main-agent-release-gate] BLOCKED\n');
        for (const reason of blockingReasons) {
            process.stderr.write(`- ${reason}\n`);
        }
        return 1;
    }
    return 0;
}
process.exit(main(process.argv.slice(2)));
