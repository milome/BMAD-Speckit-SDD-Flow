/**
 * §A.6：mandatory gates 与 granularity YAML 与 `resolveRuntimePolicy` 一致；非法重叠须抛错。
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import { loadConfig, type StageName } from '../../scripts/bmad-config';
import { resolveRuntimePolicy, type RuntimeFlowId } from '../../scripts/runtime-governance';

const CFG_ROOT = join(import.meta.dirname, '..', '..', '_bmad', '_config');
const ILLEGAL = join(import.meta.dirname, '..', 'fixtures', 'runtime-governance-illegal');

describe('runtime-governance mandatory + granularity (§A.6)', () => {
  const config = loadConfig();

  it('runtime-mandatory-gates.yaml 每条规则在匹配 (flow,stage) 上得到 mandatoryGate true', () => {
    const doc = yaml.load(readFileSync(join(CFG_ROOT, 'runtime-mandatory-gates.yaml'), 'utf8')) as {
      gates: Array<{ id: string; flow: string; stage: string }>;
    };
    for (const g of doc.gates) {
      const p = resolveRuntimePolicy({
        flow: g.flow as RuntimeFlowId,
        stage: g.stage as StageName,
        config,
      });
      expect(p.mandatoryGate).toBe(true);
      expect(p.reason).toContain(g.id);
    }
  });

  it('runtime-granularity-stages.yaml 每条 stage 在 story flow 下得到 granularityGoverned true', () => {
    const doc = yaml.load(readFileSync(join(CFG_ROOT, 'runtime-granularity-stages.yaml'), 'utf8')) as {
      granularity_governed_stages: string[];
    };
    for (const st of doc.granularity_governed_stages) {
      const p = resolveRuntimePolicy({
        flow: 'story',
        stage: st as StageName,
        config,
      });
      expect(p.granularityGoverned).toBe(true);
    }
  });

  it('mandatoryGate 与 granularityGoverned 同时为 true 的配置必须失败', () => {
    expect(() =>
      resolveRuntimePolicy({
        flow: 'story',
        stage: 'specify',
        config,
        governanceYamlPaths: {
          mandatoryGates: join(ILLEGAL, 'runtime-mandatory-gates.yaml'),
          granularityStages: join(ILLEGAL, 'runtime-granularity-stages.yaml'),
        },
      })
    ).toThrow(/Illegal runtime governance/);
  });
});
