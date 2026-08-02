'use strict';

const { compareText, fail } = require('./canonical-artifact.cjs');

const VERDICTS = new Set(['approve_delete', 'retain_on_demand', 'manual_review']);
const REVIEW_PROFILE_VERSION = 'test-portfolio-delete/v1';
const REQUEST_FIELDS = Object.freeze([
  'identityKey',
  'testPath',
  'reasonCode',
  'evidenceRefs',
  'capabilityRefs',
  'traceRefs',
  'fixtureRefs',
  'targetEvidenceRefs',
  'independentOracleEvidenceRefs',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function denseArray(value, code) {
  if (!Array.isArray(value) || value.length === 0) fail(code);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) fail(code);
  }
  return value;
}

function identityKeys(candidates) {
  const keys = denseArray(candidates, 'TEST_DELETION_BATCH_EMPTY').map((candidate) => {
    if (
      !isPlainObject(candidate) ||
      typeof candidate.identityKey !== 'string' ||
      candidate.identityKey.trim() === ''
    ) {
      fail('TEST_DELETION_CANDIDATE_INVALID');
    }
    return candidate.identityKey.trim();
  });
  if (new Set(keys).size !== keys.length) fail('TEST_DELETION_CANDIDATE_DUPLICATE');
  return keys.sort(compareText);
}

function compactCandidate(candidate) {
  return Object.fromEntries(
    REQUEST_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(candidate, field)).map(
      (field) => [field, candidate[field]]
    )
  );
}

function fallback(keys, bindings) {
  return {
    ...bindings,
    reviewMode: 'local_model_once',
    verdict: 'retain_on_demand',
    candidateIdentityKeys: keys,
    reviewProfileVersion: REVIEW_PROFILE_VERSION,
  };
}

async function reviewAmbiguousCandidatesOnce({
  candidates,
  invoke,
  timeoutMs,
  batchHash,
  evidenceHash,
  policyHash,
}) {
  const keys = identityKeys(candidates);
  const bindings = { batchHash, evidenceHash, policyHash };
  if (
    typeof invoke !== 'function' ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 300000
  ) {
    return fallback(keys, bindings);
  }

  let timeout;
  try {
    const response = await Promise.race([
      Promise.resolve(
        invoke({
          schemaVersion: 'test-deletion-review-request/v1',
          candidates: candidates.map(compactCandidate),
        })
      ),
      new Promise((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('LOCAL_REVIEW_TIMEOUT')), timeoutMs);
      }),
    ]);
    if (
      !isPlainObject(response) ||
      !VERDICTS.has(response.verdict) ||
      !Array.isArray(response.candidateIdentityKeys) ||
      response.candidateIdentityKeys.some((key) => typeof key !== 'string') ||
      response.candidateIdentityKeys.slice().sort(compareText).join('\0') !== keys.join('\0')
    ) {
      return fallback(keys, bindings);
    }
    return {
      ...bindings,
      reviewMode: 'local_model_once',
      verdict: response.verdict,
      candidateIdentityKeys: keys,
      reviewProfileVersion: REVIEW_PROFILE_VERSION,
    };
  } catch {
    return fallback(keys, bindings);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

module.exports = {
  REVIEW_PROFILE_VERSION,
  reviewAmbiguousCandidatesOnce,
};
