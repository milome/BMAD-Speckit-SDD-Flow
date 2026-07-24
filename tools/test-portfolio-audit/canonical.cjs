const crypto = require('node:crypto');
const path = require('node:path');

const AUDIT_SCHEMA_VERSION = 'test-portfolio-audit/v1';
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const STATUS = new Set(['COMPLETE', 'INCOMPLETE', 'FAILED']);

function normalizeRepoPath(repoRoot, value) {
  const root = path.resolve(repoRoot);
  const candidate = String(value || '').replace(/\\/g, '/');
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute).replace(/\\/g, '/');
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    const error = new Error(`PATH_OUTSIDE_REPO:${value}`);
    error.code = 'PATH_OUTSIDE_REPO';
    throw error;
  }
  return relative === '' ? '.' : relative;
}

function normalizeEvidenceRef(value) {
  const text = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^source:\.\//, 'source:');
  if (!text) throw new Error('EVIDENCE_REF_EMPTY');
  return text;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(canonicalize(value))}\n`, 'utf8');
}

function sha256Bytes(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function compareEvidenceRef(left, right) {
  return String(left).localeCompare(String(right), 'en', { numeric: true });
}

function compareTestIdentity(left, right) {
  return `${left.testPath}\0${left.runnerId}`.localeCompare(
    `${right.testPath}\0${right.runnerId}`,
    'en',
    { numeric: true }
  );
}

function stableUnique(values) {
  return [...new Set(values.map(String))].sort(compareEvidenceRef);
}

function validateCanonicalAudit(artifact) {
  if (artifact.schemaVersion !== AUDIT_SCHEMA_VERSION) {
    throw new Error('AUDIT_SCHEMA_VERSION_INVALID');
  }
  if (!STATUS.has(artifact.status)) throw new Error('AUDIT_STATUS_INVALID');
  for (const row of artifact.tests || []) {
    if (!row.testPath || !row.runnerId) throw new Error('TEST_IDENTITY_MISSING');
    if (
      row.executionMultiplicity === 'duplicate' &&
      (!Array.isArray(row.executionRouteRefs) || row.executionRouteRefs.length < 2)
    ) {
      throw new Error('DUPLICATE_EVIDENCE_INCOMPLETE');
    }
    for (const [dimension, evidence] of Object.entries(row.confidence || {})) {
      if (!CONFIDENCE.has(evidence)) throw new Error(`CONFIDENCE_INVALID:${dimension}`);
    }
  }
  return artifact;
}

module.exports = {
  AUDIT_SCHEMA_VERSION,
  canonicalJsonBytes,
  canonicalize,
  compareEvidenceRef,
  compareTestIdentity,
  normalizeEvidenceRef,
  normalizeRepoPath,
  sha256Bytes,
  stableUnique,
  validateCanonicalAudit,
};
