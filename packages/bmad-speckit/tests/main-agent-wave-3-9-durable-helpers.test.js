const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SRC_ENTRY = path.join(PACKAGE_ROOT, 'src', 'main-agent', 'index.js');
const HELPERS = [
  ['governance-packet-execution-store', 'governancePacketExecutionStoreHelper'],
  ['governance-packet-reconciler', 'governancePacketReconcilerHelper'],
  ['governance-remediation-artifact', 'governanceRemediationArtifactHelper'],
  ['governance-remediation-config', 'governanceRemediationConfigHelper'],
  ['governance-remediation-runner', 'governanceRemediationRunnerHelper'],
  ['agent-display-names', 'agentDisplayNamesHelper'],
  ['load-manifest', 'loadManifestHelper'],
  ['party-mode-runtime-assets', 'partyModeRuntimeAssetsHelper'],
  ['model-governance-policy-filter', 'modelGovernancePolicyFilterHelper'],
  ['party-mode-runtime', 'partyModeRuntimeHelper'],
  ['prompt-routing-governance', 'promptRoutingGovernanceHelper'],
  ['prompt-routing-hints-schema', 'promptRoutingHintsSchemaHelper'],
  ['prompt-routing-hints', 'promptRoutingHintsHelper'],
  ['skill-inventory-provider', 'skillInventoryProviderHelper'],
];

const HELPER_FILES = ['helpers/durable-helper-report.js', ...HELPERS.map(([helperId]) => `helpers/${helperId}.js`)];
const TYPE_SCRIPT_RUNNER_PATTERN = new RegExp(`\\b${['t', 's', 'x'].join('')}\\b`);
const TS_NODE_PATTERN = new RegExp(['t', 's', '-', 'n', 'o', 'd', 'e'].join(''));

function makeConsumerRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-9-'));
}

async function captureRuntime(argv) {
  const { mainAgentRuntimeCommand } = require(SRC_ENTRY);
  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = function captureStdout(chunk, ...rest) {
    stdout += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  process.stderr.write = function captureStderr(chunk, ...rest) {
    stderr += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  try {
    const exitCode = await mainAgentRuntimeCommand(argv);
    return { exitCode, stdout, stderr };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

async function runWithoutCompiledFallback(argv) {
  const originalLoad = Module._load;
  Module._load = function guardedLoad(request, parent, isMain) {
    const normalized = String(request || '').replace(/\\/g, '/');
    if (normalized.includes('compiled/main-agent-orchestration.cjs')) {
      throw new Error(`covered helper entered compiled fallback: ${request}`);
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return await captureRuntime(argv);
  } finally {
    Module._load = originalLoad;
  }
}

describe('main-agent wave 3.9 durable helpers', () => {
  it('ships selected P4 helpers as package-local helper files without root dispatch', () => {
    for (const relativePath of HELPER_FILES) {
      const sourcePath = path.join(PACKAGE_ROOT, 'src', 'main-agent', relativePath);
      assert.equal(fs.existsSync(sourcePath), true, `missing ${relativePath}`);
      const source = fs.readFileSync(sourcePath, 'utf8');

      assert.doesNotMatch(source, /scripts[\\/].*\.(?:ts|js|cjs)/);
      assert.doesNotMatch(source, /runRepoScript\(/);
      assert.doesNotMatch(source, TYPE_SCRIPT_RUNNER_PATTERN);
      assert.doesNotMatch(source, TS_NODE_PATTERN);
      assert.doesNotMatch(source, /compiled[\\/]main-agent-orchestration\.cjs/);
    }
  });

  it('returns stable durable helper descriptors from package source modules', () => {
    const root = makeConsumerRoot();
    try {
      for (const [helperId, exportName] of HELPERS) {
        const helperModule = require(path.join(PACKAGE_ROOT, 'src', 'main-agent', 'helpers', `${helperId}.js`));
        assert.equal(typeof helperModule[exportName], 'function', `missing ${exportName}`);
        const descriptor = helperModule[exportName]({ cwd: root });

        assert.equal(descriptor.schemaVersion, 'main-agent-durable-helper/v1');
        assert.equal(descriptor.helperId, helperId);
        assert.equal(descriptor.cwd, root);
        assert.equal(descriptor.mode, 'durable_helper_copy');
        assert.equal(descriptor.targetSurface, 'package_main_agent_helper');
        assert.equal(descriptor.publicCliAction, false);
        assert.equal(descriptor.supportedConsumerInvocation, null);
        assert.equal(descriptor.consumerRuntimeProof.usedRootScript, false);
        assert.equal(descriptor.consumerRuntimeProof.usedCompiledFallback, false);
        assert.equal(descriptor.consumerRuntimeProof.usedTypeScriptRunner, false);
        assert.equal(
          descriptor.sourceAuthorityRuntimeProof.status,
          'source_authority_helper_loaded'
        );
        assert.match(
          descriptor.sourceAuthorityRuntimeProof.runtimePath,
          /(?:dist|src)\/main-agent\/source-authority\//
        );
        assert.equal(descriptor.sourceAuthorityRuntimeProof.usedRootScript, false);
        assert.equal(descriptor.sourceAuthorityRuntimeProof.usedCompiledFallback, false);
        assert.equal(descriptor.sourceAuthorityRuntimeProof.usedTypeScriptRunner, false);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not expose P4 durable helpers as public main-agent CLI actions', async () => {
    const root = makeConsumerRoot();
    try {
      for (const [helperId] of HELPERS) {
        const result = await runWithoutCompiledFallback([helperId, '--cwd', root, '--json']);
        const body = JSON.parse(result.stdout);

        assert.equal(result.stderr, '');
        assert.equal(result.exitCode, 2);
        assert.equal(body.schemaVersion, 'main-agent-package-runtime/v1');
        assert.equal(body.action, helperId);
        assert.equal(body.status, 'unsupported_main_agent_action');
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
