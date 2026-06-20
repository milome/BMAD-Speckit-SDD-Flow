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
exports.RALPH_SCRIPT_ENFORCED_SUBSET = void 0;
exports.parseSpeckitTasksToUserStories = parseSpeckitTasksToUserStories;
exports.buildSpeckitImplementVerifyCommand = buildSpeckitImplementVerifyCommand;
exports.buildSpeckitImplementRecordPhaseCommand = buildSpeckitImplementRecordPhaseCommand;
exports.prepareSpeckitImplementRalphTracking = prepareSpeckitImplementRalphTracking;
exports.verifySpeckitImplementRalphTracking = verifySpeckitImplementRalphTracking;
exports.recordSpeckitImplementRalphPhase = recordSpeckitImplementRalphPhase;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const pathing_1 = require("./pathing");
const verify_ralph_compliance_1 = require("./verify-ralph-compliance");
const write_tracking_files_1 = require("./write-tracking-files");
exports.RALPH_SCRIPT_ENFORCED_SUBSET = [
    'create/prepare tracking files',
    'record TDD-RED/TDD-GREEN/TDD-REFACTOR phase traces',
    'final compliance verification',
];
const TASK_LINE_PATTERN = /^\s*-\s*\[(?<checked>[ xX])\]\s+(?<body>.+?)\s*$/u;
const TASK_ID_PATTERN = /\bT\d+(?:\.\d+)?\b/u;
const NON_PRODUCTION_HINT_PATTERN = /\b(doc|docs|documentation|readme|\.md\b|audit|review|lint|verify|verification|checklist|handoff|comment|comments|changelog)\b/iu;
function normalizeString(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
function resolveProjectRoot(projectRoot) {
    return path.resolve(projectRoot ?? process.cwd());
}
function resolveTasksPath(projectRoot, tasksPath) {
    return path.isAbsolute(tasksPath) ? path.resolve(tasksPath) : path.resolve(projectRoot, tasksPath);
}
function resolveTrackingBaseDir(projectRoot, input, tasksPath) {
    if (normalizeString(input.mode) !== 'bmad') {
        return path.dirname(tasksPath);
    }
    const epic = normalizeString(input.epic);
    const story = normalizeString(input.story);
    const epicSlug = normalizeString(input.epicSlug);
    const storySlug = normalizeString(input.storySlug);
    if (!epic || !story || !epicSlug || !storySlug) {
        return path.dirname(tasksPath);
    }
    return path.join(projectRoot, '_bmad-output', 'implementation-artifacts', `epic-${epic}-${epicSlug}`, `story-${story}-${storySlug}`);
}
function buildReferenceDocumentPath(baseDir, tasksPath) {
    return path.join(baseDir, path.basename(tasksPath));
}
function inferProductionCode(taskBody) {
    return !NON_PRODUCTION_HINT_PATTERN.test(taskBody);
}
function createPendingTddSteps(involvesProductionCode) {
    return involvesProductionCode
        ? [
            { phase: 'TDD-RED', passes: false },
            { phase: 'TDD-GREEN', passes: false },
            { phase: 'TDD-REFACTOR', passes: false },
        ]
        : [{ phase: 'DONE', passes: false }];
}
function parseSpeckitTasksToUserStories(tasksContent) {
    const userStories = tasksContent
        .split(/\r?\n/u)
        .map((line) => line.match(TASK_LINE_PATTERN))
        .filter((match) => Boolean(match))
        .map((match) => ({
        checked: match.groups?.checked?.toLowerCase() === 'x',
        body: match.groups?.body?.trim() ?? '',
    }))
        .filter(({ body }) => TASK_ID_PATTERN.test(body))
        .map(({ checked, body }, index) => {
        const involvesProductionCode = inferProductionCode(body);
        return {
            id: `US-${String(index + 1).padStart(3, '0')}`,
            title: body,
            description: body,
            acceptanceCriteria: [body],
            priority: index + 1,
            passes: checked,
            notes: `Source task checkbox: ${checked ? '[x]' : '[ ]'}`,
            involvesProductionCode,
            tddSteps: createPendingTddSteps(involvesProductionCode),
        };
    });
    if (userStories.length === 0) {
        throw new Error('No actionable checklist tasks were found in tasks.md for Ralph tracking');
    }
    return userStories;
}
function buildSpeckitImplementVerifyCommand(input) {
    const args = ['ralph', 'verify', `--tasksPath "${input.tasksPath}"`];
    for (const [key, value] of Object.entries({
        mode: input.mode,
        epic: input.epic,
        story: input.story,
        epicSlug: input.epicSlug,
        storySlug: input.storySlug,
    })) {
        const normalized = normalizeString(value);
        if (normalized) {
            args.push(`--${key} "${normalized}"`);
        }
    }
    return `npx bmad-speckit ${args.join(' ')}`;
}
function buildSpeckitImplementRecordPhaseCommand(input) {
    const args = [
        'ralph',
        'record-phase',
        `--tasksPath "${input.tasksPath}"`,
        `--userStoryId "${input.userStoryId}"`,
        `--title "${input.title}"`,
        `--phase "${input.phase}"`,
        `--detail "${input.detail}"`,
    ];
    for (const [key, value] of Object.entries({
        mode: input.mode,
        epic: input.epic,
        story: input.story,
        epicSlug: input.epicSlug,
        storySlug: input.storySlug,
        storyLogTimestamp: typeof input.storyLogTimestamp === 'string' ? input.storyLogTimestamp : undefined,
    })) {
        const normalized = normalizeString(value);
        if (normalized) {
            args.push(`--${key} "${normalized}"`);
        }
    }
    return `npx bmad-speckit ${args.join(' ')}`;
}
function prepareSpeckitImplementRalphTracking(input) {
    const projectRoot = resolveProjectRoot(input.projectRoot);
    const tasksPath = resolveTasksPath(projectRoot, input.tasksPath);
    const trackingBaseDir = resolveTrackingBaseDir(projectRoot, input, tasksPath);
    const referenceDocumentPath = buildReferenceDocumentPath(trackingBaseDir, tasksPath);
    const tasksContent = fs.readFileSync(tasksPath, 'utf8');
    const userStories = parseSpeckitTasksToUserStories(tasksContent);
    const stem = path.basename(tasksPath, path.extname(tasksPath));
    const taskDescription = normalizeString(input.taskDescription) ?? `Execute speckit implement tasks from ${stem}`;
    const result = (0, write_tracking_files_1.createRalphTrackingFiles)({
        projectRoot,
        tasksPath,
        referenceDocumentPath,
        branchName: input.branchName,
        taskDescription,
        userStories,
        overwrite: input.overwrite,
    });
    return {
        ...result,
        verifyCommand: buildSpeckitImplementVerifyCommand({
            tasksPath: input.tasksPath,
            mode: input.mode,
            epic: input.epic,
            story: input.story,
            epicSlug: input.epicSlug,
            storySlug: input.storySlug,
        }),
    };
}
function verifySpeckitImplementRalphTracking(input) {
    const projectRoot = resolveProjectRoot(input.projectRoot);
    const tasksPath = resolveTasksPath(projectRoot, input.tasksPath);
    const trackingBaseDir = resolveTrackingBaseDir(projectRoot, input, tasksPath);
    const referenceDocumentPath = buildReferenceDocumentPath(trackingBaseDir, tasksPath);
    const paths = (0, pathing_1.resolveRalphTrackingPaths)({
        projectRoot,
        tasksPath,
        referenceDocumentPath,
    });
    return {
        paths,
        result: (0, verify_ralph_compliance_1.verifyRalphCompliance)({
            prdPath: paths.prdPath,
            progressPath: paths.progressPath,
        }),
    };
}
function recordSpeckitImplementRalphPhase(input) {
    const projectRoot = resolveProjectRoot(input.projectRoot);
    const tasksPath = resolveTasksPath(projectRoot, input.tasksPath);
    const trackingBaseDir = resolveTrackingBaseDir(projectRoot, input, tasksPath);
    const referenceDocumentPath = buildReferenceDocumentPath(trackingBaseDir, tasksPath);
    const paths = (0, pathing_1.resolveRalphTrackingPaths)({
        projectRoot,
        tasksPath,
        referenceDocumentPath,
    });
    return {
        paths,
        progress: (0, write_tracking_files_1.recordTddPhaseTrace)({
            progressPath: paths.progressPath,
            userStoryId: input.userStoryId,
            title: input.title,
            phase: input.phase,
            detail: input.detail,
            storyLogTimestamp: input.storyLogTimestamp,
        }),
    };
}
