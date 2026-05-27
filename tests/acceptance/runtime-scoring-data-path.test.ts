import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveRuntimeScoringDataPath } from '../../scripts/runtime-scoring-data-path';

function normalized(value: string): string {
  return value.replace(/\\/g, '/');
}

describe('runtime scoring data path resolver', () => {
  const originalScoringDataPath = process.env.SCORING_DATA_PATH;

  afterEach(() => {
    if (originalScoringDataPath === undefined) {
      delete process.env.SCORING_DATA_PATH;
    } else {
      process.env.SCORING_DATA_PATH = originalScoringDataPath;
    }
  });

  it('defaults to _bmad-output/scoring', () => {
    const root = path.resolve('/repo');
    delete process.env.SCORING_DATA_PATH;

    expect(normalized(resolveRuntimeScoringDataPath({ root }))).toBe(
      `${normalized(root)}/_bmad-output/scoring`
    );
  });

  it('prefers explicit dataPath', () => {
    const root = path.resolve('/repo');

    expect(normalized(resolveRuntimeScoringDataPath({ root, dataPath: 'tmp/scoring' }))).toBe(
      `${normalized(root)}/tmp/scoring`
    );
  });

  it('uses SCORING_DATA_PATH when no explicit dataPath is provided', () => {
    const root = path.resolve('/repo');

    expect(
      normalized(
        resolveRuntimeScoringDataPath({
          root,
          env: { SCORING_DATA_PATH: '_custom/scoring' },
        })
      )
    ).toBe(`${normalized(root)}/_custom/scoring`);
  });

  it('reads process.env.SCORING_DATA_PATH when env is not injected', () => {
    const root = path.resolve('/repo');
    process.env.SCORING_DATA_PATH = '_env/scoring';

    expect(normalized(resolveRuntimeScoringDataPath({ root }))).toBe(
      `${normalized(root)}/_env/scoring`
    );
  });
});
