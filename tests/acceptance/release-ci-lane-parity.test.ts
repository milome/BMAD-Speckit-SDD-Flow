import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

const require = createRequire(import.meta.url);
const {
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

describe('release evidence parity', () => {
  it('requires exact immutable evidence and release coverage that contains PR selection', () => {
    const release = evidence({
      profile: 'release-full',
      requiredLaneIdentities: ['core/core-01', 'feature/feature-01', 'feature/feature-02'],
      selectedTestIdentities: [
        'vitest::tests/core.test.ts',
        'vitest::tests/feature.test.ts',
        'vitest::tests/release.test.ts',
      ],
    });
    const catalog = catalogEvidence(release.selectedTestIdentities as string[]);

    expect(verifyReleaseEvidenceParity(evidence(), release, catalog)).toMatchObject({
      qualifyingSelectedCount: 2,
      releaseSelectedCount: 3,
    });

    for (const [field, value] of [
      ['commitSha', 'b'.repeat(40)],
      ['catalogHash', `sha256:${'5'.repeat(64)}`],
      ['policyHash', `sha256:${'6'.repeat(64)}`],
      ['packageDescriptorHash', `sha256:${'7'.repeat(64)}`],
      ['tarballSha256', `sha256:${'8'.repeat(64)}`],
    ] as const) {
      expect(() =>
        verifyReleaseEvidenceParity(evidence(), { ...release, [field]: value }, catalog)
      ).toThrow('RELEASE_EVIDENCE_PARITY_MISMATCH');
    }
  });

  it('rejects release evidence that misses PR tests or canonical catalog tests', () => {
    const release = evidence({
      profile: 'release-full',
      selectedTestIdentities: ['vitest::tests/core.test.ts', 'vitest::tests/release.test.ts'],
    });
    const catalog = catalogEvidence(release.selectedTestIdentities as string[]);

    expect(() => verifyReleaseEvidenceParity(evidence(), release, catalog)).toThrow(
      'RELEASE_EVIDENCE_PR_NOT_CONTAINED'
    );
    expect(() =>
      verifyReleaseEvidenceParity(
        evidence({ selectedTestIdentities: ['vitest::tests/core.test.ts'] }),
        release,
        catalogEvidence([
          'vitest::tests/core.test.ts',
          'vitest::tests/feature.test.ts',
          'vitest::tests/release.test.ts',
        ])
      )
    ).toThrow('RELEASE_EVIDENCE_CATALOG_MISMATCH');
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
          '--release-evidence',
          releaseEvidencePath,
          '--catalog',
          join(root, 'missing-catalog.json'),
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
      '--release-evidence',
      releaseEvidencePath,
      '--catalog',
      join(root, 'missing-catalog.json'),
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

    expect(result.independentPublishAuthorityCount).toBe(0);
    expect(result.independentPackAuthorityCount).toBe(0);
    expect(result.runtimeMismatchCount).toBe(0);
    expect(result.evidencePathDistinct).toBe(true);
    expect(Object.keys(triggers).sort()).toEqual(['workflow_call', 'workflow_dispatch']);
    expect(
      releaseWorkflow.jobs.release.steps.map((step: any) => String(step.run || '')).join('\n')
    ).toContain('npm install --global npm@10.9.4');
    expect(
      releaseWorkflow.jobs.release.steps.map((step: any) => String(step.run || '')).join('\n')
    ).toContain(
      'npm run ci:release-full -- --commit-sha "$CI_COMMIT_SHA" --changed-paths .artifacts/qualifying/plan/changed-paths.json'
    );
    expect(
      releaseWorkflow.jobs.release.steps.map((step: any) => String(step.run || '')).join('\n')
    ).toContain('--catalog .artifacts/test-portfolio/test-catalog.json');
  });

  it('grants the reusable publish caller the permissions required by release authority', () => {
    const publishWorkflow = load(readFileSync('.github/workflows/publish-npm.yml', 'utf8')) as any;

    expect(publishWorkflow.permissions).toEqual({
      actions: 'read',
      contents: 'write',
      'id-token': 'write',
    });
  });

  it('keeps the checkout pristine until governed release-full package preparation', () => {
    const releaseWorkflow = load(
      readFileSync('.github/workflows/release.yml', 'utf8')
    ) as any;
    const steps = releaseWorkflow.jobs.release.steps;
    const releaseFullIndex = steps.findIndex((step: any) =>
      String(step.run || '').includes('npm run ci:release-full')
    );
    const preReleaseFullCommands = steps
      .slice(0, releaseFullIndex)
      .map((step: any) => String(step.run || ''))
      .join('\n');

    expect(releaseFullIndex).toBeGreaterThanOrEqual(0);
    expect(preReleaseFullCommands).not.toContain('npm run build');
  });

  it('rejects release parity that compares one evidence file with itself', () => {
    const releaseSource = readFileSync('.github/workflows/release.yml', 'utf8');
    const publishSource = readFileSync('.github/workflows/publish-npm.yml', 'utf8');
    const selfComparison = releaseSource.replace(
      /--release-evidence\s+\S+/u,
      '--release-evidence .artifacts/qualifying/final/ci-run-manifest.json'
    );

    expect(() =>
      verifyReleaseWorkflowAuthority({
        releaseSource: selfComparison,
        publishSource,
      })
    ).toThrow('RELEASE_EVIDENCE_SELF_COMPARISON');
  });

  it('rejects release authority that does not produce fresh release-full evidence', () => {
    const releaseSource = readFileSync('.github/workflows/release.yml', 'utf8');
    const publishSource = readFileSync('.github/workflows/publish-npm.yml', 'utf8');
    const withoutReleaseVerification = releaseSource.replace(
      /^\s+- name: Run fresh release-full[\s\S]*?^\s+- name: Verify exact evidence/mu,
      '      - name: Verify exact evidence'
    );

    expect(() =>
      verifyReleaseWorkflowAuthority({
        releaseSource: withoutReleaseVerification,
        publishSource,
      })
    ).toThrow('RELEASE_VERIFICATION_RUN_REQUIRED');
  });
});
