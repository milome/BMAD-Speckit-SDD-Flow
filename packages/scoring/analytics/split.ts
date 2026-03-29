import { createHash } from 'node:crypto';
import type { CanonicalSplit } from './types';

export interface AssignDeterministicSplitOptions {
  seed: number;
  groupKey: string | null;
  strategy?: string;
}

export function assignDeterministicSplit(
  options: AssignDeterministicSplitOptions
): CanonicalSplit {
  const strategy = options.strategy ?? 'story_hash_v1';
  const stableKey = `${options.seed}:${options.groupKey ?? 'ungrouped'}`;
  const hash = createHash('sha256').update(stableKey).digest('hex');
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;

  let assignment: CanonicalSplit['assignment'] = 'train';
  if (bucket >= 80 && bucket < 90) assignment = 'validation';
  if (bucket >= 90) assignment = 'test';

  return {
    assignment,
    seed: options.seed,
    strategy,
    group_key: options.groupKey,
  };
}
