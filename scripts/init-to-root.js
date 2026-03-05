#!/usr/bin/env node
/**
 * Deploy _bmad, _bmad-output, commands, rules to project root (current working directory).
 * Usage: from package root, run `npm run init` or `node scripts/init-to-root.js [targetDir]`
 *        `node scripts/init-to-root.js --full [targetDir]` for full deployment (7 dirs + .cursor/ sync)
 * Target defaults to process.cwd() (e.g. when run as postinstall from a consumer project, cwd is that project).
 */
const path = require('path');
const fs = require('fs');

const PKG_ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const fullMode = args.includes('--full');
const targetArg = args.find(a => a !== '--full');
const TARGET = targetArg ? path.resolve(targetArg) : process.cwd();

const CORE_DIRS = ['_bmad', '_bmad-output', 'commands', 'rules'];
const FULL_DIRS = ['_bmad', '_bmad-output', 'commands', 'rules', 'config', 'templates', 'workflows'];
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

console.log('BMAD-Speckit-SDD-Flow init: deploy to', TARGET, fullMode ? '(full mode)' : '');
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

// .cursor/ sync (always: commands, rules; full mode adds config/code-reviewer-config.yaml)
const CURSOR_SYNC = [
  { src: 'commands', dest: '.cursor/commands' },
  { src: 'rules', dest: '.cursor/rules' },
];
for (const { src, dest } of CURSOR_SYNC) {
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

console.log('Done. Copied', DIRS.length, 'dirs,', totalFiles, 'files.');
console.log('Verify with: _bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1');
