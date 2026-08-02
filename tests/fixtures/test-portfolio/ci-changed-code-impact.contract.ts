import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const temporaryRoots: string[] = [];

type MutableRecord = Record<string, unknown>;
type CatalogTestRecord = MutableRecord & {
  identityKey: string;
  testPath: string;
  targetRefs: string[];
  traceRefs: string[];
  capabilityRefs: string[];
  featureRefs: string[];
  packageId: string;
  classifications?: MutableRecord;
};
type CatalogFixture = MutableRecord & { tests: CatalogTestRecord[] };
type PolicyFixture = MutableRecord & {
  protectedCapabilities: MutableRecord[];
  semanticEvidenceBindings: unknown[];
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function git(root: string, ...args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), 'committed-impact-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src/internal.ts'), 'export const value = 1;\n', 'utf8');
  writeFileSync(join(root, 'src/public.ts'), "export { value } from './internal.js';\n", 'utf8');
  git(root, 'init');
  git(root, 'config', 'user.email', 'ci@example.invalid');
  git(root, 'config', 'user.name', 'CI Test');
  git(root, 'add', 'src/internal.ts', 'src/public.ts');
  git(root, 'commit', '-m', 'baseline');
  const baseSha = git(root, 'rev-parse', 'HEAD');
  return { root, baseSha };
}

function catalog(): CatalogFixture {
  return {
    tests: [
      {
        identityKey: 'vitest#tests/public.test.ts',
        testPath: 'tests/public.test.ts',
        targetRefs: ['src/public.ts'],
        traceRefs: ['trace:public-api'],
        capabilityRefs: ['capability:public-api'],
        featureRefs: [],
        packageId: 'root',
      },
      {
        identityKey: 'vitest#tests/unrelated.test.ts',
        testPath: 'tests/unrelated.test.ts',
        targetRefs: ['src/unrelated.ts'],
        traceRefs: ['trace:unrelated'],
        capabilityRefs: ['capability:unrelated'],
        featureRefs: [],
        packageId: 'root',
      },
    ],
  };
}

function facts(): MutableRecord {
  return {
    sourceIndex: {
      productionEdges: [
        {
          from: 'src/public.ts',
          to: 'src/internal.ts',
          evidenceRef: 'source:src/public.ts#import:./internal.js',
        },
      ],
    },
  };
}

function policy(): PolicyFixture {
  const fixturePolicy = JSON.parse(
    readFileSync(join(process.cwd(), 'repo-governance/ci/test-policy.json'), 'utf8')
  ) as PolicyFixture;
  fixturePolicy.semanticEvidenceBindings = [];
  for (const capability of fixturePolicy.protectedCapabilities) {
    delete capability.semanticEvidenceNamespace;
  }
  return fixturePolicy;
}

function authorityBound(
  commitSha: string,
  catalogValue: CatalogFixture = catalog(),
  factsValue: MutableRecord = facts(),
  policyValue: PolicyFixture = policy()
) {
  factsValue.schemaVersion = 'test-portfolio-audit-facts/v1';
  factsValue.repository = { commit: commitSha, dirty: false };
  catalogValue.tests = catalogValue.tests.map((test: CatalogTestRecord) => {
    const targetRefs = [...new Set(test.targetRefs)].sort((left, right) =>
      left.localeCompare(right, 'en')
    );
    const behaviorEvidence = Object.fromEntries(
      targetRefs.map((targetRef: string) => [`target:${targetRef}`, 'direct'])
    );
    return {
      runnerId: 'vitest',
      executableIdentity: `vitest::${test.testPath}`,
      failureModeRefs: [],
      selectionRefs: [],
      fixtureRefs: [],
      lifecycleState: 'retained_on_demand',
      releaseGateMembership: 'none',
      durationSummary: {},
      evidenceRefs: [],
      ...test,
      targetRefs,
      behaviorEvidence,
      behaviorOracleAuthority: {},
      classifications: {
        ...test.classifications,
        protectedCapabilityRefs: [],
      },
    };
  });
  const testPaths = catalogValue.tests.map((test: CatalogTestRecord) => test.testPath).sort();
  factsValue.inventory = {
    tests: catalogValue.tests.map((test: CatalogTestRecord) => ({
      identityKey: test.identityKey,
      runnerId: test.runnerId,
      testPath: test.testPath,
      executableIdentity: test.executableIdentity,
      evidenceRefs: [],
    })),
  };
  factsValue.discovery = {
    complete: true,
    runnerResolved: testPaths,
    candidates: testPaths,
    runnerResolvedCount: testPaths.length,
    candidateCount: testPaths.length,
    unexplainedRunnerOnlyCount: 0,
    unexplainedCandidateOnlyCount: 0,
    unexplainedRunnerOnly: [],
    unexplainedCandidateOnly: [],
  };
  factsValue.analyzerResults = [
    {
      analyzerId: 'target-validity',
      dimension: 'targetValidity',
      status: 'COMPLETE',
      findings: catalogValue.tests.flatMap((test: CatalogTestRecord) =>
        test.targetRefs.map((targetRef: string) => ({
          identityKey: test.identityKey,
          targetRef,
          value: 'active',
          confidence: 'high',
          evidenceRefs: [`source:${targetRef}`],
          issueCodes: [],
        }))
      ),
      issues: [],
    },
  ];
  const {
    catalogFactsHash,
    catalogPolicyHash,
  } = require('../../../tools/ci/generate-test-catalog.cjs');
  catalogValue.schemaVersion = 'test-catalog/v1';
  catalogValue.repository = { commit: commitSha, dirty: false };
  catalogValue.policyHash = catalogPolicyHash(policyValue);
  catalogValue.factsHash = catalogFactsHash(factsValue);
  catalogValue.generatedPath = '.artifacts/test-portfolio/test-catalog.json';
  catalogValue.gates = {
    catalogIdentityDuplicateCount: 0,
    unexplainedRunnerOnlyCount: 0,
    unexplainedCandidateOnlyCount: 0,
    unclassifiedTestCount: 0,
    protectedCapabilityWithoutCoreTestCount: 0,
    executableTestCount: catalogValue.tests.length,
    executableTestBudget: 1200,
    executableBudgetStatus: 'within_budget',
    corePermanentCount: 0,
    reconciliationErrorCount: 0,
  };
  return { catalog: catalogValue, facts: factsValue, policy: policyValue };
}

describe('committed changed-code impact graph', () => {
  it('requires complete canonical Catalog and Facts provenance', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/public.ts'), 'export const publicValue = 2;\n', 'utf8');
    git(root, 'add', 'src/public.ts');
    git(root, 'commit', '-m', 'change public');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const authority = authorityBound(commitSha);
    delete authority.facts.schemaVersion;
    const { catalogFactsHash } = require('../../../tools/ci/generate-test-catalog.cjs');
    authority.catalog.factsHash = catalogFactsHash(authority.facts);

    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('IMPACT_FACTS_SCHEMA_INVALID');
  });

  it('rejects a self-consistent Catalog with incomplete schema authority', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/public.ts'), 'export const publicValue = 2;\n', 'utf8');
    git(root, 'add', 'src/public.ts');
    git(root, 'commit', '-m', 'change public');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const authority = authorityBound(commitSha);
    delete authority.catalog.generatedPath;
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('CATALOG_SCHEMA_INVALID');
  });

  it('rejects self-consistent Facts without complete Catalog authority inputs', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/public.ts'), 'export const publicValue = 2;\n', 'utf8');
    git(root, 'add', 'src/public.ts');
    git(root, 'commit', '-m', 'change public');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const authority = authorityBound(commitSha);
    delete authority.facts.inventory;
    const { catalogFactsHash } = require('../../../tools/ci/generate-test-catalog.cjs');
    authority.catalog.factsHash = catalogFactsHash(authority.facts);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('IMPACT_CATALOG_AUTHORITY_MISMATCH');
  });

  it('rejects a Catalog bound to a different policy hash', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/public.ts'), 'export const publicValue = 2;\n', 'utf8');
    git(root, 'add', 'src/public.ts');
    git(root, 'commit', '-m', 'change public');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const authority = authorityBound(commitSha);
    authority.catalog.policyHash = `sha256:${'0'.repeat(64)}`;
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('IMPACT_CATALOG_POLICY_HASH_MISMATCH');
  });

  it('derives direct target impact from the committed diff without root-wide expansion', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/public.ts'), 'export const publicValue = 2;\n', 'utf8');
    git(root, 'add', 'src/public.ts');
    git(root, 'commit', '-m', 'change public');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const authority = authorityBound(commitSha);

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.changedPaths).toEqual(['src/public.ts']);
    expect(impact.pathBindings[0]).toMatchObject({
      changedPath: 'src/public.ts',
      traceRefs: ['trace:public-api'],
      capabilityRefs: ['capability:public-api'],
      packageIds: [],
      testIdentityRefs: ['vitest#tests/public.test.ts'],
    });
    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
  });

  it('reports unavailable optional canonical sources without blocking mapped impact', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/public.ts'), 'export const publicValue = 2;\n', 'utf8');
    git(root, 'add', 'src/public.ts');
    git(root, 'commit', '-m', 'change public');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const authority = authorityBound(commitSha);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
    expect(impact.sourceAvailability).toEqual({
      historicalExecutionBindings: 'unavailable',
      observedExecutionBindings: 'unavailable',
      registryBindingRecords: 'unavailable',
    });
    expect(impact.sourceDiagnostics).toEqual([
      'IMPACT_SOURCE_UNAVAILABLE:historicalExecutionBindings',
      'IMPACT_SOURCE_UNAVAILABLE:observedExecutionBindings',
      'IMPACT_SOURCE_UNAVAILABLE:registryBindingRecords',
    ]);
  });

  it('fails closed for an unmapped root-level source file without selecting all root tests', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'root-tool.cjs'), "'use strict';\nmodule.exports = true;\n", 'utf8');
    git(root, 'add', 'root-tool.cjs');
    git(root, 'commit', '-m', 'add root tool');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const authority = authorityBound(commitSha, catalog(), {
      sourceIndex: { productionEdges: [] },
    });
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('IMPACT_BINDING_UNRESOLVED');
  });

  it('marks registered direct-node command targets as CLI command impact', () => {
    const { root } = createRepository();
    mkdirSync(join(root, 'tools/ci'), { recursive: true });
    writeFileSync(
      join(root, 'tools/ci/freeze-core-portfolio.cjs'),
      "'use strict';\nmodule.exports = { version: 1 };\n",
      'utf8'
    );
    git(root, 'add', 'tools/ci/freeze-core-portfolio.cjs');
    git(root, 'commit', '-m', 'add command target');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(
      join(root, 'tools/ci/freeze-core-portfolio.cjs'),
      "'use strict';\nmodule.exports = { version: 2 };\n",
      'utf8'
    );
    git(root, 'add', 'tools/ci/freeze-core-portfolio.cjs');
    git(root, 'commit', '-m', 'change command target');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const commandCatalog = catalog();
    commandCatalog.tests[0].targetRefs = ['tools/ci/freeze-core-portfolio.cjs'];
    const authority = authorityBound(commitSha, commandCatalog, {
      sourceIndex: { productionEdges: [] },
    });
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].bindingKinds).toEqual(
      expect.arrayContaining(['cli_command', 'direct_target'])
    );
  });

  it('maps the root npm lockfile to package consumer boundary tests', () => {
    const { bindingForPath } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const boundaryTest = {
      identityKey: 'vitest#tests/package-install.test.ts',
      testPath: 'tests/package-install.test.ts',
      fixtureRefs: [],
      targetRefs: [],
      traceRefs: ['trace:package-install'],
      capabilityRefs: ['consumer-install-boundary'],
      featureRefs: [],
      packageId: 'root-package',
      classifications: {
        criticalBindings: [{ kind: 'package_install' }],
      },
    };

    const binding = bindingForPath({
      changedPath: 'package-lock.json',
      tests: [boundaryTest],
      consumersByTarget: new Map(),
      facts: {
        sourceIndex: {
          packageRecords: [
            {
              packagePath: 'package.json',
              packageDirectory: '.',
              packageJson: { name: 'root-package' },
            },
          ],
        },
      },
    });

    expect(binding).toMatchObject({
      changedPath: 'package-lock.json',
      testIdentityRefs: ['vitest#tests/package-install.test.ts'],
      bindingKinds: ['public_consumer_boundary'],
    });
  });

  it('binds a committed fixture change to its executable owner', () => {
    const { root } = createRepository();
    const fixturePath = 'tests/fixtures/portfolio/input.json';
    mkdirSync(join(root, 'tests/fixtures/portfolio'), { recursive: true });
    writeFileSync(join(root, fixturePath), '{"version":1}\n', 'utf8');
    git(root, 'add', fixturePath);
    git(root, 'commit', '-m', 'fixture baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, fixturePath), '{"version":2}\n', 'utf8');
    git(root, 'add', fixturePath);
    git(root, 'commit', '-m', 'change fixture');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const fixtureCatalog = catalog();
    fixtureCatalog.tests[0].fixtureRefs = [fixturePath];
    const fixtureFacts = {
      sourceIndex: {
        productionEdges: [],
        testTargetRecords: [
          {
            testPath: fixtureCatalog.tests[0].testPath,
            targetPath: fixturePath,
          },
        ],
      },
    };
    const authority = authorityBound(commitSha, fixtureCatalog, fixtureFacts);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings).toEqual([
      expect.objectContaining({
        changedPath: fixturePath,
        testIdentityRefs: ['vitest#tests/public.test.ts'],
        bindingKinds: ['fixture_dependency'],
      }),
    ]);
    expect(impact.unmappedChangedProductPaths).toEqual([]);
  });

  it('walks reverse static imports to the nearest test target', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/internal.ts'), 'export const value = 2;\n', 'utf8');
    git(root, 'add', 'src/internal.ts');
    git(root, 'commit', '-m', 'change internal');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const authority = authorityBound(commitSha);

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
    expect(impact.pathBindings[0].bindingKinds).toContain('static_import');
  });

  it('distinguishes literal dynamic imports from static import evidence', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/internal.ts'), 'export const value = 2;\n', 'utf8');
    git(root, 'add', 'src/internal.ts');
    git(root, 'commit', '-m', 'change internal');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const dynamicFacts = facts();
    dynamicFacts.sourceIndex.productionEdges[0].evidenceRef =
      'source:src/public.ts#dynamic-import:./internal.js';
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const authority = authorityBound(commitSha, catalog(), dynamicFacts);

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].bindingKinds).toContain('dynamic_import');
    expect(impact.pathBindings[0].bindingKinds).not.toContain('static_import');
  });

  it('walks generated owner-output-consumer bindings without selecting unrelated tests', () => {
    const { root } = createRepository();
    writeFileSync(join(root, 'src/generator.ts'), 'export const version = 1;\n', 'utf8');
    writeFileSync(join(root, 'src/generated.ts'), 'export const generated = 1;\n', 'utf8');
    writeFileSync(
      join(root, 'src/generated-consumer.ts'),
      "export { generated } from './generated.js';\n",
      'utf8'
    );
    git(root, 'add', 'src/generator.ts', 'src/generated.ts', 'src/generated-consumer.ts');
    git(root, 'commit', '-m', 'generated baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, 'src/generator.ts'), 'export const version = 2;\n', 'utf8');
    git(root, 'add', 'src/generator.ts');
    git(root, 'commit', '-m', 'change generator');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const generatedCatalog = catalog();
    generatedCatalog.tests[0].targetRefs = ['src/generated-consumer.ts'];
    const generatedFacts = {
      sourceIndex: {
        productionEdges: [],
        generatedBindingRecords: [
          {
            ownerPath: 'src/generator.ts',
            outputPath: 'src/generated.ts',
            consumerPath: 'src/generated-consumer.ts',
            evidenceRef: 'source:package.json#testPortfolioAudit.generatorBindings[0]',
          },
        ],
      },
    };
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const authority = authorityBound(commitSha, generatedCatalog, generatedFacts);

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
    expect(impact.pathBindings[0].bindingKinds).toContain('generated_artifact');
  });

  it('uses package bin authority for root manifest changes without root-wide fallback', () => {
    const { root } = createRepository();
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"fixture","bin":{"fixture":"src/public.ts"}}\n',
      'utf8'
    );
    git(root, 'add', 'package.json');
    git(root, 'commit', '-m', 'package baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"fixture","bin":{"fixture":"src/public.ts"},"version":"1.0.0"}\n',
      'utf8'
    );
    git(root, 'add', 'package.json');
    git(root, 'commit', '-m', 'change package');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const cliCatalog = catalog();
    cliCatalog.tests[0].classifications = {
      criticalBindings: [{ kind: 'cli_bin', evidenceRef: 'source:package.json#bin:fixture' }],
    };
    cliCatalog.tests[1].classifications = { criticalBindings: [] };
    const cliFacts = {
      sourceIndex: {
        productionEdges: [],
        packageBinRecords: [
          {
            binName: 'fixture',
            packageDirectory: '.',
            packagePath: 'package.json',
            targetPath: 'src/public.ts',
            evidenceRef: 'source:package.json#bin:fixture',
          },
        ],
      },
    };
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const authority = authorityBound(commitSha, cliCatalog, cliFacts);

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
    expect(impact.pathBindings[0].bindingKinds).toContain('cli_command');
  });

  it('does not treat nested package tests as root package boundary tests', () => {
    const { root } = createRepository();
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"fixture","bin":{"fixture":"src/public.ts"}}\n',
      'utf8'
    );
    git(root, 'add', 'package.json');
    git(root, 'commit', '-m', 'package baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"fixture","bin":{"fixture":"src/public.ts"},"version":"1.0.0"}\n',
      'utf8'
    );
    git(root, 'add', 'package.json');
    git(root, 'commit', '-m', 'change package');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const packageCatalog = catalog();
    packageCatalog.tests[0].classifications = {
      criticalBindings: [{ kind: 'cli_bin', evidenceRef: 'source:package.json#bin:fixture' }],
    };
    packageCatalog.tests[1] = {
      ...packageCatalog.tests[1],
      identityKey: 'vitest#packages/nested/tests/cli.test.ts',
      testPath: 'packages/nested/tests/cli.test.ts',
      packageId: '@scope/nested',
      classifications: {
        criticalBindings: [
          {
            kind: 'cli_bin',
            evidenceRef: 'source:packages/nested/package.json#bin:nested',
          },
        ],
      },
    };
    const packageFacts = {
      sourceIndex: {
        productionEdges: [],
        packageBinRecords: [
          {
            binName: 'fixture',
            packageDirectory: '.',
            packagePath: 'package.json',
            targetPath: 'src/public.ts',
            evidenceRef: 'source:package.json#bin:fixture',
          },
        ],
        packageRecords: [
          {
            packageDirectory: '.',
            packagePath: 'package.json',
            packageJson: { name: 'fixture' },
          },
          {
            packageDirectory: 'packages/nested',
            packagePath: 'packages/nested/package.json',
            packageJson: { name: '@scope/nested' },
          },
        ],
      },
    };
    const authority = authorityBound(commitSha, packageCatalog, packageFacts);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
  });

  it('uses package export authority when a manifest has no CLI bin', () => {
    const { root } = createRepository();
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"fixture","exports":"./src/public.ts"}\n',
      'utf8'
    );
    git(root, 'add', 'package.json');
    git(root, 'commit', '-m', 'package export baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"fixture","exports":"./src/public.ts","version":"1.0.0"}\n',
      'utf8'
    );
    git(root, 'add', 'package.json');
    git(root, 'commit', '-m', 'change package export');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const packageCatalog = catalog();
    packageCatalog.tests[0].classifications = {
      criticalBindings: [
        {
          kind: 'package_install',
          evidenceRef: 'source:package.json#testPortfolioAudit.criticalBindings[0]',
        },
      ],
    };
    packageCatalog.tests[1].classifications = { criticalBindings: [] };
    const packageFacts = {
      sourceIndex: {
        productionEdges: [],
        packageRecords: [
          {
            packageDirectory: '.',
            packagePath: 'package.json',
            packageJson: { name: 'fixture', exports: './src/public.ts' },
          },
        ],
      },
    };
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const authority = authorityBound(commitSha, packageCatalog, packageFacts);

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
    expect(impact.pathBindings[0].bindingKinds).toContain('public_consumer_boundary');
  });

  it('expands an exported source change to its package public consumer boundary', () => {
    const { root } = createRepository();
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"fixture","exports":"./src/public.ts"}\n',
      'utf8'
    );
    git(root, 'add', 'package.json');
    git(root, 'commit', '-m', 'package export baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, 'src/public.ts'), 'export const publicValue = 2;\n', 'utf8');
    git(root, 'add', 'src/public.ts');
    git(root, 'commit', '-m', 'change exported source');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const packageCatalog = catalog();
    packageCatalog.tests[0].targetRefs = ['package.json'];
    const packageFacts = {
      sourceIndex: {
        productionEdges: [],
        packageRecords: [
          {
            packageDirectory: '.',
            packagePath: 'package.json',
            packageJson: { name: 'fixture', exports: './src/public.ts' },
          },
        ],
      },
    };
    const authority = authorityBound(commitSha, packageCatalog, packageFacts);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
    expect(impact.pathBindings[0].bindingKinds).toContain('public_consumer_boundary');
  });

  it('resolves a single package exports wildcard to a concrete public consumer target', () => {
    const { root } = createRepository();
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist/feature.js'), 'export const value = 1;\n', 'utf8');
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"fixture","exports":{"./*":"./dist/*.js"}}\n',
      'utf8'
    );
    git(root, 'add', 'dist/feature.js', 'package.json');
    git(root, 'commit', '-m', 'wildcard export baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, 'src/internal.ts'), 'export const value = 2;\n', 'utf8');
    git(root, 'add', 'src/internal.ts');
    git(root, 'commit', '-m', 'change wildcard export source');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const packageCatalog = catalog();
    packageCatalog.tests[0].targetRefs = ['package.json'];
    const packageFacts = {
      sourceIndex: {
        productionEdges: [
          {
            from: 'dist/feature.js',
            to: 'src/internal.ts',
            evidenceRef: 'source:dist/feature.js#import:../src/internal.js',
          },
        ],
        packageRecords: [
          {
            packageDirectory: '.',
            packagePath: 'package.json',
            packageJson: { name: 'fixture', exports: { './*': './dist/*.js' } },
          },
        ],
      },
    };
    const authority = authorityBound(commitSha, packageCatalog, packageFacts);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
    expect(impact.pathBindings[0].bindingKinds).toContain('public_consumer_boundary');
    expect(impact.pathBindings[0].evidenceRefs).toContain('source:package.json#exports:./feature');
  });

  it('fails closed with an explicit diagnostic for complex package exports wildcards', () => {
    const { root } = createRepository();
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist/feature.js'), 'export const value = 1;\n', 'utf8');
    writeFileSync(
      join(root, 'package.json'),
      '{"name":"fixture","exports":{"./**":"./dist/**/*.js"}}\n',
      'utf8'
    );
    git(root, 'add', 'dist/feature.js', 'package.json');
    git(root, 'commit', '-m', 'complex export baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, 'src/internal.ts'), 'export const value = 2;\n', 'utf8');
    git(root, 'add', 'src/internal.ts');
    git(root, 'commit', '-m', 'change complex export source');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const packageCatalog = catalog();
    packageCatalog.tests[0].targetRefs = ['package.json'];
    const packageFacts = {
      sourceIndex: {
        productionEdges: [
          {
            from: 'dist/feature.js',
            to: 'src/internal.ts',
            evidenceRef: 'source:dist/feature.js#import:../src/internal.js',
          },
        ],
        packageRecords: [
          {
            packageDirectory: '.',
            packagePath: 'package.json',
            packageJson: { name: 'fixture', exports: { './**': './dist/**/*.js' } },
          },
        ],
      },
    };
    const authority = authorityBound(commitSha, packageCatalog, packageFacts);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('IMPACT_PACKAGE_EXPORT_PATTERN_UNRESOLVED');
  });

  it('ignores nameless package metadata while preserving canonical package ownership', () => {
    const { root } = createRepository();
    mkdirSync(join(root, 'packages/pkg/src'), { recursive: true });
    writeFileSync(join(root, 'packages/pkg/src/index.ts'), 'export const value = 1;\n', 'utf8');
    git(root, 'add', 'packages/pkg/src/index.ts');
    git(root, 'commit', '-m', 'package baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, 'packages/pkg/src/index.ts'), 'export const value = 2;\n', 'utf8');
    git(root, 'add', 'packages/pkg/src/index.ts');
    git(root, 'commit', '-m', 'change package source');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const packageCatalog = catalog();
    packageCatalog.tests[0] = {
      ...packageCatalog.tests[0],
      testPath: 'tests/external-package.test.ts',
      targetRefs: [],
      packageId: '@scope/pkg',
    };
    packageCatalog.tests[1] = {
      ...packageCatalog.tests[1],
      testPath: 'tests/another-external-package.test.ts',
      targetRefs: [],
      packageId: '@scope/pkg',
    };
    const packageFacts = {
      sourceIndex: {
        productionEdges: [],
        packageRecords: [
          {
            packageDirectory: 'packages/config-only',
            packagePath: 'packages/config-only/package.json',
            packageJson: { type: 'commonjs' },
          },
          {
            packageDirectory: 'packages/pkg',
            packagePath: 'packages/pkg/package.json',
            packageJson: { name: '@scope/pkg' },
          },
        ],
      },
    };
    const authority = authorityBound(commitSha, packageCatalog, packageFacts);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0]).toMatchObject({
      changedPath: 'packages/pkg/src/index.ts',
      packageIds: ['@scope/pkg'],
      bindingKinds: ['package_ownership'],
      testIdentityRefs: [],
    });
  });

  it('uses canonical registry and observed execution records when present', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/internal.ts'), 'export const value = 2;\n', 'utf8');
    git(root, 'add', 'src/internal.ts');
    git(root, 'commit', '-m', 'change registered target');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const boundCatalog = catalog();
    boundCatalog.tests[0].targetRefs = ['src/registry.json'];
    const boundFacts = {
      sourceIndex: {
        productionEdges: [],
        registryBindingRecords: [
          {
            registryPath: 'src/registry.json',
            targetPath: 'src/internal.ts',
            evidenceRef: 'source:src/registry.json#handlers.primary',
          },
        ],
        observedExecutionBindings: [
          {
            targetPath: 'src/internal.ts',
            testIdentity: 'vitest#tests/public.test.ts',
            evidenceRef: 'timing:observed/public',
          },
        ],
      },
    };
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const authority = authorityBound(commitSha, boundCatalog, boundFacts);

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/public.test.ts']);
    expect(impact.pathBindings[0].bindingKinds).toEqual(
      expect.arrayContaining(['observed_execution', 'registry_schema'])
    );
  });

  it('preserves rename and copy provenance as bounded graph relations', () => {
    const { parseNameStatus } = require('../../../tools/ci/build-changed-code-impact.cjs');

    expect(
      parseNameStatus('R100\0src/old.ts\0src/new.ts\0C100\0src/base.ts\0src/copy.ts\0')
    ).toEqual([
      {
        status: 'C100',
        previousPath: 'src/base.ts',
        changedPath: 'src/copy.ts',
      },
      {
        status: 'R100',
        previousPath: 'src/old.ts',
        changedPath: 'src/new.ts',
      },
    ]);
  });

  it('keeps Git copy provenance out of changed paths and source-test expansion', () => {
    const { root } = createRepository();
    writeFileSync(join(root, 'src/base.ts'), 'export const copied = true;\n', 'utf8');
    git(root, 'add', 'src/base.ts');
    git(root, 'commit', '-m', 'copy baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, 'src/copy.ts'), 'export const copied = true;\n', 'utf8');
    git(root, 'add', 'src/copy.ts');
    git(root, 'commit', '-m', 'copy source');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const copyCatalog = catalog();
    copyCatalog.tests[0] = {
      ...copyCatalog.tests[0],
      identityKey: 'vitest#tests/base.test.ts',
      testPath: 'tests/base.test.ts',
      targetRefs: ['src/base.ts'],
    };
    copyCatalog.tests[1] = {
      ...copyCatalog.tests[1],
      identityKey: 'vitest#tests/copy.test.ts',
      testPath: 'tests/copy.test.ts',
      targetRefs: ['src/copy.ts'],
    };
    const authority = authorityBound(commitSha, copyCatalog, {
      sourceIndex: { productionEdges: [] },
    });
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.changedFiles).toEqual([
      {
        status: 'C100',
        previousPath: 'src/base.ts',
        changedPath: 'src/copy.ts',
      },
    ]);
    expect(impact.changedPaths).toEqual(['src/copy.ts']);
    expect(impact.pathBindings).toHaveLength(1);
    expect(impact.pathBindings[0].testIdentityRefs).toEqual(['vitest#tests/copy.test.ts']);
  });

  it('maps real committed rename, copy, and delete changes to current test identities', () => {
    const { root } = createRepository();
    writeFileSync(join(root, 'src/deleted.ts'), 'export const deleted = 1;\n', 'utf8');
    git(root, 'add', 'src/deleted.ts');
    git(root, 'commit', '-m', 'change baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    git(root, 'mv', 'src/public.ts', 'src/renamed.ts');
    writeFileSync(join(root, 'src/copied.ts'), "export { value } from './internal.js';\n", 'utf8');
    rmSync(join(root, 'src/deleted.ts'));
    git(root, 'add', '-A');
    git(root, 'commit', '-m', 'rename copy delete');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const changeCatalog = catalog();
    changeCatalog.tests[0].targetRefs = ['src/renamed.ts', 'src/copied.ts', 'src/deleted.ts'];
    const authority = authorityBound(commitSha, changeCatalog, {
      sourceIndex: { productionEdges: [] },
    });
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.changedFiles.map((change: { status: string }) => change.status[0])).toEqual(
      expect.arrayContaining(['C', 'D', 'R'])
    );
    expect(impact.changedPaths).toEqual(
      expect.arrayContaining(['src/copied.ts', 'src/deleted.ts', 'src/public.ts', 'src/renamed.ts'])
    );
    expect(
      impact.pathBindings.every((binding: { testIdentityRefs: string[] }) =>
        binding.testIdentityRefs.includes('vitest#tests/public.test.ts')
      )
    ).toBe(true);
  });

  it('treats a non-source filesystem target as direct impact evidence', () => {
    const { root } = createRepository();
    writeFileSync(join(root, 'config.json'), '{"enabled":false}\n', 'utf8');
    git(root, 'add', 'config.json');
    git(root, 'commit', '-m', 'config baseline');
    const baseSha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(join(root, 'config.json'), '{"enabled":true}\n', 'utf8');
    git(root, 'add', 'config.json');
    git(root, 'commit', '-m', 'change config');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const filesystemCatalog = catalog();
    filesystemCatalog.tests[0].targetRefs = ['config.json'];
    const authority = authorityBound(commitSha, filesystemCatalog, {
      sourceIndex: { productionEdges: [] },
    });
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const impact = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...authority,
    });

    expect(impact.pathBindings[0]).toMatchObject({
      changedPath: 'config.json',
      testIdentityRefs: ['vitest#tests/public.test.ts'],
      bindingKinds: ['direct_target'],
    });
  });

  it('produces the same impact hash when canonical Facts record order changes', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/internal.ts'), 'export const value = 2;\n', 'utf8');
    git(root, 'add', 'src/internal.ts');
    git(root, 'commit', '-m', 'change internal');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const firstFacts = {
      sourceIndex: {
        productionEdges: [
          {
            from: 'src/other.ts',
            to: 'src/public.ts',
            evidenceRef: 'source:src/other.ts#import:./public.js',
          },
          ...facts().sourceIndex.productionEdges,
        ],
      },
    };
    const secondFacts = structuredClone(firstFacts);
    secondFacts.sourceIndex.productionEdges.reverse();
    const firstAuthority = authorityBound(commitSha, catalog(), firstFacts);
    const secondAuthority = authorityBound(commitSha, catalog(), secondFacts);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    const first = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...firstAuthority,
    });
    const second = buildChangedCodeImpact({
      repoRoot: root,
      baseSha,
      commitSha,
      ...secondAuthority,
    });

    expect(second).toEqual(first);
    expect(second.impactHash).toBe(first.impactHash);
  });

  it('rejects dirty or stale Facts provenance when it is declared', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/public.ts'), 'export const publicValue = 2;\n', 'utf8');
    git(root, 'add', 'src/public.ts');
    git(root, 'commit', '-m', 'change public');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const authority = authorityBound(commitSha);
    authority.facts.repository = { commit: baseSha, dirty: false };
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('IMPACT_FACTS_COMMIT_MISMATCH');

    authority.facts.repository = { commit: commitSha, dirty: true };
    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('IMPACT_FACTS_DIRTY');
  });

  it('validates the Catalog Facts binding with the Catalog canonical hash algorithm', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/public.ts'), 'export const publicValue = 2;\n', 'utf8');
    git(root, 'add', 'src/public.ts');
    git(root, 'commit', '-m', 'change public');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const boundFacts = facts();
    boundFacts.sourceIndex.generatedBindingRecords = [];
    const authority = authorityBound(commitSha, catalog(), boundFacts);
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');

    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).not.toThrow();

    authority.catalog.factsHash = `sha256:${'0'.repeat(64)}`;
    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('IMPACT_CATALOG_FACTS_MISMATCH');
  });

  it('fails closed for an unmapped committed product path', () => {
    const { root, baseSha } = createRepository();
    writeFileSync(join(root, 'src/unmapped.ts'), 'export const missing = true;\n', 'utf8');
    git(root, 'add', 'src/unmapped.ts');
    git(root, 'commit', '-m', 'add unmapped');
    const commitSha = git(root, 'rev-parse', 'HEAD');
    const { buildChangedCodeImpact } = require('../../../tools/ci/build-changed-code-impact.cjs');
    const authority = authorityBound(commitSha);

    expect(() =>
      buildChangedCodeImpact({
        repoRoot: root,
        baseSha,
        commitSha,
        ...authority,
      })
    ).toThrow('IMPACT_BINDING_UNRESOLVED');
  });
});
