/**
 * §A.4 最小集成：单条显式链 policy.triggerStage → scoringEnabledForTriggerStage ≙ policy.scoringEnabled
 * （与 scoring-chain 矩阵互补，冻结「治理输出与 loader 同源」）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { loadConfig } from '../../scripts/bmad-config';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import {
  scoringEnabledForTriggerStage,
  resetTriggerConfigCache,
} from '../../packages/scoring/trigger/trigger-loader';

const SCORING_YAML = join(process.cwd(), '_bmad', '_config', 'scoring-trigger-modes.yaml');

describe('runtime-governance policy → trigger loader (§A.4)', () => {
  beforeEach(() => {
    resetTriggerConfigCache();
  });

  const config = loadConfig();

  it('同一 (flow, stage) 下 policy.scoringEnabled 与 scoringEnabledForTriggerStage(policy.triggerStage, real_dev) 一致', () => {
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'tasks', config });
    const fromLoader = scoringEnabledForTriggerStage(policy.triggerStage, 'real_dev', SCORING_YAML);
    expect(policy.scoringEnabled).toBe(fromLoader.enabled);
  });
});
