const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

function unique(values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    if (!value) continue;
    const resolved = path.resolve(value);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      result.push(resolved);
    }
  }
  return result;
}

function ancestorDirs(startDir) {
  const dirs = [];
  let current = path.resolve(startDir);
  while (true) {
    dirs.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

function packageName(rootDir) {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
    );
    return typeof packageJson.name === 'string' ? packageJson.name : null;
  } catch {
    return null;
  }
}

function modulePathExists(candidate) {
  return (
    fs.existsSync(candidate) ||
    fs.existsSync(`${candidate}.js`) ||
    fs.existsSync(`${candidate}.cjs`) ||
    fs.existsSync(path.join(candidate, 'index.js')) ||
    fs.existsSync(path.join(candidate, 'package.json'))
  );
}

function anchors() {
  return unique([
    process.env.BMAD_SPECKIT_PACKAGE_ROOT,
    process.cwd(),
    ...ancestorDirs(process.cwd()),
    __dirname,
    ...ancestorDirs(__dirname),
  ]);
}

function packageRootCandidates() {
  const candidates = [];
  const explicitRoot = process.env.BMAD_SPECKIT_PACKAGE_ROOT;
  if (explicitRoot) {
    candidates.push(
      explicitRoot,
      path.join(explicitRoot, 'node_modules', 'bmad-speckit-sdd-flow'),
      path.join(explicitRoot, 'node_modules', 'bmad-speckit'),
      path.join(explicitRoot, 'node_modules', 'bmad-speckit-sdd-flow', 'node_modules', 'bmad-speckit')
    );
  }

  for (const anchor of anchors()) {
    candidates.push(anchor);
    candidates.push(path.join(anchor, 'node_modules', 'bmad-speckit-sdd-flow'));
    candidates.push(path.join(anchor, 'node_modules', 'bmad-speckit'));
    candidates.push(
      path.join(anchor, 'node_modules', 'bmad-speckit-sdd-flow', 'node_modules', 'bmad-speckit')
    );
    candidates.push(path.join(anchor, 'packages', 'bmad-speckit'));
  }

  return unique(candidates).filter(
    (candidate) => fs.existsSync(candidate) || fs.existsSync(path.join(candidate, 'package.json'))
  );
}

function bmadSpeckitRootCandidates() {
  const candidates = [];
  const explicitRoot = process.env.BMAD_SPECKIT_PACKAGE_ROOT;
  if (explicitRoot) {
    candidates.push(
      explicitRoot,
      path.join(explicitRoot, 'packages', 'bmad-speckit'),
      path.join(explicitRoot, 'node_modules', 'bmad-speckit'),
      path.join(explicitRoot, 'node_modules', 'bmad-speckit-sdd-flow', 'node_modules', 'bmad-speckit')
    );
  }

  for (const anchor of anchors()) {
    if (packageName(anchor) === 'bmad-speckit') candidates.push(anchor);
    candidates.push(path.join(anchor, 'packages', 'bmad-speckit'));
    candidates.push(path.join(anchor, 'node_modules', 'bmad-speckit'));
    candidates.push(
      path.join(anchor, 'node_modules', 'bmad-speckit-sdd-flow', 'node_modules', 'bmad-speckit')
    );
  }

  return unique(candidates).filter(
    (candidate) => fs.existsSync(candidate) || fs.existsSync(path.join(candidate, 'package.json'))
  );
}

function checkedError(label, attempts) {
  const lines = attempts.map((attempt) => `- ${attempt.candidate}: ${attempt.error}`);
  return new Error(`Cannot resolve ${label}. Checked:\n${lines.join('\n')}`);
}

function requireRootPackageDependency(name) {
  const attempts = [];
  const resolvePaths = unique([process.cwd(), __dirname]);
  try {
    return require(require.resolve(name, { paths: resolvePaths }));
  } catch (error) {
    attempts.push({
      candidate: `${name} via require.resolve paths=${resolvePaths.join(', ')}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  for (const root of packageRootCandidates()) {
    try {
      return createRequire(path.join(root, 'package.json'))(name);
    } catch (error) {
      attempts.push({
        candidate: `${name} from ${root}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw checkedError(name, attempts);
}

function requireBmadSpeckit(subpath = '') {
  const normalizedSubpath = String(subpath || '').replace(/^[/\\]+/u, '');
  const packageRequest = normalizedSubpath ? `bmad-speckit/${normalizedSubpath}` : 'bmad-speckit';
  const attempts = [];
  const resolvePaths = unique([process.cwd(), __dirname]);
  try {
    return require(require.resolve(packageRequest, { paths: resolvePaths }));
  } catch (error) {
    attempts.push({
      candidate: `${packageRequest} via require.resolve paths=${resolvePaths.join(', ')}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  for (const root of bmadSpeckitRootCandidates()) {
    const candidate = normalizedSubpath ? path.join(root, normalizedSubpath) : root;
    if (!modulePathExists(candidate)) {
      attempts.push({ candidate, error: 'not found' });
      continue;
    }
    try {
      return require(candidate);
    } catch (error) {
      attempts.push({
        candidate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw checkedError(packageRequest, attempts);
}

function requireLargeDocumentWriter() {
  return requireBmadSpeckit('src/utils/large-document-writer');
}

function requireJsYaml() {
  return requireRootPackageDependency('js-yaml');
}

module.exports = {
  requireBmadSpeckit,
  requireRootPackageDependency,
  requireLargeDocumentWriter,
  requireJsYaml,
};
