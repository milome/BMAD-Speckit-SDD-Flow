'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const { assertGovernedPath, fail, writeCanonicalArtifact } = require('./canonical-artifact.cjs');

const MAX_MODEL_OUTPUT_BYTES = 1024 * 1024;
const RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'candidateIdentityKeys'],
  properties: {
    verdict: {
      type: 'string',
      enum: ['approve_delete', 'retain_on_demand', 'manual_review'],
    },
    candidateIdentityKeys: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      uniqueItems: true,
    },
  },
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateRequest(request) {
  if (
    !isPlainObject(request) ||
    request.schemaVersion !== 'test-deletion-review-request/v1' ||
    !Array.isArray(request.candidates) ||
    request.candidates.length === 0
  ) {
    fail('TEST_DELETION_LOCAL_REVIEW_REQUEST_INVALID');
  }
  return request;
}

function reviewPrompt(request) {
  return [
    'You are the independent local reviewer for a governed non-core test deletion batch.',
    'Read only the listed candidate test files and their directly referenced targets when needed.',
    'Do not modify files, run broad repository scans, or expand the requested scope.',
    'Approve only when every candidate has no unique semantic obligation, no active authority binding,',
    'no changed-code impact requirement, and an independent stronger oracle remains after deletion.',
    'If any candidate is uncertain or evidence is insufficient, retain the entire batch or request manual review.',
    'Return only the JSON object required by the supplied output schema.',
    '',
    canonicalJsonBytes(request).toString('utf8'),
  ].join('\n');
}

function readReviewResponse(responsePath) {
  if (!fs.existsSync(responsePath) || !fs.statSync(responsePath).isFile()) {
    fail('TEST_DELETION_LOCAL_REVIEW_OUTPUT_MISSING');
  }
  const bytes = fs.readFileSync(responsePath);
  if (bytes.length === 0 || bytes.length > MAX_MODEL_OUTPUT_BYTES) {
    fail('TEST_DELETION_LOCAL_REVIEW_OUTPUT_INVALID');
  }
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('TEST_DELETION_LOCAL_REVIEW_OUTPUT_INVALID');
  }
}

function createCodexLocalReviewInvoker({
  repoRoot = process.cwd(),
  timeoutMs,
  runCommand = spawnSync,
}) {
  const root = path.resolve(repoRoot);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) {
    fail('TEST_DELETION_LOCAL_REVIEW_TIMEOUT_INVALID');
  }
  return async (rawRequest) => {
    const request = validateRequest(rawRequest);
    const requestHash = sha256Bytes(canonicalJsonBytes(request)).slice('sha256:'.length);
    const outputDir = assertGovernedPath(
      root,
      path.join(root, '.artifacts', 'test-portfolio', 'deletion-batches', 'local-review')
    );
    fs.mkdirSync(outputDir, { recursive: true });
    const schemaReceipt = writeCanonicalArtifact({
      repoRoot: root,
      outputDir,
      fileName: `${requestHash}.schema.json`,
      artifact: RESPONSE_SCHEMA,
    });
    writeCanonicalArtifact({
      repoRoot: root,
      outputDir,
      fileName: `${requestHash}.request.json`,
      artifact: request,
    });
    const responsePath = assertGovernedPath(
      root,
      path.join(outputDir, `${requestHash}.response.json`)
    );
    const stdoutPath = assertGovernedPath(root, path.join(outputDir, `${requestHash}.stdout.log`));
    const stderrPath = assertGovernedPath(root, path.join(outputDir, `${requestHash}.stderr.log`));
    fs.rmSync(responsePath, { force: true });

    const args = [
      'exec',
      '--ephemeral',
      '--ignore-rules',
      '--sandbox',
      'read-only',
      '--color',
      'never',
      '--cd',
      root,
      '--output-schema',
      schemaReceipt.path,
      '--output-last-message',
      responsePath,
      '-',
    ];
    const result = runCommand('codex', args, {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
      input: reviewPrompt(request),
      maxBuffer: MAX_MODEL_OUTPUT_BYTES,
      shell: process.platform === 'win32',
      timeout: timeoutMs,
      windowsHide: true,
    });
    fs.writeFileSync(
      stdoutPath,
      String(result?.stdout || '').slice(0, MAX_MODEL_OUTPUT_BYTES),
      'utf8'
    );
    fs.writeFileSync(
      stderrPath,
      String(result?.stderr || '').slice(0, MAX_MODEL_OUTPUT_BYTES),
      'utf8'
    );
    if (result?.error || result?.status !== 0) {
      fail('TEST_DELETION_LOCAL_REVIEW_COMMAND_FAILED', {
        status: Number.isInteger(result?.status) ? result.status : null,
      });
    }
    return readReviewResponse(responsePath);
  };
}

module.exports = {
  createCodexLocalReviewInvoker,
};
