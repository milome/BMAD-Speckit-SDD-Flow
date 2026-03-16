/**
 * StoryStateManager Module
 *
 * Manages the lifecycle state of stories through workflow stages.
 */

import type { StoryState, StoryStage, StageEntry, Result } from './types';
import { STAGE_TRANSITIONS } from './types';
import { StageValidator } from './StageValidator';
import { AuditLogger } from './AuditLogger';
import { StageTransitionError, ValidationError, ErrorCodes } from './errors';
import { ok, err } from './types';

/**
 * Manages the state and lifecycle of a story through workflow stages
 */
export class StoryStateManager {
  private state: StoryState;
  private validator: StageValidator;
  private logger: AuditLogger;
  private currentStageEntry?: StageEntry;

  /**
   * Creates a new StoryStateManager
   * @param storyId - The unique identifier for the story
   */
  constructor(storyId: string) {
    this.validator = new StageValidator();
    this.logger = new AuditLogger();

    const now = new Date();
    this.state = {
      storyId,
      currentStage: 'create',
      stageHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    // Create initial stage entry
    this.currentStageEntry = {
      stage: 'create',
      enteredAt: now,
    };

    // Log entry to create stage
    this.logger.logStageEntered(storyId, 'create');
  }

  /**
   * Gets a deep copy of the current state
   * @returns The current story state
   */
  getCurrentState(): StoryState {
    return this.deepCopyState(this.state);
  }

  /**
   * Gets the current stage
   * @returns The current story stage
   */
  getCurrentStage(): StoryStage {
    return this.state.currentStage;
  }

  /**
   * Advances the story to the next stage
   * @returns Result containing the new state or an error
   */
  advanceStage(): Result<StoryState, StageTransitionError> {
    // Check if we're at the final stage
    if (this.state.currentStage === 'post-audit') {
      return err(
        new StageTransitionError(
          'Cannot advance: already at final stage',
          ErrorCodes.ALREADY_FINAL_STAGE,
          this.state.currentStage,
          this.state.currentStage
        )
      );
    }

    // Check if current stage is completed
    if (!this.isCurrentStageComplete()) {
      return err(
        new StageTransitionError(
          `Cannot advance: current stage '${this.state.currentStage}' is not completed`,
          ErrorCodes.STAGE_NOT_COMPLETED,
          this.state.currentStage,
          STAGE_TRANSITIONS[this.state.currentStage]!
        )
      );
    }

    // Get the next stage
    const nextStage = STAGE_TRANSITIONS[this.state.currentStage];
    if (!nextStage) {
      return err(
        new StageTransitionError(
          'Cannot advance: no next stage available',
          ErrorCodes.ALREADY_FINAL_STAGE,
          this.state.currentStage,
          this.state.currentStage
        )
      );
    }

    const completedStages = this.getCompletedStages();
    const transitionResult = this.validator.validateTransition({
      storyId: this.state.storyId,
      currentStage: this.state.currentStage,
      targetStage: nextStage,
      completedStages,
    });
    if (!transitionResult.ok) {
      return err(transitionResult.error);
    }

    // Complete current stage entry
    if (this.currentStageEntry) {
      this.state.stageHistory.push({ ...this.currentStageEntry });
    }

    // Log exit from current stage
    this.logger.logStageCompleted(
      this.state.storyId,
      this.state.currentStage,
      this.currentStageEntry?.result ?? 'success'
    );

    // Update state
    this.state.currentStage = nextStage;
    this.state.updatedAt = new Date();

    // Create new stage entry
    this.currentStageEntry = {
      stage: nextStage,
      enteredAt: new Date(),
    };

    // Log entry to new stage
    this.logger.logStageEntered(this.state.storyId, nextStage);

    return ok(this.deepCopyState(this.state));
  }

  /**
   * Marks the current stage as complete
   * @param result - The completion result
   * @returns Result containing the updated state or an error
   */
  completeStage(result: 'success' | 'failed' | 'skipped'): Result<StoryState, ValidationError> {
    if (!this.currentStageEntry) {
      return err(
        new ValidationError(
          'No active stage to complete',
          ErrorCodes.STAGE_NOT_FOUND,
          this.state.currentStage
        )
      );
    }

    this.currentStageEntry.completedAt = new Date();
    this.currentStageEntry.result = result;
    this.state.updatedAt = new Date();

    // Log completion
    this.logger.logStageCompleted(this.state.storyId, this.state.currentStage, result);

    return ok(this.deepCopyState(this.state));
  }

  /**
   * Checks if the story can advance to the next stage
   * @returns true if advancement is possible
   */
  canAdvance(): boolean {
    if (this.state.currentStage === 'post-audit') {
      return false;
    }
    return this.isCurrentStageComplete();
  }

  /**
   * Gets the audit logger
   * @returns The audit logger instance
   */
  getAuditLogger(): AuditLogger {
    return this.logger;
  }

  /**
   * Gets the stage validator
   * @returns The stage validator instance
   */
  getStageValidator(): StageValidator {
    return this.validator;
  }

  /**
   * Checks if the current stage is complete
   * @returns true if current stage has been completed
   */
  private isCurrentStageComplete(): boolean {
    if (!this.currentStageEntry) {
      return false;
    }
    return this.currentStageEntry.completedAt !== undefined;
  }

  private getCompletedStages(): StoryStage[] {
    const historicalStages = this.state.stageHistory
      .filter((entry) => entry.completedAt !== undefined)
      .map((entry) => entry.stage);

    if (this.currentStageEntry?.completedAt) {
      return [...historicalStages, this.currentStageEntry.stage];
    }

    return historicalStages;
  }

  /**
   * Creates a deep copy of the state
   * @param state - The state to copy
   * @returns A deep copy of the state
   */
  private deepCopyState(state: StoryState): StoryState {
    return {
      ...state,
      stageHistory: state.stageHistory.map((entry) => ({ ...entry })),
      createdAt: new Date(state.createdAt),
      updatedAt: new Date(state.updatedAt),
    };
  }
}
