const crypto = require('node:crypto');

const PRESENTATION_ONLY_KEYS = new Set([
  'comment',
  'comments',
  'description',
  'displayLabel',
  'displayOrder',
  'helpText',
  'label',
  'note',
  'notes',
  'title',
]);
const GENERATED_METADATA_KEYS = new Set([
  'aliasAudit',
  'builderVersion',
  'currentAttemptId',
  'manifestHash',
  'recordPath',
  'sourcePath',
]);
const CANONICAL_AUTHORITY_KEYS = new Set([
  'closeoutProof',
  'commandTargetCollection',
  'currentTargetMap',
  'evidenceTrustStates',
  'implementationConfirmationHash',
  'requiredCommands',
  'requiredSections',
  'schemaVersion',
  'sourceDocumentHash',
  'sourceProjectionHash',
  'targetModificationPathCoverage',
  'traceClosureAssertions',
]);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function stripPresentationOnly(value) {
  if (Array.isArray(value)) return value.map(stripPresentationOnly);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (PRESENTATION_ONLY_KEYS.has(key)) continue;
    out[key] = stripPresentationOnly(item);
  }
  return out;
}

function stripGeneratedMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const clone = { ...value };
  for (const key of GENERATED_METADATA_KEYS) delete clone[key];
  return clone;
}

function canonicalizeAuthorityValue(key, value) {
  if (!value || typeof value !== 'object') return value;
  if (key === 'closeoutProof') {
    return {
      requiredCommands: Array.isArray(value.requiredCommands) ? value.requiredCommands : [],
    };
  }
  if (key === 'commandTargetCollection') {
    return {
      rows: Array.isArray(value.rows)
        ? value.rows.map((row) => ({
            id: row?.id,
            command: row?.command,
            files: row?.files,
            traceRefs: row?.traceRefs,
            evidenceRefs: row?.evidenceRefs,
          }))
        : [],
    };
  }
  if (key === 'currentTargetMap') {
    return {
      schemaVersion: value.schemaVersion,
      displayProfile: value.displayProfile,
      currentSummaryCount: Array.isArray(value.currentSummary)
        ? value.currentSummary.length
        : value.summary?.currentSummaryCount,
      targetSummaryCount: Array.isArray(value.targetSummary)
        ? value.targetSummary.length
        : value.summary?.targetSummaryCount,
      diffRowCount: Array.isArray(value.diffRows) ? value.diffRows.length : value.summary?.diffRowCount,
      processCount: Array.isArray(value.process) ? value.process.length : value.summary?.processCount,
      artifactPathCount: Array.isArray(value.artifactPaths)
        ? value.artifactPaths.length
        : value.summary?.artifactPathCount,
      canonicalArtifactCount: Array.isArray(value.canonicalArtifacts)
        ? value.canonicalArtifacts.length
        : value.summary?.canonicalArtifactCount,
      legacySurfaceCount: Array.isArray(value.existingArtifacts)
        ? value.existingArtifacts.length
        : value.summary?.legacySurfaceCount,
    };
  }
  if (key === 'targetModificationPathCoverage') {
    return {
      rows: Array.isArray(value.rows)
        ? value.rows.map((row) => ({
            id: row?.id,
            path: row?.path,
            traceRefs: row?.traceRefs,
            evidenceRefs: row?.evidenceRefs,
          }))
        : value.rows,
    };
  }
  if (key === 'traceClosureAssertions') {
    return {
      rows: Array.isArray(value.rows)
        ? value.rows.map((row) => ({
            id: row?.id,
            covers: row?.covers,
            evidenceRefs: row?.evidenceRefs,
            commandRefs: row?.commandRefs,
            artifactRefs: row?.artifactRefs,
            acceptanceRefs: row?.acceptanceRefs,
          }))
        : value.rows,
    };
  }
  if (key === 'evidenceTrustStates') {
    return {
      rows: Array.isArray(value.rows)
        ? value.rows.map((row) => ({
            id: row?.id,
            requiredCommandRefs: row?.requiredCommandRefs,
            artifactRefs: row?.artifactRefs,
          }))
        : value.rows,
    };
  }
  return value;
}

function canonicalManifestCore(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return {};
  const core = {};
  for (const [key, value] of Object.entries(manifest)) {
    if (CANONICAL_AUTHORITY_KEYS.has(key)) core[key] = canonicalizeAuthorityValue(key, value);
  }
  return core;
}

function hashCanonicalManifest(manifest) {
  return sha256(
    stableStringify(canonicalManifestCore(stripGeneratedMetadata(stripPresentationOnly(manifest))))
  );
}

function hashSourceProjection(projection) {
  return sha256(stableStringify(stripPresentationOnly(projection ?? {})));
}

module.exports = {
  hashCanonicalManifest,
  hashSourceProjection,
  sha256,
  stableStringify,
  canonicalManifestCore,
  stripPresentationOnly,
};
