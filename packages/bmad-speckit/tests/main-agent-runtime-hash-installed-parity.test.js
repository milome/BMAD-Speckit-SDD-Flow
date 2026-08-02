const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const {
  assertCurrentPartitionRuntimeEpoch,
} = require('../src/utils/goal-contract/partition-receipts.ts');

const packageRoot = path.resolve(__dirname, '..');
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

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 180_000,
  });
}

function runNpm(args, options) {
  if (process.platform === 'win32') {
    return run(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', 'call', 'npm.cmd', ...args],
      options
    );
  }
  return run('npm', args, options);
}

function expectSuccess(result, label) {
  assert.equal(
    result.status,
    0,
    `${label}\nstdout:\n${result.stdout ?? ''}\nstderr:\n${result.stderr ?? ''}`
  );
  return result;
}

function parsePackedPackage(stdout) {
  const jsonStart = stdout.indexOf('[');
  assert.ok(jsonStart >= 0, `npm pack output missing JSON payload: ${stdout}`);
  const parsed = JSON.parse(stdout.slice(jsonStart));
  assert.equal(Array.isArray(parsed), true);
  assert.equal(parsed.length, 1);
  return parsed[0];
}

function waitForNextEpoch() {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
}

test(
  'binds clean dist build to fresh packed and installed runtime hashes',
  { timeout: 600_000 },
  () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-runtime-parity-'));
    const packRoot = path.join(tempRoot, 'pack');
    const consumerRoot = path.join(tempRoot, 'consumer');
    const npmCacheRoot = path.join(tempRoot, 'npm-cache');
    fs.mkdirSync(packRoot, { recursive: true });
    fs.mkdirSync(consumerRoot, { recursive: true });
    fs.writeFileSync(
      path.join(consumerRoot, 'package.json'),
      `${JSON.stringify({
        name: 'main-agent-runtime-parity-consumer',
        version: '1.0.0',
        private: true,
      })}\n`,
      'utf8'
    );
    const npmEnv = {
      ...process.env,
      npm_config_cache: npmCacheRoot,
      npm_config_loglevel: 'error',
    };

    try {
      const packStartedAt = Date.now();
      const pack = parsePackedPackage(
        expectSuccess(
          runNpm(
            ['pack', packageRoot, '--json', '--pack-destination', packRoot],
            { cwd: packRoot, env: npmEnv, timeout: 300_000 }
          ),
          'fresh package pack failed'
        ).stdout
      );
      const tarballPath = path.join(packRoot, pack.filename);
      assert.ok(fs.statSync(tarballPath).mtimeMs >= packStartedAt, 'packed tarball is stale');
      const tarballHash = createHash('sha256')
        .update(fs.readFileSync(tarballPath))
        .digest('hex');
      assert.match(tarballHash, /^[a-f0-9]{64}$/u);
      const packedPaths = pack.files.map((entry) => String(entry.path).replace(/\\/gu, '/'));
      assert.equal(
        packedPaths.some(
          (entry) =>
            entry === 'src' ||
            entry.startsWith('src/') ||
            entry === 'tests' ||
            entry.startsWith('tests/') ||
            entry === 'test-nonempty' ||
            entry.startsWith('test-nonempty/') ||
            entry.split('/').some((segment) => segment.startsWith('__fixtures'))
        ),
        false
      );
      assert.equal(
        packedPaths.some((entry) =>
          entry.startsWith('dist/main-agent/source-authority/_bmad/')
        ),
        false
      );
      assert.equal(
        packedPaths.some((entry) =>
          /^dist\/main-agent\/source-authority\/packages\/[^/]+\/src\//u.test(entry)
        ),
        false
      );

      const extractedRoot = path.join(tempRoot, 'extracted');
      fs.mkdirSync(extractedRoot, { recursive: true });
      const tarCommand = process.platform === 'win32' ? 'tar.exe' : 'tar';
      expectSuccess(
        run(tarCommand, ['-xzf', tarballPath, '-C', extractedRoot], {
          cwd: tempRoot,
        }),
        'fresh package extraction failed'
      );
      const packedPackageRoot = path.join(extractedRoot, 'package');
      const buildAuthority = JSON.parse(
        fs.readFileSync(
          path.join(
            packedPackageRoot,
            'dist/main-agent/runtime-build-authority-receipt.json'
          ),
          'utf8'
        )
      );
      const runtimeIndexModule = require(path.join(
        packedPackageRoot,
        'dist/main-agent/source-authority/scripts/requirements-contract-package-runtime-index.js'
      ));
      const packedRuntimeHash = runtimeIndexModule.packageRuntimeHashFor(packedPackageRoot);
      const packedRuntimeFileCount =
        runtimeIndexModule.createPackageRuntimeIndex(packedPackageRoot).length;

      expectSuccess(
        runNpm(
          [
            'install',
            '--no-audit',
            '--no-fund',
            '--no-package-lock',
            '--no-save',
            '--install-links=false',
            tarballPath,
          ],
          { cwd: consumerRoot, env: npmEnv }
        ),
        'fresh package install failed'
      );
      const installedRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
      assert.equal(fs.lstatSync(installedRoot).isSymbolicLink(), false);
      assert.equal(fs.existsSync(path.join(installedRoot, 'src')), false);
      assert.equal(fs.existsSync(path.join(installedRoot, 'tests')), false);
      const installedRuntimeIndexModule = require(path.join(
        installedRoot,
        'dist/main-agent/source-authority/scripts/requirements-contract-package-runtime-index.js'
      ));
      const installedRuntimeHash =
        installedRuntimeIndexModule.packageRuntimeHashFor(installedRoot);
      const installedRuntimeFileCount =
        installedRuntimeIndexModule.createPackageRuntimeIndex(installedRoot).length;

      assert.match(buildAuthority.distBuildHash, /^sha256:[a-f0-9]{64}$/u);
      assert.match(buildAuthority.packageAssetSetHash, /^sha256:[a-f0-9]{64}$/u);
      assert.equal(
        buildAuthority.packageAssetSetHash,
        `sha256:${createHash('sha256')
          .update(JSON.stringify(buildAuthority.packageAssetEntries))
          .digest('hex')}`
      );
      assert.equal(buildAuthority.packageRuntimeHash, packedRuntimeHash);
      assert.equal(packedRuntimeHash, installedRuntimeHash);
      assert.equal(packedRuntimeFileCount, installedRuntimeFileCount);
      assert.ok(installedRuntimeFileCount > 0);

      const cli = expectSuccess(
        run(
          process.execPath,
          [path.join(installedRoot, 'bin', 'bmad-speckit.js'), 'version'],
          { cwd: consumerRoot }
        ),
        'installed CLI failed to load'
      );
      assert.match(cli.stdout, /\d+\.\d+\.\d+/u);
      assert.doesNotThrow(() =>
        require(path.join(installedRoot, 'dist/main-agent/index.js'))
      );
      const installedGoalContract = require(path.join(
        installedRoot,
        'dist',
        'commands',
        'goal-contract.js'
      ));
      assert.equal(typeof installedGoalContract.partition, 'function');
      const classifier = require(path.join(
        installedRoot,
        'dist/main-agent/source-authority/scripts/requirements-contract-artifact-role-classifier.js'
      ));
      const classification = classifier.classifyRequirementsContractArtifactRole({
        requestedArtifactRole: 'requirement_source_prd',
      });
      assert.equal(classification.ok, true);
      assert.equal(
        classification.classification.activationState,
        'active_production_authority'
      );
      assert.equal(fs.existsSync(path.join(installedRoot, '_bmad')), true);
      assert.equal(
        fs.existsSync(path.join(installedRoot, 'dist/main-agent/source-authority/_bmad')),
        false
      );
      for (const entry of buildAuthority.packageAssetEntries) {
        assert.equal(
          createHash('sha256')
            .update(fs.readFileSync(path.join(installedRoot, entry.target)))
            .digest('hex'),
          entry.targetHash,
          `installed package asset drifted: ${entry.target}`
        );
      }
      waitForNextEpoch();
      const nextRoot = path.join(tempRoot, 'next-epoch');
      const nextPackRoot = path.join(nextRoot, 'pack');
      const nextConsumerRoot = path.join(nextRoot, 'consumer');
      fs.mkdirSync(nextPackRoot, { recursive: true });
      fs.mkdirSync(nextConsumerRoot, { recursive: true });
      fs.writeFileSync(
        path.join(nextConsumerRoot, 'package.json'),
        `${JSON.stringify({
          name: 'main-agent-runtime-parity-consumer-next',
          version: '1.0.0',
          private: true,
        })}\n`,
        'utf8'
      );
      const nextStartedAt = Date.now();
      const nextPack = parsePackedPackage(
        expectSuccess(
          runNpm(
            ['pack', packageRoot, '--json', '--pack-destination', nextPackRoot],
            { cwd: nextPackRoot, env: npmEnv, timeout: 300_000 }
          ),
          'next package pack failed'
        ).stdout
      );
      const nextTarballPath = path.join(nextPackRoot, nextPack.filename);
      expectSuccess(
        runNpm(
          [
            'install',
            '--no-audit',
            '--no-fund',
            '--no-package-lock',
            '--no-save',
            '--install-links=false',
            nextTarballPath,
          ],
          { cwd: nextConsumerRoot, env: npmEnv }
        ),
        'next package install failed'
      );
      const nextInstalledRoot = path.join(
        nextConsumerRoot,
        'node_modules',
        'bmad-speckit'
      );
      const nextTarballHash = createHash('sha256')
        .update(fs.readFileSync(nextTarballPath))
        .digest('hex');
      assert.doesNotThrow(() =>
        assertCurrentPartitionRuntimeEpoch({
          runRoot: nextRoot,
          startedAt: nextStartedAt,
          artifacts: [
            {
              path: nextTarballPath,
              type: 'file',
              expectedHash: nextTarballHash,
            },
            {
              path: nextInstalledRoot,
              type: 'directory',
              freshnessMarker:
                'dist/main-agent/runtime-build-authority-receipt.json',
            },
          ],
        })
      );
      for (const stalePath of [tarballPath, installedRoot]) {
        assert.throws(
          () =>
            assertCurrentPartitionRuntimeEpoch({
              runRoot: nextRoot,
              startedAt: nextStartedAt,
              artifacts: [
                {
                  path: stalePath,
                  type: fs.statSync(stalePath).isDirectory()
                    ? 'directory'
                    : 'file',
                  freshnessMarker: fs.statSync(stalePath).isDirectory()
                    ? 'dist/main-agent/runtime-build-authority-receipt.json'
                    : undefined,
                },
              ],
            }),
          (error) =>
            error.failureClass ===
            'partition_runtime_epoch_artifact_outside_root'
        );
      }
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);
