#!/usr/bin/env node
/**
 * 发布前检查：同步 bundled workspace runtime，并只读验证 build 生成的 package `_bmad`。
 *
 * package `_bmad` 只能由 build-main-agent-dist.cjs 生成；prepublish 不得成为第二 producer。
 */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS script for prepublish */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.BMAD_SPECKIT_REPO_ROOT
  ? path.resolve(process.env.BMAD_SPECKIT_REPO_ROOT)
  : path.resolve(__dirname, '..');
const RELEASE_GATE_RUNTIME = path.join(
  ROOT,
  'packages',
  'bmad-speckit',
  'dist',
  'utils',
  'goal-contract',
  'release-gate.js'
);
if (!fs.existsSync(RELEASE_GATE_RUNTIME)) {
  throw new Error(
    `Missing built goal-contract release gate runtime: ${RELEASE_GATE_RUNTIME}. Run npm run build:main-agent-dist before prepublish.`
  );
}
const { checkGoalContractReleaseGate } = require(RELEASE_GATE_RUNTIME);
const {
  syncBundledWorkspaceRuntime,
} = require('./requirements-contract-bundled-runtime-sync');
const SPECKIT_DIR = path.join(ROOT, 'packages', 'bmad-speckit');
const SPECKIT_BMAD_MIRROR = path.join(SPECKIT_DIR, '_bmad');
const RUNTIME_BUILD_AUTHORITY_RUNTIME = path.join(
  SPECKIT_DIR,
  'dist',
  'main-agent',
  'source-authority',
  'scripts',
  'requirements-contract-runtime-build-authority.js'
);
const RUNTIME_BUILD_AUTHORITY_RECEIPT = path.join(
  SPECKIT_DIR,
  'dist',
  'main-agent',
  'runtime-build-authority-receipt.json'
);
const RUNTIME_ASSET_MANIFEST = path.join(
  SPECKIT_DIR,
  'dist',
  'main-agent',
  'runtime-asset-manifest.json'
);
const BUILD_MAIN_AGENT_DIST = path.join(
  SPECKIT_DIR,
  'scripts',
  'build-main-agent-dist.cjs'
);
const DEPENDENCY_LOCK = path.join(ROOT, 'package-lock.json');
const PACK_SESSION_FILE = path.join(SPECKIT_DIR, 'node_modules', '.pack-session-count.json');
const PACK_SESSION_LOCK_DIR = path.join(SPECKIT_DIR, 'node_modules', '.pack-session.lock');
const SILENT = process.env.BMAD_PREPUBLISH_SILENT === '1';
const PACK_SESSION_LOCK_TIMEOUT_MS = Number.parseInt(
  process.env.BMAD_PACK_SESSION_LOCK_TIMEOUT_MS || '180000',
  10
);

function info(message) {
  if (!SILENT) console.log(message);
}

const BUNDLED = [
  {
    id: '@bmad-speckit/schema',
    relDir: 'packages/schema',
    distCheck: (dir) => fs.existsSync(path.join(dir, 'run-score-schema.json')),
  },
  {
    id: '@bmad-speckit/scoring',
    relDir: 'packages/scoring',
    distCheck: (dir) => {
      const distDir = path.join(dir, 'dist');
      if (!fs.existsSync(distDir)) return false;
      const files = fs.readdirSync(distDir, { recursive: true });
      return files.length > 0;
    },
    extraCheck: (dir) => fs.existsSync(path.join(dir, 'rules')),
  },
  {
    id: '@bmad-speckit/ralph-method',
    relDir: 'packages/ralph-method',
    distCheck: (dir) => {
      const distDir = path.join(dir, 'dist');
      if (!fs.existsSync(distDir)) return false;
      const files = fs.readdirSync(distDir, { recursive: true });
      return files.some((f) => String(f).endsWith('.js'));
    },
  },
  {
    id: '@bmad-speckit/runtime-context',
    relDir: 'packages/runtime-context',
    distCheck: (dir) => {
      const distDir = path.join(dir, 'dist');
      if (!fs.existsSync(distDir)) return false;
      const files = fs.readdirSync(distDir, { recursive: true });
      return files.some((f) => String(f).endsWith('.js'));
    },
  },
  {
    id: '@bmad-speckit/runtime-emit',
    relDir: 'packages/runtime-emit',
    // 只保留 accepted main-agent/runtime host bundles 作为正式产物
    distCheck: (dir) => {
      const emitRuntimePolicy = path.join(dir, 'dist', 'emit-runtime-policy.cjs');
      const resolveForSession = path.join(dir, 'dist', 'resolve-for-session.cjs');
      const renderAuditBlock = path.join(dir, 'dist', 'render-audit-block.cjs');
      const runAuditorHost = path.join(dir, 'dist', 'run-auditor-host.cjs');
      return fs.existsSync(emitRuntimePolicy) && fs.existsSync(resolveForSession) && fs.existsSync(renderAuditBlock) && fs.existsSync(runAuditorHost);
    },
  },
];

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function isStrictlyWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function verifyBmadMirror() {
  if (!fs.existsSync(RUNTIME_BUILD_AUTHORITY_RUNTIME)) {
    throw new Error(
      `缺少 runtime build authority validator: ${RUNTIME_BUILD_AUTHORITY_RUNTIME}`
    );
  }
  if (!fs.existsSync(RUNTIME_BUILD_AUTHORITY_RECEIPT)) {
    throw new Error(
      `缺少 runtime build authority receipt: ${RUNTIME_BUILD_AUTHORITY_RECEIPT}`
    );
  }

  const { assertRuntimeBuildAuthorityCurrent } = require(
    RUNTIME_BUILD_AUTHORITY_RUNTIME
  );
  const receipt = JSON.parse(
    fs.readFileSync(RUNTIME_BUILD_AUTHORITY_RECEIPT, 'utf8')
  );
  const baseReceipt = Object.fromEntries(
    [
      'schemaVersion',
      'hashDomainRegistry',
      'sourceInputManifestHash',
      'buildScriptHash',
      'dependencyLockHash',
      'runtimeAssetManifestHash',
      'distRuntimeHash',
      'packageRuntimeHash',
      'decision',
      'distBuildHash',
    ].map((key) => [key, receipt[key]])
  );
  assertRuntimeBuildAuthorityCurrent({
    receipt: baseReceipt,
    packageRoot: SPECKIT_DIR,
    runtimeAssetManifestPath: RUNTIME_ASSET_MANIFEST,
    buildScriptPath: BUILD_MAIN_AGENT_DIST,
    dependencyLockPath: DEPENDENCY_LOCK,
  });
  const entries = receipt.packageAssetEntries;
  if (
    !Array.isArray(entries) ||
    entries.length === 0 ||
    receipt.packageAssetCount !== entries.length ||
    receipt.packageAssetSetHash !==
      `sha256:${createHash('sha256')
        .update(JSON.stringify(entries))
        .digest('hex')}`
  ) {
    throw new Error('package _bmad mirror asset receipt is stale');
  }
  const targets = entries.map((entry) => entry.target);
  if (
    new Set(targets).size !== targets.length ||
    JSON.stringify(targets) !==
      JSON.stringify([...targets].sort((left, right) => left.localeCompare(right)))
  ) {
    throw new Error('package _bmad mirror asset set is invalid');
  }
  const repositoryBmadRoot = path.join(ROOT, '_bmad');

  for (const entry of entries) {
    const sourcePath = path.resolve(ROOT, entry.source);
    const targetPath = path.resolve(SPECKIT_DIR, entry.target);
    if (
      entry.owner !== 'package-root-_bmad' ||
      entry.source !== entry.target ||
      !isStrictlyWithin(repositoryBmadRoot, sourcePath) ||
      !isStrictlyWithin(SPECKIT_BMAD_MIRROR, targetPath) ||
      !fs.existsSync(sourcePath) ||
      !fs.statSync(sourcePath).isFile() ||
      !fs.existsSync(targetPath) ||
      !fs.statSync(targetPath).isFile() ||
      sha256File(sourcePath) !== entry.sourceHash ||
      sha256File(targetPath) !== entry.targetHash ||
      entry.sourceHash !== entry.targetHash
    ) {
      throw new Error(`package _bmad mirror verification failed: ${entry.target}`);
    }
  }

  return {
    packageAssetCount: receipt.packageAssetCount,
    packageAssetSetHash: receipt.packageAssetSetHash,
  };
}

/**
 * 安全删除目录（带重试）
 * @param {string} target - Directory path to remove.
 */
function rmWithRetry(target) {
  if (!fs.existsSync(target)) return;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 100,
      });
      return;
    } catch (error) {
      if (attempt === 9) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
}

function readPackSessionCount() {
  if (!fs.existsSync(PACK_SESSION_FILE)) return 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(PACK_SESSION_FILE, 'utf8'));
    return Number.isFinite(parsed?.count) && parsed.count > 0 ? parsed.count : 0;
  } catch {
    return 0;
  }
}

function writePackSessionCount(count) {
  fs.mkdirSync(path.dirname(PACK_SESSION_FILE), { recursive: true });
  if (count <= 0) {
    rmWithRetry(PACK_SESSION_FILE);
    return;
  }
  fs.writeFileSync(PACK_SESSION_FILE, JSON.stringify({ count }, null, 2) + '\n', 'utf8');
}

function readLockOwner(lockDir) {
  const ownerPath = path.join(lockDir, 'owner.json');
  if (!fs.existsSync(ownerPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
  } catch {
    return { unreadable: true };
  }
}

function isLockOwnerAlive(owner) {
  if (!owner || owner.unreadable) return true;
  if (owner.packSession === true) {
    const timeoutMs =
      Number.isFinite(PACK_SESSION_LOCK_TIMEOUT_MS) &&
      PACK_SESSION_LOCK_TIMEOUT_MS > 0
        ? PACK_SESSION_LOCK_TIMEOUT_MS
        : 180000;
    const acquiredAt = Date.parse(String(owner.acquiredAt || ''));
    return Number.isFinite(acquiredAt) && Date.now() - acquiredAt < timeoutMs;
  }
  const pid = Number(owner.pid);
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

function removeDeadOwnerLock(lockDir) {
  const owner = readLockOwner(lockDir);
  if (isLockOwnerAlive(owner)) return false;
  rmWithRetry(lockDir);
  return true;
}

function acquirePersistentPackSessionLock(lockDir) {
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  const startedAt = Date.now();
  const timeoutMs = Number.isFinite(PACK_SESSION_LOCK_TIMEOUT_MS) && PACK_SESSION_LOCK_TIMEOUT_MS > 0
    ? PACK_SESSION_LOCK_TIMEOUT_MS
    : 180000;
  const owner = {
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    packSession: process.env.BMAD_PACK_SESSION === '1',
  };
  while (Date.now() - startedAt < timeoutMs) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(path.join(lockDir, 'owner.json'), JSON.stringify(owner, null, 2) + '\n', 'utf8');
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      if (removeDeadOwnerLock(lockDir)) {
        continue;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  const currentOwner = readLockOwner(lockDir);
  throw new Error(
    `Timed out acquiring pack session lock after ${timeoutMs}ms: ${lockDir}` +
      (currentOwner ? ` owner=${JSON.stringify(currentOwner)}` : '')
  );
}

/**
 * 获取 prepublish 同步锁，避免并行 pack/prepublish 争抢同一 staging 目录
 * @param {string} lockDir - Lock directory path to acquire.
 */
function acquirePrepublishSyncLock(lockDir) {
  const payload = {
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      fs.mkdirSync(lockDir, { recursive: false });
      fs.writeFileSync(path.join(lockDir, 'owner.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      if (removeDeadOwnerLock(lockDir)) {
        continue;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }

  throw new Error(`Timed out acquiring prepublish sync lock: ${lockDir}`);
}

/**
 * 释放 prepublish 同步锁
 * @param {string} lockDir - Lock directory path to release.
 */
function releasePrepublishSyncLock(lockDir) {
  rmWithRetry(lockDir);
}

const PREPUBLISH_SYNC_LOCK_DIR = path.join(SPECKIT_DIR, 'node_modules', '.prepublish-sync.lock');

const holdPackSessionLock = process.env.BMAD_PACK_SESSION === '1';
let prepublishPassed = false;
acquirePersistentPackSessionLock(PACK_SESSION_LOCK_DIR);
acquirePrepublishSyncLock(PREPUBLISH_SYNC_LOCK_DIR);
try {
  if (holdPackSessionLock) {
    writePackSessionCount(readPackSessionCount() + 1);
  }
  const bundledRuntimeSync = syncBundledWorkspaceRuntime({
    repoRoot: ROOT,
    packageRoot: SPECKIT_DIR,
  });
  info(
    `同步 workspace runtime packages → packages/bmad-speckit/node_modules/@bmad-speckit ` +
      `packages=${bundledRuntimeSync.packageCount} files=${bundledRuntimeSync.fileCount}`
  );
  const bmadMirrorVerification = verifyBmadMirror();
  info(
    `只读验证 packages/bmad-speckit/_bmad ` +
      `assets=${bmadMirrorVerification.packageAssetCount} ` +
      `setHash=${bmadMirrorVerification.packageAssetSetHash}\n`
  );

  const checks = [];

  for (const b of BUNDLED) {
    const pkgDir = path.join(ROOT, b.relDir);
    checks.push({
      label: `${b.relDir}/ 产物就绪`,
      test: () => b.distCheck(pkgDir),
    });
    if (b.extraCheck) {
      checks.push({
        label: `${b.relDir} extra`,
        test: () => b.extraCheck(pkgDir),
      });
    }
    const parts = b.id.split('/');
    const dest = path.join(SPECKIT_DIR, 'node_modules', ...parts);
    checks.push({
      label: `packages/bmad-speckit/node_modules/${b.id} 存在`,
      test: () => fs.existsSync(dest),
    });
  }

  checks.push({
    label: 'packages/bmad-speckit/_bmad 存在',
    test: () => fs.existsSync(SPECKIT_BMAD_MIRROR) && fs.statSync(SPECKIT_BMAD_MIRROR).isDirectory() && fs.readdirSync(SPECKIT_BMAD_MIRROR).length > 0,
  });

  checks.push({
    label: 'packages/bmad-speckit/_bmad 含 hooks/*.cjs',
    test: () => {
      const hookRoots = [
        path.join(SPECKIT_BMAD_MIRROR, 'runtime', 'hooks'),
        path.join(SPECKIT_BMAD_MIRROR, 'cursor', 'hooks'),
        path.join(SPECKIT_BMAD_MIRROR, 'claude', 'hooks'),
      ];
      return hookRoots.every((dir) => fs.existsSync(dir) && fs.readdirSync(dir).some((name) => name.endsWith('.cjs')));
    },
  });

  checks.push({
    label: 'tracked goal-contract release-gate fixture includes current coverageReceiptPath and unmappedSourceObligations proof',
    test: () => {
      const fixtureRoot = path.join(ROOT, 'tests', 'fixtures', 'goal-contract-release-gate');
      const source = path.join(fixtureRoot, 'source-plan.md');
      const goal = path.join(fixtureRoot, 'goal-contract.md');
      const coverage = path.join(fixtureRoot, 'coverage.json');
      const generation = path.join(fixtureRoot, 'generation.json');
      const result = checkGoalContractReleaseGate({ source, goal, coverage, generation });
      return result.ok;
    },
  });

  checks.push({
    label: 'packages/bmad-speckit/package.json 包含 bundleDependencies（三项 @bmad-speckit/*）',
    test: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(SPECKIT_DIR, 'package.json'), 'utf8'));
      const bd = pkg.bundleDependencies || pkg.bundledDependencies;
      if (!Array.isArray(bd)) return false;
      return BUNDLED.every((b) => bd.includes(b.id));
    },
  });

  let allPassed = true;
  for (const { label, test } of checks) {
    const ok = test();
    info(ok ? `  ✓ ${label}` : `  ✗ ${label}`);
    if (!ok) allPassed = false;
  }

  if (!allPassed) {
    console.error('\n发布前检查未通过，请修复上述问题后重试。');
    throw new Error('prepublish_checks_failed');
  }

  prepublishPassed = true;
  info('\n发布前检查全部通过 ✓');
} finally {
  releasePrepublishSyncLock(PREPUBLISH_SYNC_LOCK_DIR);
  if (!holdPackSessionLock || !prepublishPassed) {
    rmWithRetry(PACK_SESSION_LOCK_DIR);
  }
}
