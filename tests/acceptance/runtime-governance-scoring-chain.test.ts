/**
 * §A.6：`triggerStage` 与 `call_mapping` 一致；`scoringEnabled` 与 `scoringEnabledForTriggerStage` 对齐；
 * 覆盖 `real_dev` 与 `eval_question`；显式区分 `implement` 与 `speckit_5_2` 两条 stage 注册。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy, type RuntimeFlowId } from '../../scripts/runtime-governance';
import {
  scoringEnabledForTriggerStage,
  resetTriggerConfigCache,
} from '../../packages/scoring/trigger/trigger-loader';
import type { StageName } from '../../scripts/bmad-config';

const SCORING_YAML = join(process.cwd(), '_bmad', '_config', 'scoring-trigger-modes.yaml');

function distinctCallMappingStages(): string[] {
  const doc = yaml.load(readFileSync(SCORING_YAML, 'utf8')) as {
    scoring_write_control: { call_mapping: Record<string, { stage: string }> };
  };
  const stages = new Set<string>();
  for (const v of Object.values(doc.scoring_write_control.call_mapping)) {
    stages.add(v.stage);
  }
  return [...stages].sort();
}

/** Minimal (flow, stage) 覆盖矩阵：每个 trigger id 至少一条 */
const TRIGGER_COVERAGE: Array<{ triggerStage: string; flow: RuntimeFlowId; stage: StageName }> = [
  { triggerStage: 'speckit_1_2', flow: 'story', stage: 'specify' },
  { triggerStage: 'speckit_2_2', flow: 'story', stage: 'plan' },
  { triggerStage: 'speckit_3_2', flow: 'story', stage: 'gaps' },
  { triggerStage: 'speckit_4_2', flow: 'story', stage: 'tasks' },
  { triggerStage: 'speckit_5_2', flow: 'story', stage: 'implement' },
  { triggerStage: 'implement', flow: 'standalone_tasks', stage: 'implement' },
  { triggerStage: 'bmad_story_stage2', flow: 'story', stage: 'story_audit' },
  { triggerStage: 'bmad_story_stage4', flow: 'story', stage: 'post_audit' },
];

describe('runtime-governance ↔ scoring chain (§A.6)', () => {
  beforeEach(() => {
    resetTriggerConfigCache();
  });

  const config = loadConfig();

  it('call_mapping 中每个 distinct stage 存在映射且 scoringEnabled 与 scoringEnabledForTriggerStage(real_dev) 一致', () => {
    const distinct = distinctCallMappingStages();
    expect(distinct.length).toBeGreaterThan(0);

    for (const triggerStage of distinct) {
      const pair = TRIGGER_COVERAGE.find((t) => t.triggerStage === triggerStage);
      if (!pair) {
        throw new Error(`add TRIGGER_COVERAGE for ${triggerStage}`);
      }
      const p = resolveRuntimePolicy({ flow: pair.flow, stage: pair.stage, config });
      expect(p.triggerStage).toBe(triggerStage);
      const se = scoringEnabledForTriggerStage(triggerStage, 'real_dev', SCORING_YAML);
      expect(p.scoringEnabled).toBe(se.enabled);
    }
  });

  it.each(
    TRIGGER_COVERAGE.flatMap((row) => [
      { ...row, scenario: 'real_dev' as const },
      { ...row, scenario: 'eval_question' as const },
    ])
  )(
    '$flow × $stage ($triggerStage) scenario=$scenario: scoringEnabled matches scoringEnabledForTriggerStage',
    ({ flow, stage, triggerStage, scenario }) => {
      const p = resolveRuntimePolicy({ flow, stage, config, scenario });
      expect(p.triggerStage).toBe(triggerStage);
      const se = scoringEnabledForTriggerStage(triggerStage, scenario, SCORING_YAML);
      expect(p.scoringEnabled).toBe(se.enabled);
    }
  );

  it('至少一条 (flow, stage) 映射到 implement，另一条映射到 speckit_5_2', () => {
    const pImp = resolveRuntimePolicy({ flow: 'standalone_tasks', stage: 'implement', config });
    const p52 = resolveRuntimePolicy({ flow: 'story', stage: 'implement', config });
    expect(pImp.triggerStage).toBe('implement');
    expect(p52.triggerStage).toBe('speckit_5_2');
    expect(pImp.scoringEnabled).toBe(true);
    expect(p52.scoringEnabled).toBe(true);
  });

  it('structured control mirror preserves distinct implement and speckit_5_2 trigger stages', () => {
    const pImp = resolveRuntimePolicy({ flow: 'standalone_tasks', stage: 'implement', config });
    const p52 = resolveRuntimePolicy({ flow: 'story', stage: 'implement', config });

    expect(pImp.control.triggerStage).toBe('implement');
    expect(p52.control.triggerStage).toBe('speckit_5_2');
    expect(pImp.control.scoringEnabled).toBe(true);
    expect(p52.control.scoringEnabled).toBe(true);
    expect(pImp.triggerStage).toBe(pImp.control.triggerStage);
    expect(p52.triggerStage).toBe(p52.control.triggerStage);
  });

  it('structured control mirror stays aligned with top-level trigger and scoring fields across scenarios', () => {
    for (const { flow, stage, triggerStage } of TRIGGER_COVERAGE) {
      const policy = resolveRuntimePolicy({ flow, stage, config, scenario: 'real_dev' });
      expect(policy.control.triggerStage).toBe(triggerStage);
      expect(policy.control.scoringEnabled).toBe(policy.scoringEnabled);
      expect(policy.control.mandatoryGate).toBe(policy.mandatoryGate);
      expect(policy.control.granularityGoverned).toBe(policy.granularityGoverned);
    }
  });
});
