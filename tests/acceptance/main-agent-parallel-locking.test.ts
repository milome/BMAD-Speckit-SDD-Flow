import { describe, expect, it } from 'vitest';
import { buildParallelMissionPlan } from '../../scripts/parallel-mission-control';

describe('main-agent parallel locking', () => {
  it('serializes overlapping write scopes and blocks protected write paths', () => {
    const plan = buildParallelMissionPlan({
      batchId: 'batch-001',
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
          write_scope: ['src/a.ts'],
          depends_on: [],
          assigned_agent: 'worker-b',
          target_branch: 'task/s2',
          target_pr: 'PR-2',
        },
        {
          node_id: 'n3',
          story_key: 'S3',
          packet_id: 'p3',
          write_scope: ['_bmad-output/implementation-artifacts/sprint-status.yaml'],
          depends_on: [],
          assigned_agent: 'worker-c',
          target_branch: 'task/s3',
          target_pr: 'PR-3',
        },
      ],
    });

    expect(plan.sprint_status_write_allowed).toBe(false);
    expect(plan.conflicts).toContainEqual({
      scope: 'src/a.ts',
      contenders: ['n1', 'n2'],
      resolution: 'serialize',
    });
    expect(plan.conflicts.find((item) => item.scope.includes('sprint-status.yaml'))?.resolution).toBe(
      'block'
    );
    expect(plan.merge_order).not.toContain('n3');
  });
});
