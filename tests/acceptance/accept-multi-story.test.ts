import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  getGlobalState,
  saveGlobalState,
  createStory,
  getStoryState,
  updateStoryState,
  listActiveStories,
  getCurrentContext,
  setCurrentContext,
  completeStory,
  acquireLock,
  releaseLock,
  getLock,
} from '../../scripts/bmad-state';
import { existsSync, rmdirSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TEST_STATE_DIR = '.claude/state';
const TEST_STORIES_DIR = join(TEST_STATE_DIR, 'stories');
const TEST_LOCKS_DIR = join(TEST_STATE_DIR, 'locks');

describe('bmad multi-story state', () => {
  // Clean up before each test
  beforeEach(() => {
    // Clean test directories
    try {
      const stories = readdirSync(TEST_STORIES_DIR);
      for (const f of stories) {
        if (f.includes('E001') || f.includes('E002')) {
          unlinkSync(join(TEST_STORIES_DIR, f));
        }
      }
    } catch {}
    try {
      const locks = readdirSync(TEST_LOCKS_DIR);
      for (const f of locks) {
        if (f.includes('E001') || f.includes('E002')) {
          unlinkSync(join(TEST_LOCKS_DIR, f));
        }
      }
    } catch {}
    try {
      if (existsSync(join(TEST_STATE_DIR, 'bmad-progress.yaml'))) {
        unlinkSync(join(TEST_STATE_DIR, 'bmad-progress.yaml'));
      }
    } catch {}
  });

  describe('global state', () => {
    it('creates default global state', () => {
      const state = getGlobalState();
      expect(state.version).toBe('2.0');
      expect(state.active_stories).toEqual([]);
      expect(state.completed_stories).toEqual([]);
      expect(state.current_context).toBeNull();
    });

    it('persists global state', () => {
      const state = getGlobalState();
      state.active_stories.push({
        epic: 'E001',
        story: 'S001',
        stage: 'specify',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      saveGlobalState(state);

      const loaded = getGlobalState();
      expect(loaded.active_stories).toHaveLength(1);
      expect(loaded.active_stories[0].epic).toBe('E001');
    });
  });

  describe('story lifecycle', () => {
    it('creates a new story', () => {
      const story = createStory('E001', 'S001', 'string-validator');
      expect(story.epic).toBe('E001');
      expect(story.story).toBe('S001');
      expect(story.story_slug).toBe('string-validator');
      expect(story.stage).toBe('specify');
      expect(story.audit_status).toBe('pending');
    });

    it('throws if story already exists', () => {
      createStory('E001', 'S001', 'test');
      expect(() => createStory('E001', 'S001', 'test2')).toThrow('already exists');
    });

    it('gets story state', () => {
      createStory('E001', 'S001', 'test');
      const state = getStoryState('E001', 'S001');
      expect(state).not.toBeNull();
      expect(state?.epic).toBe('E001');
    });

    it('returns null for non-existent story', () => {
      const state = getStoryState('E999', 'S999');
      expect(state).toBeNull();
    });

    it('updates story state', () => {
      createStory('E001', 'S001', 'test');
      const updated = updateStoryState('E001', 'S001', { stage: 'plan_passed' });
      expect(updated.stage).toBe('plan_passed');

      const loaded = getStoryState('E001', 'S001');
      expect(loaded?.stage).toBe('plan_passed');
    });

    it('lists active stories', () => {
      createStory('E001', 'S001', 'test1');
      createStory('E001', 'S002', 'test2');
      createStory('E002', 'S001', 'test3');

      const stories = listActiveStories();
      expect(stories).toHaveLength(3);
    });

    it('completes a story', () => {
      createStory('E001', 'S001', 'test');
      completeStory('E001', 'S001');

      const stories = listActiveStories();
      expect(stories).toHaveLength(0);

      // State file still exists as archive
      const state = getStoryState('E001', 'S001');
      expect(state).not.toBeNull();
      expect(state?.epic).toBe('E001');
    });
  });

  describe('current context', () => {
    it('sets current context on create', () => {
      createStory('E001', 'S001', 'test');
      const ctx = getCurrentContext();
      expect(ctx).toEqual({ epic: 'E001', story: 'S001' });
    });

    it('switches context', () => {
      createStory('E001', 'S001', 'test1');
      createStory('E002', 'S001', 'test2');

      setCurrentContext('E002', 'S001');
      const ctx = getCurrentContext();
      expect(ctx).toEqual({ epic: 'E002', story: 'S001' });
    });

    it('throws when setting non-active context', () => {
      expect(() => setCurrentContext('E999', 'S999')).toThrow('not active');
    });
  });

  describe('story locking', () => {
    it('acquires and releases lock', () => {
      const acquired = acquireLock('E001', 'S001', 'agent-1');
      expect(acquired).toBe(true);

      const lock = getLock('E001', 'S001');
      expect(lock.locked).toBe(true);
      expect(lock.owner).toBe('agent-1');

      const released = releaseLock('E001', 'S001', 'agent-1');
      expect(released).toBe(true);

      const afterRelease = getLock('E001', 'S001');
      expect(afterRelease.locked).toBe(false);
    });

    it('prevents concurrent write locks', () => {
      acquireLock('E001', 'S001', 'agent-1');
      const acquired = acquireLock('E001', 'S001', 'agent-2');
      expect(acquired).toBe(false);
    });

    it('allows same owner to reacquire', () => {
      acquireLock('E001', 'S001', 'agent-1');
      const acquired = acquireLock('E001', 'S001', 'agent-1');
      expect(acquired).toBe(true);
    });

    it('prevents releasing others lock', () => {
      acquireLock('E001', 'S001', 'agent-1');
      const released = releaseLock('E001', 'S001', 'agent-2');
      expect(released).toBe(false);
    });
  });

  describe('multi-story isolation', () => {
    it('stories have independent states', () => {
      const story1 = createStory('E001', 'S001', 'test1');
      const story2 = createStory('E001', 'S002', 'test2');

      updateStoryState('E001', 'S001', { stage: 'implement_passed' });

      const state1 = getStoryState('E001', 'S001');
      const state2 = getStoryState('E001', 'S002');

      expect(state1?.stage).toBe('implement_passed');
      expect(state2?.stage).toBe('specify');
    });

    it('stories have independent locks', () => {
      acquireLock('E001', 'S001', 'agent-1');
      const canLock2 = acquireLock('E001', 'S002', 'agent-2');
      expect(canLock2).toBe(true);

      const lock1 = getLock('E001', 'S001');
      const lock2 = getLock('E001', 'S002');

      expect(lock1.locked).toBe(true);
      expect(lock2.locked).toBe(true);
    });
  });
});
