import { describe, it, expect } from 'vitest';
import { clusterWeaknesses, type WeaknessCluster } from '../cluster-weaknesses';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(overrides: Partial<RunScoreRecord>): RunScoreRecord {
  return {
    run_id: 'r1',
    scenario: 'real_dev',
    stage: 'spec',
    phase_score: 70,
    phase_weight: 0.25,
    check_items: [],
    timestamp: new Date().toISOString(),
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

describe('clusterWeaknesses', () => {
  // 用例 1: 多条记录相同 item_id 失败 → 聚合为 cluster
  it('aggregates failed check_items by item_id into WeaknessCluster', () => {
    const records: RunScoreRecord[] = [
      makeRecord({
        run_id: 'r1',
        stage: 'spec',
        check_items: [
          { item_id: 'item_a', passed: false, score_delta: -10, note: 'note1' },
        ],
      }),
      makeRecord({
        run_id: 'r2',
        stage: 'plan',
        check_items: [
          { item_id: 'item_a', passed: false, score_delta: -5, note: 'note2' },
        ],
      }),
    ];
    const result = clusterWeaknesses(records, 2);
    expect(result.length).toBe(1);
    expect(result[0].primary_item_ids).toEqual(['item_a']);
    expect(result[0].frequency).toBe(2);
    expect(result[0].cluster_id).toBe('item_a');
    expect(result[0].affected_stages).toContain('spec');
    expect(result[0].affected_stages).toContain('plan');
  });

  // 用例 2: 频率 < minFrequency → 不纳入
  it('excludes item_id with frequency < minFrequency', () => {
    const records: RunScoreRecord[] = [
      makeRecord({
        check_items: [{ item_id: 'item_once', passed: false, score_delta: -10 }],
      }),
    ];
    const result = clusterWeaknesses(records, 2);
    expect(result).toEqual([]);
  });

  // 用例 3: 空 records → 返回 []
  it('returns empty array for empty records', () => {
    const result = clusterWeaknesses([], 2);
    expect(result).toEqual([]);
  });

  // 用例 4: 关键词从 note 正确提取
  it('extracts top-5 keywords from notes with stopword filtering', () => {
    const records: RunScoreRecord[] = [
      makeRecord({
        stage: 'spec',
        check_items: [
          {
            item_id: 'item_x',
            passed: false,
            score_delta: -10,
            note: '缺少边界检查、与、错误处理',
          },
        ],
      }),
      makeRecord({
        stage: 'plan',
        check_items: [
          {
            item_id: 'item_x',
            passed: false,
            score_delta: -5,
            note: '边界检查、的、问题',
          },
        ],
      }),
    ];
    const result = clusterWeaknesses(records, 2);
    expect(result.length).toBe(1);
    expect(result[0].keywords.length).toBeLessThanOrEqual(5);
    // 停用词 "的"、"与"、"和" 应被过滤
    expect(result[0].keywords).not.toContain('的');
    expect(result[0].keywords).not.toContain('与');
    expect(result[0].keywords).toContain('边界检查'); // 出现2次
    expect(result[0].keywords).toContain('错误处理');
    expect(result[0].keywords).toContain('问题');
  });

  // 用例 5: severity_distribution 统计正确
  it('maps score_delta to severity_distribution correctly', () => {
    const records: RunScoreRecord[] = [
      makeRecord({
        stage: 'spec',
        check_items: [
          { item_id: 'item_sev', passed: false, score_delta: -15 },
          { item_id: 'item_sev', passed: false, score_delta: -7 },
          { item_id: 'item_sev', passed: false, score_delta: -3 },
        ],
      }),
      makeRecord({
        stage: 'plan',
        check_items: [
          { item_id: 'item_sev', passed: false, score_delta: -10 },
        ],
      }),
    ];
    const result = clusterWeaknesses(records, 2);
    expect(result.length).toBe(1);
    expect(result[0].severity_distribution).toEqual({
      高: 2,
      中: 1,
      低: 1,
    });
  });
});
