const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const packageRoot = path.resolve(__dirname, '..');
const buildScript = path.join(packageRoot, 'scripts', 'build-main-agent-dist.cjs');

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
  const parsed = JSON.parse(stdout);
  assert.equal(Array.isArray(parsed), true);
  assert.equal(parsed.length, 1);
  return parsed[0];
}

test(
  'binds clean dist build to fresh packed and installed runtime hashes',
  { timeout: 300_000 },
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
      expectSuccess(
        run(process.execPath, [buildScript], { cwd: packageRoot }),
        'clean main-agent dist build failed'
      );
      const buildAuthority = JSON.parse(
        fs.readFileSync(
          path.join(packageRoot, 'dist/main-agent/runtime-build-authority-receipt.json'),
          'utf8'
        )
      );

      const pack = parsePackedPackage(
        expectSuccess(
          runNpm(
            ['pack', '--ignore-scripts', '--json', '--pack-destination', packRoot],
            { cwd: packageRoot, env: npmEnv }
          ),
          'fresh package pack failed'
        ).stdout
      );
      const tarballPath = path.join(packRoot, pack.filename);
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
      const runtimeIndexModule = require(path.join(
        packageRoot,
        'dist/main-agent/source-authority/scripts/requirements-contract-package-runtime-index.js'
      ));
      const packedRuntimeHash = runtimeIndexModule.packageRuntimeHashFor(packedPackageRoot);
      const packedRuntimeFileCount =
        runtimeIndexModule.createPackageRuntimeIndex(packedPackageRoot).length;

      expectSuccess(
        runNpm(
          [
            'install',
            '--ignore-scripts',
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
      const installedRuntimeIndexModule = require(path.join(
        installedRoot,
        'dist/main-agent/source-authority/scripts/requirements-contract-package-runtime-index.js'
      ));
      const installedRuntimeHash =
        installedRuntimeIndexModule.packageRuntimeHashFor(installedRoot);
      const installedRuntimeFileCount =
        installedRuntimeIndexModule.createPackageRuntimeIndex(installedRoot).length;

      assert.match(buildAuthority.distBuildHash, /^sha256:[a-f0-9]{64}$/u);
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
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);
