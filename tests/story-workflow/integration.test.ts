/**
 * Integration Tests
 *
 * INT-001~003: Full workflow integration tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StoryStateManager,
  StageValidator,
  AuditLogger,
  ValidationError,
  StageTransitionError,
} from '../../src/story-workflow';

describe('Integration Tests', () => {
  describe('INT-001: full state transition workflow', () => {
    it('should complete full lifecycle: create -> audit -> dev -> post-audit', () => {
      const manager = new StoryStateManager('integration-story-1');

      // Verify initial state
      expect(manager.getCurrentStage()).toBe('create');

      // Complete create and advance to audit
      manager.completeStage('success');
      let result = manager.advanceStage();
      expect(result.ok).toBe(true);
      expect(manager.getCurrentStage()).toBe('audit');

      // Complete audit and advance to dev
      manager.completeStage('success');
      result = manager.advanceStage();
      expect(result.ok).toBe(true);
      expect(manager.getCurrentStage()).toBe('dev');

      // Complete dev and advance to post-audit
      manager.completeStage('success');
      result = manager.advanceStage();
      expect(result.ok).toBe(true);
      expect(manager.getCurrentStage()).toBe('post-audit');

      // Complete post-audit and verify no more advancement
      manager.completeStage('success');
      expect(manager.canAdvance()).toBe(false);

      // Verify state history
      const state = manager.getCurrentState();
      expect(state.stageHistory).toHaveLength(3);
      expect(state.stageHistory[0].stage).toBe('create');
      expect(state.stageHistory[1].stage).toBe('audit');
      expect(state.stageHistory[2].stage).toBe('dev');
    });
  });

  describe('INT-002: validation failure blocks advancement', () => {
    it('should expose shared allowed next stage semantics across validator and manager consumers', () => {
      const manager = new StoryStateManager('integration-story-2');
      const validator = manager.getStageValidator();

      expect(validator.getAllowedNextStages('create')).toEqual(['audit']);

      const transitionResult = validator.validateTransition({
        storyId: 'integration-story-2',
        currentStage: 'create',
        targetStage: 'dev',
        completedStages: ['create', 'audit'],
      });

      expect(transitionResult.ok).toBe(false);
      if (!transitionResult.ok) {
        expect(transitionResult.error.details.allowedNextStages).toEqual(['audit']);
      }
    });

    it('should not allow skipping without completing intermediate stages', () => {
      const manager = new StoryStateManager('integration-story-2');

      // Try to advance without completing create
      const result = manager.advanceStage();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(StageTransitionError);
        expect(result.error.code).toBe('STAGE_NOT_COMPLETED');
      }

      // Verify still at create
      expect(manager.getCurrentStage()).toBe('create');
    });

    it('should return structured skip and reverse errors from StageValidator', () => {
      const validator = new StageValidator();

      const skipResult = validator.validateTransition({
        storyId: 'integration-story-3',
        currentStage: 'create',
        targetStage: 'dev',
        completedStages: ['create', 'audit'],
      });
      expect(skipResult.ok).toBe(false);
      if (!skipResult.ok) {
        expect(skipResult.error.code).toBe('SKIP_NOT_ALLOWED');
        expect(skipResult.error.details.allowedNextStages).toEqual(['audit']);
      }

      const reverseResult = validator.validateTransition({
        storyId: 'integration-story-3',
        currentStage: 'audit',
        targetStage: 'create',
        completedStages: ['create', 'audit'],
      });
      expect(reverseResult.ok).toBe(false);
      if (!reverseResult.ok) {
        expect(reverseResult.error.code).toBe('REVERSE_NOT_ALLOWED');
        expect(reverseResult.error.details.allowedNextStages).toEqual(['dev']);
      }
    });
  });

  describe('INT-003: audit log consistency', () => {
    it('should maintain consistent logs across state transitions', () => {
      const manager = new StoryStateManager('integration-story-4');
      const logger = manager.getAuditLogger();

      // Initial state should have create entry log
      let logs = logger.getLogsByStoryId('integration-story-4');
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.some((log) => log.stage === 'create' && log.event === 'entered')).toBe(true);

      // Complete and advance
      manager.completeStage('success');
      manager.advanceStage();

      // Should have create completed and audit entered
      logs = logger.getLogsByStoryId('integration-story-4');
      expect(logs.some((log) => log.stage === 'create' && log.event === 'completed')).toBe(true);
      expect(logs.some((log) => log.stage === 'audit' && log.event === 'entered')).toBe(true);

      // Continue through all stages
      manager.completeStage('success');
      manager.advanceStage();
      manager.completeStage('success');
      manager.advanceStage();

      // Verify all stages have logs
      logs = logger.getLogsByStoryId('integration-story-4');
      const enteredStages = logs.filter((log) => log.event === 'entered').map((log) => log.stage);
      const completedStages = logs.filter((log) => log.event === 'completed').map((log) => log.stage);

      expect(enteredStages).toContain('create');
      expect(enteredStages).toContain('audit');
      expect(enteredStages).toContain('dev');
      expect(enteredStages).toContain('post-audit');

      expect(completedStages).toContain('create');
      expect(completedStages).toContain('audit');
      expect(completedStages).toContain('dev');
    });

    it('should correlate log entries with state history', () => {
      const manager = new StoryStateManager('integration-story-5');

      // Progress through stages
      manager.completeStage('success');
      manager.advanceStage();
      manager.completeStage('success');
      manager.advanceStage();

      const state = manager.getCurrentState();
      const logger = manager.getAuditLogger();
      const logs = logger.getLogsByStoryId('integration-story-5');

      // Each completed stage in history should have a completed log entry
      for (const historyEntry of state.stageHistory) {
        if (historyEntry.completedAt) {
          const logEntry = logs.find(
            (log) =>
              log.stage === historyEntry.stage &&
              log.event === 'completed' &&
              log.result === historyEntry.result
          );
          expect(logEntry).toBeDefined();
        }
      }
    });
  });

  describe('E2E: module end-to-end validation', () => {
    it('should demonstrate full module API usage', () => {
      // Create manager
      const manager = new StoryStateManager('e2e-story-1');

      // Get components
      const validator = manager.getStageValidator();
      const logger = manager.getAuditLogger();

      // Verify initial state
      expect(manager.getCurrentStage()).toBe('create');
      expect(manager.canAdvance()).toBe(false);

      // Complete current stage
      const completeResult = manager.completeStage('success');
      expect(completeResult.ok).toBe(true);
      expect(manager.canAdvance()).toBe(true);

      // Advance stage
      const advanceResult = manager.advanceStage();
      expect(advanceResult.ok).toBe(true);
      if (advanceResult.ok) {
        expect(advanceResult.value.currentStage).toBe('audit');
      }

      // Verify logs
      const logs = logger.getLogsByStoryId('e2e-story-1');
      expect(logs.length).toBeGreaterThanOrEqual(3); // create entered, create completed, audit entered

      // Verify validator still works
      const validation = validator.validateEntry({
        storyId: 'e2e-story-1',
        targetStage: 'dev',
        currentStage: 'audit',
        completedStages: ['create'],
      });
      expect(validation.valid).toBe(false); // audit not completed yet
    });
  });
});
