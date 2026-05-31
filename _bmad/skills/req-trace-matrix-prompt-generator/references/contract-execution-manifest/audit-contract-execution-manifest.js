#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { buildContractExecutionManifest } = require('./build-contract-execution-manifest');
const { normalizeContractExecutionManifest } = require('./normalize-contract-execution-manifest');

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value) {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function manifestFromArtifact(artifact) {
  if (!artifact) return {};
  if (artifact.contractExecutionManifest) return artifact.contractExecutionManifest;
  return artifact;
}

function commandIds(manifest) {
  return new Set(objects(manifest.requiredCommands).map((row) => text(row.id)).filter(Boolean));
}

function closeoutRequiredCommands(manifest) {
  return Array.isArray(manifest.closeoutProof?.requiredCommands)
    ? manifest.closeoutProof.requiredCommands.map(text).filter(Boolean)
    : [];
}

function auditContractExecutionManifest(input) {
  const blockingReasons = [];
  const normalizedArtifacts = [];
  const canonical = buildContractExecutionManifest({
    confirmation: input.confirmation ?? {},
    manifest: input.canonicalManifest,
    sourcePath: input.sourcePath,
    recordPath: input.recordPath,
    attemptId: input.attemptId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    sourceProjectionHash: input.canonicalManifest?.sourceProjectionHash,
  });

  for (const artifact of input.artifacts ?? []) {
    const raw = manifestFromArtifact(artifact.value);
    const normalized = buildContractExecutionManifest({
      confirmation: input.confirmation ?? {},
      manifest: raw,
      sourcePath: raw.sourcePath ?? input.sourcePath,
      recordPath: raw.recordPath ?? input.recordPath,
      attemptId: raw.currentAttemptId ?? input.attemptId,
      sourceDocumentHash: raw.sourceDocumentHash ?? input.sourceDocumentHash,
      implementationConfirmationHash:
        raw.implementationConfirmationHash ?? input.implementationConfirmationHash,
      sourceProjectionHash: raw.sourceProjectionHash,
    });
    normalizedArtifacts.push({
      name: artifact.name,
      manifestHash: normalized.manifestHash,
      sourceProjectionHash: normalized.sourceProjectionHash,
      aliasAudit: normalized.aliasAudit,
    });
    if (normalized.manifestHash !== canonical.manifestHash) {
      blockingReasons.push(`MANIFEST_HASH_MISMATCH:${artifact.name}`);
    }
    for (const key of ['sourceDocumentHash', 'implementationConfirmationHash']) {
      if (canonical[key] && normalized[key] && canonical[key] !== normalized[key]) {
        blockingReasons.push(`MANIFEST_IDENTITY_MISMATCH:${artifact.name}:${key}`);
      }
    }
  }

  const normalized = normalizeContractExecutionManifest({
    confirmation: input.confirmation ?? {},
    manifest: input.canonicalManifest ?? canonical,
  });
  blockingReasons.push(...normalized.audit.blockingReasons);
  const ids = commandIds(canonical);
  for (const commandId of closeoutRequiredCommands(canonical)) {
    if (!ids.has(commandId)) {
      blockingReasons.push(`CLOSEOUT_REQUIRED_COMMAND_MISSING:${commandId}`);
    }
  }
  if (text(canonical.schemaVersion) !== 'contract-execution-manifest/v1') {
    blockingReasons.push('MANIFEST_SCHEMA_VERSION_MISSING_OR_INVALID');
  }
  if (!text(canonical.manifestHash)) {
    blockingReasons.push('MANIFEST_HASH_MISSING');
  }
  if (!text(canonical.sourceProjectionHash)) {
    blockingReasons.push('SOURCE_PROJECTION_HASH_MISSING');
  }
  return {
    schemaVersion: 'contract-execution-manifest-audit/v1',
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    canonical: {
      manifestHash: canonical.manifestHash,
      sourceProjectionHash: canonical.sourceProjectionHash,
      schemaVersion: canonical.schemaVersion,
      builderVersion: canonical.builderVersion,
    },
    artifacts: normalizedArtifacts,
  };
}

function parseArgs(argv) {
  const out = { artifacts: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--artifact') {
      const name = argv[index + 1];
      const file = argv[index + 2];
      if (!name || !file) throw new Error('--artifact requires <name> <json-path>');
      out.artifacts.push({ name, file });
      index += 2;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    out[key] = value;
    index += 1;
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const confirmation = args.confirmation ? readJson(args.confirmation) : {};
  const canonicalManifest = args.canonicalManifest ? readJson(args.canonicalManifest) : undefined;
  const artifacts = args.artifacts.map((artifact) => ({
    name: artifact.name,
    value: readJson(path.resolve(artifact.file)),
  }));
  const report = auditContractExecutionManifest({
    confirmation,
    canonicalManifest,
    sourcePath: args.sourcePath,
    recordPath: args.recordPath,
    attemptId: args.attemptId,
    sourceDocumentHash: args.sourceDocumentHash,
    implementationConfirmationHash: args.implementationConfirmationHash,
    artifacts,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  auditContractExecutionManifest,
  main,
};
