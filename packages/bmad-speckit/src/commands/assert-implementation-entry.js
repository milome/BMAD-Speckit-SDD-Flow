const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function resolveProjectRoot(opts) {
  return path.resolve(opts && opts.cwd ? opts.cwd : process.cwd());
}

function resolveEmitCli(root) {
  const candidates = [
    path.join(root, '.claude', 'hooks', 'emit-runtime-policy-cli.cjs'),
    path.join(root, '.cursor', 'hooks', 'emit-runtime-policy-cli.cjs'),
    path.join(root, 'scripts', 'emit-runtime-policy.cjs'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function assertImplementationEntryCommand(opts = {}) {
  const root = resolveProjectRoot(opts);
  const emitCli = resolveEmitCli(root);
  if (!emitCli) {
    throw new Error(
      'assert-implementation-entry: missing emit-runtime-policy entry (expected .claude/.cursor hooks or scripts/emit-runtime-policy.cjs)'
    );
  }

  const result = spawnSync(process.execPath, [emitCli, '--cwd', root], {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      `assert-implementation-entry: emit-runtime-policy failed: ${result.stderr || result.stdout || '(no output)'}`
    );
  }

  const raw = String(result.stdout || '').trim();
  if (!raw) {
    throw new Error('assert-implementation-entry: emit-runtime-policy returned empty stdout');
  }

  const policy = JSON.parse(raw);
  const gate = policy.implementationEntryGate;
  if (!gate || typeof gate !== 'object') {
    throw new Error('assert-implementation-entry: implementationEntryGate missing from policy output');
  }

  process.stdout.write(`${JSON.stringify(gate, null, 2)}\n`);
  if (gate.decision !== 'pass') {
    process.exitCode = 2;
  }
  return gate;
}

module.exports = { assertImplementationEntryCommand };
