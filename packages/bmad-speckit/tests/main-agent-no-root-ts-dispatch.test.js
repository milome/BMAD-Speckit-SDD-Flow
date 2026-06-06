const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const TSX_PATTERN = new RegExp(`\\b${['t', 's', 'x'].join('')}\\b`);
const TS_NODE_PATTERN = new RegExp(['t', 's', '-', 'n', 'o', 'd', 'e'].join(''));
const RUNTIME_TS_RUNNER_PATTERNS = [
  /\b(?:require|import)\s*\([^)]*['"]tsx['"]/,
  /\b(?:require|import)\s*\([^)]*['"]ts-node['"]/,
  /\b(?:spawnSync|execFileSync|execSync)\s*\([^;\n]*(?:tsx|ts-node)/,
  /\bnode\s+--loader\s+(?:tsx|ts-node)/,
];

function listPackageRuntimeTests() {
  return fs
    .readdirSync(path.join(PACKAGE_ROOT, 'tests'))
    .filter((name) => name.endsWith('.test.js'))
    .map((name) => path.join(PACKAGE_ROOT, 'tests', name));
}

describe('main-agent public dispatch root TypeScript guard', () => {
  it('keeps stable public main-agent commands out of runRepoScript and TypeScript runners', () => {
    const source = fs.readFileSync(PACKAGE_CLI, 'utf8');
    const markerIndex = source.indexOf(".command('main-agent'");
    assert.notEqual(markerIndex, -1, 'missing grouped main-agent command');
    const publicMainAgent = source.slice(markerIndex);

    assert.doesNotMatch(publicMainAgent, /runRepoScript\(/);
    assert.doesNotMatch(publicMainAgent, /main-agent-orchestration\.ts/);
    assert.doesNotMatch(publicMainAgent, TSX_PATTERN);
    assert.doesNotMatch(publicMainAgent, TS_NODE_PATTERN);
  });

  it('retains the root orchestration script as source_dev_only_or_compatibility_shim_after_wave_1', () => {
    const rootScript = path.join(PROJECT_ROOT, 'scripts', 'main-agent-orchestration.ts');

    assert.equal(fs.existsSync(rootScript), true);
  });

  it('keeps package runtime tests plain JavaScript without root TypeScript imports', () => {
    for (const filePath of listPackageRuntimeTests()) {
      const source = fs.readFileSync(filePath, 'utf8');

      assert.doesNotMatch(source, /\.\.\/\.\.\/scripts\/.*\.ts/);
      assert.doesNotMatch(source, /scripts\/main-agent-orchestration\.ts/);
      for (const pattern of RUNTIME_TS_RUNNER_PATTERNS) {
        assert.doesNotMatch(source, pattern);
      }
      assert.doesNotMatch(source, /D:\\Dev\\BMAD-Speckit-SDD-Flow/);
    }
  });
});
