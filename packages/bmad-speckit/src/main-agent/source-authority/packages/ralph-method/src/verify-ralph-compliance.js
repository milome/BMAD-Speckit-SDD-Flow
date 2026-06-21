"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassConsistency = void 0;
exports.verifyRalphCompliance = verifyRalphCompliance;
const fs = require("node:fs");
const schema_1 = require("./schema");
const verify_pass_consistency_1 = require("./verify-pass-consistency");
const verify_tdd_trace_1 = require("./verify-tdd-trace");
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
function readProgressHeader(content) {
    const completedMatch = content.match(/^Completed:\s*(\d+)/m);
    const currentMatch = content.match(/^Current story:\s*(\d+)/m);
    return {
        completed: completedMatch ? Number(completedMatch[1]) : undefined,
        currentStory: currentMatch ? Number(currentMatch[1]) : undefined,
    };
}
function expectedCurrentStory(totalStories, completedStories) {
    if (totalStories === 0) {
        return 0;
    }
    return completedStories >= totalStories ? totalStories : completedStories + 1;
}
function storyLogCount(content) {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s+US-\d+:/u.test(line)).length;
}
function verifyRalphCompliance(input) {
    try {
        const prd = parsePrd(input.prdPath);
        const progress = fs.readFileSync(input.progressPath, 'utf8');
        const tddTrace = (0, verify_tdd_trace_1.verifyTddTrace)(input);
        const passConsistency = (0, verify_pass_consistency_1.verifyPassConsistency)(input);
        const completedStories = prd.userStories.filter((story) => story.passes).length;
        const totalStories = prd.userStories.length;
        const header = readProgressHeader(progress);
        const errors = [
            ...tddTrace.errors,
            ...passConsistency.errors,
        ];
        if (header.completed !== completedStories) {
            errors.push(`Completed: ${header.completed ?? 'missing'} does not match prd passed count ${completedStories}`);
        }
        const expectedCurrent = expectedCurrentStory(totalStories, completedStories);
        if (header.currentStory !== expectedCurrent) {
            errors.push(`Current story: ${header.currentStory ?? 'missing'} does not match expected ${expectedCurrent}`);
        }
        if (storyLogCount(progress) < completedStories) {
            errors.push(`Story log count ${storyLogCount(progress)} is lower than completed story count ${completedStories}`);
        }
        const mergedResults = prd.userStories.map((story) => {
            const tdd = tddTrace.userStoryResults.find((result) => result.userStoryId === story.id);
            const consistency = passConsistency.userStoryResults.find((result) => result.userStoryId === story.id);
            const storyErrors = [
                ...(tdd?.errors ?? []),
                ...(consistency?.errors ?? []),
            ];
            return {
                userStoryId: story.id,
                checked: Boolean(tdd?.checked || consistency?.checked),
                passed: storyErrors.length === 0,
                errors: storyErrors,
                warnings: [...(tdd?.warnings ?? []), ...(consistency?.warnings ?? [])],
            };
        });
        return {
            status: finalStatus(mergedResults, errors),
            errors,
            warnings: [...tddTrace.warnings, ...passConsistency.warnings],
            userStoryResults: mergedResults,
            summary: buildSummary(mergedResults),
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
var verify_pass_consistency_2 = require("./verify-pass-consistency");
Object.defineProperty(exports, "verifyPassConsistency", { enumerable: true, get: function () { return verify_pass_consistency_2.verifyPassConsistency; } });
