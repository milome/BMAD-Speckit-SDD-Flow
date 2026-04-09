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

const ROOT = path.resolve(__dirname, '..');
const SPECKIT_DIR = path.join(ROOT, 'packages', 'bmad-speckit');
const SPECKIT_BMAD_MIRROR = path.join(SPECKIT_DIR, '_bmad');
const SPECKIT_SCOPED_NODE_MODULES = path.join(SPECKIT_DIR, 'node_modules', '@bmad-speckit');
const PACK_SESSION_FILE = path.join(SPECKIT_DIR, 'node_modules', '.pack-session-count.json');
const PACK_SESSION_LOCK_DIR = path.join(SPECKIT_DIR, 'node_modules', '.pack-session.lock');
const SILENT = process.env.BMAD_PREPUBLISH_SILENT === '1';

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
    // 只保留两个主消费产物作为正式产物
    distCheck: (dir) => {
      const governanceWorker = path.join(dir, 'dist', 'governance-runtime-worker.cjs');
      const governanceRunner = path.join(dir, 'dist', 'governance-remediation-runner.cjs');
      return (
        fs.existsSync(governanceWorker) &&
        fs.existsSync(governanceRunner)
      );
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
 * @param {string} target
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

function acquirePersistentPackSessionLock(lockDir) {
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      fs.mkdirSync(lockDir);
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  throw new Error(`Timed out acquiring pack session lock: ${lockDir}`);
}

/**
 * 获取 prepublish 同步锁，避免并行 pack/prepublish 争抢同一 staging 目录
 * @param {string} lockDir
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
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }

  throw new Error(`Timed out acquiring prepublish sync lock: ${lockDir}`);
}

/**
 * 释放 prepublish 同步锁
 * @param {string} lockDir
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

/**
 * 同步 workspace scoped packages 到 packages/bmad-speckit/node_modules/@bmad-speckit
 * 使用策略：新目录构建 + 父级一次性切换
 */
function syncBundledWorkspaceScopes() {
  const parentDir = path.dirname(SPECKIT_SCOPED_NODE_MODULES);
  const staging = path.join(parentDir, '@bmad-speckit.staging');

  // 清理可能存在的旧 staging
  rmWithRetry(staging);

  // 新目录构建：复制所有 bundled 包到 staging
  fs.mkdirSync(staging, { recursive: true });
  for (const b of BUNDLED) {
    const src = path.join(ROOT, b.relDir);
    const pkgName = b.id.split('/')[1];
    const dest = path.join(staging, pkgName);
    copyDirContents(src, dest);
  }

  // 父级一次性切换
  atomicSwap(staging, SPECKIT_SCOPED_NODE_MODULES);
}

/**
 * 同步单个 workspace 包到 bundled 位置
 * 使用策略：新目录构建 + 父级一次性切换
 * @param {string} relDir - 相对 ROOT 的目录
 * @param {string} scopedId - 包的 scoped id，如 @bmad-speckit/runtime-emit
 */
function syncWorkspacePackageToBundled(relDir, scopedId) {
  const pkgDir = path.join(ROOT, relDir);
  const parts = scopedId.split('/');
  const pkgName = parts[1];

  // 目标位置在 node_modules/@bmad-speckit/ 下
  const targetDir = path.join(SPECKIT_SCOPED_NODE_MODULES, pkgName);
  const parentDir = path.dirname(targetDir);
  const staging = path.join(parentDir, `${pkgName}.staging`);

  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const publishFiles = pkg.files || [];

  // 清理可能存在的旧 staging
  rmWithRetry(staging);

  // 新目录构建
  fs.mkdirSync(staging, { recursive: true });
  fs.copyFileSync(path.join(pkgDir, 'package.json'), path.join(staging, 'package.json'));
  const readmeSrc = path.join(pkgDir, 'README.md');
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.join(staging, 'README.md'));
  }
  for (const entry of publishFiles) {
    const value = String(entry);
    if (value.includes('*')) {
      const matcher = new RegExp(
        '^' + value.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'
      );
      for (const name of fs.readdirSync(pkgDir)) {
        if (!matcher.test(name)) continue;
        const src = path.join(pkgDir, name);
        const out = path.join(staging, name);
        copyDirContents(src, out);
      }
      continue;
    }

    const src = path.join(pkgDir, value);
    const out = path.join(staging, value);
    if (fs.existsSync(src)) {
      copyDirContents(src, out);
    }
  }

  // runtime-emit 特殊处理：确保 dist 目录完整复制
  if (scopedId === '@bmad-speckit/runtime-emit') {
    const distDir = path.join(pkgDir, 'dist');
    const destDist = path.join(staging, 'dist');
    if (fs.existsSync(distDir)) {
      copyDirContents(distDir, destDist);
    }
  }

  // 父级一次性切换
  atomicSwap(staging, targetDir);
}

const PREPUBLISH_SYNC_LOCK_DIR = path.join(SPECKIT_DIR, 'node_modules', '.prepublish-sync.lock');

const holdPackSessionLock = process.env.BMAD_PACK_SESSION === '1';
acquirePersistentPackSessionLock(PACK_SESSION_LOCK_DIR);
acquirePrepublishSyncLock(PREPUBLISH_SYNC_LOCK_DIR);
try {
  if (holdPackSessionLock) {
    writePackSessionCount(readPackSessionCount() + 1);
  }
  for (const b of BUNDLED) {
    info(`同步 ${b.id} → bmad-speckit/node_modules ...`);
    syncWorkspacePackageToBundled(b.relDir, b.id);
  }
  info('同步 workspace scoped packages → packages/bmad-speckit/node_modules/@bmad-speckit ...');
  syncBundledWorkspaceScopes();
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
