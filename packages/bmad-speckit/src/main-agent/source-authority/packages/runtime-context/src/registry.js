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
exports.runtimeContextRegistryPath = runtimeContextRegistryPath;
exports.defaultRuntimeContextRegistry = defaultRuntimeContextRegistry;
exports.writeRuntimeContextRegistry = writeRuntimeContextRegistry;
exports.readRuntimeContextRegistry = readRuntimeContextRegistry;
exports.readRegistryOrDefault = readRegistryOrDefault;
exports.buildProjectRegistryFromSprintStatus = buildProjectRegistryFromSprintStatus;
exports.buildEpicContextsFromSprintStatus = buildEpicContextsFromSprintStatus;
exports.buildStoryContextsFromSprintStatus = buildStoryContextsFromSprintStatus;
exports.buildRunContext = buildRunContext;
exports.resolveActiveScope = resolveActiveScope;
exports.resolveContextPathFromActiveScope = resolveContextPathFromActiveScope;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
function runtimeContextRegistryPath(root) {
    return path.join(root, '_bmad-output', 'runtime', 'registry.json');
}
function sanitizeBranchRef(value) {
    const normalized = String(value ?? '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'dev';
}
function resolveGitHeadPath(root) {
    const gitEntry = path.join(root, '.git');
    if (!fs.existsSync(gitEntry)) {
        return null;
    }
    try {
        const stat = fs.lstatSync(gitEntry);
        if (stat.isDirectory()) {
            return path.join(gitEntry, 'HEAD');
        }
        if (stat.isFile()) {
            const raw = fs.readFileSync(gitEntry, 'utf8').trim();
            const match = /^gitdir:\s*(.+)$/iu.exec(raw);
            if (!match) {
                return null;
            }
            const gitDir = path.isAbsolute(match[1]) ? match[1] : path.resolve(root, match[1]);
            return path.join(gitDir, 'HEAD');
        }
    }
    catch {
        return null;
    }
    return null;
}
function resolvePlanningArtifactsBranch(root) {
    const headPath = resolveGitHeadPath(root);
    if (!headPath || !fs.existsSync(headPath)) {
        return 'dev';
    }
    try {
        const raw = fs.readFileSync(headPath, 'utf8').trim();
        const branchMatch = /^ref:\s+refs\/heads\/(.+)$/iu.exec(raw);
        if (branchMatch) {
            return sanitizeBranchRef(branchMatch[1]);
        }
        if (/^[0-9a-f]{7,40}$/iu.test(raw)) {
            return `detached-${raw.slice(0, 7)}`;
        }
    }
    catch {
        return 'dev';
    }
    return 'dev';
}
function defaultEpicsPath(root) {
    return `_bmad-output/planning-artifacts/${resolvePlanningArtifactsBranch(root)}/epics.md`;
}
function defaultRuntimeContextRegistry(root) {
    const now = new Date().toISOString();
    return {
        version: 1,
        projectRoot: root,
        generatedAt: now,
        updatedAt: now,
        sources: {
            sprintStatusPath: '_bmad-output/implementation-artifacts/sprint-status.yaml',
            epicsPath: defaultEpicsPath(root),
            storyArtifactsRoot: '_bmad-output/implementation-artifacts',
            specsRoot: 'specs',
        },
        project: {
            activeEpicIds: [],
            activeStoryIds: [],
        },
        projectContextPath: path.join('_bmad-output', 'runtime', 'context', 'project.json'),
        epicContexts: {},
        storyContexts: {},
        runContexts: {},
        auditIndex: {
            bugfix: {},
            standalone_tasks: {},
        },
        implementationEntryIndex: {
            story: {},
            bugfix: {},
            standalone_tasks: {},
        },
        latestReviewerCloseout: null,
        activeScope: {
            scopeType: 'project',
            resolvedContextPath: path.join('_bmad-output', 'runtime', 'context', 'project.json'),
            reason: 'default project scope',
        },
    };
}
function writeRuntimeContextRegistry(root, registry) {
    const file = runtimeContextRegistryPath(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const body = JSON.stringify(registry, null, 2) + '\n';
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
function readRuntimeContextRegistry(root) {
    const file = runtimeContextRegistryPath(root);
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    parsed.sources = parsed.sources ?? {
        sprintStatusPath: '_bmad-output/implementation-artifacts/sprint-status.yaml',
        epicsPath: defaultEpicsPath(root),
        storyArtifactsRoot: '_bmad-output/implementation-artifacts',
        specsRoot: 'specs',
    };
    if (!parsed.sources.epicsPath || parsed.sources.epicsPath === 'epics.md') {
        parsed.sources.epicsPath = defaultEpicsPath(root);
    }
    if (!parsed.auditIndex) {
        parsed.auditIndex = {
            bugfix: {},
            standalone_tasks: {},
        };
    }
    else {
        parsed.auditIndex.bugfix = parsed.auditIndex.bugfix ?? {};
        parsed.auditIndex.standalone_tasks = parsed.auditIndex.standalone_tasks ?? {};
    }
    if (!parsed.implementationEntryIndex) {
        parsed.implementationEntryIndex = {
            story: {},
            bugfix: {},
            standalone_tasks: {},
        };
    }
    else {
        parsed.implementationEntryIndex.story = parsed.implementationEntryIndex.story ?? {};
        parsed.implementationEntryIndex.bugfix = parsed.implementationEntryIndex.bugfix ?? {};
        parsed.implementationEntryIndex.standalone_tasks =
            parsed.implementationEntryIndex.standalone_tasks ?? {};
    }
    parsed.latestReviewerCloseout = parsed.latestReviewerCloseout ?? null;
    return parsed;
}
/**
 * Load existing registry from disk when present; otherwise a fresh default.
 * @param {string} root - Project root.
 * @returns {object} Runtime context registry.
 */
function readRegistryOrDefault(root) {
    const file = runtimeContextRegistryPath(root);
    if (!fs.existsSync(file)) {
        return defaultRuntimeContextRegistry(root);
    }
    return readRuntimeContextRegistry(root);
}
function buildProjectRegistryFromSprintStatus(root, sprintStatusPath) {
    const raw = fs.readFileSync(sprintStatusPath, 'utf8');
    const doc = (yaml.load(raw) ?? {});
    const developmentStatus = doc.development_status ?? {};
    const activeEpicIds = Object.keys(developmentStatus).filter((key) => key.startsWith('epic-'));
    const activeStoryIds = Object.keys(developmentStatus).filter((key) => !key.startsWith('epic-'));
    const registry = defaultRuntimeContextRegistry(root);
    registry.project.activeEpicIds = activeEpicIds;
    registry.project.activeStoryIds = activeStoryIds;
    registry.sources.sprintStatusPath = path.relative(root, sprintStatusPath).replace(/\\/g, '/');
    registry.updatedAt = new Date().toISOString();
    return registry;
}
function buildEpicContextsFromSprintStatus(root, sprintStatusPath) {
    const raw = fs.readFileSync(sprintStatusPath, 'utf8');
    const doc = (yaml.load(raw) ?? {});
    const developmentStatus = doc.development_status ?? {};
    return Object.fromEntries(Object.entries(developmentStatus)
        .filter(([key]) => key.startsWith('epic-'))
        .map(([epicId, status]) => [
        epicId,
        {
            path: path.join(root, '_bmad-output', 'runtime', 'context', 'epics', `${epicId}.json`),
            status,
        },
    ]));
}
function buildStoryContextsFromSprintStatus(root, sprintStatusPath) {
    const raw = fs.readFileSync(sprintStatusPath, 'utf8');
    const doc = (yaml.load(raw) ?? {});
    const developmentStatus = doc.development_status ?? {};
    const epicIds = Object.keys(developmentStatus).filter((key) => key.startsWith('epic-'));
    const defaultEpicId = epicIds[0] ?? 'epic-unknown';
    return Object.fromEntries(Object.entries(developmentStatus)
        .filter(([key]) => !key.startsWith('epic-'))
        .map(([storyId, status]) => [
        storyId,
        {
            path: path.join(root, '_bmad-output', 'runtime', 'context', 'stories', defaultEpicId, `${storyId}.json`),
            status,
            epicId: defaultEpicId,
            artifactRoot: path.join(root, '_bmad-output', 'implementation-artifacts', defaultEpicId, storyId),
            specRoot: path.join(root, 'specs', defaultEpicId, storyId),
        },
    ]));
}
function buildRunContext(root, input) {
    return {
        scopeType: 'run',
        epicId: input.epicId,
        storyId: input.storyId,
        storySlug: input.storySlug,
        runId: input.runId,
        lifecycleStage: input.lifecycleStage,
        ...(input.workflowStage ? { workflowStage: input.workflowStage } : {}),
        ...(input.iteration != null ? { iteration: input.iteration } : {}),
        path: path.join(root, '_bmad-output', 'runtime', 'context', 'runs', input.epicId, input.storyId, `${input.runId}.json`),
    };
}
function resolveActiveScope(registry, scope) {
    return scope;
}
function resolveContextPathFromActiveScope(registry, scope) {
    switch (scope.scopeType) {
        case 'run': {
            if (!scope.runId || !registry.runContexts[scope.runId]) {
                throw new Error(`Missing run context for ${scope.runId ?? 'unknown'}`);
            }
            return registry.runContexts[scope.runId].path;
        }
        case 'story': {
            if (!scope.storyId || !registry.storyContexts[scope.storyId]) {
                throw new Error(`Missing story context for ${scope.storyId ?? 'unknown'}`);
            }
            return registry.storyContexts[scope.storyId].path;
        }
        case 'epic': {
            if (!scope.epicId || !registry.epicContexts[scope.epicId]) {
                throw new Error(`Missing epic context for ${scope.epicId ?? 'unknown'}`);
            }
            return registry.epicContexts[scope.epicId].path;
        }
        case 'project':
        default:
            return registry.projectContextPath;
    }
}
