/**
 * Story Workflow Module - Index
 *
 * Main entry point for the story-workflow module.
 * Provides state management, stage validation, and audit logging for BMAD stories.
 */

// Type exports
export type {
  StoryStage,
  StoryState,
  StageEntry,
  ValidationContext,
  ValidationResult,
  AuditLogEntry,
  LogQuery,
  Result,
} from './types';

// Constant exports
export { STAGE_TRANSITIONS, STAGE_PREREQUISITES, ok, err } from './types';

// Class exports
export { StoryStateManager } from './StoryStateManager';
export { StageValidator } from './StageValidator';
export { AuditLogger } from './AuditLogger';

// Error exports
export { ValidationError, StageTransitionError, ErrorCodes, type ErrorCode } from './errors';
