"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPassConsistency = verifyPassConsistency;
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
function verifyPassConsistency(input) {
    try {
        const prd = parsePrd(input.prdPath);
        const userStoryResults = prd.userStories.map((story) => {
            const errors = [];
            const allStepsPassed = story.tddSteps.every((step) => step.passes);
            if (story.passes && !allStepsPassed) {
                errors.push(`${story.id} passes=true but not all tddSteps.passes are true`);
            }
            if (!story.passes && allStepsPassed) {
                errors.push(`${story.id} has all tddSteps.passes=true but story passes=false`);
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
