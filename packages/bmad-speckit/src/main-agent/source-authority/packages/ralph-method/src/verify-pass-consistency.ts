import * as fs from 'node:fs';
import { parseRalphPrdDocument, RalphSchemaValidationError } from './schema';
import type {
  RalphPrdDocument,
  RalphVerifierInput,
  RalphVerifierResult,
  RalphVerifierStoryResult,
  RalphVerificationStatus,
} from './types';

function buildSummary(results: RalphVerifierStoryResult[]) {
  const checkedStories = results.filter((result) => result.checked).length;
  const passingStories = results.filter((result) => result.checked && result.passed).length;
  const failingStories = results.filter((result) => result.checked && !result.passed).length;
  const skippedStories = results.filter((result) => !result.checked).length;
  return { checkedStories, passingStories, failingStories, skippedStories };
}

function finalStatus(
  results: RalphVerifierStoryResult[],
  errors: string[]
): RalphVerificationStatus {
  return errors.length > 0 || results.some((result) => result.checked && !result.passed)
    ? 'fail'
    : 'pass';
}

function parsePrd(prdPath: string): RalphPrdDocument {
  const raw = JSON.parse(fs.readFileSync(prdPath, 'utf8')) as unknown;
  return parseRalphPrdDocument(raw);
}

export function verifyPassConsistency(input: RalphVerifierInput): RalphVerifierResult {
  try {
    const prd = parsePrd(input.prdPath);

    const userStoryResults: RalphVerifierStoryResult[] = prd.userStories.map((story) => {
      const errors: string[] = [];
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
  } catch (error) {
    const message =
      error instanceof RalphSchemaValidationError || error instanceof Error
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
