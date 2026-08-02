'use strict';

const path = require('node:path');

const { fail, readCanonicalArtifact } = require('./canonical-artifact.cjs');
const { validatePackageDescriptor } = require('./prepare-package-artifact.cjs');
const { runCiShard } = require('./run-vitest-shard.cjs');
const { validateRunManifest } = require('./write-ci-run-manifest.cjs');

const CONSUMER_LANES = new Set(['consumer_install', 'package_consumer']);

function runConsumerPackageLane({
  repoRoot = process.cwd(),
  descriptor,
  descriptorPath,
  manifest,
  manifestPath = '',
  lane,
  shardId,
  outputDir = '.artifacts/test-portfolio/lane-results',
  runCommand,
  runShard = runCiShard,
}) {
  validateRunManifest(manifest);
  if (!CONSUMER_LANES.has(lane)) fail('CONSUMER_PACKAGE_LANE_INVALID', { lane });
  validatePackageDescriptor({
    repoRoot,
    descriptor,
    descriptorPath,
    expectedCommitSha: manifest.plan.repository.commitSha,
  });
  const tarball = path.resolve(repoRoot, descriptor.tarballPath);
  return runShard({
    repoRoot,
    manifest,
    lane,
    shardId,
    outputDir,
    environment: {
      BMAD_SPECKIT_TARBALL: tarball,
      BMAD_SPECKIT_PACKAGE_DESCRIPTOR: descriptorPath,
      CI_RUN_MANIFEST: manifestPath || 'governed',
    },
    ...(runCommand ? { runCommand } : {}),
  });
}

function parseCliArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !['--descriptor', '--manifest', '--lane', '--shard-id', '--output-dir'].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CONSUMER_PACKAGE_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  if (!options.descriptor || !options.manifest || !options.lane || !options['shard-id']) {
    fail('CONSUMER_PACKAGE_CLI_ARGS_INVALID');
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);
  const descriptorPath = path.resolve(options.descriptor);
  const manifestPath = path.resolve(options.manifest);
  const descriptor = readCanonicalArtifact({
    repoRoot: process.cwd(),
    filePath: descriptorPath,
  }).artifact;
  const manifest = readCanonicalArtifact({
    repoRoot: process.cwd(),
    filePath: manifestPath,
  }).artifact;
  const result = runConsumerPackageLane({
    descriptor,
    descriptorPath,
    manifest,
    manifestPath,
    lane: options.lane,
    shardId: options['shard-id'],
    outputDir: options['output-dir'] || '.artifacts/test-portfolio/lane-results',
  });
  process.stdout.write(
    `${JSON.stringify({
      lane: result.lane,
      shardId: result.shardId,
      outcome: result.outcome,
      resultPath: result.resultPath,
    })}\n`
  );
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  main,
  parseCliArgs,
  runConsumerPackageLane,
};
