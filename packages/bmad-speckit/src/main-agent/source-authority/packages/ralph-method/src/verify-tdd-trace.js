"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTddTrace = verifyTddTrace;
const fs = require("node:fs");
const schema_1 = require("./schema");
function buildSummary(results) {
    const checkedStories = results.filter((result) => result.checked).length;
    const passingStories = results.filter((result) => result.checked && result.passed).length;
    const failingStories = results.filter((result) => result.checked && !result.passed).length;
    const skippedStories = results.filter((result) => !result.checked).length;
    return { checkedStories, passingStories, failingStories, skippedStories };
}
function finalStatus(results, errors) {
    return errors.length > 0 || results.some((result) => result.checked && !result.passed)
        ? 'fail'
        : 'pass';
}
function parsePrd(prdPath) {
    const raw = JSON.parse(fs.readFileSync(prdPath, 'utf8'));
    return (0, schema_1.parseRalphPrdDocument)(raw);
}
function parseProgressSections(content) {
    const sections = new Map();
    let currentStoryId = null;
    for (const line of content.split(/\r?\n/)) {
        const headerMatch = /^##\s+(US-\d+):/.exec(line.trim());
        if (headerMatch) {
            currentStoryId = headerMatch[1];
            sections.set(currentStoryId, { lines: [] });
            continue;
        }
        if (!currentStoryId) {
            continue;
        }
        const section = sections.get(currentStoryId);
        if (line.startsWith('Status: ')) {
            section.statusLine = line.trim();
            continue;
        }
        section.lines.push(line.trim());
    }
    return sections;
}
function phaseMarker(phase) {
    return `[${phase}]`;
}
function findPhaseLineIndexes(lines, phase) {
    const marker = phaseMarker(phase);
    return lines.reduce((acc, line, index) => {
        if (line.startsWith(marker)) {
            acc.push(index);
        }
        return acc;
    }, []);
}
function verifyTddTrace(input) {
    try {
        const prd = parsePrd(input.prdPath);
        const progress = fs.readFileSync(input.progressPath, 'utf8');
        const sections = parseProgressSections(progress);
        const userStoryResults = prd.userStories.map((story) => {
            const section = sections.get(story.id);
            const shouldCheck = story.passes || section?.statusLine === 'Status: PASSED';
            if (!shouldCheck) {
                return {
                    userStoryId: story.id,
                    checked: false,
                    passed: true,
                    errors: [],
                    warnings: [],
                };
            }
            const errors = [];
            if (!section) {
                errors.push(`Missing progress section for ${story.id}`);
            }
            else {
                if (section.statusLine !== 'Status: PASSED') {
                    errors.push(`Progress section for ${story.id} is not marked PASSED`);
                }
                const phaseIndexes = story.tddSteps.map((step) => findPhaseLineIndexes(section.lines, step.phase));
                phaseIndexes.forEach((indexes, index) => {
                    const phase = story.tddSteps[index].phase;
                    if (indexes.length === 0) {
                        errors.push(`Missing ${phase} trace for ${story.id}`);
                        return;
                    }
                    if (indexes.length > 1) {
                        errors.push(`Duplicate ${phase} trace for ${story.id}`);
                    }
                    const line = section.lines[indexes[0]] ?? '';
                    if (line.includes('_pending_')) {
                        errors.push(`Pending placeholder remains for ${story.id} ${phase}`);
                    }
                });
                const flattened = phaseIndexes.map((indexes) => indexes[0] ?? -1);
                const sorted = [...flattened].sort((a, b) => a - b);
                if (flattened.some((value, index) => value !== sorted[index])) {
                    errors.push(`Invalid TDD phase order for ${story.id}`);
                }
            }
            return {
                userStoryId: story.id,
                checked: true,
                passed: errors.length === 0,
                errors,
                warnings: [],
            };
        });
        const errors = userStoryResults.flatMap((result) => result.errors);
        return {
            status: finalStatus(userStoryResults, errors),
            errors,
            warnings: [],
            userStoryResults,
            summary: buildSummary(userStoryResults),
        };
    }
    catch (error) {
        const message = error instanceof schema_1.RalphSchemaValidationError || error instanceof Error
            ? error.message
            : String(error);
        return {
            status: 'fail',
            errors: [message],
            warnings: [],
            userStoryResults: [],
            summary: {
                checkedStories: 0,
                passingStories: 0,
                failingStories: 0,
                skippedStories: 0,
            },
        };
    }
}
