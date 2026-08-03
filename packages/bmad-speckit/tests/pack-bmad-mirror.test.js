const { after, before, test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  assertCurrentPartitionRuntimeEpoch,
} = require('../src/utils/goal-contract/partition-receipts.ts');

const packageRoot = path.join(__dirname, '..');
let packageTestSession;

function acquirePackageTestSessionLock(root) {
  const lockDir = path.join(
    root,
    'node_modules',
    '.package-test-session.lock'
  );
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  const startedAt = Date.now();
  while (Date.now() - startedAt < 900_000) {
    try {
      fs.mkdirSync(lockDir);
      return {
        release() {
          fs.rmSync(lockDir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (
        fs.existsSync(lockDir) &&
        Date.now() - fs.statSync(lockDir).mtimeMs > 7_200_000
      ) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  throw new Error(`timed out acquiring package test session lock: ${lockDir}`);
}

before(
  () => {
    packageTestSession = acquirePackageTestSessionLock(packageRoot);
  },
  { timeout: 900_000 }
);

after(() => {
  packageTestSession?.release();
});

const prepublishSource = path.join(
  packageRoot,
  'src/main-agent/source-authority/scripts/prepublish-check.ts'
);

function runNpm(args, options) {
  if (process.platform === 'win32') {
    return spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', 'call', 'npm.cmd', ...args],
      {
        ...options,
        shell: false,
        windowsHide: true,
      }
    );
  }
  return spawnSync('npm', args, {
    ...options,
    shell: false,
    windowsHide: true,
  });
}

function parsePack(stdout) {
  const jsonStart = stdout.indexOf('[');
  assert.ok(jsonStart >= 0, `npm pack output missing JSON payload: ${stdout}`);
  return JSON.parse(stdout.slice(jsonStart))[0];
}

function waitForNextEpoch() {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
}

test('uses the production runtime epoch freshness validator', () => {
  assert.equal(typeof assertCurrentPartitionRuntimeEpoch, 'function');
});

test('prepublish verifies the package _bmad mirror without producing it', () => {
  const source = fs.readFileSync(prepublishSource, 'utf8');
  assert.doesNotMatch(source, /\bsyncBmadMirror\b/u);
  assert.doesNotMatch(source, /copyDirContents\(source,\s*staging\)/u);
  assert.match(source, /\bverifyBmadMirror\b/u);
});

test('real npm pack preserves the package asset set without source snapshots', {
  timeout: 300_000,
}, () => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-contract-pack-'));
  const startedAt = Date.now();
  const result = runNpm(['pack', packageRoot, '--pack-destination', runRoot, '--json'], {
    cwd: runRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_cache: path.join(runRoot, 'npm-cache'),
      npm_config_loglevel: 'error',
    },
  });

  assert.strictEqual(
    result.status,
    0,
    `npm pack failed: ${result.error?.message || ''}\n${result.stderr || result.stdout}`
  );

  const packInfo = parsePack(result.stdout);
  const tarballPath = path.join(runRoot, packInfo.filename);
  assert.ok(fs.statSync(tarballPath).mtimeMs >= startedAt, 'tarball is stale');
  assert.match(
    createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex'),
    /^[a-f0-9]{64}$/u
  );
  const extractedRoot = path.join(runRoot, 'extracted');
  fs.mkdirSync(extractedRoot, { recursive: true });
  const tarCommand = process.platform === 'win32' ? 'tar.exe' : 'tar';
  const extraction = spawnSync(tarCommand, ['-xzf', tarballPath, '-C', extractedRoot], {
    cwd: runRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.strictEqual(
    extraction.status,
    0,
    `tarball extraction failed: ${extraction.error?.message || ''}\n${
      extraction.stderr || extraction.stdout
    }`
  );
  const packedPackageRoot = path.join(extractedRoot, 'package');
  const files = packInfo.files.map((file) => file.path);
  const hookCjs = files.filter((file) => /^_bmad\/.+\/hooks\/.+\.cjs$/.test(file));

  const expectedHookFiles = [
    'node_modules/@bmad-speckit/schema/run-score-schema.json',
    '_bmad/runtime/hooks/runtime-policy-inject-core.cjs',
    '_bmad/cursor/hooks/runtime-policy-inject.cjs',
    '_bmad/claude/hooks/runtime-policy-inject.cjs',
    '_bmad/_config/ai-tdd-six-model-manifest.csv',
    '_bmad/_config/ai-tdd-six-model-action-matrix.csv',
    '_bmad/_config/ai-tdd-six-model-skill-routes.csv',
    '_bmad/_config/ai-tdd-reconfirmation-route-matrix.csv',
    '_bmad/skills/ai-tdd-runtime-navigator/workflow.md',
    '_bmad/skills/large-document-writer/SKILL.md',
    '_bmad/skills/large-document-writer/agents/openai.yaml',
    '_bmad/skills/goal-contract-partition-orchestrator/SKILL.md',
    '_bmad/skills/goal-contract-partition-orchestrator/agents/openai.yaml',
    '_bmad/skills/goal-contract-partition-orchestrator/references/partition-protocol.md',
    'dist/runtime/bmad-help-renderer.js',
    'dist/runtime/bmads-renderer.js',
    'dist/runtime/ai-tdd/projection-manifest.js',
    'dist/runtime/ai-tdd/display-budget.js',
    'dist/runtime/ai-tdd/runtime-decision.js',
    'dist/commands/large-doc.js',
    'dist/utils/large-document-writer/index.js',
    'dist/main-agent/source-authority/scripts/requirements-contract-checkpoint-semantic-validation.js',
    'dist/main-agent/source-authority/schemas/requirements-contract-checkpoint-semantic-validation-receipt.schema.json',
  ];

  const expectedHookSubset = expectedHookFiles.filter((file) => file.endsWith('.cjs'));
  const expectedNonHookSubset = expectedHookFiles.filter((file) => !file.endsWith('.cjs'));

  for (const file of expectedHookSubset) {
    assert.ok(files.includes(file), `tarball missing ${file}`);
  }

  for (const file of expectedNonHookSubset) {
    assert.ok(files.includes(file), `tarball missing ${file}`);
  }

  assert.equal(
    files.some(
      (file) =>
        file === 'src' ||
        file.startsWith('src/') ||
        file === 'tests' ||
        file.startsWith('tests/') ||
        file.startsWith('dist/_bmad/') ||
        file.startsWith('dist/main-agent/source-authority/_bmad/')
    ),
    false
  );

  const buildAuthority = JSON.parse(
    fs.readFileSync(
      path.join(
        packedPackageRoot,
        'dist/main-agent/runtime-build-authority-receipt.json'
      ),
      'utf8'
    )
  );
  assert.equal(
    buildAuthority.packageAssetSetHash,
    `sha256:${createHash('sha256')
      .update(JSON.stringify(buildAuthority.packageAssetEntries))
      .digest('hex')}`
  );
  for (const entry of buildAuthority.packageAssetEntries) {
    assert.ok(files.includes(entry.target), `tarball missing package asset ${entry.target}`);
  }

  assert.ok(hookCjs.length >= 10, `expected multiple hook .cjs files, got ${hookCjs.length}`);

  waitForNextEpoch();
  const nextRunRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'goal-contract-pack-next-')
  );
  const nextStartedAt = Date.now();
  const nextResult = runNpm(
    ['pack', packageRoot, '--pack-destination', nextRunRoot, '--json'],
    {
      cwd: nextRunRoot,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      env: {
        ...process.env,
        npm_config_cache: path.join(nextRunRoot, 'npm-cache'),
        npm_config_loglevel: 'error',
      },
    }
  );
  assert.strictEqual(
    nextResult.status,
    0,
    `next npm pack failed: ${nextResult.error?.message || ''}\n${
      nextResult.stderr || nextResult.stdout
    }`
  );
  const nextPackInfo = parsePack(nextResult.stdout);
  const nextTarballPath = path.join(nextRunRoot, nextPackInfo.filename);
  const nextTarballHash = createHash('sha256')
    .update(fs.readFileSync(nextTarballPath))
    .digest('hex');
  assert.doesNotThrow(() =>
    assertCurrentPartitionRuntimeEpoch({
      runRoot: nextRunRoot,
      startedAt: nextStartedAt,
      artifacts: [
        {
          path: nextTarballPath,
          type: 'file',
          expectedHash: nextTarballHash,
        },
      ],
    })
  );
  assert.throws(
    () =>
      assertCurrentPartitionRuntimeEpoch({
        runRoot: nextRunRoot,
        startedAt: nextStartedAt,
        artifacts: [{ path: tarballPath, type: 'file' }],
      }),
    (error) =>
      error.failureClass === 'partition_runtime_epoch_artifact_outside_root'
  );

  fs.rmSync(nextRunRoot, { recursive: true, force: true });
  fs.rmSync(runRoot, { recursive: true, force: true });
});
