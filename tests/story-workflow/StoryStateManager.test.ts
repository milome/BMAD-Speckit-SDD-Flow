/**
 * StoryStateManager Unit Tests
 *
 * Tests for STM-001~008
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoryStateManager } from '../../src/story-workflow/StoryStateManager';
import { StageTransitionError, ErrorCodes } from '../../src/story-workflow/errors';

describe('StoryStateManager', () => {
  let manager: StoryStateManager;

  beforeEach(() => {
    manager = new StoryStateManager('story-123');
  });

  describe('STM-001: initial state validation', () => {
    it('should initialize with currentStage as create', () => {
      expect(manager.getCurrentStage()).toBe('create');
    });

    it('should store the storyId', () => {
      const state = manager.getCurrentState();
      expect(state.storyId).toBe('story-123');
    });

    it('should initialize with empty stage history', () => {
      const state = manager.getCurrentState();
      expect(state.stageHistory).toHaveLength(0);
    });
  });

  describe('STM-002: normal state progression', () => {
    it('should progress through all stages: create -> audit -> dev -> post-audit', () => {
      // Complete create and advance to audit
      manager.completeStage('success');
      let result = manager.advanceStage();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.currentStage).toBe('audit');
      }

      // Complete audit and advance to dev
      manager.completeStage('success');
      result = manager.advanceStage();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.currentStage).toBe('dev');
      }

      // Complete dev and advance to post-audit
      manager.completeStage('success');
      result = manager.advanceStage();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.currentStage).toBe('post-audit');
      }
    });
  });

  describe('STM-003: incomplete stage blocks advancement', () => {
    it('should not allow advancement without completing current stage', () => {
      // Try to advance without completing
      const result = manager.advanceStage();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(StageTransitionError);
        expect(result.error.code).toBe('STAGE_NOT_COMPLETED');
      }
    });
  });

  describe('STM-004~005: validator-driven transition enforcement', () => {
    it('should expose validator allowed next stages from the shared validator', () => {
      expect(manager.getStageValidator().getAllowedNextStages('create')).toEqual(['audit']);
      expect(manager.getStageValidator().getAllowedNextStages('post-audit')).toEqual([]);
    });

    it('should surface reverse transition errors from the shared validator', () => {
      const validator = manager.getStageValidator();
      const result = validator.validateTransition({
        storyId: 'story-123',
        currentStage: 'audit',
        targetStage: 'create',
        completedStages: ['create', 'audit'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(StageTransitionError);
        expect(result.error.code).toBe(ErrorCodes.REVERSE_NOT_ALLOWED);
        expect(result.error.details.allowedNextStages).toEqual(['dev']);
      }
    });

    it('should surface skip transition errors from the shared validator', () => {
      const validator = manager.getStageValidator();
      const result = validator.validateTransition({
        storyId: 'story-123',
        currentStage: 'create',
        targetStage: 'dev',
        completedStages: ['create', 'audit'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(StageTransitionError);
        expect(result.error.code).toBe(ErrorCodes.SKIP_NOT_ALLOWED);
        expect(result.error.details.allowedNextStages).toEqual(['audit']);
      }
    });
  });

  describe('STM-006: final stage check', () => {
    it('should return false for canAdvance at post-audit stage', () => {
      // Progress to post-audit
      manager.completeStage('success');
      manager.advanceStage();
      manager.completeStage('success');
      manager.advanceStage();
      manager.completeStage('success');
      manager.advanceStage();

      expect(manager.getCurrentStage()).toBe('post-audit');
      expect(manager.canAdvance()).toBe(false);
    });

    it('should not allow advancement from post-audit', () => {
      // Progress to post-audit
      manager.completeStage('success');
      manager.advanceStage();
      manager.completeStage('success');
      manager.advanceStage();
      manager.completeStage('success');
      manager.advanceStage();
      manager.completeStage('success');

      const result = manager.advanceStage();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('ALREADY_FINAL_STAGE');
      }
    });
  });

  describe('STM-007: stage history recording', () => {
    it('should record all stages in history', () => {
      // Progress through stages
      manager.completeStage('success');
      manager.advanceStage();
      manager.completeStage('success');
      manager.advanceStage();
      manager.completeStage('success');
      manager.advanceStage();

      const state = manager.getCurrentState();

      expect(state.stageHistory).toHaveLength(3);
      expect(state.stageHistory[0].stage).toBe('create');
      expect(state.stageHistory[1].stage).toBe('audit');
      expect(state.stageHistory[2].stage).toBe('dev');
    });

    it('should record stage entry and completion times', () => {
      manager.completeStage('success');
      manager.advanceStage();

      const state = manager.getCurrentState();
      expect(state.stageHistory[0].enteredAt).toBeInstanceOf(Date);
      expect(state.stageHistory[0].completedAt).toBeInstanceOf(Date);
      expect(state.stageHistory[0].result).toBe('success');
    });
  });

  describe('STM-008: timestamp updates', () => {
    it('should use validator-backed transition checks when advancing stages', () => {
      manager.completeStage('success');
      const spy = vi.spyOn(manager.getStageValidator(), 'validateTransition');

      const result = manager.advanceStage();

      expect(result.ok).toBe(true);
      expect(spy).toHaveBeenCalledWith({
        storyId: 'story-123',
        currentStage: 'create',
        targetStage: 'audit',
        completedStages: ['create'],
      });
    });

    it('should surface validator-based transition errors for incomplete prerequisites', () => {
      const validator = manager.getStageValidator();
      const result = validator.validateTransition({
        storyId: 'story-123',
        currentStage: 'audit',
        targetStage: 'dev',
        completedStages: ['create'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCodes.PREREQUISITE_NOT_MET);
        expect(result.error.details.allowedNextStages).toEqual(['dev']);
      }
    });

    it('should update updatedAt on state changes', () => {
      const initialState = manager.getCurrentState();
      const initialUpdatedAt = initialState.updatedAt;

      // Wait a tiny bit and make a change
      manager.completeStage('success');

      const updatedState = manager.getCurrentState();
      expect(updatedState.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );
    });

    it('should maintain createdAt constant', () => {
      const initialState = manager.getCurrentState();
      const initialCreatedAt = initialState.createdAt;

      manager.completeStage('success');
      manager.advanceStage();

      const updatedState = manager.getCurrentState();
      expect(updatedState.createdAt).toEqual(initialCreatedAt);
    });
  });

  describe('completeStage', () => {
    it('should mark current stage as complete', () => {
      const result = manager.completeStage('success');

      expect(result.ok).toBe(true);
      expect(manager.canAdvance()).toBe(true);
    });

    it('should allow skipping result for failed stages', () => {
      const result = manager.completeStage('skipped');

      expect(result.ok).toBe(true);
    });
  });

  describe('canAdvance', () => {
    it('should return true when current stage is complete and not final', () => {
      manager.completeStage('success');
      expect(manager.canAdvance()).toBe(true);
    });

    it('should return false when current stage is not complete', () => {
      expect(manager.canAdvance()).toBe(false);
    });
  });
});
