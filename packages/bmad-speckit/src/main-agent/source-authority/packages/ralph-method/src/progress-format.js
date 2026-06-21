"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRalphTimestamp = formatRalphTimestamp;
exports.computeRalphProgressHeader = computeRalphProgressHeader;
exports.formatRalphStoryLogLine = formatRalphStoryLogLine;
exports.renderRalphUserStorySection = renderRalphUserStorySection;
exports.renderInitialRalphProgressDocument = renderInitialRalphProgressDocument;
exports.updateRalphProgressHeader = updateRalphProgressHeader;
exports.markRalphStoryStatus = markRalphStoryStatus;
exports.upsertRalphProgressPhaseLine = upsertRalphProgressPhaseLine;
exports.appendRalphStoryLog = appendRalphStoryLog;
exports.hasRalphStoryLogEntry = hasRalphStoryLogEntry;
exports.validateRalphProgressPhaseSet = validateRalphProgressPhaseSet;
const types_1 = require("./types");
const STORY_LOG_SENTINEL = '# Story log';
function pad(num) {
    return String(num).padStart(2, '0');
}
function formatRalphTimestamp(value = new Date()) {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid Ralph timestamp: ${String(value)}`);
    }
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function computeRalphProgressHeader(prd) {
    const totalStories = prd.userStories.length;
    const completedStories = prd.userStories.filter((story) => story.passes).length;
    const currentStory = totalStories === 0 ? 0 : completedStories >= totalStories ? totalStories : completedStories + 1;
    return {
        title: prd.taskDescription,
        totalStories,
        currentStory,
        completedStories,
    };
}
function formatRalphStoryLogLine(input) {
    return `[${formatRalphTimestamp(input.timestamp)}] ${input.userStoryId}: ${input.title} - PASSED`;
}
function renderPendingStepLine(phase) {
    return `[${phase}] _pending_`;
}
function renderRalphUserStorySection(story) {
    const lines = [`## ${story.id}: ${story.title}`, `Status: ${story.passes ? 'PASSED' : 'PENDING'}`];
    for (const phase of (0, types_1.expectedRalphTddPhasesForStory)(story.involvesProductionCode)) {
        lines.push(renderPendingStepLine(phase));
    }
    return lines.join('\n');
}
function renderInitialRalphProgressDocument(prd) {
    const header = computeRalphProgressHeader(prd);
    const sections = prd.userStories
        .map((story) => renderRalphUserStorySection(story))
        .join('\n\n');
    return [
        `# Progress: ${header.title}`,
        `# Total stories: ${header.totalStories}`,
        '',
        `Current story: ${header.currentStory}`,
        `Completed: ${header.completedStories}`,
        '',
        '---',
        STORY_LOG_SENTINEL,
        '',
        sections,
        '',
    ].join('\n');
}
function replaceFirstLineMatching(content, matcher, replacement) {
    const lines = content.split(/\r?\n/);
    const index = lines.findIndex((line) => matcher.test(line));
    if (index === -1) {
        return content;
    }
    lines[index] = replacement;
    return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
}
function updateRalphProgressHeader(content, header) {
    let next = content;
    next = replaceFirstLineMatching(next, /^# Progress:/, `# Progress: ${header.title}`);
    next = replaceFirstLineMatching(next, /^# Total stories:/, `# Total stories: ${header.totalStories}`);
    next = replaceFirstLineMatching(next, /^Current story:/, `Current story: ${header.currentStory}`);
    next = replaceFirstLineMatching(next, /^Completed:/, `Completed: ${header.completedStories}`);
    return next;
}
function markRalphStoryStatus(content, story) {
    const header = `## ${story.id}: ${story.title}`;
    const lines = content.split(/\r?\n/);
    const index = lines.findIndex((line) => line.trim() === header);
    if (index === -1 || index + 1 >= lines.length) {
        return content;
    }
    lines[index + 1] = `Status: ${story.passes ? 'PASSED' : 'PENDING'}`;
    return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
}
function phaseMarker(phase) {
    return `[${phase}]`;
}
function upsertRalphProgressPhaseLine(content, story, phase, detail) {
    const header = `## ${story.id}: ${story.title}`;
    const lines = content.split(/\r?\n/);
    const index = lines.findIndex((line) => line.trim() === header);
    if (index === -1) {
        return content;
    }
    const marker = phaseMarker(phase);
    const targetLine = `${marker} ${detail}`;
    for (let i = index + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('## ')) {
            break;
        }
        if (line.startsWith(marker)) {
            lines[i] = targetLine;
            return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
        }
    }
    const insertAt = index + 2 + (0, types_1.expectedRalphTddPhasesForStory)(story.involvesProductionCode).indexOf(phase);
    lines.splice(insertAt, 0, targetLine);
    return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
}
function appendRalphStoryLog(content, entry) {
    const lines = content.split(/\r?\n/);
    const sentinelIndex = lines.findIndex((line) => line.trim() === STORY_LOG_SENTINEL);
    if (sentinelIndex === -1) {
        return `${content}${content.endsWith('\n') ? '' : '\n'}${STORY_LOG_SENTINEL}\n${entry}\n`;
    }
    const firstSectionIndex = lines.findIndex((line, index) => index > sentinelIndex && line.startsWith('## '));
    const insertAt = firstSectionIndex === -1 ? lines.length : firstSectionIndex;
    lines.splice(insertAt, 0, entry, '');
    return `${lines.join('\n')}${content.endsWith('\n') ? '\n' : ''}`;
}
function hasRalphStoryLogEntry(content, userStoryId) {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .some((line) => line.includes(`] ${userStoryId}: `) && line.endsWith(' - PASSED'));
}
function validateRalphProgressPhaseSet(story) {
    return (0, types_1.isProductionRalphUserStory)(story)
        ? ['TDD-RED', 'TDD-GREEN', 'TDD-REFACTOR']
        : ['DONE'];
}
