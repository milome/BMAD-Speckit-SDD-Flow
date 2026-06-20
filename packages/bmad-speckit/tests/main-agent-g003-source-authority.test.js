const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SRC_ENTRY = path.join(PACKAGE_ROOT, 'src', 'main-agent', 'index.js');
const SOURCE_AUTHORITY_ENTRY = path.join(
  PACKAGE_ROOT,
  'src',
  'main-agent',
  'source-authority',
  'scripts',
  'main-agent-orchestration.js'
);

function makeConsumerRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-g003-source-authority-'));
  const recordsDir = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  fs.mkdirSync(recordsDir, { recursive: true });
  fs.writeFileSync(
    path.join(recordsDir, 'index.json'),
    JSON.stringify({ active: 'REQ-1', requirementSets: { 'REQ-1': { id: 'REQ-1' } } }),
    'utf8'
  );
  return root;
}

async function runGuarded(argv) {
  const originalLoad = Module._load;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  let stdout = '';
  let stderr = '';
  Module._load = function guardedLoad(request, parent, isMain) {
    const value = String(request || '').replace(/\\/g, '/');
    if (value.includes('compiled/main-agent-orchestration.cjs')) {
      throw new Error(`G003 source authority entered compiled fallback: ${request}`);
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  process.stdout.write = function writeStdout(chunk, ...rest) {
    stdout += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  process.stderr.write = function writeStderr(chunk, ...rest) {
    stderr += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  try {
    delete require.cache[require.resolve(SRC_ENTRY)];
    const { mainAgentRuntimeCommand } = require(SRC_ENTRY);
    const exitCode = await mainAgentRuntimeCommand(argv);
    return { exitCode, stdout, stderr };
  } finally {
    Module._load = originalLoad;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

describe('main-agent G003 package source authority', () => {
  it('loads package-local main-agent orchestration source without compiled fallback', () => {
    const sourceAuthority = require(SOURCE_AUTHORITY_ENTRY);

    assert.equal(typeof sourceAuthority.mainMainAgentOrchestration, 'function');
    assert.equal(typeof sourceAuthority.mainMainAgentOrchestrationAsync, 'function');
  });

  it('runs G003 run-loop through package source authority instead of the compiled fallback', async () => {
    const root = makeConsumerRoot();
    try {
      const result = await runGuarded(['run-loop', '--cwd', root, '--json']);
      assert.equal(typeof result.exitCode, 'number');
      assert.match(result.stdout, /main-agent-run-loop|NO_ACTIVE_REQUIREMENT|no_active_requirement/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs G003 legacy-only actions through package source authority instead of unsupported action fallback', async () => {
    const root = makeConsumerRoot();
    try {
      const result = await runGuarded([
        '--legacy-orchestration',
        '--action',
        'route-intake',
        '--cwd',
        root,
        '--json',
      ]);
      assert.notEqual(result.exitCode, 0);
      assert.match(result.stderr, /route-intake requires --input <json-file> or --payload <json>/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
