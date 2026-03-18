/**
 * AuditLogger Unit Tests
 *
 * Tests for LOG-001~008
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger } from '../../src/story-workflow/AuditLogger';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  describe('LOG-001: logStageEntered', () => {
    it('should create correct log entry when entering a stage', () => {
      const entry = logger.logStageEntered('story-123', 'create');

      expect(entry.storyId).toBe('story-123');
      expect(entry.stage).toBe('create');
      expect(entry.event).toBe('entered');
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.id).toBeDefined();
    });

    it('should include optional input data', () => {
      const input = { payload: { name: 'Test Story' } };
      const entry = logger.logStageEntered('story-123', 'create', input, 'executor-1');

      expect(entry.input).toEqual(input);
      expect(entry.executor).toBe('executor-1');
    });
  });

  describe('LOG-002: logStageCompleted', () => {
    it('should create correct log entry when completing a stage', () => {
      // First enter the stage
      logger.logStageEntered('story-123', 'create');

      const entry = logger.logStageCompleted('story-123', 'create', 'success');

      expect(entry.storyId).toBe('story-123');
      expect(entry.stage).toBe('create');
      expect(entry.event).toBe('completed');
      expect(entry.result).toBe('success');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should include optional output data', () => {
      logger.logStageEntered('story-123', 'create');
      const output = { result: 'Story created successfully' };

      const entry = logger.logStageCompleted('story-123', 'create', 'success', output, 'executor-1');

      expect(entry.output).toEqual(output);
      expect(entry.executor).toBe('executor-1');
    });
  });

  describe('LOG-003: log fields completeness', () => {
    it('should have all required fields in log entry', () => {
      const entry = logger.logStageEntered('story-123', 'audit');

      expect(entry.id).toBeDefined();
      expect(typeof entry.id).toBe('string');
      expect(entry.storyId).toBe('story-123');
      expect(entry.stage).toBe('audit');
      expect(entry.event).toBe('entered');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should create unique IDs for each log entry', () => {
      const entry1 = logger.logStageEntered('story-123', 'create');
      const entry2 = logger.logStageEntered('story-123', 'create');

      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe('LOG-004: duration calculation', () => {
    it('should calculate duration for completed stage', () => {
      const enterTime = new Date();
      logger.logStageEntered('story-123', 'create', undefined, undefined, enterTime);

      const completeTime = new Date(enterTime.getTime() + 5000); // 5 seconds later
      const entry = logger.logStageCompleted('story-123', 'create', 'success', undefined, undefined, completeTime);

      expect(entry.duration).toBe(5000);
    });

    it('should handle custom executor in completion', () => {
      logger.logStageEntered('story-123', 'create');
      const entry = logger.logStageCompleted('story-123', 'create', 'success', undefined, 'custom-executor');

      expect(entry.executor).toBe('custom-executor');
    });
  });

  describe('LOG-005: getLogsByStoryId', () => {
    it('should return logs for specific story', () => {
      logger.logStageEntered('story-1', 'create');
      logger.logStageEntered('story-2', 'create');
      logger.logStageEntered('story-1', 'audit');

      const logs = logger.getLogsByStoryId('story-1');

      expect(logs).toHaveLength(2);
      expect(logs.every((log) => log.storyId === 'story-1')).toBe(true);
    });

    it('should return empty array if no logs for story', () => {
      const logs = logger.getLogsByStoryId('nonexistent');
      expect(logs).toEqual([]);
    });
  });

  describe('LOG-006: queryLogs by stage', () => {
    it('should filter logs by stage', () => {
      logger.logStageEntered('story-1', 'create');
      logger.logStageEntered('story-1', 'audit');
      logger.logStageEntered('story-2', 'create');

      const logs = logger.queryLogs({ stage: 'create' });

      expect(logs).toHaveLength(2);
      expect(logs.every((log) => log.stage === 'create')).toBe(true);
    });

    it('should filter logs by event type', () => {
      logger.logStageEntered('story-1', 'create');
      logger.logStageCompleted('story-1', 'create', 'success');

      const enteredLogs = logger.queryLogs({ event: 'entered' });
      const completedLogs = logger.queryLogs({ event: 'completed' });

      expect(enteredLogs).toHaveLength(1);
      expect(completedLogs).toHaveLength(1);
    });
  });

  describe('LOG-007: log ordering', () => {
    it('should return logs sorted by timestamp', () => {
      const now = new Date();
      logger.logStageEntered('story-1', 'create', undefined, undefined, new Date(now.getTime() + 2000));
      logger.logStageEntered('story-1', 'audit', undefined, undefined, new Date(now.getTime() + 1000));
      logger.logStageEntered('story-1', 'dev', undefined, undefined, new Date(now.getTime() + 3000));

      const logs = logger.getLogsByStoryId('story-1');

      expect(logs[0].stage).toBe('audit');
      expect(logs[1].stage).toBe('create');
      expect(logs[2].stage).toBe('dev');
    });
  });

  describe('LOG-008: clearLogs', () => {
    it('should clear all logs', () => {
      logger.logStageEntered('story-1', 'create');
      logger.logStageEntered('story-2', 'create');

      logger.clearLogs();

      expect(logger.getLogCount()).toBe(0);
      expect(logger.getLogsByStoryId('story-1')).toEqual([]);
    });
  });

  describe('getLogCount', () => {
    it('should return total log count', () => {
      expect(logger.getLogCount()).toBe(0);

      logger.logStageEntered('story-1', 'create');
      expect(logger.getLogCount()).toBe(1);

      logger.logStageEntered('story-2', 'audit');
      expect(logger.getLogCount()).toBe(2);
    });
  });

  describe('logStageFailed', () => {
    it('should create failed event log entry', () => {
      logger.logStageEntered('story-123', 'create');
      const error = new Error('Stage execution failed');

      const entry = logger.logStageFailed('story-123', 'create', error, 'executor-1');

      expect(entry.storyId).toBe('story-123');
      expect(entry.stage).toBe('create');
      expect(entry.event).toBe('failed');
      expect(entry.error).toBe('Stage execution failed');
      expect(entry.executor).toBe('executor-1');
    });
  });
});
