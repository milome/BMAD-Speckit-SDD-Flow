const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SOURCE_ACTIONS_ROOT = path.join(PACKAGE_ROOT, 'src', 'main-agent', 'actions');
const DIST_ACTIONS_ROOT = path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'actions');

const ROOT_NATIVE_GOAL_SCRIPTS = [
  'scripts/native-goal-command.ts',
  'scripts/main-agent-native-goal-invoker.ts',
];

function readRuntimeSource(root, fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8');
}

function assertPackageRuntimeModule(root, fileName, exportNames) {
  const filePath = path.join(root, fileName);
  assert.equal(fs.existsSync(filePath), true, `${fileName} must exist in package runtime`);
  const source = readRuntimeSource(root, fileName);
  assert.doesNotMatch(source, /scripts[\\/](?:native-goal-command|main-agent-native-goal-invoker)\.ts/);
  assert.doesNotMatch(source, /require\(['"].*scripts[\\/]/);
  assert.doesNotMatch(source, /\btsx\b/);
  assert.doesNotMatch(source, /\bts-node\b/);

  const mod = require(filePath);
  for (const exportName of exportNames) {
    assert.equal(typeof mod[exportName], 'function', `${fileName} missing ${exportName}`);
  }
}

describe('main-agent native goal package runtime authority', () => {
  it('keeps native goal source authority inside the package runtime only', () => {
    assertPackageRuntimeModule(SOURCE_ACTIONS_ROOT, 'native-goal-command.js', [
      'resolveNativeGoalCommand',
    ]);
    assertPackageRuntimeModule(SOURCE_ACTIONS_ROOT, 'native-goal-invoker.js', [
      'runNativeGoalInvocation',
    ]);

    for (const relativePath of ROOT_NATIVE_GOAL_SCRIPTS) {
      assert.equal(
        fs.existsSync(path.join(PROJECT_ROOT, relativePath)),
        false,
        `${relativePath} must not exist as a root runtime compatibility layer`
      );
    }
  });

  it('builds native goal runtime into dist without root TypeScript dependencies', () => {
    assertPackageRuntimeModule(DIST_ACTIONS_ROOT, 'native-goal-command.js', [
      'resolveNativeGoalCommand',
    ]);
    assertPackageRuntimeModule(DIST_ACTIONS_ROOT, 'native-goal-invoker.js', [
      'runNativeGoalInvocation',
    ]);
  });
});
