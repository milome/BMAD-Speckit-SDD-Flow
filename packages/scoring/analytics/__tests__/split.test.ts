import { describe, expect, it } from 'vitest';
import { assignDeterministicSplit } from '../split';

describe('deterministic split assignment', () => {
  it('assigns the same split for the same seed and group key', () => {
    const left = assignDeterministicSplit({
      seed: 42,
      groupKey: 'epic-15/story-1',
    });
    const right = assignDeterministicSplit({
      seed: 42,
      groupKey: 'epic-15/story-1',
    });

    expect(left.assignment).toBe(right.assignment);
    expect(left.group_key).toBe('epic-15/story-1');
    expect(left.strategy).toBe('story_hash_v1');
  });
});
