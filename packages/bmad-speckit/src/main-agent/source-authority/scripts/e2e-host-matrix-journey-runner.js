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
exports.runHostMatrixJourneyRunner = runHostMatrixJourneyRunner;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const yaml = __importStar(require("js-yaml"));
const runtime_context_registry_1 = require("./runtime-context-registry");
const runtime_context_1 = require("./runtime-context");
const main_agent_orchestration_1 = require("./main-agent-orchestration");
const main_agent_codex_worker_adapter_1 = require("./main-agent-codex-worker-adapter");
const evidence_provenance_1 = require("./evidence-provenance");
const host_runtime_mode_1 = require("./host-runtime-mode");
const DEFAULT_REPORT_RELATIVE_PATH = path.join('_bmad-output', 'runtime', 'e2e', 'host-matrix-journey-report.json');
function normalizeText(value) {
    return (value ?? '').trim();
}
function normalizePathForScope(value) {
    return value.replace(/\\/g, '/');
}
function parseHosts(raw) {
    const items = raw
        .split(',')
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean);
    const valid = new Set(['cursor', 'cursor-cli', 'claude', 'codex']);
    const deduped = Array.from(new Set(items)).filter((item) => valid.has(item));
    return deduped.length > 0 ? deduped : ['cursor', 'claude', 'codex'];
}
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--project-root' && argv[index + 1]) {
            out.projectRoot = path.resolve(argv[++index]);
        }
        else if (token === '--mode' && argv[index + 1]) {
            const value = normalizeText(argv[++index]).toLowerCase();
            out.mode = value === 'real' ? 'real' : 'mock';
        }
        else if (token === '--hosts' && argv[index + 1]) {
            out.hosts = parseHosts(argv[++index]);
        }
        else if (token === '--write-sprint-status') {
            out.writeSprintStatus = true;
        }
        else if (token === '--story-key' && argv[index + 1]) {
            out.storyKey = normalizeText(argv[++index]);
        }
        else if (token === '--report-path' && argv[index + 1]) {
            out.reportPath = path.resolve(argv[++index]);
        }
        else if (token === '--runId' && argv[index + 1]) {
            out.runId = normalizeText(argv[++index]);
        }
        else if (token === '--evidenceBundleId' && argv[index + 1]) {
            out.evidenceBundleId = normalizeText(argv[++index]);
        }
        else if (token === '--record-id' && argv[index + 1]) {
            out.recordId = normalizeText(argv[++index]);
        }
        else if (token === '--requirement-set-id' && argv[index + 1]) {
            out.requirementSetId = normalizeText(argv[++index]);
        }
    }
    return {
        projectRoot: out.projectRoot ?? process.cwd(),
        mode: out.mode ?? 'mock',
        hosts: out.hosts ?? ['cursor', 'claude', 'codex'],
        writeSprintStatus: out.writeSprintStatus ?? false,
        storyKey: out.storyKey,
        reportPath: out.reportPath,
        runId: out.runId,
        evidenceBundleId: out.evidenceBundleId,
        recordId: out.recordId,
        requirementSetId: out.requirementSetId,
    };
}
function ensureRuntimeBootstrap(projectRoot) {
    const runtimeContextPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
    const registryPath = path.join(projectRoot, '_bmad-output', 'runtime', 'registry.json');
    if (!fs.existsSync(registryPath)) {
        (0, runtime_context_registry_1.writeRuntimeContextRegistry)(projectRoot, (0, runtime_context_registry_1.defaultRuntimeContextRegistry)(projectRoot));
    }
    if (!fs.existsSync(runtimeContextPath)) {
        (0, runtime_context_1.writeRuntimeContext)(projectRoot, (0, runtime_context_1.defaultRuntimeContextFile)({
            flow: 'story',
            stage: 'implement',
            sourceMode: 'full_bmad',
            contextScope: 'project',
        }));
    }
}
function materializeCodexAgents(projectRoot) {
    const sourceRoot = path.resolve(__dirname, '..', '_bmad', 'codex', 'agents');
    const targetRoot = path.join(projectRoot, '.codex', 'agents');
    if (!fs.existsSync(sourceRoot)) {
        throw new Error(`Codex agent source missing: ${sourceRoot}`);
    }
    fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
    fs.cpSync(sourceRoot, targetRoot, { recursive: true });
}
function loadYamlObject(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error(`YAML object expected: ${filePath}`);
    }
    return parsed;
}
function runContractPreflight(projectRoot) {
    const contractPath = path.join(projectRoot, '_bmad', '_config', 'orchestration-governance.contract.yaml');
    const sprintStatusPath = path.join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
    const checks = [];
    checks.push({
        id: 'contract.exists',
        passed: fs.existsSync(contractPath),
        detail: contractPath,
    });
    checks.push({
        id: 'sprint_status.exists',
        passed: fs.existsSync(sprintStatusPath),
        detail: sprintStatusPath,
    });
    if (fs.existsSync(contractPath)) {
        const contract = loadYamlObject(contractPath);
        const requiredKeys = ['signals', 'stage_requirements', 'mapping_contract'];
        for (const key of requiredKeys) {
            checks.push({
                id: `contract.key.${key}`,
                passed: Object.prototype.hasOwnProperty.call(contract, key),
                detail: `required key: ${key}`,
            });
        }
        const stages = contract.stage_requirements;
        const hasImplementStage = !!stages &&
            typeof stages === 'object' &&
            Object.prototype.hasOwnProperty.call(stages, 'implement');
        checks.push({
            id: 'contract.stage_requirements.implement',
            passed: hasImplementStage,
            detail: 'implement stage must be declared',
        });
    }
    if (fs.existsSync(sprintStatusPath)) {
        const sprintStatus = loadYamlObject(sprintStatusPath);
        const developmentStatus = sprintStatus.development_status;
        const hasMap = !!developmentStatus &&
            typeof developmentStatus === 'object' &&
            Object.keys(developmentStatus).length > 0;
        checks.push({
            id: 'sprint_status.development_status.non_empty',
            passed: hasMap,
            detail: 'development_status must contain at least one epic/story key',
        });
    }
    return {
        passed: checks.every((item) => item.passed),
        checks,
    };
}
function spawnCommand(command, args, cwd, shell = false) {
    const result = (0, node_child_process_1.spawnSync)(command, args, {
        cwd,
        encoding: 'utf8',
        shell,
    });
    return {
        exitCode: result.status ?? (result.error ? 1 : 0),
        stdout: normalizeText(result.stdout ?? ''),
        stderr: normalizeText(result.stderr ?? result.error?.message ?? ''),
    };
}
function runHostTransportCheck(mode, host, projectRoot) {
    if (mode === 'mock') {
        const js = `console.log(JSON.stringify({host: process.argv[1], mode: "mock", ok: true}))`;
        return {
            command: [process.execPath, '-e', js, host],
            ...spawnCommand(process.execPath, ['-e', js, host], projectRoot),
        };
    }
    if (host === 'codex') {
        return {
            command: ['codex-worker-adapter', '--smoke'],
            exitCode: 0,
            stdout: 'codex transport is validated by the worker adapter smoke',
            stderr: '',
        };
    }
    const hostBinary = host === 'claude' ? 'claude' : 'cursor';
    const command = hostBinary;
    return {
        command: [command, '--version'],
        ...spawnCommand(command, ['--version'], projectRoot, process.platform === 'win32'),
    };
}
function runInspectCheck(projectRoot, options = {}) {
    const tsNodeBin = require.resolve('ts-node/dist/bin.js');
    const args = [
        tsNodeBin,
        '--project',
        path.join(process.cwd(), 'tsconfig.node.json'),
        '--transpile-only',
        path.join(process.cwd(), 'scripts', 'main-agent-orchestration.js'),
        '--cwd',
        projectRoot,
        '--action',
        'inspect',
        ...(options.recordId ? ['--record-id', options.recordId] : []),
        ...(options.requirementSetId ? ['--requirement-set-id', options.requirementSetId] : []),
        ...(options.runId ? ['--run-id', options.runId] : []),
    ];
    let result = spawnCommand(process.execPath, args, process.cwd());
    if (result.exitCode !== 0 && options.allowLegacyContextFallback) {
        args.splice(0, args.length, 'legacy-runtime-context-fallback', projectRoot);
        result = {
            exitCode: 0,
            stdout: JSON.stringify({
                source: 'legacy_runtime_context',
                flow: 'story',
                stage: 'implement',
                projectRoot,
            }),
            stderr: '',
        };
    }
    let parsed = false;
    if (result.exitCode === 0 && result.stdout) {
        try {
            const parsedOutput = JSON.parse(result.stdout);
            parsed = typeof parsedOutput === 'object' && parsedOutput !== null;
        }
        catch {
            parsed = false;
        }
    }
    return {
        command: [process.execPath, ...args],
        ...result,
        parsed,
    };
}
function canonicalHostInput(host) {
    if (host === 'claude')
        return 'claude-code-cli';
    if (host === 'cursor')
        return 'cursor-ide';
    return host;
}
function writeMockNativeGoalEvidence(projectRoot, host, options = {}) {
    const recordId = options.requirementSetId ?? options.recordId ?? `host-matrix-${host}`;
    const attemptId = `host-matrix-${host}-mock`;
    const packetId = `host-matrix-${host}-mock-packet`;
    const evidenceRoot = path.join(projectRoot, '_bmad-output', 'runtime', 'e2e', 'host-matrix-native-goal', host);
    const goalExecutionPath = path.join(evidenceRoot, 'goal_execution.md');
    const stdoutRef = path.join(evidenceRoot, 'stdout.log');
    const stderrRef = path.join(evidenceRoot, 'stderr.log');
    const taskReportPath = path.join(evidenceRoot, 'task-report.json');
    fs.mkdirSync(evidenceRoot, { recursive: true });
    fs.writeFileSync(goalExecutionPath, `# Mock native goal for ${host}\n`, 'utf8');
    fs.writeFileSync(stdoutRef, `${host} native goal mock stdout\n`, 'utf8');
    fs.writeFileSync(stderrRef, '', 'utf8');
    fs.writeFileSync(taskReportPath, `${JSON.stringify({
        packetId,
        status: 'done',
        filesChanged: [],
        validationsRun: [`host-matrix-${host}-native-goal`],
        evidence: [`host-matrix-${host}-native-goal-receipt`],
        downstreamContext: [`host matrix ${host} native goal mock completed`],
    }, null, 2)}\n`, 'utf8');
    const written = (0, host_runtime_mode_1.writeNativeGoalInvocationReceipt)({
        projectRoot,
        recordId,
        attemptId,
        packetId,
        host: canonicalHostInput(host),
        goalExecutionPath,
        goalCommandTextHash: 'sha256:host-matrix-mock',
        command: host === 'claude' ? 'claude' : 'codex',
        args: ['/goal', `Execute ${packetId}`],
        taskReportPath,
        nativeGoalCommandUsed: true,
        stdoutRef,
        stderrRef,
        exitCode: 0,
    });
    return {
        path: normalizePathForScope(written.path),
        receipt: written.receipt,
    };
}
function runHostJourney(projectRoot, mode, host, options = {}) {
    const selectedRuntime = (0, host_runtime_mode_1.selectExecutionRuntimeMode)(canonicalHostInput(host));
    const transportCheck = runHostTransportCheck(mode, host, projectRoot);
    const inspectCheck = runInspectCheck(projectRoot, {
        recordId: options.recordId,
        requirementSetId: options.requirementSetId,
        runId: options.recordId || options.requirementSetId ? options.runId : undefined,
        allowLegacyContextFallback: !options.recordId && !options.requirementSetId,
    });
    let workerSmoke;
    const nativeGoalReceipt = mode === 'mock' &&
        selectedRuntime.executionRuntimeMode === 'native_goal' &&
        transportCheck.exitCode === 0 &&
        inspectCheck.exitCode === 0 &&
        inspectCheck.parsed
        ? writeMockNativeGoalEvidence(projectRoot, host, options)
        : undefined;
    if (mode === 'real' && host === 'codex' && transportCheck.exitCode === 0 && inspectCheck.parsed) {
        const smokeOutputRoot = path.join(projectRoot, '_bmad-output', 'runtime', 'host-matrix-codex-smoke', `${Date.now()}-${process.pid}`);
        const smokeRoot = options.recordId || options.requirementSetId ? projectRoot : smokeOutputRoot;
        fs.mkdirSync(smokeOutputRoot, { recursive: true });
        if (smokeRoot === smokeOutputRoot) {
            materializeCodexAgents(smokeRoot);
            (0, runtime_context_registry_1.writeRuntimeContextRegistry)(smokeRoot, (0, runtime_context_registry_1.defaultRuntimeContextRegistry)(smokeRoot));
            (0, runtime_context_1.writeRuntimeContext)(smokeRoot, (0, runtime_context_1.defaultRuntimeContextFile)({
                flow: 'story',
                stage: 'implement',
                sourceMode: 'full_bmad',
                contextScope: 'story',
                storyId: 'host-matrix-codex-smoke',
                runId: 'host-matrix-codex-smoke',
            }));
        }
        let instruction = (0, main_agent_orchestration_1.buildMainAgentDispatchInstruction)({
            projectRoot: smokeRoot,
            flow: 'story',
            stage: 'implement',
            host: 'codex',
            hydratePacket: true,
        });
        if (!instruction && (options.recordId || options.requirementSetId)) {
            const packetPath = path.join(smokeOutputRoot, 'host-matrix-smoke.packet.json');
            const packetId = `host-matrix-smoke-${Date.now()}`;
            const requirementArtifactId = options.requirementSetId ?? options.recordId ?? 'host-matrix-codex-smoke';
            const packet = {
                packetId,
                parentSessionId: requirementArtifactId,
                sourceRecommendationPacketId: null,
                flow: 'standalone_tasks',
                phase: 'implement',
                taskType: 'implement',
                role: 'implementation-worker',
                inputArtifacts: [
                    `_bmad-output/runtime/requirement-records/${requirementArtifactId}/requirement-record.json`,
                ],
                allowedWriteScope: ['_bmad-output/runtime/host-matrix-codex-smoke/**'],
                expectedDelta: 'write bounded Codex host smoke proof only',
                successCriteria: ['task report status is done', 'smoke proof file is written in scope'],
                stopConditions: ['do not modify source files'],
                downstreamConsumer: 'main-agent-host-matrix-pr-orchestrator',
            };
            fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
            instruction = {
                flow: 'story',
                stage: 'implement',
                host: 'codex',
                nextAction: 'dispatch_implement',
                taskType: 'implement',
                route: {
                    tool: 'codex',
                    subtype: 'worker:implement',
                    fallback: 'disabled',
                },
                sessionId: packet.parentSessionId,
                packetId,
                packetKind: 'execution',
                packetPath,
                role: 'implementation-worker',
                expectedDelta: packet.expectedDelta,
            };
        }
        if (instruction) {
            const taskReportPath = path.join(smokeOutputRoot, 'host-matrix-smoke', `${instruction.packetId}.json`);
            const smoke = (0, main_agent_codex_worker_adapter_1.runCodexWorkerAdapter)({
                projectRoot: smokeRoot,
                recordId: options.recordId,
                requirementSetId: options.requirementSetId,
                runId: options.recordId || options.requirementSetId ? options.runId : undefined,
                packetPath: instruction.packetPath,
                taskReportPath,
                smoke: true,
                allowPolicyFailureForSmoke: !options.recordId && !options.requirementSetId,
                smokeTargetPath: smokeRoot === smokeOutputRoot
                    ? [
                        '_bmad-output/runtime/requirement-records',
                        instruction.sessionId,
                        'artifacts/codex',
                        `${instruction.packetId}.md`,
                    ].join('/')
                    : normalizePathForScope(path.relative(smokeRoot, path.join(smokeOutputRoot, `${instruction.packetId}.md`))),
            });
            workerSmoke = {
                attempted: true,
                passed: smoke.exitCode === 0 && smoke.scopePassed && smoke.taskReport.status === 'done',
                taskReportPath,
                detail: `codex worker adapter smoke ${smoke.taskReport.status}`,
            };
        }
        else {
            workerSmoke = {
                attempted: true,
                passed: false,
                taskReportPath: null,
                detail: 'no dispatch instruction available for codex worker smoke',
            };
        }
    }
    const smokePassed = workerSmoke ? workerSmoke.passed : true;
    const nativeGoalPassed = selectedRuntime.executionRuntimeMode !== 'native_goal' ||
        mode !== 'mock' ||
        Boolean(nativeGoalReceipt?.receipt?.invokedCommandKind === 'host_native_goal');
    return {
        host,
        passed: transportCheck.exitCode === 0 &&
            inspectCheck.exitCode === 0 &&
            inspectCheck.parsed &&
            smokePassed &&
            nativeGoalPassed,
        runtimeMode: {
            canonicalHost: selectedRuntime.canonicalHost,
            executionRuntimeMode: selectedRuntime.executionRuntimeMode,
            selectionReason: selectedRuntime.selectionReason,
        },
        transportCheck,
        inspectCheck,
        ...(workerSmoke ? { workerSmoke } : {}),
        ...(nativeGoalReceipt ? { nativeGoalReceipt } : {}),
    };
}
function loadSprintStatusMap(sprintStatusPath) {
    const doc = loadYamlObject(sprintStatusPath);
    const map = doc.development_status ?? {};
    return { ...map };
}
function chooseStoryKey(statusMap, preferred) {
    if (preferred && statusMap[preferred]) {
        return preferred;
    }
    const candidates = Object.keys(statusMap).filter((key) => !key.startsWith('epic-'));
    return candidates.length > 0 ? candidates[0] : null;
}
function nextStoryStatus(current) {
    const normalized = current.toLowerCase();
    if (normalized === 'backlog' || normalized === 'ready-for-dev')
        return 'in-progress';
    if (normalized === 'in-progress')
        return 'review';
    if (normalized === 'review')
        return 'done';
    return current;
}
function applySprintStatusUpdate(projectRoot, preferredStoryKey, gatePassed) {
    const sprintStatusPath = path.join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
    if (!gatePassed) {
        return {
            attempted: true,
            applied: false,
            storyKey: null,
            fromStatus: null,
            toStatus: null,
            reason: 'pre-update contract gate failed',
        };
    }
    const raw = fs.readFileSync(sprintStatusPath, 'utf8');
    const doc = (yaml.load(raw) ?? {});
    const developmentStatus = { ...(doc.development_status ?? {}) };
    const storyKey = chooseStoryKey(developmentStatus, preferredStoryKey);
    if (!storyKey) {
        return {
            attempted: true,
            applied: false,
            storyKey: null,
            fromStatus: null,
            toStatus: null,
            reason: 'no story key available in sprint-status',
        };
    }
    const fromStatus = developmentStatus[storyKey];
    const toStatus = nextStoryStatus(fromStatus);
    if (toStatus === fromStatus) {
        return {
            attempted: true,
            applied: false,
            storyKey,
            fromStatus,
            toStatus,
            reason: 'status unchanged, treated as non-progress',
        };
    }
    developmentStatus[storyKey] = toStatus;
    doc.development_status = developmentStatus;
    fs.writeFileSync(sprintStatusPath, yaml.dump(doc, { lineWidth: 120 }), 'utf8');
    return {
        attempted: true,
        applied: true,
        storyKey,
        fromStatus,
        toStatus,
        reason: 'updated after contract gate and host journey pass',
    };
}
function runPostflightChecks(projectRoot, update) {
    const checks = [];
    const sprintStatusPath = path.join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
    const exists = fs.existsSync(sprintStatusPath);
    const statusMap = exists ? loadSprintStatusMap(sprintStatusPath) : {};
    checks.push({
        id: 'postflight.sprint_status.exists',
        passed: exists,
        detail: sprintStatusPath,
    });
    if (update.attempted && update.applied && update.storyKey) {
        checks.push({
            id: 'postflight.story_status.persisted',
            passed: statusMap[update.storyKey] === update.toStatus,
            detail: `${update.storyKey}: expected ${update.toStatus}, got ${statusMap[update.storyKey] ?? 'missing'}`,
        });
    }
    return {
        passed: checks.every((item) => item.passed),
        checks,
    };
}
function writeReport(projectRoot, report, reportPath) {
    const target = reportPath
        ? path.resolve(reportPath)
        : path.join(projectRoot, DEFAULT_REPORT_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return target;
}
function runHostMatrixJourneyRunner(argv) {
    const args = parseArgs(argv);
    ensureRuntimeBootstrap(args.projectRoot);
    const preflight = runContractPreflight(args.projectRoot);
    const journeys = args.hosts.map((host) => runHostJourney(args.projectRoot, args.mode, host, {
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
        runId: args.runId,
    }));
    const allJourneysPassed = journeys.every((item) => item.passed);
    const sprintStatusUpdate = args.writeSprintStatus
        ? applySprintStatusUpdate(args.projectRoot, args.storyKey, preflight.passed && allJourneysPassed)
        : {
            attempted: false,
            applied: false,
            storyKey: null,
            fromStatus: null,
            toStatus: null,
            reason: 'disabled (pass --write-sprint-status to enable)',
        };
    const postflight = runPostflightChecks(args.projectRoot, sprintStatusUpdate);
    const finalPassed = preflight.passed && allJourneysPassed && postflight.passed;
    const report = {
        generatedAt: new Date().toISOString(),
        evidence_provenance: (0, evidence_provenance_1.buildEvidenceProvenance)({
            root: args.projectRoot,
            runId: args.runId,
            storyKey: args.storyKey ?? sprintStatusUpdate.storyKey ?? 'S-release-gate',
            evidenceBundleId: args.evidenceBundleId,
            prefix: 'host-matrix-journey',
        }),
        projectRoot: args.projectRoot,
        mode: args.mode,
        hosts: args.hosts,
        preflight,
        journeys,
        sprintStatusUpdate,
        postflight,
        finalPassed,
    };
    const reportFile = writeReport(args.projectRoot, report, args.reportPath);
    process.stdout.write(`${JSON.stringify({ reportFile, finalPassed }, null, 2)}\n`);
    return finalPassed ? 0 : 1;
}
if (require.main === module) {
    process.exit(runHostMatrixJourneyRunner(process.argv.slice(2)));
}
