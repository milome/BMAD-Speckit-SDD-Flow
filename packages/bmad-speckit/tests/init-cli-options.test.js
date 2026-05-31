const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'bin', 'bmad-speckit.js');

describe('init CLI global skill write option', () => {
  it('exposes --allow-global-skill-writes and keeps project-local wording in help', () => {
    const result = spawnSync(process.execPath, [BIN, 'init', '--help'], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    });

    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /--allow-global-skill-writes/);
    assert.match(result.stdout, /project-local skill/);
    assert.match(result.stdout, /directories \(default\)/);
  });
});
