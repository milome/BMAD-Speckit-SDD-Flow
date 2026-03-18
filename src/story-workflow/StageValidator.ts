/**
 * StageValidator Module
 *
 * Validates stage transitions for stories.
 */

import type { ValidationContext, ValidationResult, StoryStage, Result } from './types';
import { err, ok, STAGE_PREREQUISITES } from './types';
import { ValidationError, StageTransitionError, ErrorCodes, type ErrorCode } from './errors';

const STORY_STAGES: StoryStage[] = ['create', 'audit', 'dev', 'post-audit'];
const EMPTY_ALLOWED_NEXT_STAGES: readonly StoryStage[] = [];
const ALLOWED_NEXT_STAGE_MAP: Readonly<Record<StoryStage, readonly StoryStage[]>> = {
  create: ['audit'],
  audit: ['dev'],
  dev: ['post-audit'],
  'post-audit': EMPTY_ALLOWED_NEXT_STAGES,
};

/**
 * Validates stage transitions for stories
 */
export class StageValidator {
  /**
   * Validates if entry to a stage is allowed
   * @param context - Validation context containing current and target stage info
   * @returns ValidationResult with valid flag and any error messages
   */
  validateEntry(context: ValidationContext): ValidationResult {
    const transitionResult = this.validateTransition(context);
    if (transitionResult.ok) {
      return {
        valid: true,
        errors: [],
      };
    }

    return {
      valid: false,
      errors: [transitionResult.error.message],
    };
  }

  /**
   * Gets the allowed next stages for a given current stage.
   * @param stage - The current stage
   * @returns A stable, defensive copy of the allowed next stages
   */
  getAllowedNextStages(stage: StoryStage): StoryStage[] {
    return [...ALLOWED_NEXT_STAGE_MAP[stage]];
  }

  /**
   * Validates a stage transition and returns a structured transition error on failure.
   * @param context - Validation context containing current and target stage info
   * @returns Result containing validation success or a typed StageTransitionError
   */
  validateTransition(
    context: ValidationContext
  ): Result<ValidationContext, StageTransitionError> {
    const allowedNextStages = this.getAllowedNextStages(context.currentStage);
    const prerequisite = this.getPrerequisiteStage(context.targetStage);
    if (prerequisite !== null && !context.completedStages.includes(prerequisite)) {
      return err(
        this.createStageTransitionError(
          `Cannot enter stage '${context.targetStage}': prerequisite stage '${prerequisite}' is not completed`,
          ErrorCodes.PREREQUISITE_NOT_MET,
          context.currentStage,
          context.targetStage,
          {
            storyId: context.storyId,
            prerequisite,
            completedStages: [...context.completedStages],
            allowedNextStages,
          }
        )
      );
    }

    if (allowedNextStages.includes(context.targetStage)) {
      return ok(context);
    }

    const expectedNextStage = allowedNextStages[0] ?? null;
    const currentIndex = STORY_STAGES.indexOf(context.currentStage);
    const targetIndex = STORY_STAGES.indexOf(context.targetStage);

    if (targetIndex < currentIndex) {
      return err(
        this.createStageTransitionError(
          `Cannot reverse transition: '${context.currentStage}' -> '${context.targetStage}' is not allowed`,
          ErrorCodes.REVERSE_NOT_ALLOWED,
          context.currentStage,
          context.targetStage,
          {
            storyId: context.storyId,
            expectedNextStage,
            allowedNextStages,
          }
        )
      );
    }

    return err(
      this.createStageTransitionError(
        `Cannot skip stages: must complete '${expectedNextStage}' before entering '${context.targetStage}'`,
        ErrorCodes.SKIP_NOT_ALLOWED,
        context.currentStage,
        context.targetStage,
        {
          storyId: context.storyId,
          expectedNextStage,
          completedStages: [...context.completedStages],
          allowedNextStages,
        }
      )
    );
  }

  /**
   * Gets the prerequisite stage for a given stage
   * @param stage - The target stage
   * @returns The prerequisite stage or null if none
   */
  getPrerequisiteStage(stage: StoryStage): StoryStage | null {
    return STAGE_PREREQUISITES[stage];
  }

  /**
   * Creates a ValidationError with proper typing
   * @param message - Error message
   * @param code - Error code
   * @param stage - Related stage
   * @param details - Additional context
   * @returns ValidationError instance
   */
  createValidationError(
    message: string,
    code: ErrorCode,
    stage: StoryStage,
    details: Record<string, unknown> = {}
  ): ValidationError {
    return new ValidationError(message, code, stage, details);
  }

  /**
   * Creates a StageTransitionError with proper typing
   * @param message - Error message
   * @param code - Error code
   * @param fromStage - Source stage
   * @param toStage - Target stage
   * @param details - Additional context
   * @returns StageTransitionError instance
   */
  createStageTransitionError(
    message: string,
    code: ErrorCode,
    fromStage: StoryStage,
    toStage: StoryStage,
    details: Record<string, unknown> = {}
  ): StageTransitionError {
    return new StageTransitionError(message, code, fromStage, toStage, details);
  }

  /**
   * Checks if a transition between stages is valid
   * @param fromStage - Source stage
   * @param toStage - Target stage
   * @param completedStages - List of completed stages
   * @returns boolean indicating if transition is valid
   */
  private checkPrerequisites(
    _fromStage: StoryStage,
    toStage: StoryStage,
    completedStages: StoryStage[]
  ): boolean {
    const prerequisite = this.getPrerequisiteStage(toStage);
    if (prerequisite === null) {
      return true; // No prerequisite required
    }
    return completedStages.includes(prerequisite);
  }
}
