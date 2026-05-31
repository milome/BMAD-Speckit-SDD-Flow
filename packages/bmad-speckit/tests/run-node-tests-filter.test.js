const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const runnerSource = path.resolve(__dirname, '..', 'scripts', 'run-node-tests.cjs');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createFixtureProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-node-tests-filter-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(runnerSource, path.join(root, 'scripts', 'run-node-tests.cjs'));
  return root;
}

describe('run-node-tests.cjs filters', () => {
  it('runs only the basename-matched test file', () => {
    const root = createFixtureProject();
    try {
      const markerOne = JSON.stringify(path.join(root, 'one-ran.txt'));
      const markerTwo = JSON.stringify(path.join(root, 'two-ran.txt'));
      writeFile(
        path.join(root, 'tests', 'one.test.js'),
        `const { test } = require('node:test'); require('node:fs').writeFileSync(${markerOne}, '1'); test('one', () => {});\n`,
      );
      writeFile(
        path.join(root, 'tests', 'nested', 'two.test.js'),
        `const { test } = require('node:test'); require('node:fs').writeFileSync(${markerTwo}, '1'); test('two', () => {});\n`,
      );

      const result = spawnSync(process.execPath, ['scripts/run-node-tests.cjs', 'one.test.js'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.strictEqual(result.status, 0, `${result.stderr}\n${result.stdout}`);
      assert.strictEqual(fs.existsSync(path.join(root, 'one-ran.txt')), true, `${result.stderr}\n${result.stdout}`);
      assert.strictEqual(fs.existsSync(path.join(root, 'two-ran.txt')), false, `${result.stderr}\n${result.stdout}`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs only the normalized relative path matched test file', () => {
    const root = createFixtureProject();
    try {
      const markerTarget = JSON.stringify(path.join(root, 'target-ran.txt'));
      const markerOther = JSON.stringify(path.join(root, 'other-ran.txt'));
      writeFile(
        path.join(root, 'tests', 'e2e', 'target.test.js'),
        `const { test } = require('node:test'); require('node:fs').writeFileSync(${markerTarget}, '1'); test('target', () => {});\n`,
      );
      writeFile(
        path.join(root, 'tests', 'other.test.js'),
        `const { test } = require('node:test'); require('node:fs').writeFileSync(${markerOther}, '1'); test('other', () => {});\n`,
      );

      const result = spawnSync(process.execPath, ['scripts/run-node-tests.cjs', 'e2e/target.test.js'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.strictEqual(result.status, 0, `${result.stderr}\n${result.stdout}`);
      assert.strictEqual(fs.existsSync(path.join(root, 'target-ran.txt')), true, `${result.stderr}\n${result.stdout}`);
      assert.strictEqual(fs.existsSync(path.join(root, 'other-ran.txt')), false, `${result.stderr}\n${result.stdout}`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when no test file matches a provided filter', () => {
    const root = createFixtureProject();
    try {
      writeFile(
        path.join(root, 'tests', 'one.test.js'),
        "const { test } = require('node:test'); test('one', () => console.log('SHOULD_NOT_RUN'));\n",
      );

      const result = spawnSync(process.execPath, ['scripts/run-node-tests.cjs', 'missing.test.js'], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.strictEqual(result.status, 1);
      assert.match(result.stderr, /No tests matched filters: missing\.test\.js/);
      assert.doesNotMatch(result.stdout, /SHOULD_NOT_RUN/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
