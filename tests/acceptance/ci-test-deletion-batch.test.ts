import { execFileSync, spawnSync } from 'node:child_process';
import {
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');

type ApplyDeletionBatch = (input: {
  repoRoot: string;
  authorization: Record<string, unknown>;
  catalog: Record<string, unknown>;
  policy: Record<string, unknown>;
  validate: (context: {
    deletedIdentityKeys: string[];
    deletedPaths: string[];
  }) => Promise<{ passed: boolean; issueCode?: string; evidence?: Record<string, unknown> }>;
  artifactsRoot?: string;
}) => Promise<Record<string, unknown>>;

const temporaryRoots: string[] = [];

function sha256(bytes: Buffer | string) {
  const { createHash } = require('node:crypto');
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function withBindings(
  authorization: Record<string, unknown>,
  candidateBindings: Array<{
    identityKey: string;
    testPath: string;
    sourceSha256: string;
  }>
) {
  const candidateIdentityKeys = candidateBindings.map((entry) => entry.identityKey).sort();
  return {
    ...authorization,
    batchHash: sha256Bytes(canonicalJsonBytes(candidateIdentityKeys)),
    candidateIdentityKeys,
    candidateBindings,
  };
}

function createFixture() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'ci-test-deletion-batch-'));
  temporaryRoots.push(repoRoot);
  execFileSync('git', ['init', '--quiet'], { cwd: repoRoot });

  const files = {
    'tests/a.test.ts': "export const value = 'a';\r\n",
    'tests/b.test.ts': "export const value = 'b';\n",
    'tests/unrelated.test.ts': "export const value = 'unrelated';\n",
  };
  for (const [testPath, source] of Object.entries(files)) {
    const target = join(repoRoot, testPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source, 'utf8');
  }
  execFileSync('git', ['add', '--', 'tests'], { cwd: repoRoot });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Portfolio Test',
      '-c',
      'user.email=portfolio@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'fixture baseline',
    ],
    { cwd: repoRoot }
  );

  const policy = {
    protectedCapabilities: [{ capabilityId: 'six-model-state-machine' }],
    deletion: {
      deterministicReasonCodes: ['EXACT_DUPLICATE'],
      localReview: { maxCandidates: 30, maxCalls: 1, retries: 0, timeoutMs: 120000 },
    },
  };
  const catalog = {
    schemaVersion: 'test-catalog/v1',
    tests: [
      {
        identityKey: 'root-vitest#tests/a.test.ts',
        lifecycleState: 'deletion_candidate',
        capabilityRefs: [],
        classifications: { protectedCapabilityRefs: [] },
        testPath: 'tests/a.test.ts',
      },
      {
        identityKey: 'root-vitest#tests/b.test.ts',
        lifecycleState: 'deletion_candidate',
        capabilityRefs: [],
        classifications: { protectedCapabilityRefs: [] },
        testPath: 'tests/b.test.ts',
      },
      {
        identityKey: 'root-vitest#tests/unrelated.test.ts',
        lifecycleState: 'retained_on_demand',
        capabilityRefs: [],
        classifications: { protectedCapabilityRefs: [] },
        testPath: 'tests/unrelated.test.ts',
      },
    ],
  };
  const candidateBindings = ['tests/a.test.ts', 'tests/b.test.ts'].map((testPath) => ({
    identityKey: `root-vitest#${testPath}`,
    testPath,
    sourceSha256: sha256(readFileSync(join(repoRoot, testPath))),
  }));
  const candidateIdentityKeys = candidateBindings.map((entry) => entry.identityKey).sort();
  const authorization = {
    batchHash: sha256Bytes(canonicalJsonBytes(candidateIdentityKeys)),
    evidenceHash: 'sha256:evidence',
    policyHash: sha256Bytes(canonicalJsonBytes(policy)),
    reviewMode: 'deterministic',
    reviewProfileVersion: 'test-portfolio-delete/v1',
    verdict: 'approve_delete',
    candidateIdentityKeys,
    candidateBindings,
  };

  return { authorization, catalog, files, policy, repoRoot };
}

function writeCanonicalJson(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, canonicalJsonBytes(value));
}

function prepareCliAuthority(
  fixture: ReturnType<typeof createFixture>,
  mutateSources?: (sources: {
    candidates: Array<Record<string, any>>;
    catalog: Record<string, any>;
    coreFreeze: Record<string, any>;
    impact: Record<string, any>;
  }) => void
) {
  const catalog = structuredClone(fixture.catalog) as Record<string, any>;
  catalog.tests = catalog.tests.map((test: Record<string, unknown>) => ({
    ...test,
    evidenceRefs: [],
    failureModeRefs: [],
    featureRefs: [],
    lifecycleState:
      fixture.authorization.candidateIdentityKeys.includes(test.identityKey)
        ? 'retained_on_demand'
        : test.lifecycleState,
    targetRefs: [],
    traceRefs: [],
  }));
  const coreFreeze = {
    schemaVersion: 'test-portfolio-core-freeze/v2',
    selected: [],
    coverage: [],
    candidateEvidence: [],
  };
  const impact = {
    schemaVersion: 'committed-changed-code-impact/v1',
    changedTestIdentityKeys: [],
    pathBindings: [],
  };
  const validationCommands = [
    'affected_tests',
    'binding_gates',
    'catalog_reconciliation',
    'count',
  ].map((kind) => ({
    kind,
    command: kind === 'affected_tests' ? 'npm' : process.execPath,
    args:
      kind === 'affected_tests'
        ? ['--version']
        : ['-e', "const fs=require('fs');if(fs.existsSync('tests/a.test.ts'))process.exit(1)"],
  }));
  const candidates = fixture.authorization.candidateBindings.map((binding) => ({
    identityKey: binding.identityKey,
    testPath: binding.testPath,
    lifecycleState: 'deletion_candidate',
    capabilityRefs: [],
    reasonCode: 'EXACT_DUPLICATE',
    evidenceRefs: [],
  }));
  const sources = { candidates, catalog, coreFreeze, impact };
  mutateSources?.(sources);
  const artifactBody = {
    schemaVersion: 'test-deletion-candidates/v1',
    candidates,
    localReviewCandidates: [],
    rejectedCandidates: [],
    validationCommands,
    summary: {
      deterministicCandidateCount: candidates.length,
      localReviewCandidateCount: 0,
      rejectedCandidateCount: 0,
    },
    provenance: {
      catalogHash: sha256Bytes(canonicalJsonBytes(catalog)),
      coreFreezeHash: sha256Bytes(canonicalJsonBytes(coreFreeze)),
      impactHash: sha256Bytes(canonicalJsonBytes(impact)),
      policyHash: sha256Bytes(canonicalJsonBytes(fixture.policy)),
      consolidationIntentHash: sha256Bytes(canonicalJsonBytes([])),
    },
  };
  const candidateArtifact = {
    ...artifactBody,
    candidateSetHash: sha256Bytes(canonicalJsonBytes(artifactBody)),
  };
  const paths = {
    authorizationPath: join(
      fixture.repoRoot,
      '.artifacts/test-portfolio/deletion-batches/batch-001.authorization.json'
    ),
    candidatesPath: join(
      fixture.repoRoot,
      '.artifacts/test-portfolio/deletion-batches/test-deletion-candidates.json'
    ),
    catalogPath: join(fixture.repoRoot, '.artifacts/test-portfolio/test-catalog.json'),
    coreFreezePath: join(
      fixture.repoRoot,
      '.artifacts/test-portfolio/test-portfolio-core-freeze.json'
    ),
    impactPath: join(
      fixture.repoRoot,
      '.artifacts/test-portfolio/committed-changed-code-impact.json'
    ),
    policyPath: join(fixture.repoRoot, 'repo-governance/ci/test-policy.json'),
    registryPath: join(
      fixture.repoRoot,
      'repo-governance/ci/test-deletion-authorizations.json'
    ),
  };
  writeCanonicalJson(paths.candidatesPath, candidateArtifact);
  writeCanonicalJson(paths.catalogPath, catalog);
  writeCanonicalJson(paths.coreFreezePath, coreFreeze);
  writeCanonicalJson(paths.impactPath, impact);
  const { authorityBindings } = require('../../tools/ci/authorize-test-deletions.cjs')
    .loadDeletionAuthorityArtifacts({
      repoRoot: fixture.repoRoot,
      candidatesPath: paths.candidatesPath,
      candidateSet: 'deterministic',
      catalogPath: paths.catalogPath,
      coreFreezePath: paths.coreFreezePath,
      impactPath: paths.impactPath,
      policy: fixture.policy,
    });
  const authorization = { ...fixture.authorization, authorityBindings, validationCommands };
  writeCanonicalJson(paths.policyPath, fixture.policy);
  writeCanonicalJson(paths.authorizationPath, authorization);
  writeCanonicalJson(paths.registryPath, {
    schemaVersion: 'test-deletion-authorizations/v1',
    authorizations: [authorization],
  });
  return { authorization, candidateArtifact, paths, sources };
}

function applyCliArgs(paths: ReturnType<typeof prepareCliAuthority>['paths']) {
  return [
    resolve('tools/ci/apply-test-deletion-batch.cjs'),
    '--authorization',
    paths.authorizationPath,
    '--candidates',
    paths.candidatesPath,
    '--candidate-set',
    'deterministic',
    '--catalog',
    paths.catalogPath,
    '--core-freeze',
    paths.coreFreezePath,
    '--impact',
    paths.impactPath,
    '--registry',
    paths.registryPath,
  ];
}

function loadApplyDeletionBatch(): ApplyDeletionBatch {
  return require('../../tools/ci/apply-test-deletion-batch.cjs').applyDeletionBatch;
}

describe('test deletion batch executor', () => {
  afterEach(() => {
    for (const repoRoot of temporaryRoots.splice(0)) {
      expect(relative(tmpdir(), repoRoot)).not.toMatch(/^\.\.(?:[\\/]|$)/);
      require('node:fs').rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('restores exact bytes for only the current batch when affected validation fails', async () => {
    const fixture = createFixture();
    const originalA = readFileSync(join(fixture.repoRoot, 'tests/a.test.ts'));
    const originalB = readFileSync(join(fixture.repoRoot, 'tests/b.test.ts'));
    const unrelated = readFileSync(join(fixture.repoRoot, 'tests/unrelated.test.ts'));

    const result = await loadApplyDeletionBatch()({
      repoRoot: fixture.repoRoot,
      authorization: fixture.authorization,
      catalog: fixture.catalog,
      policy: fixture.policy,
      validate: async () => ({ passed: false, issueCode: 'AFFECTED_TEST_FAILED' }),
    });

    expect(result.status).toBe('rolled_back');
    expect(result.issueCode).toBe('AFFECTED_TEST_FAILED');
    expect(readFileSync(join(fixture.repoRoot, 'tests/a.test.ts'))).toEqual(originalA);
    expect(readFileSync(join(fixture.repoRoot, 'tests/b.test.ts'))).toEqual(originalB);
    expect(readFileSync(join(fixture.repoRoot, 'tests/unrelated.test.ts'))).toEqual(unrelated);
    expect(
      execFileSync('git', ['diff', '--cached', '--name-only'], {
        cwd: fixture.repoRoot,
        encoding: 'utf8',
      }).trim()
    ).toBe('');
  });

  it('keeps an authorized exact batch deleted after validation passes', async () => {
    const fixture = createFixture();

    const result = await loadApplyDeletionBatch()({
      repoRoot: fixture.repoRoot,
      authorization: fixture.authorization,
      catalog: fixture.catalog,
      policy: fixture.policy,
      validate: async ({ deletedIdentityKeys, deletedPaths }) => ({
        passed: true,
        evidence: { deletedIdentityKeys, deletedPaths },
      }),
    });

    expect(result.status).toBe('applied');
    expect(result.deletedIdentityKeys).toEqual(fixture.authorization.candidateIdentityKeys);
    expect(result.deletedPaths).toEqual(['tests/a.test.ts', 'tests/b.test.ts']);
    expect(() => lstatSync(join(fixture.repoRoot, 'tests/a.test.ts'))).toThrow();
    expect(() => lstatSync(join(fixture.repoRoot, 'tests/b.test.ts'))).toThrow();
    expect(readFileSync(join(fixture.repoRoot, 'tests/unrelated.test.ts'), 'utf8')).toBe(
      fixture.files['tests/unrelated.test.ts']
    );
    expect(
      execFileSync('git', ['diff', '--cached', '--name-only'], {
        cwd: fixture.repoRoot,
        encoding: 'utf8',
      })
        .trim()
        .split(/\r?\n/)
    ).toEqual(['tests/a.test.ts', 'tests/b.test.ts']);
  });

  it('rejects authorization when a production binding still references a candidate', async () => {
    const fixture = createFixture();
    const bindingSourcePath = join(
      fixture.repoRoot,
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-bindings.ts'
    );
    mkdirSync(dirname(bindingSourcePath), { recursive: true });
    writeFileSync(
      bindingSourcePath,
      [
        'const ACTION_BINDING_SPECS = [',
        "  { actionId: 'example', behaviorTests: ['tests/a.test.ts'] },",
        '];',
        '',
      ].join('\n'),
      'utf8'
    );
    execFileSync('git', ['add', '--', relative(fixture.repoRoot, bindingSourcePath)], {
      cwd: fixture.repoRoot,
    });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Portfolio Test',
        '-c',
        'user.email=portfolio@example.invalid',
        'commit',
        '--quiet',
        '-m',
        'add active production binding',
      ],
      { cwd: fixture.repoRoot }
    );

    await expect(
      loadApplyDeletionBatch()({
        repoRoot: fixture.repoRoot,
        authorization: fixture.authorization,
        catalog: fixture.catalog,
        policy: fixture.policy,
        validate: async () => ({ passed: true }),
      })
    ).rejects.toThrow('TEST_DELETION_EXTERNAL_BINDING_ACTIVE');

    expect(readFileSync(join(fixture.repoRoot, 'tests/a.test.ts'), 'utf8')).toBe(
      fixture.files['tests/a.test.ts']
    );
    expect(readFileSync(join(fixture.repoRoot, 'tests/b.test.ts'), 'utf8')).toBe(
      fixture.files['tests/b.test.ts']
    );
  });

  it('applies a tracked authorization through the CLI validation boundary', () => {
    const fixture = createFixture();
    const authority = prepareCliAuthority(fixture);

    const output = execFileSync(
      process.execPath,
      applyCliArgs(authority.paths),
      { cwd: fixture.repoRoot, encoding: 'utf8' }
    );
    const result = JSON.parse(output);

    expect(result.status).toBe('applied');
    expect(result.validationEvidence.commandCount).toBe(4);
    expect(() => lstatSync(join(fixture.repoRoot, 'tests/a.test.ts'))).toThrow();
    expect(() => lstatSync(join(fixture.repoRoot, 'tests/b.test.ts'))).toThrow();
    expect(readFileSync(join(fixture.repoRoot, 'tests/unrelated.test.ts'), 'utf8')).toBe(
      fixture.files['tests/unrelated.test.ts']
    );
  });

  it.each([
    [
      'candidate artifact',
      (authority: ReturnType<typeof prepareCliAuthority>) => {
        const drifted = structuredClone(authority.candidateArtifact);
        drifted.summary.rejectedCandidateCount = 1;
        const { candidateSetHash: _candidateSetHash, ...body } = drifted;
        drifted.candidateSetHash = sha256Bytes(canonicalJsonBytes(body));
        writeCanonicalJson(authority.paths.candidatesPath, drifted);
      },
    ],
    [
      'catalog artifact',
      (authority: ReturnType<typeof prepareCliAuthority>) => {
        writeCanonicalJson(authority.paths.catalogPath, {
          ...authority.sources.catalog,
          driftMarker: true,
        });
      },
    ],
    [
      'core-freeze artifact',
      (authority: ReturnType<typeof prepareCliAuthority>) => {
        writeCanonicalJson(authority.paths.coreFreezePath, {
          ...authority.sources.coreFreeze,
          driftMarker: true,
        });
      },
    ],
    [
      'committed impact artifact',
      (authority: ReturnType<typeof prepareCliAuthority>) => {
        writeCanonicalJson(authority.paths.impactPath, {
          ...authority.sources.impact,
          driftMarker: true,
        });
      },
    ],
  ])('fails closed before deletion when the bound %s drifts', (_label, mutate) => {
    const fixture = createFixture();
    const authority = prepareCliAuthority(fixture);
    mutate(authority);

    const result = spawnSync(process.execPath, applyCliArgs(authority.paths), {
      cwd: fixture.repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /TEST_DELETION_(?:AUTHORIZATION_DRIFT|CANDIDATE_PROVENANCE_DRIFT)/
    );
    expect(readFileSync(join(fixture.repoRoot, 'tests/a.test.ts'), 'utf8')).toBe(
      fixture.files['tests/a.test.ts']
    );
    expect(readFileSync(join(fixture.repoRoot, 'tests/b.test.ts'), 'utf8')).toBe(
      fixture.files['tests/b.test.ts']
    );
  });

  it.each([
    [
      'is no longer a deletion_candidate',
      (sources: Record<string, any>) => {
        sources.candidates[0].lifecycleState = 'retained_on_demand';
      },
      'TEST_DELETION_CANDIDATE_STATE_INVALID',
    ],
    [
      'is selected into the dynamic core',
      (sources: Record<string, any>) => {
        sources.coreFreeze.selected = [
          {
            identityKey: 'root-vitest#tests/a.test.ts',
            coveredObligationIds: ['obligation:core'],
          },
        ];
      },
      'CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW',
    ],
    [
      'is a changed test',
      (sources: Record<string, any>) => {
        sources.impact.changedTestIdentityKeys = ['root-vitest#tests/a.test.ts'];
      },
      'TEST_DELETION_CHANGED_CODE_IMPACTED',
    ],
    [
      'is impacted through a changed path',
      (sources: Record<string, any>) => {
        sources.impact.pathBindings = [
          {
            changedPath: 'src/a.ts',
            testIdentityRefs: ['root-vitest#tests/a.test.ts'],
          },
        ];
      },
      'TEST_DELETION_CHANGED_CODE_IMPACTED',
    ],
    [
      'is the unique eligible obligation provider',
      (sources: Record<string, any>) => {
        sources.coreFreeze.coverage = [
          {
            obligationId: 'obligation:unique',
            evidenceDiagnostics: [
              {
                identityKey: 'root-vitest#tests/a.test.ts',
                eligibleForCoverage: true,
              },
              {
                identityKey: 'root-vitest#tests/b.test.ts',
                eligibleForCoverage: false,
              },
            ],
          },
        ];
      },
      'TEST_DELETION_UNIQUE_OBLIGATION_PROVIDER',
    ],
  ])('fails closed before deletion when a selected candidate %s', (_label, mutate, issueCode) => {
    const fixture = createFixture();
    const authority = prepareCliAuthority(fixture, mutate);

    const result = spawnSync(process.execPath, applyCliArgs(authority.paths), {
      cwd: fixture.repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(issueCode);
    expect(readFileSync(join(fixture.repoRoot, 'tests/a.test.ts'), 'utf8')).toBe(
      fixture.files['tests/a.test.ts']
    );
    expect(readFileSync(join(fixture.repoRoot, 'tests/b.test.ts'), 'utf8')).toBe(
      fixture.files['tests/b.test.ts']
    );
  });

  it.each([
    [
      'missing authorization',
      (_fixture: ReturnType<typeof createFixture>) => null,
      'TEST_DELETION_REVIEW_MISSING',
    ],
    [
      'core identity',
      (fixture: ReturnType<typeof createFixture>) =>
        withBindings(fixture.authorization, [fixture.authorization.candidateBindings[0]]),
      'CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW',
    ],
    [
      'repository-external path',
      (fixture: ReturnType<typeof createFixture>) => {
        fixture.catalog.tests.push({
          identityKey: 'root-vitest#../outside.test.ts',
          lifecycleState: 'deletion_candidate',
          capabilityRefs: [],
          classifications: { protectedCapabilityRefs: [] },
          testPath: '../outside.test.ts',
        });
        return withBindings(fixture.authorization, [
          {
            identityKey: 'root-vitest#../outside.test.ts',
            testPath: '../outside.test.ts',
            sourceSha256: 'sha256:outside',
          },
        ]);
      },
      'TEST_DELETION_PATH_OUTSIDE_REPOSITORY',
    ],
    [
      'source hash drift',
      (fixture: ReturnType<typeof createFixture>) => ({
        ...fixture.authorization,
        candidateBindings: fixture.authorization.candidateBindings.map((binding, index) =>
          index === 0 ? { ...binding, sourceSha256: 'sha256:drift' } : binding
        ),
      }),
      'TEST_DELETION_SOURCE_HASH_DRIFT',
    ],
    [
      'batch over the governed limit',
      (fixture: ReturnType<typeof createFixture>) => {
        const candidateBindings = Array.from({ length: 51 }, (_, index) => ({
          identityKey: `root-vitest#tests/generated-${index}.test.ts`,
          testPath: `tests/generated-${index}.test.ts`,
          sourceSha256: 'sha256:generated',
        }));
        return withBindings(fixture.authorization, candidateBindings);
      },
      'TEST_DELETION_BATCH_TOO_LARGE',
    ],
  ])(
    'rejects %s before mutating any file',
    async (_label, mutateAuthorization, expectedIssueCode) => {
      const fixture = createFixture();
      if (_label === 'core identity') {
        fixture.catalog.tests[0].lifecycleState = 'core_permanent';
      }
      const before = new Map(
        Object.keys(fixture.files).map((testPath) => [
          testPath,
          readFileSync(join(fixture.repoRoot, testPath)),
        ])
      );

      await expect(
        loadApplyDeletionBatch()({
          repoRoot: fixture.repoRoot,
          authorization: mutateAuthorization(fixture) as Record<string, unknown>,
          catalog: fixture.catalog,
          policy: fixture.policy,
          validate: async () => ({ passed: true }),
        })
      ).rejects.toThrow(expectedIssueCode);

      for (const [testPath, bytes] of before) {
        expect(readFileSync(join(fixture.repoRoot, testPath))).toEqual(bytes);
      }
    }
  );

  it('rejects a symlink before mutating any file', async () => {
    const fixture = createFixture();
    const linkPath = join(fixture.repoRoot, 'tests/link.test.ts');
    symlinkSync(join(fixture.repoRoot, 'tests/a.test.ts'), linkPath, 'file');
    const authorization = withBindings(fixture.authorization, [
      {
        identityKey: 'root-vitest#tests/link.test.ts',
        testPath: 'tests/link.test.ts',
        sourceSha256: sha256(readFileSync(linkPath)),
      },
    ]);
    fixture.catalog.tests.push({
      identityKey: 'root-vitest#tests/link.test.ts',
      lifecycleState: 'deletion_candidate',
      capabilityRefs: [],
      classifications: { protectedCapabilityRefs: [] },
      testPath: 'tests/link.test.ts',
    });
    const original = readFileSync(join(fixture.repoRoot, 'tests/a.test.ts'));

    await expect(
      loadApplyDeletionBatch()({
        repoRoot: fixture.repoRoot,
        authorization,
        catalog: fixture.catalog,
        policy: fixture.policy,
        validate: async () => ({ passed: true }),
      })
    ).rejects.toThrow('TEST_DELETION_PATH_SYMLINK');

    expect(readFileSync(join(fixture.repoRoot, 'tests/a.test.ts'))).toEqual(original);
    expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
  });
});
