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
exports.parseStoryKey = parseStoryKey;
exports.runEnsureRunCli = runEnsureRunCli;
/**
 * CLI for ensure-run-runtime-context (bmad-speckit subcommand).
 */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const context_1 = require("./context");
const registry_1 = require("./registry");
/** Same rule as create-story: epic_num-story_num-slug (e.g. 15-1-runtime-governance-complete). */
function parseStoryKey(storyKey) {
    const trimmed = storyKey.trim();
    const m = /^(\d+)-(\d+)-(.+)$/.exec(trimmed);
    if (!m) {
        throw new Error(`Invalid story-key: expected "{{epic}}-{{story}}-{{slug}}" (e.g. 15-1-runtime-governance-complete), got: ${storyKey}`);
    }
    const [, epicNum, storyNum, storySlug] = m;
    return {
        epicNum,
        storyNum,
        storySlug,
        epicId: `epic-${epicNum}`,
    };
}
function lastRunPath(root, lifecycle) {
    const name = lifecycle === 'dev_story' ? 'last-dev-story-run.json' : 'last-post-audit-run.json';
    return path.join(root, '_bmad-output', 'runtime', name);
}
function runtimeEventsPath(root) {
    return path.join(root, '_bmad-output', 'runtime', 'events');
}
function appendRuntimeEvent(root, event) {
    const eventsDir = runtimeEventsPath(root);
    fs.mkdirSync(eventsDir, { recursive: true });
    const safeTimestamp = event.timestamp.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeEventId = event.event_id.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(eventsDir, `${safeTimestamp}-${safeEventId}.json`);
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(event, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, filePath);
}
function emitRunLifecycleEvents(root, input) {
    const now = new Date().toISOString();
    const stage = stageForLifecycle(input.lifecycle);
    const scope = {
        story_key: input.storyKey,
        epic_id: input.epicId,
        story_id: input.storyKey,
        flow: 'story',
        resolved_context_path: input.runPath,
    };
    appendRuntimeEvent(root, {
        event_id: (0, node_crypto_1.randomUUID)(),
        event_type: 'run.created',
        event_version: 1,
        timestamp: now,
        run_id: input.runId,
        flow: 'story',
        stage,
        scope,
        payload: {
            lifecycle: input.lifecycle,
            status: 'pending',
        },
    });
    appendRuntimeEvent(root, {
        event_id: (0, node_crypto_1.randomUUID)(),
        event_type: 'run.scope.changed',
        event_version: 1,
        timestamp: now,
        run_id: input.runId,
        flow: 'story',
        stage,
        scope,
        payload: {
            lifecycle: input.lifecycle,
            scope_type: 'run',
        },
    });
    appendRuntimeEvent(root, {
        event_id: (0, node_crypto_1.randomUUID)(),
        event_type: 'stage.started',
        event_version: 1,
        timestamp: now,
        run_id: input.runId,
        flow: 'story',
        stage,
        scope,
        payload: {
            lifecycle: input.lifecycle,
            status: 'running',
        },
    });
}
function writeLastRun(root, lifecycle, body) {
    const file = lastRunPath(root, lifecycle);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n', 'utf8');
}
function readLastRun(root, lifecycle) {
    const file = lastRunPath(root, lifecycle);
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    }
    catch (e) {
        const err = e;
        if (err.code === 'ENOENT') {
            throw new Error(`Missing ${file}; run without --persist first.`);
        }
        throw e;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed.storyKey !== 'string' || typeof parsed.runId !== 'string') {
        throw new Error(`Invalid last-run file: ${file}`);
    }
    return { storyKey: parsed.storyKey, runId: parsed.runId };
}
function stageForLifecycle(lifecycle) {
    return lifecycle === 'dev_story' ? 'implement' : 'post_audit';
}
/**
 * Persist registry after sprint-status write: refresh from sprint when present, re-affirm run scope.
 */
function persistRunRegistry(root, storyKey, runId, lifecycle) {
    const parsed = parseStoryKey(storyKey);
    const sprintPath = path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
    let registry = fs.existsSync((0, registry_1.runtimeContextRegistryPath)(root))
        ? (0, registry_1.readRuntimeContextRegistry)(root)
        : (0, registry_1.defaultRuntimeContextRegistry)(root);
    if (fs.existsSync(sprintPath)) {
        registry = (0, registry_1.buildProjectRegistryFromSprintStatus)(root, sprintPath);
    }
    const runPath = (0, context_1.runContextPath)(root, parsed.epicId, storyKey, runId);
    registry.runContexts[runId] = {
        path: runPath,
        epicId: parsed.epicId,
        storyId: storyKey,
        runId,
        lifecycleStage: lifecycle,
    };
    registry.activeScope = {
        scopeType: 'run',
        epicId: parsed.epicId,
        storyId: storyKey,
        runId,
        resolvedContextPath: runPath,
        reason: `ensure-run-runtime-context --persist (${lifecycle})`,
    };
    registry.updatedAt = new Date().toISOString();
    (0, registry_1.writeRuntimeContextRegistry)(root, registry);
    emitRunLifecycleEvents(root, {
        runId,
        storyKey,
        epicId: parsed.epicId,
        lifecycle,
        runPath,
    });
}
function runEnsureRunCli(opts) {
    const root = opts.cwd ?? process.cwd();
    const lifecycle = opts.lifecycle;
    if (opts.persist) {
        const { storyKey, runId } = readLastRun(root, lifecycle);
        if (storyKey !== opts.storyKey.trim()) {
            throw new Error(`story-key mismatch: CLI has "${opts.storyKey}" but ${lastRunPath(root, lifecycle)} has "${storyKey}"`);
        }
        persistRunRegistry(root, storyKey, runId, lifecycle);
        return;
    }
    const storyKey = opts.storyKey.trim();
    const parsed = parseStoryKey(storyKey);
    const runId = (0, node_crypto_1.randomUUID)();
    (0, context_1.ensureRunRuntimeContext)(root, {
        epicId: parsed.epicId,
        storyId: storyKey,
        runId,
        stage: stageForLifecycle(lifecycle),
        flow: 'story',
    });
    emitRunLifecycleEvents(root, {
        runId,
        storyKey,
        epicId: parsed.epicId,
        lifecycle,
        runPath: (0, context_1.runContextPath)(root, parsed.epicId, storyKey, runId),
    });
    // eslint-disable-next-line no-console -- CLI contract (tasks-E15-S1)
    console.log(`RUN_ID:${runId}`);
    writeLastRun(root, lifecycle, { storyKey, runId });
}
