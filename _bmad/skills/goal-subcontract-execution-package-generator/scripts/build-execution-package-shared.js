'use strict';

const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sorted(value[key])])
  );
}

function stableJson(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function failure(failureClass, details = {}) {
  const error = new Error(failureClass);
  error.failureClass = failureClass;
  error.details = details;
  throw error;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith('--')) result[argv[index].slice(2)] = argv[index + 1] ?? true;
  }
  return result;
}

function resolveInside(root, relativePath, failureClass = 'path_escape') {
  if (!relativePath || path.isAbsolute(relativePath)) failure(failureClass, { path: relativePath });
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    failure(failureClass, { path: relativePath });
  }
  return resolved;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveExistingInside(root, relativePath, failureClass = 'path_escape') {
  const resolved = resolveInside(root, relativePath, failureClass);
  if (!fs.existsSync(resolved)) return resolved;
  const realRoot = fs.realpathSync.native(path.resolve(root));
  const realResolved = fs.realpathSync.native(resolved);
  if (!isInside(realRoot, realResolved)) failure(failureClass, { path: relativePath });
  return realResolved;
}

function readJson(filePath, failureClass = 'invalid_json') {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    failure(failureClass, { path: filePath, message: error.message });
  }
}

function verifySource(repositoryRoot, binding, failureClass) {
  if (!binding || typeof binding.path !== 'string' || typeof binding.hash !== 'string') {
    failure('invalid_source_binding');
  }
  const sourcePath = resolveExistingInside(repositoryRoot, binding.path, 'source_path_escape');
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    failure('source_file_missing', { path: binding.path });
  }
  const actualHash = sha256(fs.readFileSync(sourcePath));
  if (actualHash !== binding.hash) failure(failureClass, { path: binding.path, actualHash });
  return sourcePath;
}

function git(repositoryRoot, args, failureClass, input) {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    input,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    failure(failureClass, {
      stderr,
      stdout,
      message: result.error?.message || stderr || stdout,
    });
  }
  return typeof result.stdout === 'string' ? result.stdout.trim() : '';
}

function removeTemporaryFile(temporary, originalError) {
  try {
    fs.rmSync(temporary, { force: true });
  } catch (cleanupError) {
    if (originalError && typeof originalError === 'object') {
      originalError.cleanupError = cleanupError.message;
    }
  }
}

function writeAtomic(root, relativePath, content) {
  fs.mkdirSync(root, { recursive: true });
  const target = resolveInside(root, relativePath, 'package_output_path_escape');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const realRoot = fs.realpathSync.native(path.resolve(root));
  const realParent = fs.realpathSync.native(path.dirname(target));
  if (!isInside(realRoot, realParent)) {
    failure('package_output_path_escape', { path: relativePath });
  }
  if (fs.existsSync(target)) {
    const realTarget = fs.realpathSync.native(target);
    if (!isInside(realRoot, realTarget) || fs.lstatSync(target).isSymbolicLink()) {
      failure('package_output_path_escape', { path: relativePath });
    }
    if (fs.readFileSync(target, 'utf8') === content) return target;
    failure('package_output_conflict', { path: relativePath });
  }
  const temporary = `${target}.${process.pid}.${sha256(content).slice(7, 19)}.tmp`;
  if (fs.existsSync(temporary)) failure('package_output_conflict', { path: relativePath });
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, target);
    return target;
  } catch (error) {
    removeTemporaryFile(temporary, error);
    throw error;
  }
}

module.exports = {
  failure,
  git,
  isInside,
  parseArgs,
  readJson,
  resolveExistingInside,
  resolveInside,
  sha256,
  sorted,
  stableJson,
  verifySource,
  writeAtomic,
};
