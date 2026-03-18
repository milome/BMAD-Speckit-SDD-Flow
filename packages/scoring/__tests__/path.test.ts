import { describe, it, expect, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { getScoringDataPath, resolveRulesDir } from '../constants/path';

describe('resolveRulesDir', () => {
  it('传入 rulesDir 时直接返回', () => {
    const custom = '/custom/rules';
    expect(resolveRulesDir({ rulesDir: custom })).toBe(custom);
  });

  it('cwd/packages/scoring/rules 存在时优先使用（monorepo 兼容）', () => {
    const cwdRules = path.join(process.cwd(), 'packages', 'scoring', 'rules');
    if (fs.existsSync(cwdRules)) {
      expect(resolveRulesDir()).toBe(cwdRules);
    }
  });

  it('cwd 路径不存在时使用包内 rules（消费者项目）', () => {
    const result = resolveRulesDir();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    const defaultYaml = path.join(result, 'default', 'implement-scoring.yaml');
    expect(fs.existsSync(defaultYaml)).toBe(true);
  });
});

describe('getScoringDataPath', () => {
  const orig = process.env.SCORING_DATA_PATH;

  afterEach(() => {
    if (orig !== undefined) process.env.SCORING_DATA_PATH = orig;
    else delete process.env.SCORING_DATA_PATH;
  });

  it('默认返回 scoring/data', () => {
    delete process.env.SCORING_DATA_PATH;
    const p = getScoringDataPath();
    expect(p).toContain('scoring');
    expect(p).toContain('data');
  });

  it('SCORING_DATA_PATH 覆盖时使用该路径', () => {
    process.env.SCORING_DATA_PATH = '_bmad-output/scoring';
    const p = getScoringDataPath();
    expect(p).toContain('_bmad-output');
    expect(p).toContain('scoring');
  });
});
