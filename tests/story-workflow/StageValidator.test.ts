/**
 * StageValidator Unit Tests
 *
 * Tests for VAL-001~008
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StageValidator } from '../../src/story-workflow/StageValidator';
import { ValidationError, StageTransitionError } from '../../src/story-workflow/errors';
import { ErrorCodes } from '../../src/story-workflow/errors';

describe('StageValidator', () => {
  let validator: StageValidator;

  beforeEach(() => {
    validator = new StageValidator();
  });

  describe('VAL-001: allowed next stages lookup', () => {
    it('should return stable allowed next stages for each stage', () => {
      expect(validator.getAllowedNextStages('create')).toEqual(['audit']);
      expect(validator.getAllowedNextStages('audit')).toEqual(['dev']);
      expect(validator.getAllowedNextStages('dev')).toEqual(['post-audit']);
      expect(validator.getAllowedNextStages('post-audit')).toEqual([]);
    });

    it('should return a defensive copy for allowed next stages', () => {
      const allowedNextStages = validator.getAllowedNextStages('create');
      allowedNextStages.push('dev');

      expect(validator.getAllowedNextStages('create')).toEqual(['audit']);
    });
  });

  describe('VAL-002~003: audit stage entry validation', () => {
    it('should allow audit entry when create is completed (VAL-001)', () => {
      const context = {
        storyId: 'story-123',
        targetStage: 'audit',
        currentStage: 'create',
        completedStages: ['create'],
      };

      const result = validator.validateEntry(context);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject audit entry when create is not completed (VAL-002)', () => {
      const context = {
        storyId: 'story-123',
        targetStage: 'audit',
        currentStage: 'create',
        completedStages: [],
      };

      const result = validator.validateEntry(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('create');
    });
  });

  describe('VAL-003~004: dev stage entry validation', () => {
    it('should allow dev entry when audit is completed (VAL-003)', () => {
      const context = {
        storyId: 'story-123',
        targetStage: 'dev',
        currentStage: 'audit',
        completedStages: ['create', 'audit'],
      };

      const result = validator.validateEntry(context);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject dev entry when audit is not completed (VAL-004)', () => {
      const context = {
        storyId: 'story-123',
        targetStage: 'dev',
        currentStage: 'audit',
        completedStages: ['create'],
      };

      const result = validator.validateEntry(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('audit');
    });
  });

  describe('VAL-005~006: post-audit stage entry validation', () => {
    it('should allow post-audit entry when dev is completed (VAL-005)', () => {
      const context = {
        storyId: 'story-123',
        targetStage: 'post-audit',
        currentStage: 'dev',
        completedStages: ['create', 'audit', 'dev'],
      };

      const result = validator.validateEntry(context);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject post-audit entry when dev is not completed (VAL-006)', () => {
      const context = {
        storyId: 'story-123',
        targetStage: 'post-audit',
        currentStage: 'dev',
        completedStages: ['create', 'audit'],
      };

      const result = validator.validateEntry(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('dev');
    });
  });

  describe('VAL-007: error message completeness', () => {
    it('should include stage name and reason in error messages', () => {
      const context = {
        storyId: 'story-123',
        targetStage: 'audit',
        currentStage: 'create',
        completedStages: [],
      };

      const result = validator.validateEntry(context);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('create');
      expect(result.errors[0]).toContain('prerequisite');
    });

    it('should provide specific error for skipping stages', () => {
      // Trying to skip from create to dev (even with create completed)
      // This should fail because audit is the expected next stage
      const context = {
        storyId: 'story-123',
        targetStage: 'dev',
        currentStage: 'create',
        completedStages: ['create', 'audit'], // audit completed but we're still at create stage
      };

      const result = validator.validateEntry(context);

      expect(result.valid).toBe(false);
      // The error should mention that this is not the expected next stage
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('VAL-008: getPrerequisiteStage', () => {
    it('should return correct prerequisite for each stage', () => {
      expect(validator.getPrerequisiteStage('create')).toBeNull();
      expect(validator.getPrerequisiteStage('audit')).toBe('create');
      expect(validator.getPrerequisiteStage('dev')).toBe('audit');
      expect(validator.getPrerequisiteStage('post-audit')).toBe('dev');
    });
  });

  describe('VAL-009~012: typed transition validation', () => {
    it('should return ok for a valid sequential transition', () => {
      const result = validator.validateTransition({
        storyId: 'story-123',
        targetStage: 'audit',
        currentStage: 'create',
        completedStages: ['create'],
      });

      expect(result.ok).toBe(true);
    });

    it('should return PREREQUISITE_NOT_MET when prerequisite stage is incomplete', () => {
      const result = validator.validateTransition({
        storyId: 'story-123',
        targetStage: 'audit',
        currentStage: 'create',
        completedStages: [],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(StageTransitionError);
        expect(result.error.code).toBe(ErrorCodes.PREREQUISITE_NOT_MET);
        expect(result.error.fromStage).toBe('create');
        expect(result.error.toStage).toBe('audit');
        expect(result.error.details.allowedNextStages).toEqual(['audit']);
      }
    });

    it('should return SKIP_NOT_ALLOWED with allowed next stages details when attempting to skip a stage', () => {
      const result = validator.validateTransition({
        storyId: 'story-123',
        targetStage: 'dev',
        currentStage: 'create',
        completedStages: ['create', 'audit'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCodes.SKIP_NOT_ALLOWED);
        expect(result.error.fromStage).toBe('create');
        expect(result.error.toStage).toBe('dev');
        expect(result.error.details.allowedNextStages).toEqual(['audit']);
      }
    });

    it('should return REVERSE_NOT_ALLOWED with allowed next stages details when attempting to move backward', () => {
      const result = validator.validateTransition({
        storyId: 'story-123',
        targetStage: 'create',
        currentStage: 'audit',
        completedStages: ['create', 'audit'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCodes.REVERSE_NOT_ALLOWED);
        expect(result.error.fromStage).toBe('audit');
        expect(result.error.toStage).toBe('create');
        expect(result.error.details.allowedNextStages).toEqual(['dev']);
      }
    });
  });

  describe('createValidationError', () => {
    it('should create ValidationError with correct properties', () => {
      const error = validator.createValidationError(
        'Test error',
        ErrorCodes.STAGE_NOT_COMPLETED,
        'create',
        { detail: 'test' }
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCodes.STAGE_NOT_COMPLETED);
      expect(error.stage).toBe('create');
      expect(error.details).toEqual({ detail: 'test' });
    });
  });

  describe('createStageTransitionError', () => {
    it('should create StageTransitionError with correct properties', () => {
      const error = validator.createStageTransitionError(
        'Transition failed',
        ErrorCodes.INVALID_TRANSITION,
        'create',
        'dev',
        { detail: 'test' }
      );

      expect(error).toBeInstanceOf(StageTransitionError);
      expect(error.message).toBe('Transition failed');
      expect(error.code).toBe(ErrorCodes.INVALID_TRANSITION);
      expect(error.fromStage).toBe('create');
      expect(error.toStage).toBe('dev');
    });
  });
});
