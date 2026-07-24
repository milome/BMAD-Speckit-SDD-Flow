import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  canonicalJsonBytes,
  compareEvidenceRef,
  compareTestIdentity,
  normalizeEvidenceRef,
  normalizeRepoPath,
  sha256Bytes,
  stableUnique,
  validateCanonicalAudit,
} = require('../../tools/test-portfolio-audit/canonical.cjs');

function auditWithTests(tests: unknown): Record<string, unknown> {
  return {
    schemaVersion: 'test-portfolio-audit/v1',
    status: 'COMPLETE',
    tests,
  };
}

function duplicateAudit(executionRouteRefs: unknown): Record<string, unknown> {
  return auditWithTests([
    {
      testPath: 'tests/a.test.ts',
      runnerId: 'root-vitest',
      executionMultiplicity: 'duplicate',
      executionRouteRefs,
    },
  ]);
}

describe('test portfolio canonical core', () => {
  it('normalizes Windows and POSIX repository paths to one identity', () => {
    expect(normalizeRepoPath('D:/repo', '.\\tests\\acceptance\\a.test.ts')).toBe(
      'tests/acceptance/a.test.ts'
    );
    expect(normalizeRepoPath('D:/repo', 'tests/acceptance/a.test.ts')).toBe(
      'tests/acceptance/a.test.ts'
    );
    expect(() => normalizeRepoPath('D:/repo', '../outside.test.ts')).toThrow('PATH_OUTSIDE_REPO');
  });

  it('fails closed for Windows path dialects under a POSIX repository root', () => {
    for (const value of [
      'C:/outside.test.ts',
      'C:\\outside.test.ts',
      '\\\\server\\share\\outside.test.ts',
    ]) {
      expect(() => normalizeRepoPath('/repo', value)).toThrow('PATH_OUTSIDE_REPO');
    }

    const hostDrive = process.cwd().match(/^[A-Za-z]:/)?.[0] || 'C:';
    expect(() =>
      normalizeRepoPath('/repo', `${hostDrive}/repo/tests/acceptance/a.test.ts`)
    ).toThrow('PATH_OUTSIDE_REPO');
  });

  it.each([
    './C:/outside.test.ts',
    'dir/../C:/outside.test.ts',
    './\\\\server\\share\\outside.test.ts',
    'dir/../\\\\server\\share\\outside.test.ts',
  ])('rejects Windows absolute aliases after repo path normalization: %s', (value) => {
    expect(() => normalizeRepoPath('/repo', value)).toThrow('PATH_OUTSIDE_REPO');
  });

  it('uses Windows containment rules for a Windows repository root', () => {
    expect(normalizeRepoPath('C:\\repo', 'tests\\acceptance\\a.test.ts')).toBe(
      'tests/acceptance/a.test.ts'
    );
    expect(normalizeRepoPath('C:\\repo', 'C:\\repo\\tests\\acceptance\\a.test.ts')).toBe(
      'tests/acceptance/a.test.ts'
    );
    expect(normalizeRepoPath('C:/repo', 'C:/repo/tests/acceptance/a.test.ts')).toBe(
      'tests/acceptance/a.test.ts'
    );

    for (const value of [
      'C:\\outside.test.ts',
      'D:\\repo\\tests\\acceptance\\a.test.ts',
      '\\\\server\\share\\outside.test.ts',
    ]) {
      expect(() => normalizeRepoPath('C:\\repo', value)).toThrow('PATH_OUTSIDE_REPO');
    }
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

  it('orders natural evidence ties with a deterministic ordinal tie-breaker', () => {
    expect(compareEvidenceRef('route:a1', 'route:a01')).toBeGreaterThan(0);
    expect(compareEvidenceRef('route:a01', 'route:a1')).toBeLessThan(0);
    expect(compareEvidenceRef('route:a2', 'route:a10')).toBeLessThan(0);

    const expected = ['route:a01', 'route:a1'];
    expect(['route:a1', 'route:a01'].sort(compareEvidenceRef)).toEqual(expected);
    expect(['route:a01', 'route:a1'].sort(compareEvidenceRef)).toEqual(expected);
  });

  it('compares test identity fields without concatenation collisions', () => {
    const left = { testPath: 'ab', runnerId: 'c' };
    const right = { testPath: 'a', runnerId: 'bc' };

    expect(compareTestIdentity(left, right)).toBeGreaterThan(0);
    expect(compareTestIdentity(right, left)).toBeLessThan(0);
    expect(
      compareTestIdentity(
        { testPath: 'tests/a.test.ts', runnerId: 'runner-2' },
        { testPath: 'tests/a.test.ts', runnerId: 'runner-10' }
      )
    ).toBeLessThan(0);
  });

  it.each([
    [
      {
        testPath: './tests\\acceptance\\a.test.ts',
        runnerId: ' root-vitest ',
        confidence: { criticality: 'high' },
        classification: 'first',
      },
      {
        testPath: 'tests/acceptance/a.test.ts',
        runnerId: 'root-vitest',
        confidence: { criticality: 'low' },
        classification: 'second',
      },
    ],
    [
      {
        testPath: 'tests/acceptance/a.test.ts',
        runnerId: 'root-vitest',
        confidence: { criticality: 'low' },
        classification: 'second',
      },
      {
        testPath: './tests\\acceptance\\a.test.ts',
        runnerId: ' root-vitest ',
        confidence: { criticality: 'high' },
        classification: 'first',
      },
    ],
  ])('rejects duplicate normalized runner-bound identities in either order', (first, second) => {
    expect(() => validateCanonicalAudit(auditWithTests([first, second]))).toThrow(
      'TEST_IDENTITY_DUPLICATE'
    );
  });

  it('requires duplicate route evidence to be normalized, non-empty, and distinct', () => {
    expect(() => validateCanonicalAudit(duplicateAudit(['route:only', 'route:only']))).toThrow(
      'DUPLICATE_EVIDENCE_INCOMPLETE'
    );
    expect(() => validateCanonicalAudit(duplicateAudit(['route:only', '   ']))).toThrow(
      'DUPLICATE_EVIDENCE_INCOMPLETE'
    );
    expect(() =>
      validateCanonicalAudit(
        duplicateAudit(['source:.\\package.json#scripts.test', 'source:package.json#scripts.test'])
      )
    ).toThrow('DUPLICATE_EVIDENCE_INCOMPLETE');
  });

  it('rejects non-string duplicate route evidence', () => {
    for (const value of [1, ['route:array'], { ref: 'route:object' }]) {
      expect(() => normalizeEvidenceRef(value)).toThrow('EVIDENCE_REF_INVALID');
      expect(() => validateCanonicalAudit(duplicateAudit(['route:valid', value]))).toThrow(
        'DUPLICATE_EVIDENCE_INCOMPLETE'
      );
    }
  });

  it('normalizes source paths without changing route semantics', () => {
    expect(normalizeEvidenceRef('source:././package.json#scripts.test')).toBe(
      'source:package.json#scripts.test'
    );
    expect(normalizeEvidenceRef(' source:.\\config\\..\\package.json#scripts.test ')).toBe(
      'source:package.json#scripts.test'
    );
    expect(normalizeEvidenceRef('route:pr-full\\./test-ci')).toBe('route:pr-full/./test-ci');
    expect(() => normalizeEvidenceRef('source:../outside.test.ts#suite')).toThrow(
      'EVIDENCE_SOURCE_OUTSIDE_REPO'
    );
    expect(() =>
      validateCanonicalAudit(
        duplicateAudit(['source:././package.json#scripts.test', 'source:package.json#scripts.test'])
      )
    ).toThrow('DUPLICATE_EVIDENCE_INCOMPLETE');
  });

  it('rejects empty, root, and absolute source paths', () => {
    for (const value of ['source:', 'source:.', 'source:./']) {
      expect(() => normalizeEvidenceRef(value)).toThrow('EVIDENCE_SOURCE_PATH_EMPTY');
    }
    for (const value of [
      'source:/outside.test.ts',
      'source:C:/outside.test.ts',
      'source:C:\\outside.test.ts',
      'source:C:outside.test.ts',
    ]) {
      expect(() => normalizeEvidenceRef(value)).toThrow('EVIDENCE_SOURCE_OUTSIDE_REPO');
    }
  });

  it.each([
    'source:./C:/outside.test.ts',
    'source:dir/../C:/outside.test.ts',
    'source:./C:outside.test.ts',
  ])('rejects drive-qualified source paths exposed by normalization: %s', (value) => {
    expect(() => normalizeEvidenceRef(value)).toThrow('EVIDENCE_SOURCE_OUTSIDE_REPO');
  });

  it.each([
    'source:./C:/outside.test.ts',
    'source:dir/../C:/outside.test.ts',
    'source:./\\\\server\\share\\outside.test.ts',
    'source:dir/../\\\\server\\share\\outside.test.ts',
  ])('rejects Windows absolute aliases after source path normalization: %s', (value) => {
    expect(() => normalizeEvidenceRef(value)).toThrow('EVIDENCE_SOURCE_OUTSIDE_REPO');
  });

  it('removes source trailing slashes while preserving fragments', () => {
    expect(normalizeEvidenceRef('source:dir')).toBe('source:dir');
    expect(normalizeEvidenceRef('source:dir/')).toBe('source:dir');
    expect(normalizeEvidenceRef('source:dir/#suite')).toBe('source:dir#suite');
    expect(normalizeEvidenceRef('source:dir/../file.test.ts#suite')).toBe(
      'source:file.test.ts#suite'
    );
  });

  it('requires dense distinct route refs for duplicate execution evidence', () => {
    const sparseRefs = ['route:a'];
    sparseRefs.length = 2;

    for (const refs of [
      ['route:a', 'route:'],
      ['route:a', 'source:tests/a.test.ts'],
      ['source:tests/a.test.ts', 'source:tests/b.test.ts'],
      ['route:group\\test', 'route:group/test'],
      sparseRefs,
    ]) {
      expect(() => validateCanonicalAudit(duplicateAudit(refs))).toThrow(
        'DUPLICATE_EVIDENCE_INCOMPLETE'
      );
    }
  });

  it('requires confidence to be a plain object when present', () => {
    for (const confidence of [undefined, null, [], new Date(0)]) {
      expect(() =>
        validateCanonicalAudit(
          auditWithTests([
            {
              testPath: 'tests/a.test.ts',
              runnerId: 'root-vitest',
              confidence,
            },
          ])
        )
      ).toThrow('CONFIDENCE_CONTAINER_INVALID');
    }

    const artifact = auditWithTests([
      {
        testPath: 'tests/a.test.ts',
        runnerId: 'root-vitest',
        confidence: { criticality: 'high' },
      },
    ]);
    expect(validateCanonicalAudit(artifact)).toBe(artifact);
  });

  it('rejects malformed audit structures with stable domain errors', () => {
    for (const artifact of [null, [], 'invalid', new Date(0)]) {
      expect(() => validateCanonicalAudit(artifact)).toThrow('AUDIT_ARTIFACT_INVALID');
    }

    expect(() =>
      validateCanonicalAudit({
        schemaVersion: 'test-portfolio-audit/v1',
        status: 'COMPLETE',
      })
    ).toThrow('AUDIT_TESTS_INVALID');
    for (const tests of [null, {}, 'invalid']) {
      expect(() => validateCanonicalAudit(auditWithTests(tests))).toThrow('AUDIT_TESTS_INVALID');
    }

    for (const row of [null, [], 'invalid', new Date(0)]) {
      expect(() => validateCanonicalAudit(auditWithTests([row]))).toThrow('AUDIT_TEST_ROW_INVALID');
    }
  });

  it('rejects empty repository paths while preserving explicit root notation', () => {
    for (const value of [undefined, null, '', '   ']) {
      expect(() => normalizeRepoPath('D:/repo', value)).toThrow('PATH_EMPTY');
    }
    expect(normalizeRepoPath('D:/repo', '.')).toBe('.');
    for (const testPath of ['.', './']) {
      expect(() =>
        validateCanonicalAudit(
          auditWithTests([
            {
              testPath,
              runnerId: 'root-vitest',
            },
          ])
        )
      ).toThrow('TEST_IDENTITY_MISSING');
    }
  });

  it('hashes canonical bytes with the known SHA-256 vector', () => {
    expect(sha256Bytes(Buffer.from('abc', 'utf8'))).toBe(
      'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('accepts a valid canonical audit', () => {
    const artifact = duplicateAudit(['route:pr-full/test-ci', 'route:pr-full/test-bmad']);

    expect(validateCanonicalAudit(artifact)).toBe(artifact);
  });
});
