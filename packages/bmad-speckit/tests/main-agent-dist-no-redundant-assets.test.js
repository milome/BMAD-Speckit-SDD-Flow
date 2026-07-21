const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const BUILD_SCRIPT = path.join(PACKAGE_ROOT, 'scripts', 'build-main-agent-dist.cjs');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist', 'main-agent');
const SOURCE_AUTHORITY_DIST_ROOT = path.join(
  DIST_ROOT,
  'source-authority'
);
const RUNTIME_ASSET_MANIFEST = path.join(DIST_ROOT, 'runtime-asset-manifest.json');

function filesBelow(root, base = root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...filesBelow(fullPath, base));
      continue;
    }
    if (entry.isFile()) result.push(path.relative(base, fullPath).replace(/\\/g, '/'));
  }
  return result.sort();
}

test('main-agent dist does not mirror repository source trees into source-authority', () => {
  const stdout = execFileSync(process.execPath, [BUILD_SCRIPT], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  const files = filesBelow(SOURCE_AUTHORITY_DIST_ROOT);
  const forbiddenPrefixes = [
    '_bmad/',
    '_bmad-output/',
    '.specify/',
    'docs/',
    'tests/',
    'packages/bmad-speckit/src/',
    'packages/ralph-method/src/',
    'packages/runtime-context/src/',
    'packages/runtime-emit/src/',
    'packages/scoring/src/',
  ];
  const redundantFiles = files.filter((relativePath) =>
    forbiddenPrefixes.some((prefix) => relativePath.startsWith(prefix))
  );

  assert.deepEqual(
    redundantFiles,
    [],
    'source-authority dist must contain compiled runtime and declared assets, not source snapshots'
  );
  assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, 'dist', '_bmad')), false);
  assert.equal(fs.existsSync(RUNTIME_ASSET_MANIFEST), true, 'runtime asset manifest is required');

  const manifest = JSON.parse(fs.readFileSync(RUNTIME_ASSET_MANIFEST, 'utf8'));
  assert.equal(manifest.schemaVersion, 'bmad-speckit-main-agent-runtime-assets/v1');
  assert.ok(Array.isArray(manifest.entries) && manifest.entries.length > 0);
  for (const entry of manifest.entries) {
    assert.equal(typeof entry.purpose, 'string');
    assert.equal(typeof entry.source, 'string');
    assert.equal(typeof entry.target, 'string');
    assert.equal(typeof entry.consumer, 'string');
  }

  const declaredDistFiles = manifest.entries
    .map((entry) => entry.target)
    .filter((target) => target.startsWith('dist/main-agent/'))
    .map((target) => target.slice('dist/main-agent/'.length))
    .sort();
  assert.deepEqual(
    filesBelow(DIST_ROOT),
    declaredDistFiles,
    'clean dist must contain only files declared by the materialized runtime asset manifest'
  );
  assert.match(
    stdout,
    /outputFiles=\d+ manifestFiles=\d+ forbiddenPathHits=0 duplicateHashGroups=\d+/u
  );
});
