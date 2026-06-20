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
exports.LAYER_1_PRD_MARKER_FILE = exports.LAYER_1_PRD_MARKER_TYPE = exports.LAYER_1_PRD_COMPLETION_SCHEMA_VERSION = void 0;
exports.buildLayer1PrdCompletionMarker = buildLayer1PrdCompletionMarker;
exports.validateLayer1PrdCompletionMarker = validateLayer1PrdCompletionMarker;
exports.writeLayer1PrdCompletionMarker = writeLayer1PrdCompletionMarker;
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
exports.LAYER_1_PRD_COMPLETION_SCHEMA_VERSION = 'layer_1_prd_completion/v1';
exports.LAYER_1_PRD_MARKER_TYPE = 'bmad_help_five_layer_stage_complete';
exports.LAYER_1_PRD_MARKER_FILE = 'layer_1-prd.complete.json';
function toProjectRelativePath(projectRoot, filePath) {
    return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}
function sha256File(filePath) {
    return (0, node_crypto_1.createHash)('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
function resolveCurrentBranch(projectRoot) {
    try {
        const gitHead = fs.readFileSync(path.join(projectRoot, '.git', 'HEAD'), 'utf8').trim();
        if (gitHead.startsWith('ref: refs/heads/')) {
            return gitHead.replace('ref: refs/heads/', '').replace(/\//g, '-');
        }
    }
    catch {
        // Test fixtures usually do not have a Git checkout; default to the repo branch convention.
    }
    return 'dev';
}
function findProductBriefInputs(projectRoot, planningRoot) {
    if (!fs.existsSync(planningRoot))
        return [];
    return fs
        .readdirSync(planningRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /^product-brief-.*\.md$/i.test(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry, index) => ({
        path: toProjectRelativePath(projectRoot, path.join(planningRoot, entry.name)),
        priority: 3 + index,
        sourceType: 'product_brief',
    }));
}
function collectLayer1PrdInputs(projectRoot) {
    const branch = resolveCurrentBranch(projectRoot);
    const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
    const branchPrd = path.join(planningRoot, branch, 'prd.md');
    const rootPrd = path.join(planningRoot, 'prd.md');
    const prds = [];
    if (fs.existsSync(branchPrd)) {
        prds.push({
            path: toProjectRelativePath(projectRoot, branchPrd),
            priority: 1,
            sourceType: 'branch_prd',
        });
    }
    if (fs.existsSync(rootPrd)) {
        prds.push({
            path: toProjectRelativePath(projectRoot, rootPrd),
            priority: 2,
            sourceType: 'root_prd',
        });
    }
    const runtimeContextPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
    return {
        branch,
        planningRoot,
        prds,
        productBriefs: findProductBriefInputs(projectRoot, planningRoot),
        runtimeContextPath: toProjectRelativePath(projectRoot, runtimeContextPath),
        contextPresent: fs.existsSync(runtimeContextPath),
    };
}
function buildLayer1PrdCompletionMarker(input) {
    const projectRoot = path.resolve(input.projectRoot);
    const collected = collectLayer1PrdInputs(projectRoot);
    const artifactInputs = [...collected.prds, ...collected.productBriefs];
    const hashes = {};
    for (const item of artifactInputs) {
        hashes[item.path] = sha256File(path.join(projectRoot, item.path));
    }
    const prdPresent = collected.prds.length > 0;
    const productBriefPresent = collected.productBriefs.length > 0;
    const contextPresent = collected.contextPresent;
    return {
        markerType: exports.LAYER_1_PRD_MARKER_TYPE,
        schemaVersion: exports.LAYER_1_PRD_COMPLETION_SCHEMA_VERSION,
        layer: 'layer_1',
        stage: 'prd',
        generatedAt: input.generatedAt ?? new Date().toISOString(),
        inputs: {
            productBriefs: collected.productBriefs.map((item) => item.path),
            prds: collected.prds.map((item) => item.path),
            runtimeContext: collected.runtimeContextPath,
        },
        sources: {
            planningArtifactsRoot: toProjectRelativePath(projectRoot, collected.planningRoot),
            branch: collected.branch,
            bmmConfigPath: '_bmad/bmm/config.yaml',
            productBriefWorkflowPath: '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-01-init.md',
            prdWorkflowPath: '_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-01-init.md',
        },
        hashes,
        acceptance: {
            prdPresent,
            contextPresent,
            productBriefPresent,
            layer1Complete: prdPresent && productBriefPresent && contextPresent,
        },
        handoff: {
            nextLayer: 'layer_2',
            nextStage: 'arch',
            summary: 'Layer 1 PRD/context evidence is complete and ready for architecture handoff.',
        },
    };
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}
function isLayer1PrdCompletionMarker(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const marker = value;
    return (marker.markerType === exports.LAYER_1_PRD_MARKER_TYPE &&
        marker.schemaVersion === exports.LAYER_1_PRD_COMPLETION_SCHEMA_VERSION &&
        marker.layer === 'layer_1' &&
        marker.stage === 'prd' &&
        typeof marker.generatedAt === 'string' &&
        marker.inputs != null &&
        isStringArray(marker.inputs.productBriefs) &&
        isStringArray(marker.inputs.prds) &&
        typeof marker.inputs.runtimeContext === 'string' &&
        marker.sources != null &&
        marker.sources.planningArtifactsRoot === '_bmad-output/planning-artifacts' &&
        typeof marker.sources.branch === 'string' &&
        marker.sources.bmmConfigPath === '_bmad/bmm/config.yaml' &&
        marker.sources.productBriefWorkflowPath ===
            '_bmad/bmm/workflows/1-analysis/create-product-brief/steps/step-01-init.md' &&
        marker.sources.prdWorkflowPath ===
            '_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-01-init.md' &&
        marker.hashes != null &&
        typeof marker.hashes === 'object' &&
        marker.acceptance?.prdPresent === true &&
        marker.acceptance.contextPresent === true &&
        marker.acceptance.productBriefPresent === true &&
        marker.acceptance.layer1Complete === true &&
        marker.handoff?.nextLayer === 'layer_2' &&
        marker.handoff.nextStage === 'arch' &&
        typeof marker.handoff.summary === 'string');
}
function validateLayer1PrdCompletionMarker(input) {
    const projectRoot = path.resolve(input.projectRoot);
    if (!fs.existsSync(input.markerPath))
        return false;
    try {
        const parsed = JSON.parse(fs.readFileSync(input.markerPath, 'utf8'));
        if (!isLayer1PrdCompletionMarker(parsed))
            return false;
        const marker = parsed;
        const requiredHashPaths = [...marker.inputs.prds, ...marker.inputs.productBriefs];
        if (requiredHashPaths.length === 0)
            return false;
        for (const relativePath of requiredHashPaths) {
            const absolutePath = path.join(projectRoot, relativePath);
            if (!fs.existsSync(absolutePath))
                return false;
            if (marker.hashes[relativePath] !== sha256File(absolutePath))
                return false;
        }
        return fs.existsSync(path.join(projectRoot, marker.inputs.runtimeContext));
    }
    catch {
        return false;
    }
}
function writeLayer1PrdCompletionMarker(input) {
    const projectRoot = path.resolve(input.projectRoot);
    const marker = buildLayer1PrdCompletionMarker({
        projectRoot,
        generatedAt: input.generatedAt,
    });
    if (!marker.acceptance.layer1Complete) {
        throw new Error([
            'layer_1 PRD completion evidence is incomplete',
            `prdPresent=${marker.acceptance.prdPresent}`,
            `productBriefPresent=${marker.acceptance.productBriefPresent}`,
            `contextPresent=${marker.acceptance.contextPresent}`,
        ].join('; '));
    }
    const markerPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', exports.LAYER_1_PRD_MARKER_FILE);
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
    return markerPath;
}
