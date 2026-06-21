"use strict";
/**
 * Runtime context file helpers for `_bmad-output/runtime/context/...` scoped inputs.
 */
/* eslint-disable jsdoc/require-description, jsdoc/require-param, jsdoc/require-returns */
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
exports.RUNTIME_CONTEXT_VERSION = void 0;
exports.contextMaturityCandidateFromSourceMode = contextMaturityCandidateFromSourceMode;
exports.deriveContextMaturity = deriveContextMaturity;
exports.defaultRuntimeContextFile = defaultRuntimeContextFile;
exports.runtimeContextPath = runtimeContextPath;
exports.projectContextPath = projectContextPath;
exports.epicContextPath = epicContextPath;
exports.storyContextPath = storyContextPath;
exports.runContextPath = runContextPath;
exports.resolveRuntimeContextPath = resolveRuntimeContextPath;
exports.resolveRuntimeContextWritePath = resolveRuntimeContextWritePath;
exports.readRuntimeContext = readRuntimeContext;
exports.writeRuntimeContext = writeRuntimeContext;
exports.detectRuntimeSourceMode = detectRuntimeSourceMode;
exports.ensureProjectRuntimeContext = ensureProjectRuntimeContext;
exports.ensureStoryRuntimeContext = ensureStoryRuntimeContext;
exports.ensureRunRuntimeContext = ensureRunRuntimeContext;
exports.writeRuntimeContextFromSprintStatus = writeRuntimeContextFromSprintStatus;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
const registry_1 = require("./registry");
const facilitator_1 = require("./facilitator");
const reviewer_1 = require("./reviewer");
exports.RUNTIME_CONTEXT_VERSION = 1;
const RUNTIME_FLOWS = ['story', 'bugfix', 'standalone_tasks', 'epic', 'unknown'];
const STAGE_NAMES = [
    'prd',
    'arch',
    'epics',
    'story_create',
    'story_audit',
    'specify',
    'plan',
    'gaps',
    'tasks',
    'implement',
    'post_audit',
    'epic_create',
    'epic_complete',
];
function contextMaturityCandidateFromSourceMode(sourceMode) {
    switch (sourceMode) {
        case 'standalone_story':
            return 'minimal';
        case 'seeded_solutioning':
            return 'seeded';
        case 'full_bmad':
            return 'full';
        default:
            return 'unclassified';
    }
}
function deriveContextMaturity(sourceMode, evidence = {}) {
    const candidate = contextMaturityCandidateFromSourceMode(sourceMode);
    const signals = [
        evidence.artifactComplete,
        evidence.fourSignalsComplete,
        evidence.executionSpecific,
        evidence.governanceHealthy,
        evidence.runtimeScopeComplete,
    ];
    const knownCount = signals.filter((value) => value !== undefined).length;
    const trueCount = signals.filter((value) => value === true).length;
    if (evidence.followUpBudgetExhausted && knownCount === 0) {
        return 'unclassified';
    }
    if (candidate === 'full' &&
        (evidence.governanceHealthy === false || evidence.runtimeScopeComplete === false)) {
        return trueCount >= 2 ? 'seeded' : 'minimal';
    }
    if (trueCount === 5) {
        return 'full';
    }
    if (trueCount >= 2) {
        return 'seeded';
    }
    if (candidate === 'seeded') {
        return 'seeded';
    }
    if (candidate === 'full') {
        return 'seeded';
    }
    return candidate;
}
function isRuntimeFlowId(v) {
    return RUNTIME_FLOWS.includes(v);
}
function isStageName(v) {
    return STAGE_NAMES.includes(v);
}
function defaultRuntimeContextFile(overrides) {
    const base = {
        version: exports.RUNTIME_CONTEXT_VERSION,
        flow: 'story',
        stage: 'specify',
        sourceMode: 'full_bmad',
        updatedAt: new Date().toISOString(),
    };
    return { ...base, ...overrides };
}
function runtimeContextPath(root) {
    return path.join(root, '_bmad-output', 'runtime', 'context', 'project.json');
}
function projectContextPath(root) {
    return path.join(root, '_bmad-output', 'runtime', 'context', 'project.json');
}
function epicContextPath(root, epicId) {
    return path.join(root, '_bmad-output', 'runtime', 'context', 'epics', `${epicId}.json`);
}
function storyContextPath(root, epicId, storyId) {
    return path.join(root, '_bmad-output', 'runtime', 'context', 'stories', epicId, `${storyId}.json`);
}
function runContextPath(root, epicId, storyId, runId) {
    return path.join(root, '_bmad-output', 'runtime', 'context', 'runs', epicId, storyId, `${runId}.json`);
}
/** Resolve runtime context path from an explicit argument or the project-scoped default path. */
function resolveRuntimeContextPath(root, explicitPath) {
    const candidate = explicitPath?.trim();
    if (candidate) {
        return path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
    }
    return projectContextPath(root);
}
/** Resolve write target from an explicit argument or the project-scoped default path. */
function resolveRuntimeContextWritePath(root, explicitPath) {
    const candidate = explicitPath?.trim();
    if (candidate) {
        return path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate);
    }
    return projectContextPath(root);
}
function readRuntimeContext(root, explicitPath) {
    const file = resolveRuntimeContextPath(root, explicitPath);
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    }
    catch (e) {
        const err = e;
        if (err.code === 'ENOENT') {
            throw new Error(`runtime-context missing: ${file}`);
        }
        throw e;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error(`runtime-context invalid JSON: ${file}`);
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new Error(`runtime-context not an object: ${file}`);
    }
    const o = parsed;
    if (o.version !== exports.RUNTIME_CONTEXT_VERSION) {
        throw new Error(`runtime-context.version must be ${exports.RUNTIME_CONTEXT_VERSION}, got ${String(o.version)}`);
    }
    if (typeof o.flow !== 'string' || !isRuntimeFlowId(o.flow)) {
        throw new Error(`runtime-context.flow invalid or missing: ${file}`);
    }
    if (typeof o.stage !== 'string' || !isStageName(o.stage)) {
        throw new Error(`runtime-context.stage invalid or missing: ${file}`);
    }
    if (o.templateId !== undefined && typeof o.templateId !== 'string') {
        throw new Error(`runtime-context.templateId must be string when set: ${file}`);
    }
    if (o.sourceMode !== undefined &&
        o.sourceMode !== 'full_bmad' &&
        o.sourceMode !== 'seeded_solutioning' &&
        o.sourceMode !== 'standalone_story') {
        throw new Error(`runtime-context.sourceMode invalid: ${file}`);
    }
    for (const key of ['epicId', 'storyId', 'storySlug', 'runId', 'artifactRoot']) {
        if (o[key] !== undefined && typeof o[key] !== 'string') {
            throw new Error(`runtime-context.${key} must be string when set: ${file}`);
        }
    }
    for (const key of ['workflow', 'step', 'artifactPath']) {
        if (o[key] !== undefined && typeof o[key] !== 'string') {
            throw new Error(`runtime-context.${key} must be string when set: ${file}`);
        }
    }
    if (o.contextScope !== undefined &&
        o.contextScope !== 'project' &&
        o.contextScope !== 'story' &&
        o.contextScope !== 'epic' &&
        o.contextScope !== 'run') {
        throw new Error(`runtime-context.contextScope invalid: ${file}`);
    }
    if (o.languagePolicy !== undefined) {
        if (!o.languagePolicy || typeof o.languagePolicy !== 'object') {
            throw new Error(`runtime-context.languagePolicy invalid: ${file}`);
        }
        const lp = o.languagePolicy;
        if (lp.resolvedMode !== 'zh' && lp.resolvedMode !== 'en' && lp.resolvedMode !== 'bilingual') {
            throw new Error(`runtime-context.languagePolicy.resolvedMode invalid: ${file}`);
        }
    }
    if (o.latestReviewerCloseout !== undefined) {
        if (!o.latestReviewerCloseout || typeof o.latestReviewerCloseout !== 'object') {
            throw new Error(`runtime-context.latestReviewerCloseout invalid: ${file}`);
        }
    }
    if (typeof o.updatedAt !== 'string' || o.updatedAt.trim() === '') {
        throw new Error(`runtime-context.updatedAt missing: ${file}`);
    }
    const out = {
        version: exports.RUNTIME_CONTEXT_VERSION,
        flow: o.flow,
        stage: o.stage,
        updatedAt: o.updatedAt,
    };
    if (o.sourceMode === 'full_bmad' ||
        o.sourceMode === 'seeded_solutioning' ||
        o.sourceMode === 'standalone_story') {
        out.sourceMode = o.sourceMode;
    }
    if (typeof o.templateId === 'string' && o.templateId !== '') {
        out.templateId = o.templateId;
    }
    if (typeof o.epicId === 'string' && o.epicId !== '')
        out.epicId = o.epicId;
    if (typeof o.storyId === 'string' && o.storyId !== '')
        out.storyId = o.storyId;
    if (typeof o.storySlug === 'string' && o.storySlug !== '')
        out.storySlug = o.storySlug;
    if (typeof o.runId === 'string' && o.runId !== '')
        out.runId = o.runId;
    if (typeof o.artifactRoot === 'string' && o.artifactRoot !== '')
        out.artifactRoot = o.artifactRoot;
    if (typeof o.artifactPath === 'string' && o.artifactPath !== '')
        out.artifactPath = o.artifactPath;
    if (typeof o.workflow === 'string' && o.workflow !== '')
        out.workflow = o.workflow;
    if (typeof o.step === 'string' && o.step !== '')
        out.step = o.step;
    if (o.contextScope === 'project' ||
        o.contextScope === 'story' ||
        o.contextScope === 'epic' ||
        o.contextScope === 'run')
        out.contextScope = o.contextScope;
    if (o.languagePolicy && typeof o.languagePolicy === 'object') {
        const lp = o.languagePolicy;
        if (lp.resolvedMode === 'zh' || lp.resolvedMode === 'en' || lp.resolvedMode === 'bilingual') {
            out.languagePolicy = { resolvedMode: lp.resolvedMode };
        }
    }
    if (o.latestReviewerCloseout && typeof o.latestReviewerCloseout === 'object') {
        out.latestReviewerCloseout = o.latestReviewerCloseout;
    }
    return out;
}
/**
 * Write context with fsync so emit can read within ~1s on local FS.
 */
function writeRuntimeContext(root, payload) {
    writeRuntimeContextFile(runtimeContextPath(root), payload);
}
function writeRuntimeContextFile(file, payload) {
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    const body = JSON.stringify(payload, null, 2) + '\n';
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, body, 'utf8');
    let fd = fs.openSync(tmp, 'r+');
    try {
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
    fd = fs.openSync(file, 'r+');
    try {
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
}
function detectRuntimeSourceMode(root, hints) {
    if (hints?.sourceMode)
        return hints.sourceMode;
    if (hints?.hasSprintStatus)
        return 'full_bmad';
    if (hints?.hasStoryOnly)
        return 'standalone_story';
    return 'seeded_solutioning';
}
function ensureProjectRuntimeContext(root, options) {
    const detectedSourceMode = detectRuntimeSourceMode(root, {
        sourceMode: options?.sourceMode,
        hasSprintStatus: options?.hasSprintStatus,
    });
    const payload = defaultRuntimeContextFile({
        contextScope: 'project',
        sourceMode: detectedSourceMode,
        ...options,
    });
    writeRuntimeContext(root, payload);
    (0, facilitator_1.ensureFacilitatorRuntimeDefinition)(root);
    (0, reviewer_1.ensureReviewerRuntimeDefinition)(root);
    const sprintStatusPath = path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
    const registry = detectedSourceMode === 'full_bmad' && fs.existsSync(sprintStatusPath)
        ? (0, registry_1.buildProjectRegistryFromSprintStatus)(root, sprintStatusPath)
        : (0, registry_1.defaultRuntimeContextRegistry)(root);
    registry.activeScope = {
        scopeType: 'project',
        resolvedContextPath: registry.projectContextPath,
        reason: 'ensureProjectRuntimeContext bootstrap',
    };
    (0, registry_1.writeRuntimeContextRegistry)(root, registry);
    return payload;
}
function ensureStoryRuntimeContext(root, options) {
    const detectedSourceMode = detectRuntimeSourceMode(root, {
        sourceMode: options?.sourceMode,
        hasStoryOnly: true,
    });
    const payload = defaultRuntimeContextFile({
        contextScope: 'story',
        sourceMode: detectedSourceMode,
        ...options,
    });
    writeRuntimeContext(root, payload);
    (0, facilitator_1.ensureFacilitatorRuntimeDefinition)(root);
    (0, reviewer_1.ensureReviewerRuntimeDefinition)(root);
    const registry = (0, registry_1.readRegistryOrDefault)(root);
    const epicId = options.epicId || payload.epicId || 'epic-unknown';
    const scopedPath = storyContextPath(root, epicId, options.storyId);
    writeRuntimeContextFile(scopedPath, payload);
    registry.storyContexts[options.storyId] = {
        path: scopedPath,
        epicId,
        sourceMode: detectedSourceMode,
    };
    registry.activeScope = {
        scopeType: 'story',
        epicId,
        storyId: options.storyId,
        resolvedContextPath: registry.storyContexts[options.storyId].path,
        reason: 'ensureStoryRuntimeContext bootstrap',
    };
    registry.updatedAt = new Date().toISOString();
    (0, registry_1.writeRuntimeContextRegistry)(root, registry);
    return payload;
}
function ensureRunRuntimeContext(root, options) {
    const detectedSourceMode = detectRuntimeSourceMode(root, {
        sourceMode: options?.sourceMode,
        hasStoryOnly: true,
    });
    const payload = defaultRuntimeContextFile({
        contextScope: 'story',
        sourceMode: detectedSourceMode,
        ...options,
    });
    writeRuntimeContext(root, payload);
    (0, facilitator_1.ensureFacilitatorRuntimeDefinition)(root);
    (0, reviewer_1.ensureReviewerRuntimeDefinition)(root);
    const registry = (0, registry_1.readRegistryOrDefault)(root);
    const epicId = options.epicId || payload.epicId || 'epic-unknown';
    const scopedPath = runContextPath(root, epicId, options.storyId, options.runId);
    writeRuntimeContextFile(scopedPath, payload);
    registry.runContexts[options.runId] = {
        path: scopedPath,
        epicId,
        storyId: options.storyId,
        runId: options.runId,
        sourceMode: detectedSourceMode,
    };
    registry.activeScope = {
        scopeType: 'run',
        epicId,
        storyId: options.storyId,
        runId: options.runId,
        resolvedContextPath: registry.runContexts[options.runId].path,
        reason: 'ensureRunRuntimeContext bootstrap',
    };
    registry.updatedAt = new Date().toISOString();
    (0, registry_1.writeRuntimeContextRegistry)(root, registry);
    return payload;
}
function writeRuntimeContextFromSprintStatus(root, sprintStatusPath) {
    const raw = fs.readFileSync(sprintStatusPath, 'utf8');
    const doc = (yaml.load(raw) ?? {});
    const developmentStatus = doc.development_status ?? {};
    const epicIds = Object.keys(developmentStatus).filter((key) => key.startsWith('epic-'));
    const storyIds = Object.keys(developmentStatus).filter((key) => !key.startsWith('epic-'));
    const payload = defaultRuntimeContextFile({
        flow: 'story',
        stage: 'story_create',
        sourceMode: 'full_bmad',
        contextScope: 'project',
        epicId: epicIds[0],
        storyId: storyIds[0],
    });
    writeRuntimeContext(root, payload);
}
