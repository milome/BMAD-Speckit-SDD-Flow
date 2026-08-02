'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function fail(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  throw error;
}

function assertNoLinkedPathComponents(repoRoot, target) {
  const root = path.resolve(repoRoot);
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of ['', ...relative.split(path.sep)]) {
    if (segment) current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        fail('CI_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT', { target, component: current });
      }
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}

function assertGovernedPath(repoRoot, targetPath) {
  const allowedRoot = path.resolve(repoRoot, '.artifacts', 'test-portfolio');
  const target = path.resolve(targetPath);
  const relative = path.relative(allowedRoot, target);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    fail('CI_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT', { target });
  }
  assertNoLinkedPathComponents(repoRoot, target);
  return target;
}

function resolveOutputPath(repoRoot, outputDir, fileName) {
  const directory = path.isAbsolute(outputDir) ? outputDir : path.resolve(repoRoot, outputDir);
  return assertGovernedPath(repoRoot, path.resolve(directory, fileName));
}

function writeCanonicalArtifact({ repoRoot, outputDir, fileName, artifact }) {
  const target = resolveOutputPath(repoRoot, outputDir, fileName);
  const bytes = canonicalJsonBytes(artifact);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  assertGovernedPath(repoRoot, target);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  assertGovernedPath(repoRoot, temporary);
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    assertGovernedPath(repoRoot, temporary);
    assertGovernedPath(repoRoot, target);
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
  return {
    path: target,
    sha256: sha256Bytes(bytes),
    bytes: bytes.length,
  };
}

function readCanonicalArtifact({ repoRoot, filePath }) {
  const target = assertGovernedPath(repoRoot, filePath);
  const bytes = fs.readFileSync(target);
  const artifact = JSON.parse(bytes.toString('utf8'));
  const canonical = canonicalJsonBytes(artifact);
  if (!bytes.equals(canonical)) {
    fail('CI_ARTIFACT_NOT_CANONICAL', { target });
  }
  return {
    artifact,
    sha256: sha256Bytes(bytes),
  };
}

module.exports = {
  assertGovernedPath,
  compareText,
  fail,
  readCanonicalArtifact,
  resolveOutputPath,
  writeCanonicalArtifact,
};
