import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getScoringDataPath } from '../constants/path';
import path from 'path';

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
