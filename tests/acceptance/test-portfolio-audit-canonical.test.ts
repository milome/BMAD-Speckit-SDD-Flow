import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  canonicalJsonBytes,
  normalizeEvidenceRef,
  normalizeRepoPath,
  stableUnique,
  validateCanonicalAudit,
} = require('../../tools/test-portfolio-audit/canonical.cjs');

describe('test portfolio canonical core', () => {
  it('normalizes Windows and POSIX repository paths to one identity', () => {
    expect(normalizeRepoPath('D:/repo', '.\\tests\\acceptance\\a.test.ts')).toBe(
      'tests/acceptance/a.test.ts'
    );
    expect(normalizeRepoPath('D:/repo', 'tests/acceptance/a.test.ts')).toBe(
      'tests/acceptance/a.test.ts'
    );
    expect(() => normalizeRepoPath('D:/repo', '../outside.test.ts')).toThrow(
      'PATH_OUTSIDE_REPO'
    );
  });

  it('normalizes path-bearing evidence without changing route semantics', () => {
    expect(normalizeEvidenceRef('source:.\\package.json#scripts.test')).toBe(
      'source:package.json#scripts.test'
    );
    expect(normalizeEvidenceRef('route:pr-full/test-ci')).toBe('route:pr-full/test-ci');
  });

  it('produces equal bytes for object insertion-order permutations', () => {
    const left = canonicalJsonBytes({
      z: 1,
      a: { d: 4, b: 2 },
      routes: ['route:b', 'route:a'],
    });
    const right = canonicalJsonBytes({
      routes: ['route:b', 'route:a'],
      a: { b: 2, d: 4 },
      z: 1,
    });
    const reorderedArray = canonicalJsonBytes({
      routes: ['route:a', 'route:b'],
      a: { b: 2, d: 4 },
      z: 1,
    });
    expect(left.equals(right)).toBe(true);
    expect(left.equals(reorderedArray)).toBe(false);
  });

  it('rejects duplicate findings without two complete route refs', () => {
    expect(() =>
      validateCanonicalAudit({
        schemaVersion: 'test-portfolio-audit/v1',
        status: 'COMPLETE',
        tests: [
          {
            testPath: 'tests/a.test.ts',
            runnerId: 'root-vitest',
            executionMultiplicity: 'duplicate',
            executionRouteRefs: ['route:only'],
          },
        ],
      })
    ).toThrow('DUPLICATE_EVIDENCE_INCOMPLETE');
  });

  it('returns stable unique values in canonical order', () => {
    expect(stableUnique(['b', 'a', 'a'])).toEqual(['a', 'b']);
  });
});
