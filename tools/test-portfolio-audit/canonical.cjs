const crypto = require('node:crypto');
const path = require('node:path');

const AUDIT_SCHEMA_VERSION = 'test-portfolio-audit/v1';
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const STATUS = new Set(['COMPLETE', 'INCOMPLETE', 'FAILED']);

function normalizeRepoPath(repoRoot, value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    const error = new Error('PATH_EMPTY');
    error.code = 'PATH_EMPTY';
    throw error;
  }
  const root = path.resolve(repoRoot);
  const candidate = String(value).replace(/\\/g, '/');
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
  if (typeof value !== 'string') throw new Error('EVIDENCE_REF_INVALID');
  const text = value.trim().replace(/\\/g, '/');
  if (!text) throw new Error('EVIDENCE_REF_EMPTY');
  if (text.startsWith('source:')) {
    const source = text.slice('source:'.length);
    const fragmentIndex = source.indexOf('#');
    const sourcePath = fragmentIndex === -1 ? source : source.slice(0, fragmentIndex);
    const fragment = fragmentIndex === -1 ? '' : source.slice(fragmentIndex);
    if (path.posix.isAbsolute(sourcePath) || /^[A-Za-z]:/.test(sourcePath)) {
      throw new Error('EVIDENCE_SOURCE_OUTSIDE_REPO');
    }
    const normalizedPath = path.posix.normalize(sourcePath).replace(/\/+$/, '');
    if (!normalizedPath || normalizedPath === '.') {
      throw new Error('EVIDENCE_SOURCE_PATH_EMPTY');
    }
    if (
      normalizedPath === '..' ||
      normalizedPath.startsWith('../') ||
      path.posix.isAbsolute(normalizedPath) ||
      /^[A-Za-z]:/.test(normalizedPath)
    ) {
      throw new Error('EVIDENCE_SOURCE_OUTSIDE_REPO');
    }
    return `source:${normalizedPath}${fragment}`;
  }
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

function compareOrdinal(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareNatural(left, right) {
  const leftText = String(left);
  const rightText = String(right);
  const leftParts = leftText.match(/\d+|\D+/g) || [];
  const rightParts = rightText.match(/\d+|\D+/g) || [];
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;

    const leftIsNumber = /^\d+$/.test(leftPart);
    const rightIsNumber = /^\d+$/.test(rightPart);
    if (leftIsNumber && rightIsNumber) {
      const leftNumber = leftPart.replace(/^0+(?=\d)/, '');
      const rightNumber = rightPart.replace(/^0+(?=\d)/, '');
      if (leftNumber.length !== rightNumber.length) {
        return leftNumber.length < rightNumber.length ? -1 : 1;
      }
      const numberOrder = compareOrdinal(leftNumber, rightNumber);
      if (numberOrder !== 0) return numberOrder;
      continue;
    }

    const partOrder = compareOrdinal(leftPart, rightPart);
    if (partOrder !== 0) return partOrder;
  }

  return compareOrdinal(leftText, rightText);
}

function compareEvidenceRef(left, right) {
  return compareNatural(left, right);
}

function compareTestIdentity(left, right) {
  const pathOrder = compareNatural(left.testPath, right.testPath);
  if (pathOrder !== 0) return pathOrder;
  return compareNatural(left.runnerId, right.runnerId);
}

function stableUnique(values) {
  return [...new Set(values.map(String))].sort(compareEvidenceRef);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateCanonicalAudit(artifact) {
  if (!isPlainObject(artifact)) throw new Error('AUDIT_ARTIFACT_INVALID');
  if (artifact.schemaVersion !== AUDIT_SCHEMA_VERSION) {
    throw new Error('AUDIT_SCHEMA_VERSION_INVALID');
  }
  if (!STATUS.has(artifact.status)) throw new Error('AUDIT_STATUS_INVALID');
  if (!Array.isArray(artifact.tests)) throw new Error('AUDIT_TESTS_INVALID');
  for (const row of artifact.tests) {
    if (!isPlainObject(row)) throw new Error('AUDIT_TEST_ROW_INVALID');
    const normalizedTestPath =
      typeof row.testPath === 'string'
        ? path.posix.normalize(row.testPath.trim().replace(/\\/g, '/'))
        : '';
    if (
      typeof row.testPath !== 'string' ||
      row.testPath.trim() === '' ||
      normalizedTestPath === '.' ||
      normalizedTestPath === './' ||
      typeof row.runnerId !== 'string' ||
      row.runnerId.trim() === ''
    ) {
      throw new Error('TEST_IDENTITY_MISSING');
    }
    if (
      row.executionMultiplicity === 'duplicate' &&
      !hasCompleteDuplicateEvidence(row.executionRouteRefs)
    ) {
      throw new Error('DUPLICATE_EVIDENCE_INCOMPLETE');
    }
    if (Object.prototype.hasOwnProperty.call(row, 'confidence')) {
      if (!isPlainObject(row.confidence)) {
        throw new Error('CONFIDENCE_CONTAINER_INVALID');
      }
      for (const [dimension, evidence] of Object.entries(row.confidence)) {
        if (!CONFIDENCE.has(evidence)) throw new Error(`CONFIDENCE_INVALID:${dimension}`);
      }
    }
  }
  return artifact;
}

function hasCompleteDuplicateEvidence(values) {
  if (!Array.isArray(values)) return false;
  const normalizedValues = [];
  for (let index = 0; index < values.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(values, index)) return false;
    const value = values[index];
    if (typeof value !== 'string') return false;
    try {
      const normalizedValue = normalizeEvidenceRef(value);
      if (!normalizedValue.startsWith('route:') || normalizedValue.slice('route:'.length) === '') {
        return false;
      }
      normalizedValues.push(normalizedValue);
    } catch {
      return false;
    }
  }
  return stableUnique(normalizedValues).length >= 2;
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
