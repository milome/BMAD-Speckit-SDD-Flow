#!/usr/bin/env node
/**
 * Init-to-root: 将 _bmad、_bmad-output、commands、rules 部署到项目根。
 *
 * 用途：部署 BMAD 目录结构；--full 时包含 config、templates、workflows。
 *
 * CLI 参数：[targetDir], --full, --agent cursor|claude-code
 *
 * 示例：node scripts/init-to-root.js
 *
 * 退出码：0=成功
 */
import fs from 'node:fs';
import path from 'node:path';

const PKG_ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const fullMode = args.includes('--full');
const agentArgIndex = args.findIndex((a) => a === '--agent');
const requestedAgentTarget =
  agentArgIndex >= 0 && args[agentArgIndex + 1] ? args[agentArgIndex + 1] : 'cursor';
const REGISTERED_AGENT_PROFILES = {
  cursor: {
    runtimeRoot: '.cursor',
    sync(targetDir) {
      const cursorSync = [
        { src: 'commands', dest: '.cursor/commands', fromPkgRoot: false },
        { src: 'rules', dest: '.cursor/rules', fromPkgRoot: false },
      ];
      let totalFiles = 0;
      for (const { src, dest, fromPkgRoot } of cursorSync) {
        const srcPath = path.join(fromPkgRoot ? PKG_ROOT : targetDir, src);
        const destPath = path.join(targetDir, dest);
        if (fs.existsSync(srcPath)) {
          console.log('Sync', src, '->', dest);
          copyRecursive(srcPath, destPath);
          totalFiles += countFiles(destPath);
        }
      }
      const crSrc = path.join(targetDir, 'config', 'code-reviewer-config.yaml');
      const crDest = path.join(targetDir, '.cursor', 'agents', 'code-reviewer-config.yaml');
      if (fs.existsSync(crSrc)) {
        fs.mkdirSync(path.dirname(crDest), { recursive: true });
        fs.copyFileSync(crSrc, crDest);
        console.log('Sync config/code-reviewer-config.yaml -> .cursor/agents/');
        totalFiles += 1;
      }
      return totalFiles;
    },
  },
  'claude-code': {
    runtimeRoot: '.claude',
    sync(targetDir) {
      const claudeSync = [
        { src: 'commands', dest: '.claude/commands', fromPkgRoot: false },
        { src: 'rules', dest: '.claude/rules', fromPkgRoot: false },
        { src: '.claude/agents', dest: '.claude/agents', fromPkgRoot: true },
        { src: '.claude/protocols', dest: '.claude/protocols', fromPkgRoot: true },
        { src: '.claude/state', dest: '.claude/state', fromPkgRoot: true },
        { src: '.claude/hooks', dest: '.claude/hooks', fromPkgRoot: true },
      ];
      let totalFiles = 0;
      for (const { src, dest, fromPkgRoot } of claudeSync) {
        const srcPath = path.join(fromPkgRoot ? PKG_ROOT : targetDir, src);
        const destPath = path.join(targetDir, dest);
        if (fs.existsSync(srcPath)) {
          console.log('Sync', src, '->', dest);
          copyRecursive(srcPath, destPath);
          totalFiles += countFiles(destPath);
        } else {
          fs.mkdirSync(destPath, { recursive: true });
        }
      }
      return totalFiles;
    },
  },
};
const agentProfile = REGISTERED_AGENT_PROFILES[requestedAgentTarget];
if (!agentProfile) {
  console.error(`Unsupported --agent value: ${requestedAgentTarget}`);
  process.exit(1);
}
const agentTarget = requestedAgentTarget;
const targetArg = args.find(
  (a, index) => a !== '--full' && a !== '--agent' && index !== agentArgIndex + 1
);
const TARGET = targetArg ? path.resolve(targetArg) : process.cwd();

const CORE_DIRS = ['_bmad', '_bmad-output', 'commands', 'rules'];
const FULL_DIRS = [
  '_bmad',
  '_bmad-output',
  'commands',
  'rules',
  'config',
  'templates',
  'workflows',
];
const DIRS = fullMode ? FULL_DIRS : CORE_DIRS;

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function countFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dirPath)) {
    const p = path.join(dirPath, name);
    n += fs.statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

console.log(
  'BMAD-Speckit-SDD-Flow init: deploy to',
  TARGET,
  fullMode ? '(full mode)' : '',
  `[agent=${agentTarget}]`
);
let totalFiles = 0;
for (const dir of DIRS) {
  const src = path.join(PKG_ROOT, dir);
  const dest = path.join(TARGET, dir);
  if (!fs.existsSync(src)) {
    console.warn('Skip (missing):', dir);
    continue;
  }
  console.log('Copy', dir, '->', dest);
  if (fs.existsSync(dest)) {
    console.warn('Target exists, merging:', dest);
  }
  copyRecursive(src, dest);
  totalFiles += countFiles(dest);
}

totalFiles += agentProfile.sync(TARGET, PKG_ROOT);

console.log('Done. Copied', DIRS.length, 'dirs,', totalFiles, 'files.');
console.log('Verify with: _bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1');
