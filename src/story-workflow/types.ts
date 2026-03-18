/**
 * Story Workflow Module - Type Definitions
 *
 * Core types and interfaces for the BMAD story workflow system.
 */

/** Valid story lifecycle stages */
export type StoryStage = 'create' | 'audit' | 'dev' | 'post-audit';

/** Stage transition mapping - defines the next stage for each current stage */
export const STAGE_TRANSITIONS: Record<StoryStage, StoryStage | null> = {
  create: 'audit',
  audit: 'dev',
  dev: 'post-audit',
  'post-audit': null,
};

/** Stage prerequisite mapping - defines the required previous stage for entry */
export const STAGE_PREREQUISITES: Record<StoryStage, StoryStage | null> = {
  create: null,
  audit: 'create',
  dev: 'audit',
  'post-audit': 'dev',
};

/** Represents a single stage entry in the story's history */
export interface StageEntry {
  stage: StoryStage;
  enteredAt: Date;
  completedAt?: Date;
  result?: 'success' | 'failed' | 'skipped';
}

/** Complete state of a story */
export interface StoryState {
  storyId: string;
  currentStage: StoryStage;
  stageHistory: StageEntry[];
  createdAt: Date;
  updatedAt: Date;
}

/** Context provided for stage validation */
export interface ValidationContext {
  storyId: string;
  targetStage: StoryStage;
  currentStage: StoryStage;
  completedStages: StoryStage[];
}

/** Result of a validation operation */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Represents an audit log entry for story lifecycle events */
export interface AuditLogEntry {
  id: string;
  storyId: string;
  stage: StoryStage;
  event: 'entered' | 'completed' | 'failed';
  timestamp: Date;
  duration?: number;
  result?: 'success' | 'failed' | 'skipped';
  executor?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

/** Query parameters for retrieving audit logs */
export interface LogQuery {
  storyId?: string;
  stage?: StoryStage;
  event?: 'entered' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

/** Result type for operations that can fail - inspired by Rust's Result type */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Creates a successful Result
 * @param value - The success value
 * @returns A Result containing the value
 */
export function ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

/**
 * Creates a failed Result
 * @param error - The error value
 * @returns A Result containing the error
 */
export function err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}
