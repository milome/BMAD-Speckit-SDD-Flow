const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const tar = require('tar');

const PACK_MTIME = new Date('1985-10-26T08:15:00.000Z');

function readPackageJson(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

function resolveDependencyDirectory(name, fromDirectory) {
  const segments = name.split('/');
  let current = path.resolve(fromDirectory);
  for (;;) {
    const candidate = path.join(current, 'node_modules', ...segments);
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return fs.realpathSync.native(candidate);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`cannot resolve bundled dependency ${name} from ${fromDirectory}`);
}

function collectBundledDependencies(packageRoot) {
  const rootPackage = readPackageJson(packageRoot);
  const bundled = rootPackage.bundleDependencies ?? rootPackage.bundledDependencies ?? [];
  const queue = bundled.map((name) => ({ name, from: packageRoot }));
  const dependencies = new Map();
  while (queue.length > 0) {
    const { name, from } = queue.shift();
    const sourceRoot = resolveDependencyDirectory(name, from);
    const dependencyPackage = readPackageJson(sourceRoot);
    const existing = dependencies.get(dependencyPackage.name);
    if (existing && existing.sourceRoot !== sourceRoot) {
      throw new Error(`conflicting bundled dependency ${dependencyPackage.name}`);
    }
    if (existing) continue;
    dependencies.set(dependencyPackage.name, {
      name: dependencyPackage.name,
      sourceRoot,
    });
    for (const dependencyName of Object.keys({
      ...dependencyPackage.dependencies,
      ...dependencyPackage.optionalDependencies,
    })) {
      queue.push({ name: dependencyName, from: sourceRoot });
    }
  }
  return [...dependencies.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function materializeWithHardlinks(sourcePath, destinationPath) {
  const metadata = fs.lstatSync(sourcePath);
  if (metadata.isSymbolicLink()) {
    throw new Error(`symbolic link is not allowed in package staging: ${sourcePath}`);
  }
  if (metadata.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      if (entry === 'node_modules') continue;
      materializeWithHardlinks(
        path.join(sourcePath, entry),
        path.join(destinationPath, entry)
      );
    }
    return;
  }
  if (!metadata.isFile()) {
    throw new Error(`unsupported package staging entry ${sourcePath}`);
  }
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.linkSync(sourcePath, destinationPath);
}

function removeStagingSession(stagingBase, sessionRoot) {
  const relative = path.relative(stagingBase, sessionRoot);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('package staging cleanup escaped its authority root');
  }
  fs.rmSync(sessionRoot, { recursive: true, force: true });
}

function createHermeticPackageStaging(packageRoot) {
  const repositoryRoot = path.resolve(packageRoot, '..', '..');
  const stagingBase = path.join(repositoryRoot, '.artifacts', 'npm-pack-staging');
  fs.mkdirSync(stagingBase, { recursive: true });
  const sessionRoot = fs.mkdtempSync(path.join(stagingBase, 'pack-'));
  const stagedPackageRoot = path.join(sessionRoot, 'package');
  try {
    materializeWithHardlinks(packageRoot, stagedPackageRoot);
    for (const dependency of collectBundledDependencies(packageRoot)) {
      materializeWithHardlinks(
        dependency.sourceRoot,
        path.join(stagedPackageRoot, 'node_modules', ...dependency.name.split('/'))
      );
    }
  } catch (error) {
    fs.rmSync(sessionRoot, { recursive: true, force: true });
    throw error;
  }
  return {
    packageRoot: stagedPackageRoot,
    cleanup() {
      removeStagingSession(stagingBase, sessionRoot);
    },
  };
}

function preservePackageMirror(packageRoot) {
  const mirrorRoot = path.join(packageRoot, '_bmad');
  if (!fs.existsSync(mirrorRoot)) return undefined;
  const repositoryRoot = path.resolve(packageRoot, '..', '..');
  const stagingBase = path.join(repositoryRoot, '.artifacts', 'npm-pack-staging');
  fs.mkdirSync(stagingBase, { recursive: true });
  const sessionRoot = fs.mkdtempSync(path.join(stagingBase, 'preserve-'));
  const preservedRoot = path.join(sessionRoot, '_bmad');
  try {
    materializeWithHardlinks(mirrorRoot, preservedRoot);
  } catch (error) {
    removeStagingSession(stagingBase, sessionRoot);
    throw error;
  }
  return {
    restore() {
      try {
        fs.rmSync(mirrorRoot, { recursive: true, force: true });
        materializeWithHardlinks(preservedRoot, mirrorRoot);
      } catch (error) {
        try {
          removeStagingSession(stagingBase, sessionRoot);
        } catch {}
        throw error;
      }
      removeStagingSession(stagingBase, sessionRoot);
    },
  };
}

function assertSafeTarball(tarballPath) {
  const unsafe = [];
  tar.list({
    file: tarballPath,
    sync: true,
    onReadEntry(entry) {
      for (const [field, value] of [['path', entry.path], ['linkpath', entry.linkpath]]) {
        if (!value) continue;
        const normalized = String(value).replace(/\\/gu, '/');
        if (
          normalized.split('/').includes('..') ||
          normalized.startsWith('/') ||
          /^[A-Za-z]:\//u.test(normalized)
        ) {
          unsafe.push(`${field}:${normalized}`);
        }
      }
    },
  });
  if (unsafe.length > 0) {
    throw new Error(`unsafe npm pack tar entries: ${unsafe.slice(0, 8).join(', ')}`);
  }
}

function parsePackRecord(stdout) {
  const start = stdout.indexOf('[');
  if (start < 0) throw new Error('npm pack dry-run output missing JSON payload');
  const records = JSON.parse(stdout.slice(start));
  if (!Array.isArray(records) || records.length !== 1) {
    throw new Error('npm pack dry-run output must contain one package record');
  }
  return records[0];
}

function normalizePackPath(value, label) {
  const normalized = String(value ?? '').replace(/\\/gu, '/');
  if (
    !normalized ||
    normalized.split('/').includes('..') ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//u.test(normalized)
  ) {
    throw new Error(`unsafe npm pack ${label}: ${normalized}`);
  }
  return normalized;
}

function writeTarballFromPackRecord({
  stagedPackageRoot,
  packDestination,
  packResult,
}) {
  const packRecord = parsePackRecord(packResult.stdout);
  const filename = normalizePackPath(packRecord.filename, 'filename');
  if (path.posix.basename(filename) !== filename) {
    throw new Error(`unsafe npm pack filename: ${filename}`);
  }
  if (!Array.isArray(packRecord.files) || packRecord.files.length === 0) {
    throw new Error('npm pack dry-run returned no package files');
  }
  const files = packRecord.files.map((entry) => {
    const entryPath = normalizePackPath(entry.path, 'file entry');
    const absolutePath = path.join(stagedPackageRoot, ...entryPath.split('/'));
    const metadata = fs.statSync(absolutePath);
    if (!metadata.isFile()) {
      throw new Error(`npm pack file entry is not a file: ${entryPath}`);
    }
    return { ...entry, path: entryPath, size: metadata.size };
  });
  const tarballPath = path.join(packDestination, filename);
  const noHardlinkCache = {
    get() {
      return undefined;
    },
    set() {},
  };
  tar.create(
    {
      cwd: stagedPackageRoot,
      file: tarballPath,
      gzip: true,
      linkCache: noHardlinkCache,
      mtime: PACK_MTIME,
      portable: true,
      prefix: 'package/',
      sync: true,
    },
    files.map((entry) => entry.path)
  );
  const bytes = fs.readFileSync(tarballPath);
  const outputRecord = {
    ...packRecord,
    filename,
    files,
    size: bytes.length,
    unpackedSize: files.reduce((total, entry) => total + entry.size, 0),
    shasum: createHash('sha1').update(bytes).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
  };
  return {
    ...packResult,
    stdout: JSON.stringify([outputRecord]),
  };
}

function assertCommandSuccess(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label}\nstdout:\n${result.stdout ?? ''}\nstderr:\n${result.stderr ?? ''}`);
  }
}

function packFromHermeticStaging({
  packageRoot,
  packDestination,
  runNpm,
  npmOptions = {},
  runLifecycle = true,
}) {
  fs.mkdirSync(packDestination, { recursive: true });
  let preservedMirror;
  let postpackAuthorized = false;
  let staging;
  try {
    if (runLifecycle) {
      assertCommandSuccess(
        runNpm(['run', 'prepack'], { ...npmOptions, cwd: packageRoot }),
        'package prepack failed'
      );
      preservedMirror = preservePackageMirror(packageRoot);
      postpackAuthorized = true;
    }
    staging = createHermeticPackageStaging(packageRoot);
    let result = runNpm(
      [
        'pack',
        staging.packageRoot,
        '--ignore-scripts',
        '--dry-run',
        '--json',
      ],
      { ...npmOptions, cwd: packDestination }
    );
    if (result.status === 0) {
      result = writeTarballFromPackRecord({
        stagedPackageRoot: staging.packageRoot,
        packDestination,
        packResult: result,
      });
      const filename = parsePackRecord(result.stdout).filename;
      assertSafeTarball(path.join(packDestination, filename));
    }
    return result;
  } finally {
    try {
      if (runLifecycle && postpackAuthorized) {
        assertCommandSuccess(
          runNpm(['run', 'postpack'], { ...npmOptions, cwd: packageRoot }),
          'package postpack failed'
        );
      }
    } finally {
      try {
        preservedMirror?.restore();
      } finally {
        staging?.cleanup();
      }
    }
  }
}

module.exports = { packFromHermeticStaging };
