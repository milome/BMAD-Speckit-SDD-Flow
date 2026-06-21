#!/usr/bin/env node
/**
 * 在 pack/publish 生命周期内，把 workspace 开发态 `file:` 依赖临时归一化为发布态版本号，
 * 避免安装 root tgz 后 `npm ls` 将 bundled workspace 依赖标记为 invalid。
 *
 * 设计目标：
 * 1. 只在 pack/publish 窗口内生效，不污染开发态 package.json。
 * 2. 支持并发 pack：用 ref-count + lock 保护临时改写与恢复。
 * 3. 泛化处理 root 与 packages 子目录下 package.json 中的本地 file: workspace 依赖。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const NODE_MODULES_DIR = path.join(ROOT, 'node_modules');
const STATE_FILE = path.join(NODE_MODULES_DIR, '.pack-manifest-normalization.json');
const LOCK_DIR = path.join(NODE_MODULES_DIR, '.pack-manifest-normalization.lock');
const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

function waitBriefly(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function rmWithRetry(target) {
  if (!fs.existsSync(target)) return;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) throw error;
      waitBriefly(100);
    }
  }
}

function acquireLock(lockDir) {
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(
        path.join(lockDir, 'owner.json'),
        JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }, null, 2) + '\n',
        'utf8'
      );
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      waitBriefly(250);
    }
  }
  throw new Error(`Timed out acquiring pack-manifest lock: ${lockDir}`);
}

function releaseLock(lockDir) {
  rmWithRetry(lockDir);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return readJson(STATE_FILE);
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeJson(STATE_FILE, state);
}

function listManifestPaths() {
  const paths = [path.join(ROOT, 'package.json')];
  const packagesDir = path.join(ROOT, 'packages');
  if (!fs.existsSync(packagesDir)) return paths;
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packagesDir, entry.name, 'package.json');
    if (fs.existsSync(manifestPath)) {
      paths.push(manifestPath);
    }
  }
  return paths;
}

function resolveLocalPackageFromFileSpec(manifestDir, spec) {
  if (typeof spec !== 'string' || !spec.startsWith('file:')) return null;
  const rawTarget = spec.slice(5);
  if (!rawTarget) return null;

  let targetPath = path.resolve(manifestDir, rawTarget);
  if (!fs.existsSync(targetPath)) return null;
  if (fs.statSync(targetPath).isFile()) {
    if (path.basename(targetPath) !== 'package.json') return null;
    return { manifestPath: targetPath, pkg: readJson(targetPath) };
  }

  const manifestPath = path.join(targetPath, 'package.json');
  if (!fs.existsSync(manifestPath)) return null;
  return { manifestPath, pkg: readJson(manifestPath) };
}

function normalizeManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const pkg = JSON.parse(raw);
  let changed = false;

  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (!deps || typeof deps !== 'object' || Array.isArray(deps)) continue;

    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== 'string' || !spec.startsWith('file:')) continue;
      const resolved = resolveLocalPackageFromFileSpec(path.dirname(manifestPath), spec);
      if (!resolved || !resolved.pkg || typeof resolved.pkg.version !== 'string') continue;
      if (deps[name] === resolved.pkg.version) continue;
      deps[name] = resolved.pkg.version;
      changed = true;
    }
  }

  return {
    changed,
    raw,
    normalized: changed ? JSON.stringify(pkg, null, 2) + '\n' : raw,
  };
}

function prepare() {
  acquireLock(LOCK_DIR);
  try {
    const current = readState();
    if (current && Number.isFinite(current.count) && current.count > 0) {
      current.count += 1;
      writeState(current);
      return;
    }

    const backups = {};
    for (const manifestPath of listManifestPaths()) {
      const { changed, raw, normalized } = normalizeManifest(manifestPath);
      if (!changed) continue;
      backups[path.relative(ROOT, manifestPath)] = raw;
      fs.writeFileSync(manifestPath, normalized, 'utf8');
    }

    writeState({
      count: 1,
      createdAt: new Date().toISOString(),
      backups,
    });
  } finally {
    releaseLock(LOCK_DIR);
  }
}

function restore() {
  acquireLock(LOCK_DIR);
  try {
    const current = readState();
    if (!current || !Number.isFinite(current.count) || current.count <= 0) {
      rmWithRetry(STATE_FILE);
      return;
    }

    if (current.count > 1) {
      current.count -= 1;
      writeState(current);
      return;
    }

    const backups = current.backups && typeof current.backups === 'object' ? current.backups : {};
    for (const [relativePath, raw] of Object.entries(backups)) {
      const target = path.join(ROOT, relativePath);
      if (typeof raw !== 'string') continue;
      fs.writeFileSync(target, raw, 'utf8');
    }

    rmWithRetry(STATE_FILE);
  } finally {
    releaseLock(LOCK_DIR);
  }
}

const mode = process.argv[2];
if (mode === 'prepare') {
  prepare();
} else if (mode === 'restore') {
  restore();
} else {
  process.stderr.write('Usage: node scripts/normalize-pack-manifests.js <prepare|restore>\n');
  process.exit(1);
}
