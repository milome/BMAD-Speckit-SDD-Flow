#!/usr/bin/env node
/**
 * 清理打包后的临时文件
 * postpack 钩子调用，清理 packages/bmad-speckit/_bmad 和 node_modules/@bmad-speckit/*
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packedBmad = path.join(root, 'packages', 'bmad-speckit', '_bmad');
const packedScoped = path.join(root, 'packages', 'bmad-speckit', 'node_modules', '@bmad-speckit');
const packSessionFile = path.join(root, 'packages', 'bmad-speckit', 'node_modules', '.pack-session-count.json');
const packSessionLockDir = path.join(root, 'packages', 'bmad-speckit', 'node_modules', '.pack-session.lock');

function rmWithRetry(target) {
  if (!fs.existsSync(target)) return;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) {
        console.warn(`Warning: failed to remove ${target}: ${error.message}`);
        return;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

function readPackSessionCount() {
  if (!fs.existsSync(packSessionFile)) return 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(packSessionFile, 'utf8'));
    return Number.isFinite(parsed?.count) && parsed.count > 0 ? parsed.count : 0;
  } catch {
    return 0;
  }
}

function writePackSessionCount(count) {
  if (count <= 0) {
    rmWithRetry(packSessionFile);
    return;
  }
  fs.writeFileSync(packSessionFile, JSON.stringify({ count }, null, 2) + '\n', 'utf8');
}

const currentCount = readPackSessionCount();
if (currentCount > 1) {
  writePackSessionCount(currentCount - 1);
  rmWithRetry(packSessionLockDir);
  process.exit(0);
}
if (currentCount === 1) {
  writePackSessionCount(0);
}

if (fs.existsSync(packedBmad)) {
  rmWithRetry(packedBmad);
}

if (fs.existsSync(packedScoped)) {
  rmWithRetry(packedScoped);
}

rmWithRetry(packSessionLockDir);
