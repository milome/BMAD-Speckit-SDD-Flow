import { describe, expect, it } from 'vitest';
import {
  buildParallelMissionPlan,
  buildPrTopology,
  validatePrTopologyForReleaseGate,
} from '../../scripts/parallel-mission-control';

describe('main-agent PR topology', () => {
  it('allows all affected stories to pass only after required PR nodes are closed', () => {
    const plan = buildParallelMissionPlan({
      batchId: 'batch-pr',
      nodes: [
        {
          node_id: 'n1',
          story_key: 'S1',
          packet_id: 'p1',
          write_scope: ['src/a.ts'],
          depends_on: [],
          assigned_agent: 'worker-a',
          target_branch: 'task/s1',
          target_pr: 'PR-1',
        },
        {
          node_id: 'n2',
          story_key: 'S2',
          packet_id: 'p2',
          write_scope: ['src/b.ts'],
          depends_on: ['n1'],
          assigned_agent: 'worker-b',
          target_branch: 'task/s2',
          target_pr: 'PR-2',
        },
      ],
    });
    const openTopology = buildPrTopology({ plan, states: { n1: 'merged', n2: 'open' } });
    expect(openTopology.all_affected_stories_passed).toBe(false);
    expect(validatePrTopologyForReleaseGate(openTopology).passed).toBe(true);

    const inconsistent = {
      ...openTopology,
      all_affected_stories_passed: true,
    };
    expect(validatePrTopologyForReleaseGate(inconsistent).passed).toBe(false);

    const closedTopology = buildPrTopology({
      plan,
      states: { n1: 'merged', n2: 'closed_not_needed' },
    });
    expect(closedTopology.all_affected_stories_passed).toBe(true);
  });
});
