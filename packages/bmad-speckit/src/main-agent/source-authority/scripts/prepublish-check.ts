#!/usr/bin/env node
/**
 * 发布前检查：将 workspace 包同步到 packages/bmad-speckit/node_modules/@bmad-speckit/*，
 * 配合 package.json bundleDependencies，使 npm pack 后的 tarball 在干净目录可安装运行。
 *
 * 同步策略：新目录构建 + 父级一次性切换/替换（原子性重命名）
 * 避免在 packages/bmad-speckit/node_modules/@bmad-speckit/* 与 _bmad 上做高冲突 rename
 */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS script for prepublish */
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

/**
 * 复制目录内容（不复制目录本身，只复制内容）
 * 如果源是文件而不是目录，则直接复制文件
 * @param {string} src - 源路径（目录或文件）
 * @param {string} dest - 目标路径
 */
function copyDirContents(src, dest) {
  // 如果源是文件，直接复制文件
  if (!fs.statSync(src).isDirectory()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        fs.copyFileSync(src, dest);
        break;
      } catch (error) {
        if (attempt === 7) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
    }
    return;
  }

  // 源是目录，复制目录内容
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const name of fs.readdirSync(src)) {
    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirContents(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          fs.copyFileSync(srcPath, destPath);
          break;
        } catch (error) {
          if (attempt === 7) throw error;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        }
      }
    }
  }
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

/**
 * 带重试的重命名操作（Windows EPERM 兼容）
 * @param {string} oldPath - 源路径
 * @param {string} newPath - 目标路径
 * @param {number} maxAttempts - 最大重试次数
 */
function renameWithRetry(oldPath, newPath, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      fs.renameSync(oldPath, newPath);
      return;
    } catch (error) {
      // Windows EPERM 或 EBUSY 错误时重试
      if ((error.code === 'EPERM' || error.code === 'EBUSY') && attempt < maxAttempts - 1) {
        // 指数退避：从 50ms 开始，最多 1000ms
        const delay = Math.min(50 * Math.pow(1.5, attempt), 1000);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
        continue;
      }
      throw error;
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

/**
 * 原子性切换：将新构建的 staging 目录替换为目标目录
 * 策略：如果目标存在，先重命名为 .old，然后将 staging 重命名为目标，最后删除 .old
 * @param {string} staging - 新构建的目录
 * @param {string} target - 目标目录
 */
function atomicSwap(staging, target) {
  if (!fs.existsSync(staging)) {
    throw new Error(`Staging directory does not exist: ${staging}`);
  }

  // 如果目标不存在，直接重命名即可
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    renameWithRetry(staging, target);
    return;
  }

  // 父级目录中操作，避免在子目录上做 rename
  const parentDir = path.dirname(target);
  const targetName = path.basename(target);
  const oldTarget = path.join(parentDir, `${targetName}.old`);

  // 清理可能存在的旧备份
  if (fs.existsSync(oldTarget)) {
    rmWithRetry(oldTarget);
  }

  // 原子性切换（带 Windows EPERM 重试）
  renameWithRetry(target, oldTarget);     // 旧目录 -> .old
  renameWithRetry(staging, target);       // staging -> 目标
  rmWithRetry(oldTarget);                 // 删除旧目录
}

/**
 * 同步 _bmad 到 packages/bmad-speckit/_bmad
 * 使用策略：新目录构建 + 父级一次性切换
 */
function syncBmadMirror() {
  const source = path.join(ROOT, '_bmad');
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error('仓库根目录缺少 _bmad，无法同步发布镜像');
  }

  // 在父级目录创建 staging
  const parentDir = path.dirname(SPECKIT_BMAD_MIRROR);
  const staging = path.join(parentDir, '_bmad.staging');

  // 清理可能存在的旧 staging
  rmWithRetry(staging);

  // 新目录构建：复制内容到 staging
  copyDirContents(source, staging);

  // 父级一次性切换
  atomicSwap(staging, SPECKIT_BMAD_MIRROR);
}

const PREPUBLISH_SYNC_LOCK_DIR = path.join(SPECKIT_DIR, 'node_modules', '.prepublish-sync.lock');

const holdPackSessionLock = process.env.BMAD_PACK_SESSION === '1';
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
  info('同步 _bmad → packages/bmad-speckit/_bmad ...');
  syncBmadMirror();
  info('同步完成。\n');

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
    process.exit(1);
  }

  info('\n发布前检查全部通过 ✓');
} finally {
  releasePrepublishSyncLock(PREPUBLISH_SYNC_LOCK_DIR);
  if (!holdPackSessionLock) {
    rmWithRetry(PACK_SESSION_LOCK_DIR);
  }
}
