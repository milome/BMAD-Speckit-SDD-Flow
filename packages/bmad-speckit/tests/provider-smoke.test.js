const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { providerSmokeCommand } = require('../src/commands/provider-smoke.js');

describe('provider-smoke command', () => {
  it('returns a successful stub smoke result from governance config', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-smoke-'));
    const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      [
        'version: 2',
        'primaryHost: cursor',
        'packetHosts:',
        '  - cursor',
        'provider:',
        '  mode: stub',
        '  id: smoke-provider-stub',
      ].join('\n'),
      'utf8'
    );

    const outputs = [];
    try {
      await providerSmokeCommand(
        {
          config: configPath,
        },
        {
          cwd: root,
          log: (line) => outputs.push(line),
        }
      );

      assert.equal(outputs.length, 1);
      const parsed = JSON.parse(outputs[0]);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.provider.id, 'smoke-provider-stub');
      assert.equal(parsed.provider.mode, 'stub');
      assert.equal(parsed.transport, 'stub');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
