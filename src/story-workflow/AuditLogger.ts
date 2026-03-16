/**
 * AuditLogger Module
 *
 * Records all stage lifecycle events for story tracking.
 */

import type { AuditLogEntry, LogQuery, StoryStage } from './types';

/**
 * Generates a unique ID for log entries
 * @returns A unique string ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Audit logger for recording story stage lifecycle events
 */
export class AuditLogger {
  private logs: AuditLogEntry[] = [];

  /**
   * Records a stage entry event
   * @param storyId - The story identifier
   * @param stage - The stage being entered
   * @param input - Optional input data
   * @param executor - Optional executor identifier
   * @param timestamp - Optional timestamp (defaults to now)
   * @returns The created log entry
   */
  logStageEntered(
    storyId: string,
    stage: StoryStage,
    input?: Record<string, unknown>,
    executor?: string,
    timestamp: Date = new Date()
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: generateId(),
      storyId,
      stage,
      event: 'entered',
      timestamp,
      input,
      executor,
    };

    this.logs.push(entry);
    return entry;
  }

  /**
   * Records a stage completion event
   * @param storyId - The story identifier
   * @param stage - The stage being completed
   * @param result - The completion result
   * @param output - Optional output data
   * @param executor - Optional executor identifier
   * @param timestamp - Optional timestamp (defaults to now)
   * @returns The created log entry
   */
  logStageCompleted(
    storyId: string,
    stage: StoryStage,
    result: 'success' | 'failed' | 'skipped',
    output?: Record<string, unknown>,
    executor?: string,
    timestamp: Date = new Date()
  ): AuditLogEntry {
    // Find the corresponding entry event to calculate duration
    const entryLog = this.logs.find(
      (log) => log.storyId === storyId && log.stage === stage && log.event === 'entered'
    );

    const duration = entryLog ? timestamp.getTime() - entryLog.timestamp.getTime() : undefined;

    const entry: AuditLogEntry = {
      id: generateId(),
      storyId,
      stage,
      event: 'completed',
      timestamp,
      duration,
      result,
      output,
      executor,
    };

    this.logs.push(entry);
    return entry;
  }

  /**
   * Records a stage failure event
   * @param storyId - The story identifier
   * @param stage - The stage that failed
   * @param error - The error that occurred
   * @param executor - Optional executor identifier
   * @returns The created log entry
   */
  logStageFailed(
    storyId: string,
    stage: StoryStage,
    error: Error,
    executor?: string
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: generateId(),
      storyId,
      stage,
      event: 'failed',
      timestamp: new Date(),
      error: error.message,
      executor,
    };

    this.logs.push(entry);
    return entry;
  }

  /**
   * Queries logs based on filter criteria
   * @param query - Query parameters
   * @returns Matching log entries
   */
  queryLogs(query: LogQuery): AuditLogEntry[] {
    let results = [...this.logs];

    if (query.storyId !== undefined) {
      results = results.filter((log) => log.storyId === query.storyId);
    }

    if (query.stage !== undefined) {
      results = results.filter((log) => log.stage === query.stage);
    }

    if (query.event !== undefined) {
      results = results.filter((log) => log.event === query.event);
    }

    if (query.startTime !== undefined) {
      results = results.filter((log) => log.timestamp >= query.startTime!);
    }

    if (query.endTime !== undefined) {
      results = results.filter((log) => log.timestamp <= query.endTime!);
    }

    // Sort by timestamp
    results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Apply offset and limit
    const offset = query.offset ?? 0;
    const limit = query.limit ?? results.length;

    return results.slice(offset, offset + limit);
  }

  /**
   * Gets all logs for a specific story
   * @param storyId - The story identifier
   * @returns Log entries for the story, sorted by timestamp
   */
  getLogsByStoryId(storyId: string): AuditLogEntry[] {
    return this.logs
      .filter((log) => log.storyId === storyId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Gets the total count of log entries
   * @returns The number of log entries
   */
  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * Clears all log entries
   */
  clearLogs(): void {
    this.logs = [];
  }
}
