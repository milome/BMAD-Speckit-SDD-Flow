/**
 * Story 4.1 T1.3: 环节级 veto 判定单元测试
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { isVetoTriggered, buildVetoItemIds } from '../veto';
import type { CheckItem } from '../../writer/types';

const rulesDir = path.resolve(process.cwd(), 'packages', 'scoring', 'rules');

describe('isVetoTriggered', () => {
  it('returns true when check_items contains veto item_id with passed=false', () => {
    const vetoIds = new Set(['veto_core_logic', 'veto_owasp_high']);
    const checkItems: CheckItem[] = [
      { item_id: 'veto_core_logic', passed: false, score_delta: -10 },
      { item_id: 'functional_correctness', passed: true, score_delta: 0 },
    ];
    expect(isVetoTriggered(checkItems, vetoIds)).toBe(true);
  });

  it('returns false when veto item_id has passed=true', () => {
    const vetoIds = new Set(['veto_core_logic']);
    const checkItems: CheckItem[] = [
      { item_id: 'veto_core_logic', passed: true, score_delta: 0 },
    ];
    expect(isVetoTriggered(checkItems, vetoIds)).toBe(false);
  });

  it('returns false when no veto item_ids in check_items', () => {
    const vetoIds = new Set(['veto_core_logic']);
    const checkItems: CheckItem[] = [
      { item_id: 'functional_correctness', passed: false, score_delta: -10 },
    ];
    expect(isVetoTriggered(checkItems, vetoIds)).toBe(false);
  });

  it('covers veto_cwe798, veto_core_unmapped, veto_gaps_conflict', () => {
    const vetoIds = new Set(['veto_cwe798', 'veto_core_unmapped', 'veto_gaps_conflict']);
    expect(isVetoTriggered([{ item_id: 'veto_cwe798', passed: false, score_delta: -10 }], vetoIds)).toBe(true);
    expect(isVetoTriggered([{ item_id: 'veto_core_unmapped', passed: false, score_delta: -10 }], vetoIds)).toBe(true);
    expect(isVetoTriggered([{ item_id: 'veto_gaps_conflict', passed: false, score_delta: -10 }], vetoIds)).toBe(true);
  });
});

describe('buildVetoItemIds', () => {
  it('returns set containing veto_core_logic, veto_owasp_high, veto_cwe798, veto_compile, veto_core_unmapped, veto_gaps_conflict', () => {
    const ids = buildVetoItemIds({ rulesDir });
    expect(ids.has('veto_core_logic')).toBe(true);
    expect(ids.has('veto_owasp_high')).toBe(true);
    expect(ids.has('veto_cwe798')).toBe(true);
    expect(ids.has('veto_compile')).toBe(true);
    expect(ids.has('veto_core_unmapped')).toBe(true);
    expect(ids.has('veto_gaps_conflict')).toBe(true);
  });
});
