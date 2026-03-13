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
const path = require('path');
const fs = require('fs');

const PKG_ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const fullMode = args.includes('--full');
const agentArgIndex = args.findIndex((a) => a === '--agent');
const agentTarget =
  agentArgIndex >= 0 && args[agentArgIndex + 1] ? args[agentArgIndex + 1] : 'cursor';
const allowedAgents = new Set(['cursor', 'claude-code']);
if (!allowedAgents.has(agentTarget)) {
  console.error(`Unsupported --agent value: ${agentTarget}`);
  process.exit(1);
}
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

if (agentTarget === 'cursor') {
  const cursorSync = [
    { src: 'commands', dest: '.cursor/commands' },
    { src: 'rules', dest: '.cursor/rules' },
  ];
  for (const { src, dest } of cursorSync) {
    const srcPath = path.join(TARGET, src);
    const destPath = path.join(TARGET, dest);
    if (fs.existsSync(srcPath)) {
      console.log('Sync', src, '->', dest);
      copyRecursive(srcPath, destPath);
      totalFiles += countFiles(destPath);
    }
  }
  const crSrc = path.join(TARGET, 'config', 'code-reviewer-config.yaml');
  const crDest = path.join(TARGET, '.cursor', 'agents', 'code-reviewer-config.yaml');
  if (fs.existsSync(crSrc)) {
    fs.mkdirSync(path.dirname(crDest), { recursive: true });
    fs.copyFileSync(crSrc, crDest);
    console.log('Sync config/code-reviewer-config.yaml -> .cursor/agents/');
    totalFiles += 1;
  }
}

if (agentTarget === 'claude-code') {
  const claudeSync = [
    { src: 'commands', dest: '.claude/commands' },
    { src: 'rules', dest: '.claude/rules' },
    { src: '.claude/agents', dest: '.claude/agents' },
    { src: '.claude/protocols', dest: '.claude/protocols' },
    { src: '.claude/state', dest: '.claude/state' },
    { src: '.claude/hooks', dest: '.claude/hooks' },
  ];
  for (const { src, dest } of claudeSync) {
    const srcPath = path.join(PKG_ROOT, src);
    const fallbackSrcPath = path.join(TARGET, src);
    const resolvedSrcPath = fs.existsSync(srcPath) ? srcPath : fallbackSrcPath;
    const destPath = path.join(TARGET, dest);
    if (fs.existsSync(resolvedSrcPath)) {
      console.log('Sync', src, '->', dest);
      copyRecursive(resolvedSrcPath, destPath);
      totalFiles += countFiles(destPath);
    } else {
      fs.mkdirSync(destPath, { recursive: true });
    }
  }
}

console.log('Done. Copied', DIRS.length, 'dirs,', totalFiles, 'files.');
console.log('Verify with: _bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1');
