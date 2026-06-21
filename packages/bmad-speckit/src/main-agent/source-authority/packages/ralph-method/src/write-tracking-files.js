"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRalphTrackingFiles = createRalphTrackingFiles;
exports.markUserStoryPassed = markUserStoryPassed;
exports.recomputeProgressCounters = recomputeProgressCounters;
exports.recordTddPhaseTrace = recordTddPhaseTrace;
exports.appendTddTrace = appendTddTrace;
const fs = require("node:fs");
const path = require("node:path");
const pathing_1 = require("./pathing");
const progress_format_1 = require("./progress-format");
const schema_1 = require("./schema");
const types_1 = require("./types");
function atomicWriteFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, content, 'utf8');
    let fd = fs.openSync(tmp, 'r+');
    try {
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
    fs.renameSync(tmp, filePath);
    fd = fs.openSync(filePath, 'r+');
    try {
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
}
function readRalphPrd(filePath) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return (0, schema_1.parseRalphPrdDocument)(parsed);
}
function writeRalphPrd(filePath, document) {
    (0, schema_1.assertValidRalphPrdDocument)(document);
    atomicWriteFile(filePath, `${JSON.stringify(document, null, 2)}\n`);
}
function resolvePrdPathFromProgressPath(progressPath) {
    return path.join(path.dirname(progressPath), path.basename(progressPath).replace(/^progress/, 'prd').replace(/\.txt$/i, '.json'));
}
function findUserStory(document, userStoryId) {
    const story = document.userStories.find((candidate) => candidate.id === userStoryId);
    if (!story) {
        throw new Error(`Unknown Ralph user story: ${userStoryId}`);
    }
    return story;
}
function createRalphTrackingFiles(input) {
    const paths = (0, pathing_1.resolveRalphTrackingPaths)(input);
    const prd = {
        schemaVersion: types_1.RALPH_PRD_SCHEMA_VERSION,
        branchName: input.branchName,
        taskDescription: input.taskDescription,
        projectContext: input.projectContext ?? {},
        userStories: input.userStories,
    };
    (0, schema_1.assertValidRalphPrdDocument)(prd);
    let prdCreated = false;
    if (input.overwrite || !fs.existsSync(paths.prdPath)) {
        writeRalphPrd(paths.prdPath, prd);
        prdCreated = true;
    }
    let progressCreated = false;
    if (input.overwrite || !fs.existsSync(paths.progressPath)) {
        atomicWriteFile(paths.progressPath, (0, progress_format_1.renderInitialRalphProgressDocument)(prd));
        progressCreated = true;
    }
    return {
        paths,
        prdCreated,
        progressCreated,
        prd: fs.existsSync(paths.prdPath) ? readRalphPrd(paths.prdPath) : prd,
    };
}
function markUserStoryPassed(input) {
    const prd = readRalphPrd(input.prdPath);
    const story = findUserStory(prd, input.userStoryId);
    story.passes = input.passes ?? true;
    writeRalphPrd(input.prdPath, prd);
    return prd;
}
function recomputeProgressCounters(prdPath, progressPath) {
    const prd = readRalphPrd(prdPath);
    const current = fs.readFileSync(progressPath, 'utf8');
    const next = (0, progress_format_1.updateRalphProgressHeader)(current, (0, progress_format_1.computeRalphProgressHeader)(prd));
    atomicWriteFile(progressPath, next);
    return next;
}
function recordTddPhaseTrace(input) {
    const prdPath = resolvePrdPathFromProgressPath(input.progressPath);
    const prd = readRalphPrd(prdPath);
    const story = findUserStory(prd, input.userStoryId);
    let content = fs.readFileSync(input.progressPath, 'utf8');
    content = (0, progress_format_1.upsertRalphProgressPhaseLine)(content, story, input.phase, input.detail);
    const step = story.tddSteps.find((candidate) => candidate.phase === input.phase);
    if (!step) {
        throw new Error(`User story ${story.id} does not define TDD phase ${input.phase}`);
    }
    step.passes = true;
    step.note = input.detail;
    step.timestamp =
        typeof input.storyLogTimestamp === 'string'
            ? input.storyLogTimestamp
            : (input.storyLogTimestamp ?? new Date()).toISOString();
    story.passes = story.tddSteps.every((step) => step.passes);
    if (story.passes && !(0, progress_format_1.hasRalphStoryLogEntry)(content, story.id)) {
        content = (0, progress_format_1.appendRalphStoryLog)(content, (0, progress_format_1.formatRalphStoryLogLine)({
            userStoryId: input.userStoryId,
            title: input.title,
            timestamp: input.storyLogTimestamp,
        }));
    }
    content = (0, progress_format_1.markRalphStoryStatus)(content, story);
    writeRalphPrd(prdPath, prd);
    content = (0, progress_format_1.updateRalphProgressHeader)(content, (0, progress_format_1.computeRalphProgressHeader)(prd));
    atomicWriteFile(input.progressPath, content);
    return content;
}
function appendTddTrace(input) {
    let content = fs.readFileSync(input.progressPath, 'utf8');
    for (const phase of input.phases) {
        content = recordTddPhaseTrace({
            progressPath: input.progressPath,
            userStoryId: input.userStoryId,
            title: input.title,
            phase: phase.phase,
            detail: phase.detail,
            storyLogTimestamp: input.storyLogTimestamp,
        });
    }
    return content;
}
