/**
 * Story 2.1: 解析器单元测试 AC-1～AC-5
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  loadPhaseScoringYaml,
  loadGapsScoringYaml,
  loadIterationTierYaml,
} from '../../parsers/rules';

const rulesDir = path.resolve(process.cwd(), 'packages', 'scoring', 'rules');

describe('loadPhaseScoringYaml', () => {
  it('AC-1: 环节 2 合法 YAML 解析成功', () => {
    const y = loadPhaseScoringYaml(2, { rulesDir });
    expect(y.version).toBe('1.0');
    expect(y.stage).toBe('implement');
    expect(y.link_环节).toBe(2);
    expect(y.weights).toBeDefined();
    expect(y.weights.base).toBeDefined();
    expect(y.weights.bonus).toBeDefined();
    expect(y.items).toBeInstanceOf(Array);
    expect(y.items.length).toBeGreaterThan(0);
    expect(y.veto_items).toBeInstanceOf(Array);
  });

  it('AC-2: items 每项含 id、ref、deduct；ref 格式 code-reviewer-config#item_id', () => {
    const y = loadPhaseScoringYaml(2, { rulesDir });
    for (const item of y.items) {
      expect(item.id).toBeDefined();
      expect(item.ref).toMatch(/^code-reviewer-config#[a-zA-Z0-9_]+$/);
      expect(typeof item.deduct).toBe('number');
    }
  });

  it('AC-3: veto_items 每项含 id、ref、consequence；ref 指向 veto_*', () => {
    const y = loadPhaseScoringYaml(2, { rulesDir });
    for (const v of y.veto_items ?? []) {
      expect(v.id).toBeDefined();
      expect(v.ref).toMatch(/^code-reviewer-config#veto_[a-zA-Z0-9_]+$/);
      expect(v.consequence).toBeDefined();
    }
  });

  it('AC-7: 环节 3、4 文件存在且 schema 校验通过', () => {
    const y3 = loadPhaseScoringYaml(3, { rulesDir });
    expect(y3.link_环节).toBe(3);
    const y4 = loadPhaseScoringYaml(4, { rulesDir });
    expect(y4.link_环节).toBe(4);
  });
});

describe('loadGapsScoringYaml', () => {
  it('AC-4: gaps-scoring.yaml 可解析，产出前置 40%、后置 implement/post_impl 权重', () => {
    const y = loadGapsScoringYaml({ rulesDir });
    expect(y.version).toBe('1.0');
    expect(y.stage).toBe('gaps');
    expect(y.weights.base.spec_coverage).toBe(40);
    expect(y.weights.post_implement).toBeDefined();
    expect(y.weights.post_post_impl).toBeDefined();
  });
});

describe('loadIterationTierYaml', () => {
  it('AC-5: iteration-tier.yaml 可解析，产出 iteration_tier、severity_override', () => {
    const y = loadIterationTierYaml({ rulesDir });
    expect(y.iteration_tier[1]).toBe(1.0);
    expect(y.iteration_tier[2]).toBe(0.8);
    expect(y.iteration_tier[3]).toBe(0.5);
    expect(y.iteration_tier[4]).toBe(0);
    expect(y.severity_override?.fatal).toBe(3);
    expect(y.severity_override?.serious).toBe(2);
  });
});
