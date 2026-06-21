#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const {
  LEDGER_PATH,
  WAVE_DIR,
  ensureDir,
  formatJson,
  loadLedger,
  normalizePath,
  nowIso,
  readJson,
  repoPath,
  sha256File,
  writeJson,
} = require('./main-agent-wave-4-1-utils.cjs');

const OWNER_TASK_IDS = ['G003', 'G004', 'G005', 'G006', 'G007', 'G008'];
const AGGREGATE_PATH = `${WAVE_DIR}/behavior-equivalence-matrix.json`;

function parseArgs(argv) {
  const args = { json: false, updateLedger: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--update-ledger') args.updateLedger = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function sha256Canonical(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')}`;
}

function ownerArtifactRowForEntry(entry, artifact) {
  if (artifact.originalPath === entry.originalPath && Array.isArray(artifact.behaviorEquivalenceMatrix)) {
    return {
      originalPath: artifact.originalPath,
      behaviorEquivalenceMatrix: artifact.behaviorEquivalenceMatrix,
    };
  }
  if (Array.isArray(artifact.rows)) {
    const row = artifact.rows.find((candidate) => normalizePath(candidate.originalPath) === entry.originalPath);
    if (row && Array.isArray(row.behaviorEquivalenceMatrix)) {
      return {
        originalPath: normalizePath(row.originalPath),
        behaviorEquivalenceMatrix: row.behaviorEquivalenceMatrix,
      };
    }
  }
  throw new Error(`owner artifact row missing for ${entry.originalPath}`);
}

function aggregate(updateLedger) {
  ensureDir(WAVE_DIR);
  const generatedAt = nowIso();
  const ledger = loadLedger();
  const rows = [];
  const sourceArtifactsByPath = new Map();
  const matrixSourceArtifactsByOwnerTask = Object.fromEntries(
    OWNER_TASK_IDS.map((ownerTaskId) => [ownerTaskId, []])
  );

  for (const entry of ledger.entries) {
    const proof = entry.matrixFirstGenerationProof || {};
    if (!proof.artifactPath) throw new Error(`missing matrixFirstGenerationProof.artifactPath for ${entry.originalPath}`);
    const artifactPath = normalizePath(proof.artifactPath);
    const artifact = readJson(artifactPath);
    const ownerRow = ownerArtifactRowForEntry(entry, artifact);
    const aggregateCanonicalRow = {
      originalPath: entry.originalPath,
      behaviorEquivalenceMatrix: entry.behaviorEquivalenceMatrix,
    };
    const ownerRowHash = sha256Canonical(ownerRow);
    const aggregatedRowHash = sha256Canonical(aggregateCanonicalRow);
    if (ownerRowHash !== aggregatedRowHash) {
      throw new Error(`G009 hash-preserving aggregation mismatch for ${entry.originalPath}`);
    }
    const artifactHash = sha256File(artifactPath);
    sourceArtifactsByPath.set(artifactPath, {
      ownerTaskId: entry.matrixOwnerTaskId,
      artifactPath,
      artifactHash,
    });
    rows.push({
      originalPath: entry.originalPath,
      entryId: entry.entryId,
      matrixOwnerTaskId: entry.matrixOwnerTaskId,
      behaviorEquivalenceMatrixFirstGeneratedByTaskId: entry.behaviorEquivalenceMatrixFirstGeneratedByTaskId,
      ownerArtifactPath: artifactPath,
      ownerArtifactHash: artifactHash,
      ownerRowHash,
      aggregatedRowHash,
      packageImplementationSet: entry.packageImplementationSet,
      sourceAuthorityPaths: entry.sourceAuthorityPaths,
      runtimeReplayPaths: entry.runtimeReplayPaths,
      distOutputPaths: entry.distOutputPaths,
      scenarioCoverageProof: entry.scenarioCoverageProof,
      expectedOutputProvenance: entry.expectedOutputProvenance,
      behaviorEquivalenceReplayProof: entry.behaviorEquivalenceReplayProof,
      behaviorEquivalenceMatrix: entry.behaviorEquivalenceMatrix,
    });
  }

  for (const artifact of sourceArtifactsByPath.values()) {
    matrixSourceArtifactsByOwnerTask[artifact.ownerTaskId].push({
      artifactPath: artifact.artifactPath,
      artifactHash: artifact.artifactHash,
    });
  }
  for (const ownerTaskId of OWNER_TASK_IDS) {
    matrixSourceArtifactsByOwnerTask[ownerTaskId].sort((left, right) =>
      left.artifactPath.localeCompare(right.artifactPath)
    );
  }

  const aggregateArtifact = {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-g009-behavior-equivalence-aggregate/v1',
    waveId: 'main-agent-runtime-migration-wave-4.1',
    generatedAt,
    generatedByTaskId: 'G009',
    generationPolicy: 'hash_preserving_aggregation_only_no_first_generation',
    matrixSourceArtifactsByOwnerTask,
    rowCount: rows.length,
    rows,
  };
  const aggregateReceipt = writeJson(AGGREGATE_PATH, aggregateArtifact);

  if (updateLedger) {
    const rowByPath = new Map(rows.map((row) => [row.originalPath, row]));
    for (const entry of ledger.entries) {
      const row = rowByPath.get(entry.originalPath);
      entry.g009AggregationProvenance = {
        status: 'passed_hash_preserving_aggregation',
        ownerTaskId: entry.matrixOwnerTaskId,
        ownerArtifactPath: row.ownerArtifactPath,
        ownerArtifactHash: row.ownerArtifactHash,
        ownerRowHash: row.ownerRowHash,
        aggregateArtifactPath: AGGREGATE_PATH,
        aggregateArtifactHash: aggregateReceipt.hash,
        aggregatedRowHash: row.aggregatedRowHash,
      };
    }
    ledger.generatedAt = generatedAt;
    writeJson(LEDGER_PATH, ledger);
  }

  return {
    ok: true,
    status: updateLedger ? 'passed_and_ledger_updated' : 'passed_without_ledger_update',
    aggregatePath: AGGREGATE_PATH,
    aggregateHash: aggregateReceipt.hash,
    rowCount: rows.length,
    sourceArtifactCount: sourceArtifactsByPath.size,
    ledgerUpdated: updateLedger,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = aggregate(args.updateLedger);
  process.stdout.write(args.json ? formatJson(output) : `${JSON.stringify(output)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  aggregate,
};
