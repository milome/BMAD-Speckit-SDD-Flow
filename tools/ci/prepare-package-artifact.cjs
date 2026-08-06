'use strict';

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const {
  assertGovernedPath,
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');

const NPM_PACK_JSON_CAPTURE_MAX_BYTES = 32 * 1024 * 1024;
const PACKAGE_WORKSPACE_PREFIX = 'bmad-ci-package-';
const BUILD_COMMAND = Object.freeze({ command: 'npm', args: ['run', 'prepack'] });
const PACK_COMMAND = Object.freeze({
  command: 'npm',
  args: ['pack', '--ignore-scripts', '--json'],
});
const DESCRIPTOR_FIELDS = Object.freeze([
  'schemaVersion',
  'commitSha',
  'packageName',
  'packageVersion',
  'tarballPath',
  'tarballSha256',
  'buildCommandHash',
  'packCommandHash',
]);

function defaultRunCommand({ command, args, cwd, env, captureOutput = false }) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    ...(captureOutput ? { maxBuffer: NPM_PACK_JSON_CAPTURE_MAX_BYTES } : {}),
  });
  if (result.error) {
    if (captureOutput && result.error.code === 'ENOBUFS') {
      fail('CANONICAL_PACKAGE_CAPTURE_LIMIT_EXCEEDED', {
        maxBytes: NPM_PACK_JSON_CAPTURE_MAX_BYTES,
      });
    }
    throw result.error;
  }
  return {
    status: result.status ?? 1,
    stdout: captureOutput ? result.stdout || '' : '',
    stderr: captureOutput ? result.stderr || '' : '',
  };
}

function normalizeCommitSha(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/iu.test(value)) {
    fail('CANONICAL_PACKAGE_COMMIT_INVALID');
  }
  return value.toLowerCase();
}

function commandHash(command, args) {
  return sha256Bytes(canonicalJsonBytes({ command, args }));
}

function expectedBuildCommandHash() {
  return commandHash(BUILD_COMMAND.command, BUILD_COMMAND.args);
}

function expectedPackCommandHash() {
  return commandHash(PACK_COMMAND.command, [
    'pack',
    '--ignore-scripts',
    '--json',
    '--pack-destination',
    '<governed-output>',
  ]);
}

function resolveRepoFile(repoRoot, relativePath, code) {
  if (
    typeof relativePath !== 'string' ||
    relativePath === '' ||
    /^[A-Za-z]:/u.test(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    path.posix.isAbsolute(relativePath)
  ) {
    fail(code);
  }
  const target = path.resolve(repoRoot, relativePath);
  const relative = path.relative(path.resolve(repoRoot), target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(code);
  }
  return target;
}

function gitOutput(repoRoot, args, code) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    fail(code, {
      status: error?.status ?? null,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function pathInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

function dependencyLinkType(targetPath) {
  if (!fs.statSync(targetPath).isDirectory()) return 'file';
  return process.platform === 'win32' ? 'junction' : 'dir';
}

function dependencyLinkTarget(targetPath, dependencyPath) {
  const relative = path.relative(path.dirname(targetPath), dependencyPath);
  return relative !== '' && !path.isAbsolute(relative) ? relative : dependencyPath;
}

function projectDependencyEntry({ sourcePath, targetPath, repoRoot, stagingRoot }) {
  const sourceStat = fs.lstatSync(sourcePath);
  if (sourceStat.isSymbolicLink()) {
    const resolvedSource = fs.realpathSync(sourcePath);
    const resolvedTarget = pathInside(repoRoot, resolvedSource)
      ? path.resolve(stagingRoot, path.relative(path.resolve(repoRoot), resolvedSource))
      : resolvedSource;
    if (!fs.existsSync(resolvedTarget)) {
      fail('CANONICAL_PACKAGE_WORKSPACE_DEPENDENCY_MISSING', {
        dependencyPath: sourcePath,
      });
    }
    fs.symlinkSync(
      dependencyLinkTarget(targetPath, resolvedTarget),
      targetPath,
      dependencyLinkType(resolvedTarget)
    );
    return;
  }
  if (sourceStat.isDirectory()) {
    fs.symlinkSync(dependencyLinkTarget(targetPath, sourcePath), targetPath, 'dir');
    return;
  }
  fs.copyFileSync(sourcePath, targetPath);
}

function projectNodeModules({ repoRoot, stagingRoot }) {
  const sourceRoot = path.join(repoRoot, 'node_modules');
  if (!fs.existsSync(sourceRoot)) return;
  const targetRoot = path.join(stagingRoot, 'node_modules');
  fs.mkdirSync(targetRoot, { recursive: true });

  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.bin') continue;
    const sourcePath = path.join(sourceRoot, entry.name);
    const targetPath = path.join(targetRoot, entry.name);
    if (entry.name.startsWith('@') && entry.isDirectory() && !entry.isSymbolicLink()) {
      fs.mkdirSync(targetPath, { recursive: true });
      for (const scopedEntry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
        projectDependencyEntry({
          sourcePath: path.join(sourcePath, scopedEntry.name),
          targetPath: path.join(targetPath, scopedEntry.name),
          repoRoot,
          stagingRoot,
        });
      }
      continue;
    }
    projectDependencyEntry({
      sourcePath,
      targetPath,
      repoRoot,
      stagingRoot,
    });
  }
}

function packageWorkspaceBase(repoRoot) {
  const base =
    process.platform === 'win32'
      ? path.join(path.parse(path.resolve(repoRoot)).root, '.bmad-ci')
      : os.tmpdir();
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function removePackageWorktree({ repoRoot, stagingParent, stagingRoot }) {
  try {
    gitOutput(
      repoRoot,
      ['worktree', 'remove', '--force', stagingRoot],
      'CANONICAL_PACKAGE_WORKSPACE_CLEANUP_FAILED'
    );
  } catch (gitRemoveError) {
    if (!pathInside(stagingParent, stagingRoot)) {
      throw gitRemoveError;
    }
    try {
      fs.rmSync(stagingRoot, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
      gitOutput(
        repoRoot,
        ['worktree', 'prune', '--expire', 'now'],
        'CANONICAL_PACKAGE_WORKSPACE_CLEANUP_FAILED'
      );
    } catch {
      throw gitRemoveError;
    }
  }
  fs.rmSync(stagingParent, { recursive: true, force: true });
}

function createPackageWorkspace({ repoRoot, commitSha }) {
  if (!fs.existsSync(path.join(repoRoot, '.git'))) {
    return {
      root: repoRoot,
      cleanup() {},
    };
  }

  const resolvedCommit = gitOutput(
    repoRoot,
    ['rev-parse', '--verify', `${commitSha}^{commit}`],
    'CANONICAL_PACKAGE_COMMIT_UNAVAILABLE'
  ).toLowerCase();
  if (resolvedCommit !== commitSha) fail('CANONICAL_PACKAGE_COMMIT_UNAVAILABLE');

  const stagingParent = fs.mkdtempSync(
    path.join(packageWorkspaceBase(repoRoot), PACKAGE_WORKSPACE_PREFIX)
  );
  const stagingRoot = path.join(stagingParent, 'w');
  let worktreeAdded = false;
  try {
    gitOutput(
      repoRoot,
      ['worktree', 'add', '--detach', '--force', stagingRoot, commitSha],
      'CANONICAL_PACKAGE_WORKSPACE_CREATE_FAILED'
    );
    worktreeAdded = true;
    const stagingNodeModules = path.join(stagingRoot, 'node_modules');
    projectNodeModules({ repoRoot, stagingRoot });
    return {
      root: stagingRoot,
      cleanup() {
        if (!pathInside(stagingRoot, stagingNodeModules)) {
          fail('CANONICAL_PACKAGE_WORKSPACE_CLEANUP_FAILED');
        }
        fs.rmSync(stagingNodeModules, { recursive: true, force: true });
        removePackageWorktree({ repoRoot, stagingParent, stagingRoot });
      },
    };
  } catch (error) {
    if (worktreeAdded) {
      try {
        removePackageWorktree({ repoRoot, stagingParent, stagingRoot });
      } catch {}
    } else {
      fs.rmSync(stagingParent, { recursive: true, force: true });
    }
    throw error;
  }
}

function parsePackFilename(stdout) {
  let payload;
  try {
    payload = JSON.parse(String(stdout || ''));
  } catch {
    fail('CANONICAL_PACKAGE_PACK_OUTPUT_INVALID');
  }
  const filename = Array.isArray(payload) ? payload[0]?.filename : payload?.filename;
  if (
    typeof filename !== 'string' ||
    filename === '' ||
    filename !== path.basename(filename) ||
    !filename.endsWith('.tgz')
  ) {
    fail('CANONICAL_PACKAGE_PACK_OUTPUT_INVALID');
  }
  return filename;
}

function descriptorBody(descriptor) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    fail('CANONICAL_PACKAGE_DESCRIPTOR_INVALID');
  }
  const body = Object.fromEntries(DESCRIPTOR_FIELDS.map((field) => [field, descriptor[field]]));
  if (body.schemaVersion !== 'canonical-package/v1') {
    fail('CANONICAL_PACKAGE_DESCRIPTOR_INVALID');
  }
  body.commitSha = normalizeCommitSha(body.commitSha);
  for (const field of ['packageName', 'packageVersion']) {
    if (typeof body[field] !== 'string' || body[field].trim() === '') {
      fail('CANONICAL_PACKAGE_DESCRIPTOR_INVALID');
    }
  }
  for (const field of ['tarballSha256', 'buildCommandHash', 'packCommandHash']) {
    if (typeof body[field] !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(body[field])) {
      fail('CANONICAL_PACKAGE_DESCRIPTOR_INVALID');
    }
  }
  if (typeof body.tarballPath !== 'string' || body.tarballPath.trim() === '') {
    fail('CANONICAL_PACKAGE_DESCRIPTOR_INVALID');
  }
  return body;
}

function validatePackageDescriptor({
  repoRoot = process.cwd(),
  descriptor,
  descriptorPath,
  expectedCommitSha,
}) {
  const body = descriptorBody(descriptor);
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const expected = {
    commitSha: expectedCommitSha ? normalizeCommitSha(expectedCommitSha) : body.commitSha,
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    buildCommandHash: expectedBuildCommandHash(),
    packCommandHash: expectedPackCommandHash(),
  };
  if (
    body.commitSha !== expected.commitSha ||
    body.packageName !== expected.packageName ||
    body.packageVersion !== expected.packageVersion ||
    body.buildCommandHash !== expected.buildCommandHash ||
    body.packCommandHash !== expected.packCommandHash
  ) {
    fail('CANONICAL_PACKAGE_DESCRIPTOR_AUTHORITY_MISMATCH');
  }
  if (descriptorPath) {
    const stored = readCanonicalArtifact({ repoRoot, filePath: descriptorPath }).artifact;
    if (!canonicalJsonBytes(stored).equals(canonicalJsonBytes(body))) {
      fail('CANONICAL_PACKAGE_DESCRIPTOR_AUTHORITY_MISMATCH');
    }
  }
  const tarball = resolveRepoFile(repoRoot, body.tarballPath, 'CANONICAL_PACKAGE_PATH_INVALID');
  if (!fs.existsSync(tarball) || !fs.statSync(tarball).isFile()) {
    fail('CANONICAL_PACKAGE_TARBALL_MISSING');
  }
  const actualHash = sha256Bytes(fs.readFileSync(tarball));
  if (actualHash !== body.tarballSha256) {
    fail('CANONICAL_PACKAGE_HASH_MISMATCH');
  }
  return descriptor;
}

function preparePackageArtifact({
  repoRoot = process.cwd(),
  outputDir = '.artifacts/test-portfolio/package',
  commitSha,
  runCommand = defaultRunCommand,
}) {
  const normalizedCommitSha = normalizeCommitSha(commitSha);
  const packageOutput = path.resolve(repoRoot, outputDir);
  assertGovernedPath(repoRoot, packageOutput);
  fs.rmSync(packageOutput, { recursive: true, force: true });
  fs.mkdirSync(packageOutput, { recursive: true });
  const workspace = createPackageWorkspace({
    repoRoot,
    commitSha: normalizedCommitSha,
  });
  const packageWorkspaceRoot = workspace.root;
  const workspacePackageJson = JSON.parse(
    fs.readFileSync(path.join(packageWorkspaceRoot, 'package.json'), 'utf8')
  );

  const buildCommand = BUILD_COMMAND;
  const packCommand = {
    command: PACK_COMMAND.command,
    args: [...PACK_COMMAND.args, '--pack-destination', packageOutput],
  };
  let prepared;
  let primaryError;
  let primaryErrorCaught = false;
  let cleanup;
  let cleanupError;
  let workspaceCleanupError;
  try {
    const build = runCommand({
      kind: 'build',
      ...buildCommand,
      cwd: packageWorkspaceRoot,
      env: { ...process.env, CI_COMMIT_SHA: normalizedCommitSha },
    });
    if (build?.status !== 0) fail('CANONICAL_PACKAGE_BUILD_FAILED');

    const packed = runCommand({
      kind: 'npm_pack',
      ...packCommand,
      cwd: packageWorkspaceRoot,
      outputDir: packageOutput,
      captureOutput: true,
      env: { ...process.env, CI_COMMIT_SHA: normalizedCommitSha },
    });
    if (packed?.status !== 0) {
      fail('CANONICAL_PACKAGE_PACK_FAILED', {
        status: packed?.status ?? null,
        stderr: String(packed?.stderr || '').slice(-4096),
      });
    }
    const tarballName = parsePackFilename(packed.stdout);
    const tarball = path.join(packageOutput, tarballName);
    if (!fs.existsSync(tarball) || !fs.statSync(tarball).isFile()) {
      fail('CANONICAL_PACKAGE_TARBALL_MISSING');
    }
    const descriptor = {
      schemaVersion: 'canonical-package/v1',
      commitSha: normalizedCommitSha,
      packageName: workspacePackageJson.name,
      packageVersion: workspacePackageJson.version,
      tarballPath: path.relative(repoRoot, tarball).replace(/\\/g, '/'),
      tarballSha256: sha256Bytes(fs.readFileSync(tarball)),
      buildCommandHash: expectedBuildCommandHash(),
      packCommandHash: expectedPackCommandHash(),
    };
    const receipt = writeCanonicalArtifact({
      repoRoot,
      outputDir,
      fileName: 'canonical-package.json',
      artifact: descriptor,
    });
    prepared = {
      ...descriptor,
      descriptorPath: receipt.path,
      descriptorSha256: receipt.sha256,
    };
  } catch (error) {
    primaryError = error;
    primaryErrorCaught = true;
  } finally {
    try {
      cleanup = runCommand({
        kind: 'cleanup',
        command: 'npm',
        args: ['run', 'postpack'],
        cwd: packageWorkspaceRoot,
        env: { ...process.env, CI_COMMIT_SHA: normalizedCommitSha },
      });
    } catch (error) {
      cleanupError = error;
    }
    try {
      workspace.cleanup();
    } catch (error) {
      workspaceCleanupError = error;
    }
  }
  if (primaryErrorCaught) throw primaryError;
  if (cleanupError) throw cleanupError;
  if (cleanup?.status !== 0) fail('CANONICAL_PACKAGE_CLEANUP_FAILED');
  if (workspaceCleanupError) throw workspaceCleanupError;
  return prepared;
}

function parseCliArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !['--commit-sha', '--output-dir'].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CANONICAL_PACKAGE_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);
  let commitSha = options['commit-sha'] || process.env.CI_COMMIT_SHA;
  if (!commitSha && !process.env.CI) {
    commitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();
  }
  if (!commitSha) fail('CANONICAL_PACKAGE_COMMIT_REQUIRED');
  const prepared = preparePackageArtifact({
    commitSha,
    outputDir: options['output-dir'] || '.artifacts/test-portfolio/package',
  });
  process.stdout.write(
    `${JSON.stringify({
      descriptorPath: prepared.descriptorPath,
      descriptorSha256: prepared.descriptorSha256,
      tarballPath: prepared.tarballPath,
      tarballSha256: prepared.tarballSha256,
    })}\n`
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  expectedBuildCommandHash,
  expectedPackCommandHash,
  main,
  parseCliArgs,
  preparePackageArtifact,
  validatePackageDescriptor,
};
