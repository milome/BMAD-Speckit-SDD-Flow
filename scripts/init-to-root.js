#!/usr/bin/env node
/**
 * Deploy _bmad, _bmad-output, commands, rules to project root (current working directory).
 * Usage: from package root, run `npm run init` or `node scripts/init-to-root.js [targetDir]`
 * Target defaults to process.cwd() (e.g. when run as postinstall from a consumer project, cwd is that project).
 */
const path = require('path');
const fs = require('fs');

const PKG_ROOT = path.resolve(__dirname, '..');
const TARGET = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const DIRS = ['_bmad', '_bmad-output', 'commands', 'rules'];

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

console.log('BMAD-Speckit-SDD-Flow init: deploy to', TARGET);
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
}
console.log('Done. Verify with: _bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1');
