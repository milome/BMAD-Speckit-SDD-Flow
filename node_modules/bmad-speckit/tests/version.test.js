/**
 * VersionCommand unit tests (Story 13.1 - T1)
 * Run: node --test tests/version.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

let versionCommand;
try {
  versionCommand = require('../src/commands/version');
} catch (e) {
  versionCommand = null;
}

const tmpDir = path.join(os.tmpdir(), `bmad-speckit-version-${Date.now()}`);

describe('T1.1: versionCommand exists and returns version info', () => {
  it('module exists and exports versionCommand', () => {
    assert.ok(versionCommand, 'version module should exist');
    assert.strictEqual(typeof versionCommand.versionCommand, 'function');
  });

  it('versionCommand returns object with cliVersion, templateVersion, nodeVersion', () => {
    if (!versionCommand) return;
    const result = versionCommand.versionCommand({ cwd: tmpDir });
    assert.strictEqual(typeof result.cliVersion, 'string');
    assert.ok(result.cliVersion.length > 0);
    assert.ok(result.nodeVersion.startsWith('v'));
    assert.ok(result.templateVersion === null || typeof result.templateVersion === 'string');
  });
});

describe('T1.2: templateVersion from config', () => {
  it('reads templateVersion from bmad-speckit.json when exists', () => {
    if (!versionCommand) return;
    const cwd = path.join(tmpDir, 'with-config');
    const configDir = path.join(cwd, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({ templateVersion: 'v1.2.3', selectedAI: 'cursor-agent' }),
      'utf8'
    );
    const result = versionCommand.versionCommand({ cwd });
    assert.strictEqual(result.templateVersion, 'v1.2.3');
  });

  it('templateVersion null or unknown when no config', () => {
    if (!versionCommand) return;
    const cwd = path.join(tmpDir, 'no-config');
    fs.mkdirSync(cwd, { recursive: true });
    const result = versionCommand.versionCommand({ cwd });
    assert.ok(result.templateVersion === null || result.templateVersion === 'unknown' || result.templateVersion === '');
  });
});

describe('T1.3: --json output format', () => {
  it('versionCommand with json:true returns JSON-serializable object', () => {
    if (!versionCommand) return;
    const result = versionCommand.versionCommand({ cwd: tmpDir, json: true });
    const str = JSON.stringify(result);
    const parsed = JSON.parse(str);
    assert.strictEqual(typeof parsed.cliVersion, 'string');
    assert.strictEqual(typeof parsed.nodeVersion, 'string');
  });
});
