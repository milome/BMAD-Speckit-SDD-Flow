import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

const require = createRequire(import.meta.url);
const {
  catalogTestIdentities,
  main,
  verifyReleaseEvidenceParity,
  verifyReleaseWorkflowAuthority,
} = require('../../tools/ci/verify-release-evidence-parity.cjs');

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    commitSha: 'a'.repeat(40),
    catalogHash: `sha256:${'1'.repeat(64)}`,
    policyHash: `sha256:${'2'.repeat(64)}`,
    packageDescriptorHash: `sha256:${'3'.repeat(64)}`,
    profile: 'pr-fast',
    tarballSha256: `sha256:${'4'.repeat(64)}`,
    requiredLaneIdentities: ['core/core-01', 'feature/feature-01'],
    selectedTestIdentities: ['vitest::tests/core.test.ts', 'vitest::tests/feature.test.ts'],
    ...overrides,
  };
}

function catalogEvidence(testIdentities: string[]) {
  return {
    catalogHash: evidence().catalogHash,
    testIdentities,
  };
}

function packageEvidence(overrides: Record<string, unknown> = {}) {
  return {
    commitSha: evidence().commitSha,
    packageDescriptorHash: evidence().packageDescriptorHash,
    tarballSha256: evidence().tarballSha256,
    ...overrides,
  };
}

describe('release evidence parity', () => {
  it('uses executable identities when projecting catalog evidence', () => {
    expect(
      catalogTestIdentities({
        tests: [
          { identityKey: 'root-vitest#test-a', executableIdentity: 'vitest::test-a' },
          { identityKey: 'root-vitest#test-b', executableIdentity: 'vitest::test-b' },
        ],
      })
    ).toEqual(['vitest::test-a', 'vitest::test-b']);
    expect(() => catalogTestIdentities({ tests: [{ identityKey: 'root-vitest#test-a' }] })).toThrow(
      'RELEASE_CATALOG_EVIDENCE_INVALID'
    );
  });

  it.each(['nightly-full', 'release-full'])(
    'accepts exact immutable %s evidence that contains PR selection',
    (profile) => {
      const fullSuite = evidence({
        profile,
        requiredLaneIdentities: ['core/core-01', 'feature/feature-01', 'feature/feature-02'],
        selectedTestIdentities: [
          'vitest::tests/core.test.ts',
          'vitest::tests/feature.test.ts',
          'vitest::tests/release.test.ts',
        ],
      });
      const catalog = catalogEvidence(fullSuite.selectedTestIdentities as string[]);

      expect(
        verifyReleaseEvidenceParity(evidence(), fullSuite, catalog, packageEvidence())
      ).toMatchObject({
        qualifyingSelectedCount: 2,
        fullSuiteProfile: profile,
        fullSuiteSelectedCount: 3,
      });
    }
  );

  it('accepts event-context catalog drift when full-suite catalog is internally consistent', () => {
    const fullSuite = evidence({
      profile: 'nightly-full',
      catalogHash: `sha256:${'5'.repeat(64)}`,
      requiredLaneIdentities: ['core/core-01', 'feature/feature-01', 'feature/feature-02'],
      selectedTestIdentities: [
        'vitest::tests/core.test.ts',
        'vitest::tests/feature.test.ts',
        'vitest::tests/release.test.ts',
      ],
    });
    const catalog = {
      ...catalogEvidence(fullSuite.selectedTestIdentities as string[]),
      catalogHash: fullSuite.catalogHash,
    };

    expect(
      verifyReleaseEvidenceParity(evidence(), fullSuite, catalog, packageEvidence())
    ).toMatchObject({
      catalogHash: fullSuite.catalogHash,
      fullSuiteProfile: 'nightly-full',
    });
    expect(() =>
      verifyReleaseEvidenceParity(
        evidence(),
        fullSuite,
        { ...catalog, catalogHash: `sha256:${'6'.repeat(64)}` },
        packageEvidence()
      )
    ).toThrow('RELEASE_CATALOG_EVIDENCE_PARITY_MISMATCH');
  });

  it('requires exact PR, full-suite, and regenerated package parity', () => {
    const fullSuite = evidence({
      profile: 'release-full',
      requiredLaneIdentities: ['core/core-01', 'feature/feature-01', 'feature/feature-02'],
      selectedTestIdentities: [
        'vitest::tests/core.test.ts',
        'vitest::tests/feature.test.ts',
        'vitest::tests/release.test.ts',
      ],
    });
    const catalog = catalogEvidence(fullSuite.selectedTestIdentities as string[]);

    for (const [field, value] of [
      ['commitSha', 'b'.repeat(40)],
      ['policyHash', `sha256:${'6'.repeat(64)}`],
      ['packageDescriptorHash', `sha256:${'7'.repeat(64)}`],
      ['tarballSha256', `sha256:${'8'.repeat(64)}`],
    ] as const) {
      expect(() =>
        verifyReleaseEvidenceParity(
          evidence(),
          { ...fullSuite, [field]: value },
          catalog,
          packageEvidence()
        )
      ).toThrow('RELEASE_EVIDENCE_PARITY_MISMATCH');
    }

    for (const [field, value] of [
      ['commitSha', 'b'.repeat(40)],
      ['packageDescriptorHash', `sha256:${'7'.repeat(64)}`],
      ['tarballSha256', `sha256:${'8'.repeat(64)}`],
    ] as const) {
      expect(() =>
        verifyReleaseEvidenceParity(
          evidence(),
          fullSuite,
          catalog,
          packageEvidence({ [field]: value })
        )
      ).toThrow('RELEASE_PACKAGE_EVIDENCE_PARITY_MISMATCH');
    }
  });

  it('rejects release evidence that misses PR tests or canonical catalog tests', () => {
    const release = evidence({
      profile: 'release-full',
      selectedTestIdentities: ['vitest::tests/core.test.ts', 'vitest::tests/release.test.ts'],
    });
    const catalog = catalogEvidence(release.selectedTestIdentities as string[]);

    expect(() =>
      verifyReleaseEvidenceParity(evidence(), release, catalog, packageEvidence())
    ).toThrow('RELEASE_EVIDENCE_PR_NOT_CONTAINED');
    expect(() =>
      verifyReleaseEvidenceParity(
        evidence({ selectedTestIdentities: ['vitest::tests/core.test.ts'] }),
        release,
        catalogEvidence([
          'vitest::tests/core.test.ts',
          'vitest::tests/feature.test.ts',
          'vitest::tests/release.test.ts',
        ]),
        packageEvidence()
      )
    ).toThrow('RELEASE_EVIDENCE_CATALOG_MISMATCH');
  });

  it('rejects a partial profile as full-suite evidence', () => {
    expect(() =>
      verifyReleaseEvidenceParity(
        evidence(),
        evidence(),
        catalogEvidence(evidence().selectedTestIdentities as string[]),
        packageEvidence()
      )
    ).toThrow('RELEASE_VERIFICATION_PROFILE_INVALID');
  });

  it('rejects an incomplete release run manifest before reading catalog evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'release-evidence-parity-'));
    const prEvidencePath = join(root, 'pr-evidence.json');
    const releaseEvidencePath = join(root, 'release-evidence.json');
    try {
      writeFileSync(
        prEvidencePath,
        JSON.stringify({ schemaVersion: 'ci-run-manifest/v1', status: 'complete' }),
        'utf8'
      );
      writeFileSync(
        releaseEvidencePath,
        JSON.stringify({ schemaVersion: 'ci-run-manifest/v1', status: 'planned' }),
        'utf8'
      );

      expect(() =>
        main([
          '--pr-evidence',
          prEvidencePath,
          '--full-suite-evidence',
          releaseEvidencePath,
          '--catalog',
          join(root, 'missing-catalog.json'),
          '--package-descriptor',
          join(root, 'missing-package.json'),
        ])
      ).toThrow('RELEASE_VERIFICATION_EVIDENCE_INCOMPLETE');
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('requires production evidence inputs to be CI run manifests', () => {
    const root = mkdtempSync(join(tmpdir(), 'release-evidence-schema-'));
    const prEvidencePath = join(root, 'pr-evidence.json');
    const releaseEvidencePath = join(root, 'release-evidence.json');
    const args = [
      '--pr-evidence',
      prEvidencePath,
      '--full-suite-evidence',
      releaseEvidencePath,
      '--catalog',
      join(root, 'missing-catalog.json'),
      '--package-descriptor',
      join(root, 'missing-package.json'),
    ];
    try {
      writeFileSync(prEvidencePath, JSON.stringify(evidence()), 'utf8');
      writeFileSync(releaseEvidencePath, JSON.stringify(evidence()), 'utf8');
      expect(() => main(args)).toThrow('RELEASE_QUALIFYING_MANIFEST_REQUIRED');

      writeFileSync(
        prEvidencePath,
        JSON.stringify({ schemaVersion: 'ci-run-manifest/v1', status: 'complete' }),
        'utf8'
      );
      expect(() => main(args)).toThrow('RELEASE_VERIFICATION_MANIFEST_REQUIRED');
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('uses one reusable release authority and no independent publish implementation', () => {
    const releaseSource = readFileSync('.github/workflows/release.yml', 'utf8');
    const result = verifyReleaseWorkflowAuthority({
      releaseSource,
      publishSource: readFileSync('.github/workflows/publish-npm.yml', 'utf8'),
    });
    const releaseWorkflow = load(releaseSource) as any;
    const triggers = releaseWorkflow.on || releaseWorkflow.true;
    const fallback = releaseWorkflow.jobs['release-full-fallback'];
    const releaseSteps = releaseWorkflow.jobs.release.steps;
    const reuseDownloads = releaseSteps.filter((step: any) =>
      String(step.name || '').startsWith('Reuse exact full-suite')
    );
    const fallbackDownloads = releaseSteps.filter((step: any) =>
      String(step.name || '').startsWith('Download matrix fallback')
    );
    const provenanceChecks = releaseSteps.filter(
      (step: any) => step.uses === 'actions/github-script@v7'
    );

    expect(result.independentPublishAuthorityCount).toBe(0);
    expect(result.independentPackAuthorityCount).toBe(0);
    expect(result.runtimeMismatchCount).toBe(0);
    expect(result.evidencePathDistinct).toBe(true);
    expect(result.releaseFullFallbackCount).toBe(1);
    expect(result.releaseCancellationGuardCount).toBe(1);
    expect(result.fullSuiteRunProvenanceCheckCount).toBe(1);
    expect(result.serialReleaseFullRunCount).toBe(0);
    expect(result.packagePreparationRunCount).toBe(1);
    expect(Object.keys(triggers).sort()).toEqual(['workflow_call', 'workflow_dispatch']);
    expect(fallback.if).toBe("${{ inputs.full_suite_run_id == '' }}");
    expect(fallback.uses).toBe('./.github/workflows/ci.yml');
    expect(fallback.with).toMatchObject({
      requested_profile: 'release-full',
      commit_sha: '${{ inputs.commit_sha }}',
    });
    expect(releaseWorkflow.jobs.release.if).toContain('!cancelled()');
    expect(releaseWorkflow.jobs.release.if).not.toContain('always()');
    expect(provenanceChecks).toHaveLength(1);
    expect(provenanceChecks[0].with.script).toContain("run.conclusion !== 'success'");
    expect(provenanceChecks[0].with.script).toContain('run.head_sha');
    expect(provenanceChecks[0].with.script).toContain(
      "workflow.path !== '.github/workflows/ci.yml'"
    );
    expect(reuseDownloads).toHaveLength(2);
    expect(
      reuseDownloads.every((step: any) => step.with['run-id'] === '${{ inputs.full_suite_run_id }}')
    ).toBe(true);
    expect(fallbackDownloads).toHaveLength(2);
    expect(fallbackDownloads.every((step: any) => step.with['run-id'] === undefined)).toBe(true);
    expect(
      releaseSteps.some((step: any) => String(step.name || '').includes('qualifying PR plan'))
    ).toBe(false);
    expect(
      releaseWorkflow.jobs.release.steps.map((step: any) => String(step.run || '')).join('\n')
    ).toContain('--catalog .artifacts/test-portfolio/full-suite/plan/test-catalog.json');
  });

  it('grants the reusable publish caller the permissions required by release authority', () => {
    const publishWorkflow = load(readFileSync('.github/workflows/publish-npm.yml', 'utf8')) as any;

    expect(publishWorkflow.permissions).toEqual({
      actions: 'read',
      contents: 'write',
      'id-token': 'write',
    });
    expect(publishWorkflow.jobs.publish.with.full_suite_run_id).toBe(
      '${{ inputs.full_suite_run_id }}'
    );
  });

  it('uses OIDC trusted publishing without an npm token secret', () => {
    const releaseWorkflow = load(readFileSync('.github/workflows/release.yml', 'utf8')) as any;
    const publishWorkflow = load(readFileSync('.github/workflows/publish-npm.yml', 'utf8')) as any;
    const triggers = releaseWorkflow.on || releaseWorkflow.true;
    const releaseCommands = releaseWorkflow.jobs.release.steps
      .map((step: any) => String(step.run || ''))
      .join('\n');

    expect(releaseCommands).toContain('npm install --global npm@11.6.2');
    expect(releaseWorkflow.jobs.release.env).not.toHaveProperty('NODE_AUTH_TOKEN');
    expect(triggers.workflow_call.secrets).toBeUndefined();
    expect(publishWorkflow.jobs.publish.secrets).toBeUndefined();
    expect(publishWorkflow.permissions['id-token']).toBe('write');
  });

  it('installs without lifecycle side effects before canonical package preparation', () => {
    const releaseWorkflow = load(readFileSync('.github/workflows/release.yml', 'utf8')) as any;
    const steps = releaseWorkflow.jobs.release.steps;
    const filemodeIndex = steps.findIndex(
      (step: any) => String(step.run || '') === 'git config core.filemode false'
    );
    const installIndex = steps.findIndex(
      (step: any) => String(step.run || '') === 'npm ci --ignore-scripts'
    );
    const packagePreparationIndex = steps.findIndex((step: any) =>
      String(step.run || '').includes('npm run ci:prepare-package')
    );
    const prePackageCommands = steps
      .slice(0, packagePreparationIndex)
      .map((step: any) => String(step.run || ''))
      .join('\n');

    expect(filemodeIndex).toBeGreaterThanOrEqual(0);
    expect(installIndex).toBeGreaterThanOrEqual(0);
    expect(packagePreparationIndex).toBeGreaterThanOrEqual(0);
    expect(filemodeIndex).toBeLessThan(installIndex);
    expect(packagePreparationIndex).toBeGreaterThan(installIndex);
    expect(prePackageCommands).not.toContain('npm run build');
    expect(steps.map((step: any) => String(step.run || '')).join('\n')).not.toContain(
      'npm run ci:release-full'
    );
  });

  it('builds release gate runtime only after package reproducibility is verified', () => {
    const releaseWorkflow = load(readFileSync('.github/workflows/release.yml', 'utf8')) as any;
    const steps = releaseWorkflow.jobs.release.steps;
    const packagePreparationIndex = steps.findIndex((step: any) =>
      String(step.run || '').includes('npm run ci:prepare-package')
    );
    const descriptorVerificationIndex = steps.findIndex((step: any) =>
      String(step.run || '').includes('prepublish-check.js --verify-descriptor')
    );
    const buildIndex = steps.findIndex((step: any) => String(step.run || '') === 'npm run build');
    const releaseGatesIndex = steps.findIndex((step: any) =>
      String(step.name || '').includes('protected release gates')
    );

    expect(buildIndex).toBeGreaterThan(descriptorVerificationIndex);
    expect(buildIndex).toBeGreaterThan(packagePreparationIndex);
    expect(buildIndex).toBeLessThan(releaseGatesIndex);
    expect(steps.filter((step: any) => String(step.run || '') === 'npm run build')).toHaveLength(1);
  });

  it('rejects release parity that compares one evidence file with itself', () => {
    const releaseSource = readFileSync('.github/workflows/release.yml', 'utf8');
    const publishSource = readFileSync('.github/workflows/publish-npm.yml', 'utf8');
    const selfComparison = releaseSource.replace(
      /--full-suite-evidence\s+\S+/u,
      '--full-suite-evidence .artifacts/qualifying/final/ci-run-manifest.json'
    );

    expect(() =>
      verifyReleaseWorkflowAuthority({
        releaseSource: selfComparison,
        publishSource,
      })
    ).toThrow('RELEASE_EVIDENCE_SELF_COMPARISON');
  });

  it('rejects release authority without a reusable matrix fallback', () => {
    const releaseSource = readFileSync('.github/workflows/release.yml', 'utf8');
    const publishSource = readFileSync('.github/workflows/publish-npm.yml', 'utf8');
    const withoutReleaseFallback = releaseSource.replace(
      /^(?:[ ]{2})release-full-fallback:[\s\S]*?^(?:[ ]{2})release:/mu,
      '  release:'
    );

    expect(() =>
      verifyReleaseWorkflowAuthority({
        releaseSource: withoutReleaseFallback,
        publishSource,
      })
    ).toThrow('RELEASE_VERIFICATION_RUN_REQUIRED');
  });

  it('rejects release authority without cancellation and run provenance guards', () => {
    const releaseSource = readFileSync('.github/workflows/release.yml', 'utf8');
    const publishSource = readFileSync('.github/workflows/publish-npm.yml', 'utf8');
    const unsafeCancellation = releaseSource.replace('!cancelled()', 'always()');
    const withoutProvenance = releaseSource.replace(
      'uses: actions/github-script@v7',
      'uses: actions/github-script@v6'
    );

    expect(() =>
      verifyReleaseWorkflowAuthority({
        releaseSource: unsafeCancellation,
        publishSource,
      })
    ).toThrow('RELEASE_VERIFICATION_RUN_REQUIRED');
    expect(() =>
      verifyReleaseWorkflowAuthority({
        releaseSource: withoutProvenance,
        publishSource,
      })
    ).toThrow('RELEASE_VERIFICATION_RUN_REQUIRED');
  });
});
