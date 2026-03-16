import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoryStateTracker } from '../../src/story-assistant-validation/story-state-tracker';
import { StoryState, StateFile } from '../../src/story-assistant-validation/types';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

// Mock fs and js-yaml
vi.mock('fs');
vi.mock('js-yaml');

describe('StoryStateTracker', () => {
  let tracker: StoryStateTracker;
  const mockStateFile: StateFile = {
    state: StoryState.STORY_CREATED,
    epic: 'E001',
    story: 'S001',
    history: [{ state: StoryState.STORY_CREATED, timestamp: '2024-01-01T00:00:00Z' }],
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    tracker = new StoryStateTracker({
      epic: 'E001',
      story: 'S001',
      epicSlug: 'test-epic',
      storySlug: 'test-story',
    });
    vi.clearAllMocks();
  });

  describe('T3.1: StoryStateTracker 基础结构', () => {
    it('should create tracker with required options', () => {
      expect(tracker).toBeDefined();
      expect(tracker.options.epic).toBe('E001');
      expect(tracker.options.story).toBe('S001');
    });

    it('should have getCurrentState method', () => {
      expect(tracker.getCurrentState).toBeDefined();
      expect(typeof tracker.getCurrentState).toBe('function');
    });

    it('should have transitionTo method', () => {
      expect(tracker.transitionTo).toBeDefined();
      expect(typeof tracker.transitionTo).toBe('function');
    });

    it('should have loadState method', () => {
      expect(tracker.loadState).toBeDefined();
      expect(typeof tracker.loadState).toBe('function');
    });

    it('should have saveState method', () => {
      expect(tracker.saveState).toBeDefined();
      expect(typeof tracker.saveState).toBe('function');
    });
  });

  describe('T3.2: 状态转换逻辑', () => {
    it('should allow valid transition: story-created -> audit-passed', () => {
      const result = tracker.validateTransition(StoryState.STORY_CREATED, StoryState.AUDIT_PASSED);
      expect(result.passed).toBe(true);
    });

    it('should allow valid transition: audit-passed -> ready-for-dev', () => {
      const result = tracker.validateTransition(StoryState.AUDIT_PASSED, StoryState.READY_FOR_DEV);
      expect(result.passed).toBe(true);
    });

    it('should allow valid transition: ready-for-dev -> dev-completed', () => {
      const result = tracker.validateTransition(StoryState.READY_FOR_DEV, StoryState.DEV_COMPLETED);
      expect(result.passed).toBe(true);
    });

    it('should allow valid transition: dev-completed -> post-audit-passed', () => {
      const result = tracker.validateTransition(
        StoryState.DEV_COMPLETED,
        StoryState.POST_AUDIT_PASSED
      );
      expect(result.passed).toBe(true);
    });

    it('should reject invalid transition: story-created -> ready-for-dev', () => {
      const result = tracker.validateTransition(StoryState.STORY_CREATED, StoryState.READY_FOR_DEV);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
    });

    it('should reject invalid transition: dev-completed -> story-created', () => {
      const result = tracker.validateTransition(StoryState.DEV_COMPLETED, StoryState.STORY_CREATED);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
    });

    it('should reject invalid transition: post-audit-passed -> audit-passed', () => {
      const result = tracker.validateTransition(
        StoryState.POST_AUDIT_PASSED,
        StoryState.AUDIT_PASSED
      );
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
    });

    it('should reject transition to same state', () => {
      const result = tracker.validateTransition(StoryState.STORY_CREATED, StoryState.STORY_CREATED);
      expect(result.passed).toBe(false);
    });
  });

  describe('T3.3: 状态文件更新', () => {
    it('should create initial state file structure', async () => {
      const state = await tracker.initializeState();
      expect(state.epic).toBe('E001');
      expect(state.story).toBe('S001');
      expect(state.state).toBe(StoryState.STORY_CREATED);
      expect(state.history).toHaveLength(1);
    });

    it('should update state with timestamp', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockStateFile));
      vi.mocked(yaml.load).mockReturnValue(mockStateFile);

      const newState = await tracker.transitionTo(StoryState.AUDIT_PASSED);
      expect(newState.state).toBe(StoryState.AUDIT_PASSED);
      expect(newState.history).toHaveLength(2);
    });

    it('should save state to YAML file', async () => {
      const writeFileMock = vi.mocked(fs.writeFileSync);
      writeFileMock.mockImplementation(() => {});

      await tracker.saveState(mockStateFile);
      expect(writeFileMock).toHaveBeenCalled();
    });

    it('should load state from YAML file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockStateFile));
      vi.mocked(yaml.load).mockReturnValue(mockStateFile);

      const state = await tracker.loadState();
      expect(state.epic).toBe('E001');
      expect(state.story).toBe('S001');
      expect(state.state).toBe(StoryState.STORY_CREATED);
    });

    it('should create new state if file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const state = await tracker.loadState();
      expect(state.epic).toBe('E001');
      expect(state.story).toBe('S001');
      expect(state.state).toBe(StoryState.STORY_CREATED);
    });
  });

  describe('T3.4: 完整状态机流程', () => {
    it('should execute full state transition flow', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockStateFile));
      vi.mocked(yaml.load).mockReturnValue(mockStateFile);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      // Start from story-created
      let state = await tracker.getCurrentState();
      expect(state.state).toBe(StoryState.STORY_CREATED);

      // Transition to audit-passed
      state = await tracker.transitionTo(StoryState.AUDIT_PASSED);
      expect(state.state).toBe(StoryState.AUDIT_PASSED);
      expect(state.history[state.history.length - 1].state).toBe(StoryState.AUDIT_PASSED);

      // Update mock for next state
      const auditPassedState: StateFile = {
        ...mockStateFile,
        state: StoryState.AUDIT_PASSED,
        history: [
          ...mockStateFile.history,
          { state: StoryState.AUDIT_PASSED, timestamp: '2024-01-02T00:00:00Z' },
        ],
      };
      vi.mocked(yaml.load).mockReturnValue(auditPassedState);

      // Transition to ready-for-dev
      state = await tracker.transitionTo(StoryState.READY_FOR_DEV);
      expect(state.state).toBe(StoryState.READY_FOR_DEV);
    });

    it('should reject invalid transition with error', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockStateFile));
      vi.mocked(yaml.load).mockReturnValue(mockStateFile);

      // Cannot skip from story-created to dev-completed
      await expect(tracker.transitionTo(StoryState.DEV_COMPLETED)).rejects.toThrow();
    });

    it('should track state history correctly', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockStateFile));
      vi.mocked(yaml.load).mockReturnValue(mockStateFile);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await tracker.transitionTo(StoryState.AUDIT_PASSED);
      const state = await tracker.getCurrentState();

      expect(state.history.length).toBeGreaterThanOrEqual(1);
      expect(state.history[0].state).toBe(StoryState.STORY_CREATED);
      expect(state.history[state.history.length - 1].state).toBe(StoryState.AUDIT_PASSED);
    });
  });
});
