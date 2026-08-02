import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const fixture = require('../fixtures/test-portfolio/deletion-candidates.json');
const {
  authorizeDeletionBatch,
  authorizeFromFiles,
  createCodexLocalReviewInvoker,
  requireDeletionException,
  selectCandidateSet,
  verifyDeletionAuthorization,
  verifyDeletionExceptionAuthorization,
} = require('../../tools/ci/authorize-test-deletions.cjs');
const {
  reviewAmbiguousCandidatesOnce,
} = require('../../tools/ci/review-ambiguous-test-candidates.cjs');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');

function deletionCandidateGenerator() {
  return require('../../tools/ci/generate-test-deletion-candidates.cjs') as {
    generateTestDeletionCandidates: (input: Record<string, unknown>) => any;
    rejectExternallyBoundCandidates: (input: {
      artifact: Record<string, unknown>;
      references: Array<{
        authorityKind: string;
        authorityPath: string;
        testPath: string;
      }>;
    }) => any;
  };
}

function deletionValidationCommands() {
  return [
    {
      kind: 'affected_tests',
      command: 'npm',
      args: [
        'exec',
        '--',
        'vitest',
        'run',
        'tests/acceptance/ci-test-deletion-authorization.test.ts',
      ],
    },
    {
      kind: 'binding_gates',
      command: 'node',
      args: ['--version'],
    },
    {
      kind: 'catalog_reconciliation',
      command: 'node',
      args: ['--version'],
    },
    {
      kind: 'count',
      command: 'node',
      args: ['--version'],
    },
  ];
}

function deletionCandidateInput(overrides: Record<string, unknown> = {}) {
  const source = {
    identityKey: 'root-vitest#tests/source.test.ts',
    testPath: 'tests/source.test.ts',
    lifecycleState: 'feature_working_set',
    capabilityRefs: ['capability:source'],
    failureModeRefs: ['failure:source'],
    traceRefs: [],
    featureRefs: [],
    targetRefs: ['src/source.ts'],
    evidenceRefs: ['source:tests/source.test.ts'],
    classifications: {
      criticality: 'standard',
      targetValidity: 'active',
      oracleEffectiveness: 'effective',
      criticalBindings: [],
    },
  };
  const replacement = {
    ...source,
    identityKey: 'root-vitest#tests/replacement.test.ts',
    testPath: 'tests/replacement.test.ts',
    lifecycleState: 'retained_on_demand',
    capabilityRefs: ['capability:replacement', 'capability:source'],
    failureModeRefs: ['failure:replacement', 'failure:source'],
    targetRefs: ['src/replacement.ts'],
    evidenceRefs: ['source:tests/replacement.test.ts'],
  };
  const obsolete = {
    ...source,
    identityKey: 'root-vitest#tests/obsolete.test.ts',
    testPath: 'tests/obsolete.test.ts',
    lifecycleState: 'retained_on_demand',
    capabilityRefs: [],
    failureModeRefs: [],
    targetRefs: ['src/removed.ts'],
    evidenceRefs: ['source:src/removed.ts#no-production-inbound'],
    classifications: {
      ...source.classifications,
      targetValidity: 'obsolete_candidate',
    },
  };
  return {
    catalog: {
      schemaVersion: 'test-catalog/v1',
      tests: [source, replacement, obsolete],
    },
    coreFreeze: {
      schemaVersion: 'test-portfolio-core-freeze/v2',
      selected: [],
      coverage: [],
      candidateEvidence: [],
    },
    impact: {
      schemaVersion: 'committed-changed-code-impact/v1',
      changedTestIdentityKeys: [],
      pathBindings: [],
    },
    policy,
    consolidationIntents: [
      {
        sourceIdentityKey: source.identityKey,
        replacementIdentityKey: replacement.identityKey,
        reasonCode: 'REPLACED_BY_CONTRACT_TEST',
      },
    ],
    validationCommands: deletionValidationCommands(),
    ...overrides,
  };
}

function writeCanonicalJson(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, canonicalJsonBytes(value));
}

function createCanonicalAuthorizationFixture(repoRoot: string) {
  const input = deletionCandidateInput();
  const artifact =
    deletionCandidateGenerator().generateTestDeletionCandidates(input);
  const paths = {
    candidatesPath: join(
      repoRoot,
      '.artifacts/test-portfolio/deletion-batches/test-deletion-candidates.json'
    ),
    catalogPath: join(repoRoot, '.artifacts/test-portfolio/test-catalog.json'),
    coreFreezePath: join(
      repoRoot,
      '.artifacts/test-portfolio/test-portfolio-core-freeze.json'
    ),
    impactPath: join(
      repoRoot,
      '.artifacts/test-portfolio/committed-changed-code-impact.json'
    ),
  };
  writeCanonicalJson(paths.candidatesPath, artifact);
  writeCanonicalJson(paths.catalogPath, (input as any).catalog);
  writeCanonicalJson(paths.coreFreezePath, (input as any).coreFreeze);
  writeCanonicalJson(paths.impactPath, (input as any).impact);
  const sourcePath = join(repoRoot, 'tests/source.test.ts');
  mkdirSync(dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, 'export const source = true;\n', 'utf8');
  return { artifact, input, paths };
}

const policy = {
  protectedCapabilities: [{ capabilityId: 'six-model-state-machine' }],
  deletion: {
    deterministicReasonCodes: [
      'EXACT_DUPLICATE',
      'TARGET_REMOVED',
      'SELF_PROVING_ORACLE',
      'REPLACED_BY_CONTRACT_TEST',
    ],
    localReview: { maxCandidates: 30, maxCalls: 1, retries: 0, timeoutMs: 120000 },
  },
};

describe('test deletion authorization', () => {
  it('requires a tracked manual exception with two independent approvers', () => {
    const exceptionPolicy = {
      deletion: {
        optimizationUseForbidden: true,
        requiredReviewMode: 'manual_exception',
        minimumApprovals: 2,
      },
    };

    expect(() =>
      requireDeletionException({
        policy: exceptionPolicy,
        exceptionTicket: 'CI-123',
        exceptionReason: 'Obsolete compatibility contract replaced by a stronger oracle',
        approvers: ['owner-a'],
      })
    ).toThrow('TEST_DELETION_EXCEPTION_APPROVALS_INSUFFICIENT');

    const exception = requireDeletionException({
      policy: exceptionPolicy,
      exceptionTicket: 'CI-123',
      exceptionReason: 'Obsolete compatibility contract replaced by a stronger oracle',
      approvers: ['owner-b', 'owner-a'],
    });
    const authorization = {
      ...exception,
      verdict: 'approve_delete',
    };

    expect(() =>
      verifyDeletionExceptionAuthorization({
        policy: exceptionPolicy,
        registry: { registryMode: 'legacy_history_only' },
        authorization,
      })
    ).toThrow('TEST_DELETION_EXCEPTION_REGISTRY_REQUIRED');
    expect(
      verifyDeletionExceptionAuthorization({
        policy: exceptionPolicy,
        registry: { registryMode: 'manual_exception' },
        authorization,
      })
    ).toBe(authorization);
  });

  it('selects only the explicit local-review candidate set', () => {
    const deterministicCandidate = {
      ...fixture.candidates[0],
      identityKey: 'root-vitest#tests/deterministic.test.ts',
      testPath: 'tests/deterministic.test.ts',
    };
    const localReviewCandidate = {
      ...fixture.candidates[0],
      identityKey: 'root-vitest#tests/local-review.test.ts',
      testPath: 'tests/local-review.test.ts',
      reasonCode: 'OBSOLETE_TARGET_REVIEW',
    };

    expect(
      selectCandidateSet(
        {
          schemaVersion: 'test-deletion-candidates/v1',
          candidates: [deterministicCandidate],
          localReviewCandidates: [localReviewCandidate],
        },
        'local-review'
      )
    ).toEqual([localReviewCandidate]);
  });

  it('requires an explicit candidate set for generated multi-set artifacts', () => {
    expect(() =>
      selectCandidateSet({
        schemaVersion: 'test-deletion-candidates/v1',
        candidates: fixture.candidates,
        localReviewCandidates: fixture.candidates,
      })
    ).toThrow('TEST_DELETION_CANDIDATE_SET_REQUIRED');
  });

  it('rejects unknown and empty candidate-set selections', () => {
    const payload = {
      schemaVersion: 'test-deletion-candidates/v1',
      candidates: fixture.candidates,
      localReviewCandidates: [],
    };

    expect(() => selectCandidateSet(payload, 'unknown')).toThrow(
      'TEST_DELETION_CANDIDATE_SET_UNKNOWN'
    );
    expect(() => selectCandidateSet(payload, 'local-review')).toThrow(
      'TEST_DELETION_CANDIDATE_SET_EMPTY'
    );
  });

  it('keeps simple single-set batch payloads backward compatible', () => {
    expect(selectCandidateSet({ candidates: fixture.candidates })).toEqual(fixture.candidates);
  });

  it('writes a path-bound authorization and appends the tracked registry idempotently', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-test-deletion-authorization-'));
    const policyPath = join(repoRoot, 'repo-governance/ci/test-policy.json');
    const registryPath = join(repoRoot, 'repo-governance/ci/test-deletion-authorizations.json');
    const outputPath = join(
      repoRoot,
      '.artifacts/test-portfolio/deletion-batches/batch-001.authorization.json'
    );
    const canonicalFixture = createCanonicalAuthorizationFixture(repoRoot);
    mkdirSync(dirname(policyPath), { recursive: true });
    writeFileSync(policyPath, JSON.stringify(policy), 'utf8');
    writeFileSync(
      registryPath,
      JSON.stringify({
        schemaVersion: 'test-deletion-authorizations/v1',
        authorizations: [],
      }),
      'utf8'
    );
    execFileSync('git', ['init', '--quiet'], { cwd: repoRoot });
    execFileSync('git', ['add', '--', '.'], { cwd: repoRoot });

    try {
      const invokeLocalModel = vi.fn().mockImplementation(({ candidates }) =>
        Promise.resolve({
          verdict: 'approve_delete',
          candidateIdentityKeys: candidates.map((candidate) => candidate.identityKey),
        })
      );
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await authorizeFromFiles({
          repoRoot,
          ...canonicalFixture.paths,
          candidateSet: 'deterministic',
          policyPath,
          outputPath,
          registryPath,
          invokeLocalModel,
        });
      }

      const authorization = JSON.parse(readFileSync(outputPath, 'utf8'));
      const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
      expect(authorization.candidateBindings).toEqual([
        expect.objectContaining({
          identityKey: 'root-vitest#tests/source.test.ts',
          testPath: 'tests/source.test.ts',
          sourceSha256: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        }),
      ]);
      expect(authorization.authorityBindings).toEqual({
        candidateArtifact: {
          repositoryPath:
            '.artifacts/test-portfolio/deletion-batches/test-deletion-candidates.json',
          fileSha256: sha256Bytes(canonicalJsonBytes(canonicalFixture.artifact)),
          candidateSetHash: canonicalFixture.artifact.candidateSetHash,
          selectedCandidateSet: 'deterministic',
          selectedCandidateSetHash: sha256Bytes(
            canonicalJsonBytes(canonicalFixture.artifact.candidates)
          ),
        },
        catalog: {
          repositoryPath: '.artifacts/test-portfolio/test-catalog.json',
          fileSha256: sha256Bytes(canonicalJsonBytes((canonicalFixture.input as any).catalog)),
          contentHash: canonicalFixture.artifact.provenance.catalogHash,
        },
        coreFreeze: {
          repositoryPath: '.artifacts/test-portfolio/test-portfolio-core-freeze.json',
          fileSha256: sha256Bytes(canonicalJsonBytes((canonicalFixture.input as any).coreFreeze)),
          contentHash: canonicalFixture.artifact.provenance.coreFreezeHash,
        },
        impact: {
          repositoryPath: '.artifacts/test-portfolio/committed-changed-code-impact.json',
          fileSha256: sha256Bytes(canonicalJsonBytes((canonicalFixture.input as any).impact)),
          contentHash: canonicalFixture.artifact.provenance.impactHash,
        },
      });
      expect(authorization.validationCommands.map((entry) => entry.kind)).toEqual([
        'affected_tests',
        'binding_gates',
        'catalog_reconciliation',
        'count',
      ]);
      expect(
        authorization.validationCommands
          .filter((entry) => entry.command !== 'npm')
          .map((entry) => entry.command)
      ).toEqual(['node', 'node', 'node']);
      expect(registry.authorizations).toHaveLength(1);
      expect(registry.authorizations[0]).toEqual(authorization);
      expect(invokeLocalModel).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects caller-assembled candidate arrays as production authorization input', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-test-deletion-array-'));
    const canonicalFixture = createCanonicalAuthorizationFixture(repoRoot);
    const policyPath = join(repoRoot, 'repo-governance/ci/test-policy.json');
    const registryPath = join(repoRoot, 'repo-governance/ci/test-deletion-authorizations.json');
    const outputPath = join(
      repoRoot,
      '.artifacts/test-portfolio/deletion-batches/batch-001.authorization.json'
    );
    writeCanonicalJson(
      canonicalFixture.paths.candidatesPath,
      canonicalFixture.artifact.candidates
    );
    mkdirSync(dirname(policyPath), { recursive: true });
    writeFileSync(policyPath, JSON.stringify(policy), 'utf8');
    writeFileSync(
      registryPath,
      JSON.stringify({
        schemaVersion: 'test-deletion-authorizations/v1',
        authorizations: [],
      }),
      'utf8'
    );
    execFileSync('git', ['init', '--quiet'], { cwd: repoRoot });
    execFileSync('git', ['add', '--', '.'], { cwd: repoRoot });

    try {
      await expect(
        authorizeFromFiles({
          repoRoot,
          ...canonicalFixture.paths,
          candidateSet: 'deterministic',
          policyPath,
          outputPath,
          registryPath,
          invokeLocalModel: vi.fn(),
        })
      ).rejects.toThrow('TEST_DELETION_CANDIDATE_ARTIFACT_INVALID');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects canonical candidate provenance that no longer matches the catalog artifact', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-test-deletion-provenance-'));
    const canonicalFixture = createCanonicalAuthorizationFixture(repoRoot);
    const policyPath = join(repoRoot, 'repo-governance/ci/test-policy.json');
    const registryPath = join(repoRoot, 'repo-governance/ci/test-deletion-authorizations.json');
    const outputPath = join(
      repoRoot,
      '.artifacts/test-portfolio/deletion-batches/batch-001.authorization.json'
    );
    const driftedCatalog = structuredClone((canonicalFixture.input as any).catalog);
    driftedCatalog.tests[0].evidenceRefs.push('drift:catalog');
    writeCanonicalJson(canonicalFixture.paths.catalogPath, driftedCatalog);
    mkdirSync(dirname(policyPath), { recursive: true });
    writeFileSync(policyPath, JSON.stringify(policy), 'utf8');
    writeFileSync(
      registryPath,
      JSON.stringify({
        schemaVersion: 'test-deletion-authorizations/v1',
        authorizations: [],
      }),
      'utf8'
    );
    execFileSync('git', ['init', '--quiet'], { cwd: repoRoot });
    execFileSync('git', ['add', '--', '.'], { cwd: repoRoot });

    try {
      await expect(
        authorizeFromFiles({
          repoRoot,
          ...canonicalFixture.paths,
          candidateSet: 'deterministic',
          policyPath,
          outputPath,
          registryPath,
          invokeLocalModel: vi.fn(),
        })
      ).rejects.toThrow('TEST_DELETION_CANDIDATE_PROVENANCE_DRIFT');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('requires one local model review for a proven non-core deterministic batch', async () => {
    const invokeLocalModel = vi.fn().mockResolvedValue({
      verdict: 'approve_delete',
      candidateIdentityKeys: fixture.candidates.map((candidate) => candidate.identityKey),
    });
    const authorization = await authorizeDeletionBatch({
      candidates: fixture.candidates,
      policy,
      invokeLocalModel,
    });

    expect(invokeLocalModel).toHaveBeenCalledTimes(1);
    expect(authorization.reviewMode).toBe('local_model_once');
    expect(authorization.verdict).toBe('approve_delete');
    expect(() =>
      verifyDeletionAuthorization({
        authorization,
        deletedIdentityKeys: authorization.candidateIdentityKeys,
        evidenceHash: authorization.evidenceHash,
        policyHash: authorization.policyHash,
        reviewMode: authorization.reviewMode,
        reviewProfileVersion: authorization.reviewProfileVersion,
      })
    ).not.toThrow();
  });

  it('invokes Codex as an ephemeral read-only local deletion reviewer', async () => {
    expect(typeof createCodexLocalReviewInvoker).toBe('function');
    if (typeof createCodexLocalReviewInvoker !== 'function') return;

    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-test-deletion-codex-review-'));
    try {
      const request = {
        schemaVersion: 'test-deletion-review-request/v1',
        candidates: [
          {
            identityKey: 'root-vitest#tests/obsolete.test.ts',
            reasonCode: 'OBSOLETE_TARGET_REVIEW',
          },
        ],
      };
      const runCommand = vi.fn((_command, args, options) => {
        const outputIndex = args.indexOf('--output-last-message');
        const schemaIndex = args.indexOf('--output-schema');
        expect(outputIndex).toBeGreaterThan(-1);
        expect(schemaIndex).toBeGreaterThan(-1);
        expect(JSON.parse(readFileSync(args[schemaIndex + 1], 'utf8'))).toEqual(
          expect.objectContaining({
            required: ['verdict', 'candidateIdentityKeys'],
          })
        );
        expect(options).toEqual(
          expect.objectContaining({
            cwd: repoRoot,
            encoding: 'utf8',
            input: expect.stringContaining('OBSOLETE_TARGET_REVIEW'),
            timeout: 1234,
            windowsHide: true,
          })
        );
        writeFileSync(
          args[outputIndex + 1],
          JSON.stringify({
            verdict: 'approve_delete',
            candidateIdentityKeys: ['root-vitest#tests/obsolete.test.ts'],
          }),
          'utf8'
        );
        return { status: 0, stdout: '', stderr: '' };
      });
      const invoke = createCodexLocalReviewInvoker({
        repoRoot,
        timeoutMs: 1234,
        runCommand,
      });

      await expect(invoke(request)).resolves.toEqual({
        verdict: 'approve_delete',
        candidateIdentityKeys: ['root-vitest#tests/obsolete.test.ts'],
      });
      expect(runCommand).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining([
          'exec',
          '--ephemeral',
          '--ignore-rules',
          '--sandbox',
          'read-only',
          '--output-schema',
          expect.any(String),
          '--output-last-message',
          expect.any(String),
          '-',
        ]),
        expect.any(Object)
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it.each([
    [
      'production action binding source',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-bindings.ts',
      [
        'const ACTION_BINDING_SPECS = [',
        "  { actionId: 'example', behaviorTests: ['tests/source.test.ts'] },",
        '];',
        '',
      ].join('\n'),
    ],
    [
      'root production source',
      'src/runtime-bindings.ts',
      "export const behaviorTests = ['tests/source.test.ts'];\n",
    ],
    [
      'manifest authority',
      '_bmad/shared/requirements-contract/runtime-action-binding-manifest.json',
      JSON.stringify({
        actions: [{ actionId: 'example', behaviorTestRefs: ['tests/source.test.ts'] }],
      }),
    ],
    [
      'tracked registry',
      'repo-governance/ci/runtime-test-bindings.json',
      JSON.stringify({
        schemaVersion: 'runtime-test-bindings/v1',
        testRefs: ['tests/source.test.ts'],
      }),
    ],
  ])(
    'rejects candidates still referenced by %s',
    async (_label, authorityPath, authoritySource) => {
      const repoRoot = mkdtempSync(join(tmpdir(), 'ci-test-deletion-external-binding-'));
      const canonicalFixture = createCanonicalAuthorizationFixture(repoRoot);
      const policyPath = join(repoRoot, 'repo-governance/ci/test-policy.json');
      const registryPath = join(repoRoot, 'repo-governance/ci/test-deletion-authorizations.json');
      const outputPath = join(
        repoRoot,
        '.artifacts/test-portfolio/deletion-batches/batch-001.authorization.json'
      );
      const bindingSourcePath = join(repoRoot, authorityPath);
      mkdirSync(dirname(policyPath), { recursive: true });
      mkdirSync(dirname(bindingSourcePath), { recursive: true });
      writeFileSync(bindingSourcePath, authoritySource, 'utf8');
      writeFileSync(policyPath, JSON.stringify(policy), 'utf8');
      writeFileSync(
        registryPath,
        JSON.stringify({
          schemaVersion: 'test-deletion-authorizations/v1',
          authorizations: [],
        }),
        'utf8'
      );
      execFileSync('git', ['init', '--quiet'], { cwd: repoRoot });
      execFileSync('git', ['add', '--', '.'], { cwd: repoRoot });

      try {
        await expect(
          authorizeFromFiles({
            repoRoot,
            ...canonicalFixture.paths,
            candidateSet: 'deterministic',
            policyPath,
            outputPath,
            registryPath,
          })
        ).rejects.toThrow('TEST_DELETION_EXTERNAL_BINDING_ACTIVE');
        expect(() => readFileSync(outputPath, 'utf8')).toThrow();
      } finally {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    }
  );

  it('removes core and protected-capability candidates before review', async () => {
    for (const candidate of [
      { ...fixture.candidates[0], lifecycleState: 'core_permanent' },
      {
        ...fixture.candidates[0],
        capabilityRefs: ['six-model-state-machine'],
      },
    ]) {
      await expect(authorizeDeletionBatch({ candidates: [candidate], policy })).rejects.toThrow(
        'CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW'
      );
    }
  });

  it('invokes one local review and never retries or converges', async () => {
    const invoke = vi.fn().mockResolvedValue({
      verdict: 'retain_on_demand',
      candidateIdentityKeys: ['vitest::tests/ambiguous.test.ts'],
    });
    const result = await reviewAmbiguousCandidatesOnce({
      candidates: [
        {
          identityKey: 'vitest::tests/ambiguous.test.ts',
          reasonCode: 'AMBIGUOUS_TARGET',
        },
      ],
      invoke,
      timeoutMs: 120000,
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.verdict).toBe('retain_on_demand');
  });

  it('fails closed to retain_on_demand for malformed local review output', async () => {
    const invoke = vi.fn().mockResolvedValue({
      verdict: 'approve_delete',
      candidateIdentityKeys: ['vitest::tests/different.test.ts'],
    });
    const result = await reviewAmbiguousCandidatesOnce({
      candidates: [{ identityKey: 'vitest::tests/ambiguous.test.ts' }],
      invoke,
      timeoutMs: 120000,
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.verdict).toBe('retain_on_demand');
  });

  it('invalidates authorization when identities or bindings drift', async () => {
    const authorization = await authorizeDeletionBatch({
      candidates: fixture.candidates,
      policy,
      invokeLocalModel: vi.fn().mockResolvedValue({
        verdict: 'approve_delete',
        candidateIdentityKeys: fixture.candidates.map((candidate) => candidate.identityKey),
      }),
    });

    for (const override of [
      { deletedIdentityKeys: ['vitest::tests/different.test.ts'] },
      { evidenceHash: 'sha256:drift' },
      { policyHash: 'sha256:drift' },
      { reviewMode: 'deterministic' },
      { reviewProfileVersion: 'test-portfolio-delete/v2' },
    ]) {
      expect(() =>
        verifyDeletionAuthorization({
          authorization,
          deletedIdentityKeys: authorization.candidateIdentityKeys,
          evidenceHash: authorization.evidenceHash,
          policyHash: authorization.policyHash,
          reviewMode: authorization.reviewMode,
          reviewProfileVersion: authorization.reviewProfileVersion,
          ...override,
        })
      ).toThrow('TEST_DELETION_AUTHORIZATION_DRIFT');
    }
  });

  it('keeps flakes outside ordinary deletion authority', async () => {
    await expect(
      authorizeDeletionBatch({
        candidates: [
          {
            ...fixture.candidates[0],
            quarantineStatus: 'observing',
            reasonCode: 'FLAKE_OBSERVED',
          },
        ],
        policy,
      })
    ).rejects.toThrow('FLAKE_NOT_DELETION_AUTHORITY');
  });

  it('rejects sparse candidate arrays with the governed issue code', async () => {
    const candidates = new Array(1);

    await expect(authorizeDeletionBatch({ candidates, policy })).rejects.toThrow(
      'TEST_DELETION_CANDIDATE_INVALID'
    );
  });

  it('generates a deterministic consolidation candidate and keeps raw obsolete evidence in review', () => {
    const result =
      deletionCandidateGenerator().generateTestDeletionCandidates(deletionCandidateInput());

    expect(result.candidates).toEqual([
      expect.objectContaining({
        identityKey: 'root-vitest#tests/source.test.ts',
        lifecycleState: 'deletion_candidate',
        reasonCode: 'REPLACED_BY_CONTRACT_TEST',
        replacementIdentityKey: 'root-vitest#tests/replacement.test.ts',
      }),
    ]);
    expect(result.localReviewCandidates).toEqual([
      expect.objectContaining({
        identityKey: 'root-vitest#tests/obsolete.test.ts',
        reasonCode: 'OBSOLETE_TARGET_REVIEW',
      }),
    ]);
    expect(result.summary).toMatchObject({
      deterministicCandidateCount: 1,
      localReviewCandidateCount: 1,
      rejectedCandidateCount: 0,
    });
  });

  it('rejects deterministic and local-review candidates still bound by external authority', () => {
    const generator = deletionCandidateGenerator();
    const generated = generator.generateTestDeletionCandidates(deletionCandidateInput());
    const result = generator.rejectExternallyBoundCandidates({
      artifact: generated,
      references: [
        {
          authorityKind: 'package_script_authority',
          authorityPath: 'package.json',
          testPath: 'tests/obsolete.test.ts',
        },
        {
          authorityKind: 'production_source',
          authorityPath: 'src/runtime-bindings.ts',
          testPath: 'tests/source.test.ts',
        },
      ],
    });

    expect(result.candidates).toEqual([]);
    expect(result.localReviewCandidates).toEqual([]);
    expect(result.rejectedCandidates).toEqual([
      {
        identityKey: 'root-vitest#tests/obsolete.test.ts',
        reasonCodes: ['EXTERNAL_AUTHORITY_BINDING_PRESENT'],
      },
      {
        identityKey: 'root-vitest#tests/source.test.ts',
        reasonCodes: ['EXTERNAL_AUTHORITY_BINDING_PRESENT'],
      },
    ]);
    expect(result.summary).toEqual({
      deterministicCandidateCount: 0,
      localReviewCandidateCount: 0,
      rejectedCandidateCount: 2,
    });
  });

  it('rejects core, impacted, protected, and unique-obligation providers', () => {
    const base = deletionCandidateInput();
    const sourceIdentityKey = (base as any).catalog.tests[0].identityKey;
    const protectedTest = {
      ...(base as any).catalog.tests[0],
      identityKey: 'root-vitest#tests/protected.test.ts',
      testPath: 'tests/protected.test.ts',
      capabilityRefs: ['six-model-state-machine'],
      lifecycleState: 'retained_on_demand',
    };
    const result = deletionCandidateGenerator().generateTestDeletionCandidates({
      ...base,
      catalog: {
        ...(base as any).catalog,
        tests: [...(base as any).catalog.tests, protectedTest],
      },
      coreFreeze: {
        ...(base as any).coreFreeze,
        selected: [{ identityKey: sourceIdentityKey, coveredObligationIds: ['obligation:core'] }],
        coverage: [
          {
            obligationId: 'obligation:unique',
            evidenceDiagnostics: [
              { identityKey: protectedTest.identityKey, eligibleForCoverage: true },
            ],
          },
        ],
      },
      impact: {
        ...(base as any).impact,
        changedTestIdentityKeys: ['root-vitest#tests/obsolete.test.ts'],
      },
      consolidationIntents: [
        ...(base as any).consolidationIntents,
        {
          sourceIdentityKey: protectedTest.identityKey,
          replacementIdentityKey: 'root-vitest#tests/replacement.test.ts',
          reasonCode: 'REPLACED_BY_CONTRACT_TEST',
        },
      ],
    });

    expect(result.candidates).toEqual([]);
    expect(result.localReviewCandidates).toEqual([]);
    expect(result.rejectedCandidates.map((entry: any) => entry.reasonCodes)).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['CORE_SELECTED']),
        expect.arrayContaining(['CHANGED_CODE_IMPACTED']),
        expect.arrayContaining(['PROTECTED_CAPABILITY_BOUND']),
        expect.arrayContaining(['UNIQUE_OBLIGATION_PROVIDER']),
      ])
    );
  });

  it('keeps the sole eligibleForCoverage obligation provider out of deletion candidates', () => {
    const input = deletionCandidateInput();
    const obsolete = (input as any).catalog.tests[2];
    const source = (input as any).catalog.tests[0];
    (input as any).coreFreeze.coverage = [
      {
        obligationId: 'obligation:unique',
        evidenceDiagnostics: [
          { identityKey: obsolete.identityKey, eligibleForCoverage: true },
          { identityKey: source.identityKey, eligibleForCoverage: false },
        ],
      },
    ];

    const result = deletionCandidateGenerator().generateTestDeletionCandidates(input);

    expect(result.localReviewCandidates).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ identityKey: obsolete.identityKey })])
    );
    expect(result.rejectedCandidates).toContainEqual({
      identityKey: obsolete.identityKey,
      reasonCodes: ['UNIQUE_OBLIGATION_PROVIDER'],
    });
  });

  it('fails closed when a consolidation replacement loses capability or failure-mode coverage', () => {
    const input = deletionCandidateInput();
    const replacement = (input as any).catalog.tests[1];
    replacement.capabilityRefs = [];

    expect(() => deletionCandidateGenerator().generateTestDeletionCandidates(input)).toThrow(
      'TEST_DELETION_REPLACEMENT_COVERAGE_LOSS'
    );
  });

  it('fails closed before producing reviewable candidates without post-delete validation', () => {
    expect(() =>
      deletionCandidateGenerator().generateTestDeletionCandidates(
        deletionCandidateInput({ validationCommands: [] })
      )
    ).toThrow('TEST_DELETION_VALIDATION_MISSING');
  });

  it('is byte-stable when catalog, impact, and intent order changes', () => {
    const { canonicalJsonBytes } = require('../../tools/test-portfolio-audit/canonical.cjs');
    const input = deletionCandidateInput();
    const first = deletionCandidateGenerator().generateTestDeletionCandidates(input);
    const second = deletionCandidateGenerator().generateTestDeletionCandidates({
      ...input,
      catalog: {
        ...(input as any).catalog,
        tests: [...(input as any).catalog.tests].reverse(),
      },
      impact: {
        ...(input as any).impact,
        changedTestIdentityKeys: [...(input as any).impact.changedTestIdentityKeys].reverse(),
        pathBindings: [...(input as any).impact.pathBindings].reverse(),
      },
      consolidationIntents: [...(input as any).consolidationIntents].reverse(),
    });

    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
  });
});
