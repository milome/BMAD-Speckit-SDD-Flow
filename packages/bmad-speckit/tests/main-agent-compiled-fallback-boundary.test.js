const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DIST_ENTRY = path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'index.js');

function makeConsumerRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-fallback-boundary-'));
  const recordsDir = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  fs.mkdirSync(recordsDir, { recursive: true });
  fs.writeFileSync(
    path.join(recordsDir, 'index.json'),
    JSON.stringify({ active: 'REQ-1', requirementSets: { 'REQ-1': { id: 'REQ-1' } } }),
    'utf8'
  );
  return root;
}

async function runWithoutCompiledFallback(argv) {
  const originalLoad = Module._load;
  Module._load = function guardedLoad(request, parent, isMain) {
    const value = String(request || '').replace(/\\/g, '/');
    if (value.includes('compiled/main-agent-orchestration.cjs')) {
      throw new Error(`covered action entered compiled fallback: ${request}`);
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const { mainAgentRuntimeCommand } = require(DIST_ENTRY);
    return await mainAgentRuntimeCommand(argv);
  } finally {
    Module._load = originalLoad;
  }
}

describe('main-agent compiled fallback boundary', () => {
  it('does not enter full orchestration bundle for package-native actions even when runtime state exists', async () => {
    const root = makeConsumerRoot();
    try {
      for (const action of [
        'inspect',
        'dispatch-plan',
        'compiled-prompt-runner',
        'implementation-readiness-gate',
        'unified-ingress',
        'delivery-closeout-gate',
        'delivery-evidence-run',
        'soak-runner',
        'dual-host-pr-orchestrator',
        'chaos-scenarios',
      ]) {
        const exitCode = await runWithoutCompiledFallback([action, '--cwd', root, '--json']);
        assert.equal(typeof exitCode, 'number');
      }
      const confirmExitCode = await runWithoutCompiledFallback([
        'confirm-scope',
        '--cwd',
        root,
        '--source',
        'requirements.md',
        '--json',
      ]);
      assert.equal(typeof confirmExitCode, 'number');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
