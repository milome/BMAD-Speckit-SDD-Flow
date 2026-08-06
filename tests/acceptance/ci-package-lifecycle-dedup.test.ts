import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const fixture = require('../fixtures/test-portfolio/run-manifest-input.json');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const { buildShardPlan } = require('../../tools/ci/build-shard-plan.cjs');
const { summarizeTimingEvents } = require('../../tools/ci/summarize-test-timings.cjs');
const { createRunManifestPlan } = require('../../tools/ci/write-ci-run-manifest.cjs');
const {
  expectedBuildCommandHash,
  expectedPackCommandHash,
  preparePackageArtifact,
} = require('../../tools/ci/prepare-package-artifact.cjs');
const { runConsumerPackageLane } = require('../../tools/ci/run-consumer-package-lane.cjs');

function consumerManifest() {
  const input = structuredClone(fixture);
  const identityKey = 'vitest::tests/acceptance/accept-install-consumer-cli.test.ts';
  const selection = {
    ...input.shardPlan.selection,
    selected: [
      {
        identityKey,
        runnerId: 'vitest',
        testPath: 'tests/acceptance/accept-install-consumer-cli.test.ts',
        lane: 'consumer_install',
        reasonCodes: ['PACKAGE_CONSUMER'],
        coveredObligationIds: [],
      },
    ],
  };
  const timingSummary = summarizeTimingEvents({
    commitSha: input.repository.commitSha,
    events: [
      {
        eventId: sha256Bytes(
          canonicalJsonBytes({ commitSha: input.repository.commitSha, identityKey })
        ),
        identityKey,
        runnerId: 'vitest',
        testPath: 'tests/acceptance/accept-install-consumer-cli.test.ts',
        durationMs: 1,
        outcome: 'passed',
      },
    ],
  });
  const policy = {
    timing: {
      unknownDurationMs: 1,
      maxShardDurationMs: 120000,
      maxShardsPerLane: 1,
    },
  };
  const shardPlan = buildShardPlan({
    selection,
    timingSummary,
    policy,
    expectedCommitSha: input.repository.commitSha,
    expectedEnvironmentClass: input.shardPlan.timingBinding.expectedEnvironmentClass,
  });
  return createRunManifestPlan({
    ...input,
    selectionHash: shardPlan.selectionHash,
    timingSummary,
    policy,
    policyHash: sha256Bytes(canonicalJsonBytes(policy)),
    shardPlan,
  });
}

describe('one-build one-pack package lifecycle', () => {
  it('verifies an existing descriptor without requiring built release-gate runtime', () => {
    const repoRoot = process.cwd();
    const outputDir = join(
      repoRoot,
      '.artifacts',
      'test-portfolio',
      `prepublish-verify-${process.pid}-${Date.now()}`
    );
    const fixtureCommitSha = 'a'.repeat(40);
    const tarballPath = join(outputDir, 'fixture.tgz');
    const descriptorPath = join(outputDir, 'canonical-package.json');
    const packageJson = require('../../package.json');
    const tarballBytes = Buffer.from('canonical tarball fixture', 'utf8');
    const descriptor = {
      schemaVersion: 'canonical-package/v1',
      commitSha: fixtureCommitSha,
      packageName: packageJson.name,
      packageVersion: packageJson.version,
      tarballPath: tarballPath.slice(repoRoot.length + 1).replace(/\\/g, '/'),
      tarballSha256: sha256Bytes(tarballBytes),
      buildCommandHash: expectedBuildCommandHash(),
      packCommandHash: expectedPackCommandHash(),
    };

    try {
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(tarballPath, tarballBytes);
      writeFileSync(descriptorPath, canonicalJsonBytes(descriptor));
      const descriptorArg = descriptorPath.slice(repoRoot.length + 1);
      const result = spawnSync(
        process.execPath,
        [
          '-e',
          [
            "const fs=require('node:fs');",
            'const originalExists=fs.existsSync;',
            "fs.existsSync=(value)=>String(value).replace(/\\\\/g,'/').endsWith('/dist/utils/goal-contract/release-gate.js')?false:originalExists(value);",
            `process.argv=['node','scripts/prepublish-check.js','--verify-descriptor',${JSON.stringify(descriptorArg)}];`,
            "require('./scripts/prepublish-check.js');",
          ].join(''),
        ],
        {
          cwd: repoRoot,
          encoding: 'utf8',
          env: { ...process.env, CI_COMMIT_SHA: fixtureCommitSha },
        }
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('canonical package descriptor');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('binds the consumer package lane to one manifest shard and one canonical tarball', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'package-lifecycle-'));
    const commands: any[] = [];
    try {
      writeFileSync(
        join(repoRoot, 'package.json'),
        JSON.stringify({ name: 'fixture-package', version: '1.2.3', private: true }),
        'utf8'
      );
      const prepared = preparePackageArtifact({
        repoRoot,
        commitSha: 'a'.repeat(40),
        listTarEntries: () => ['package/package.json'],
        runCommand: (request: any) => {
          commands.push(request);
          if (request.kind === 'npm_pack') {
            mkdirSync(request.outputDir, { recursive: true });
            writeFileSync(join(request.outputDir, 'fixture-package-1.2.3.tgz'), 'tarball', 'utf8');
            return {
              status: 0,
              stdout: JSON.stringify([{ filename: 'fixture-package-1.2.3.tgz' }]),
            };
          }
          return { status: 0, stdout: '' };
        },
      });

      const manifest = consumerManifest();
      const shardCalls: any[] = [];
      const consumerRun = runConsumerPackageLane({
        repoRoot,
        descriptor: prepared,
        descriptorPath: prepared.descriptorPath,
        manifest,
        manifestPath: join(repoRoot, '.artifacts/test-portfolio/ci-run-manifest.json'),
        lane: 'consumer_install',
        shardId: 'consumer_install-01',
        runShard: (request: any) => {
          shardCalls.push(request);
          return { outcome: 'passed', exitCode: 0 };
        },
      });

      expect(commands.filter((command) => command.kind === 'build')).toHaveLength(1);
      expect(commands.filter((command) => command.kind === 'npm_pack')).toHaveLength(1);
      expect(shardCalls).toEqual([
        expect.objectContaining({
          manifest,
          lane: 'consumer_install',
          shardId: 'consumer_install-01',
          environment: expect.objectContaining({
            BMAD_SPECKIT_TARBALL: join(repoRoot, prepared.tarballPath),
            BMAD_SPECKIT_PACKAGE_DESCRIPTOR: prepared.descriptorPath,
          }),
        }),
      ]);
      expect(consumerRun.outcome).toBe('passed');
      expect(() =>
        runConsumerPackageLane({
          repoRoot,
          descriptor: prepared,
          descriptorPath: prepared.descriptorPath,
          manifest,
          lane: 'core',
          shardId: 'consumer_install-01',
          runShard: () => ({ outcome: 'passed', exitCode: 0 }),
        })
      ).toThrow('CONSUMER_PACKAGE_LANE_INVALID');
      expect(manifest.plan.shardPlan.shards.flatMap((shard: any) => shard.identityKeys)).toEqual([
        'vitest::tests/acceptance/accept-install-consumer-cli.test.ts',
      ]);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
