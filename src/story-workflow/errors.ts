/**
 * Story Workflow Module - Error Classes
 *
 * Custom error classes for the BMAD story workflow system.
 */

import type { StoryStage } from './types';

/** Error codes for story workflow operations */
export const ErrorCodes = {
  STAGE_NOT_COMPLETED: 'STAGE_NOT_COMPLETED',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  SKIP_NOT_ALLOWED: 'SKIP_NOT_ALLOWED',
  REVERSE_NOT_ALLOWED: 'REVERSE_NOT_ALLOWED',
  ALREADY_FINAL_STAGE: 'ALREADY_FINAL_STAGE',
  PREREQUISITE_NOT_MET: 'PREREQUISITE_NOT_MET',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  STAGE_NOT_FOUND: 'STAGE_NOT_FOUND',
} as const;

/** Type for error codes */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Base validation error for story workflow operations
 */
export class ValidationError extends Error {
  /** Error code for programmatic handling */
  readonly code: ErrorCode;

  /** The stage associated with this error */
  readonly stage: StoryStage;

  /** Additional error context */
  readonly details: Record<string, unknown>;

  /**
   * Creates a new ValidationError
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling
   * @param stage - The stage associated with the error
   * @param details - Additional error context
   */
  constructor(
    message: string,
    code: ErrorCode,
    stage: StoryStage,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.stage = stage;
    this.details = details;

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error for invalid stage transitions
 */
export class StageTransitionError extends ValidationError {
  /** The source stage of the attempted transition */
  readonly fromStage: StoryStage;

  /** The target stage of the attempted transition */
  readonly toStage: StoryStage;

  /**
   * Creates a new StageTransitionError
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling
   * @param fromStage - The source stage
   * @param toStage - The target stage
   * @param details - Additional error context
   */
  constructor(
    message: string,
    code: ErrorCode,
    fromStage: StoryStage,
    toStage: StoryStage,
    details: Record<string, unknown> = {}
  ) {
    super(message, code, fromStage, { ...details, toStage });
    this.name = 'StageTransitionError';
    this.fromStage = fromStage;
    this.toStage = toStage;

    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, StageTransitionError.prototype);
  }
}
