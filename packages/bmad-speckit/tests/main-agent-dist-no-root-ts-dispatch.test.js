const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const ROOT_SHIM = path.join(PROJECT_ROOT, 'scripts', 'bmad-speckit-cli.js');
const FORBIDDEN_DISPATCH = /runRepoScript\(|scripts[\\/]main-agent-orchestration\.ts|\btsx\b|ts-node/;
const COVERED_COMMANDS = [
  'main-agent',
  'main-agent-orchestration',
  'confirm-scope',
  'main-agent:confirm-scope',
];

function commandBlock(source, command) {
  const patterns = [
    `.command('${command}'`,
    `.command("${command}"`,
    `.command('${command} '`,
    `.command("${command} `,
  ];
  const starts = patterns.map((pattern) => source.indexOf(pattern)).filter((index) => index !== -1);
  const start = starts.length === 0 ? -1 : Math.min(...starts);
  assert.notEqual(start, -1, `missing covered command ${command}`);
  const next = source.indexOf('\nprogram', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe('main-agent dist dispatch guard', () => {
  it('routes every covered CLI command block through dist/main-agent', () => {
    const source = fs.readFileSync(PACKAGE_CLI, 'utf8');
    for (const command of COVERED_COMMANDS) {
      const block = commandBlock(source, command);
      assert.match(block, /\.\.\/dist\/main-agent\/index\.js/);
      assert.doesNotMatch(block, FORBIDDEN_DISPATCH);
    }
  });

  it('keeps the root bin shim as a package CLI forwarder only', () => {
    const shim = fs.readFileSync(ROOT_SHIM, 'utf8');
    assert.match(shim, /node_modules/);
    assert.match(shim, /bmad-speckit/);
    assert.match(shim, /bin/);
    assert.doesNotMatch(shim, FORBIDDEN_DISPATCH);
  });
});
