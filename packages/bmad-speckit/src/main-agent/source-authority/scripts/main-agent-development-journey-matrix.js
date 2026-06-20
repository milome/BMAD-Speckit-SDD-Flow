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
exports.runDevelopmentJourneyMatrix = runDevelopmentJourneyMatrix;
exports.main = main;
/* eslint-disable no-console */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const main_agent_bmad_help_five_layer_matrix_1 = require("./main-agent-bmad-help-five-layer-matrix");
const main_agent_unified_ingress_1 = require("./main-agent-unified-ingress");
const main_agent_host_matrix_pr_orchestrator_1 = require("./main-agent-host-matrix-pr-orchestrator");
const runtime_context_1 = require("./runtime-context");
const runtime_context_registry_1 = require("./runtime-context-registry");
function prepareHostBranchRoot(root, hostKind) {
    const branchRoot = path.join(root, '_bmad-output', 'runtime', 'journey-matrix', hostKind);
    fs.rmSync(branchRoot, { recursive: true, force: true });
    fs.mkdirSync(branchRoot, { recursive: true });
    (0, runtime_context_registry_1.writeRuntimeContextRegistry)(branchRoot, (0, runtime_context_registry_1.defaultRuntimeContextRegistry)(branchRoot));
    (0, runtime_context_1.writeRuntimeContext)(branchRoot, (0, runtime_context_1.defaultRuntimeContextFile)({
        flow: 'story',
        stage: 'implement',
        sourceMode: 'full_bmad',
        contextScope: 'story',
        storyId: `S-matrix-${hostKind}`,
        runId: `journey-matrix-${hostKind}`,
    }));
    if (hostKind === 'cursor') {
        fs.mkdirSync(path.join(branchRoot, '.cursor'), { recursive: true });
        fs.writeFileSync(path.join(branchRoot, '.cursor', 'hooks.json'), '{"version":1}\n', 'utf8');
    }
    if (hostKind === 'claude') {
        fs.mkdirSync(path.join(branchRoot, '_bmad', 'claude', 'hooks'), { recursive: true });
        fs.writeFileSync(path.join(branchRoot, '_bmad', 'claude', 'hooks', 'runtime-policy-inject.cjs'), 'module.exports = {};\n', 'utf8');
    }
    return branchRoot;
}
function prepareHostMatrixRoot(root) {
    const hostMatrixRoot = path.join(root, '_bmad-output', 'runtime', 'journey-matrix', 'host-matrix');
    fs.rmSync(hostMatrixRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(hostMatrixRoot, '_bmad', '_config'), { recursive: true });
    fs.mkdirSync(path.join(hostMatrixRoot, '_bmad-output', 'implementation-artifacts'), {
        recursive: true,
    });
    fs.writeFileSync(path.join(hostMatrixRoot, '_bmad', '_config', 'orchestration-governance.contract.yaml'), [
        'signals: {}',
        'stage_requirements:',
        '  implement: {}',
        'mapping_contract: {}',
        'adaptiveIntakeGovernanceGate:',
        '  matchScoring: {}',
        '  decisionThresholds: {}',
    ].join('\n') + '\n', 'utf8');
    fs.writeFileSync(path.join(hostMatrixRoot, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'), 'development_status:\n  S-matrix: in_progress\n', 'utf8');
    return hostMatrixRoot;
}
function runDevelopmentJourneyMatrix(input) {
    const projectRoot = path.resolve(input.projectRoot);
    const canonicalBmadRoot = path.join(__dirname, '..', '_bmad');
    if (!fs.existsSync(path.join(projectRoot, '_bmad')) && fs.existsSync(canonicalBmadRoot)) {
        fs.cpSync(canonicalBmadRoot, path.join(projectRoot, '_bmad'), { recursive: true });
    }
    const hostKinds = input.hostKinds ?? ['cursor', 'claude', 'codex'];
    const steps = [];
    const hostMatrixRoot = prepareHostMatrixRoot(projectRoot);
    const bmadHelpFiveLayer = (0, main_agent_bmad_help_five_layer_matrix_1.runBmadHelpFiveLayerMatrix)({ projectRoot });
    steps.push({
        id: 'bmad-help-five-layer-main-agent',
        sequence: 'BH1-L1-L5',
        passed: bmadHelpFiveLayer.allPassed &&
            bmadHelpFiveLayer.bmadHelpEntry.catalogLoaded &&
            bmadHelpFiveLayer.layers.map((layer) => layer.id).join(',') ===
                'layer_1,layer_2,layer_3,layer_4,layer_5',
        evidence: bmadHelpFiveLayer.layers
            .map((layer) => `${layer.id}:${layer.passed ? 'passed' : 'failed'}`)
            .join(','),
    });
    for (const hostKind of hostKinds) {
        const branchRoot = prepareHostBranchRoot(projectRoot, hostKind);
        const ingress = (0, main_agent_unified_ingress_1.runUnifiedIngress)({
            projectRoot: branchRoot,
            recordId: `REQ-JOURNEY-MATRIX-${hostKind.toUpperCase()}`,
            hostKind,
            flow: 'story',
            stage: 'implement',
            forceNoHooks: hostKind === 'codex',
        });
        steps.push({
            id: `ingress-${hostKind}`,
            sequence: 'S3c-S3e',
            passed: ingress.sameControlPlane &&
                ingress.controlPlane === 'main-agent-orchestration' &&
                ingress.runLoop.status === 'completed' &&
                (hostKind !== 'codex' || ingress.orchestrationEntry === 'cli_ingress'),
            evidence: `${ingress.hostMode}/${ingress.orchestrationEntry}/${ingress.runLoop.runId}`,
        });
    }
    const hostMatrix = (0, main_agent_host_matrix_pr_orchestrator_1.runHostMatrixPrOrchestration)({
        provider: input.realProvider ? 'real' : 'mock',
        projectRoot: hostMatrixRoot,
    });
    steps.push({
        id: 'multi-host-host-matrix',
        sequence: 'S31-S32',
        passed: hostMatrix.journeyMode === (input.realProvider ? 'real' : 'mock') &&
            hostMatrix.journeyE2EPassed &&
            hostMatrix.hostMatrix.allRequiredHostsPassed,
        evidence: `${hostMatrix.journeyMode}/${hostMatrix.finalPassed}/${JSON.stringify(hostMatrix.hostMatrix.hostsPassed)}`,
    });
    steps.push({
        id: 'pr-topology',
        sequence: 'S37-S38',
        passed: hostMatrix.prTopology.all_affected_stories_passed,
        evidence: hostMatrix.prTopology.required_nodes
            .map((node) => `${node.node_id}:${node.state}`)
            .join(','),
    });
    steps.push({
        id: 'delivery-truth-live',
        sequence: 'R1-R10/S39-S43',
        passed: false,
        evidence: 'not synthesized; run main-agent:delivery-truth-gate with real evidence bundle for completion verdict',
    });
    return {
        reportType: 'main_agent_development_journey_matrix',
        generatedAt: new Date().toISOString(),
        projectRoot,
        steps,
        allPassed: steps.every((step) => step.passed),
    };
}
function parseArgs(argv) {
    const out = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token.startsWith('--') && argv[index + 1])
            out[token.slice(2)] = argv[++index];
    }
    return out;
}
function main(argv) {
    const args = parseArgs(argv);
    const report = runDevelopmentJourneyMatrix({
        projectRoot: path.resolve(args.cwd ?? process.cwd()),
        realProvider: args.realProvider === 'true',
    });
    const reportPath = path.resolve(args.reportPath ??
        path.join(report.projectRoot, '_bmad-output', 'runtime', 'e2e', 'development-journey-matrix.json'));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({ reportPath, ...report }, null, 2));
    return report.allPassed ? 0 : 1;
}
if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}
