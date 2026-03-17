#!/usr/bin/env node
/**
 * 发布前检查脚本：确保 bmad-speckit 的 bundleDependencies 所需产物就绪。
 * 在 prepublishOnly 生命周期中调用，失败则阻止发布。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCORING_DIR = path.join(ROOT, 'packages', 'scoring');
const SPECKIT_DIR = path.join(ROOT, 'packages', 'bmad-speckit');

// 确保 scoring 包的发布文件副本存在于 bmad-speckit/node_modules 中
// （Windows junction/symlink 可能导致 npm pack 无法正确跟随）
const scoringNmDest = path.join(SPECKIT_DIR, 'node_modules', '@bmad-speckit', 'scoring');
const scoringPkg = JSON.parse(
  fs.readFileSync(path.join(SCORING_DIR, 'package.json'), 'utf8')
);
const publishFiles = (scoringPkg.files || []).filter((f) => !f.includes('*'));

function syncScoringToNodeModules() {
  fs.mkdirSync(scoringNmDest, { recursive: true });
  fs.copyFileSync(
    path.join(SCORING_DIR, 'package.json'),
    path.join(scoringNmDest, 'package.json')
  );
  const readmeSrc = path.join(SCORING_DIR, 'README.md');
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.join(scoringNmDest, 'README.md'));
  }
  for (const dir of publishFiles) {
    const src = path.join(SCORING_DIR, dir);
    const dest = path.join(scoringNmDest, dir);
    if (fs.existsSync(src)) {
      copyDir(src, dest);
    }
  }
}

function copyDir(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyDir(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('同步 scoring 发布文件到 bmad-speckit/node_modules ...');
syncScoringToNodeModules();
console.log('同步完成。\n');

const checks = [
  {
    label: 'packages/scoring/dist/ 存在且非空',
    test: () => {
      const distDir = path.join(SCORING_DIR, 'dist');
      if (!fs.existsSync(distDir)) return false;
      const files = fs.readdirSync(distDir, { recursive: true });
      return files.length > 0;
    },
  },
  {
    label: 'packages/scoring/rules/ 存在',
    test: () => fs.existsSync(path.join(SCORING_DIR, 'rules')),
  },
  {
    label: 'packages/bmad-speckit/node_modules/@bmad-speckit/scoring 存在',
    test: () =>
      fs.existsSync(
        path.join(SPECKIT_DIR, 'node_modules', '@bmad-speckit', 'scoring')
      ),
  },
  {
    label: 'packages/bmad-speckit/package.json 包含 bundleDependencies',
    test: () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(SPECKIT_DIR, 'package.json'), 'utf8')
      );
      return (
        Array.isArray(pkg.bundleDependencies) &&
        pkg.bundleDependencies.includes('@bmad-speckit/scoring')
      );
    },
  },
];

let allPassed = true;
for (const { label, test } of checks) {
  const ok = test();
  console.log(ok ? `  ✓ ${label}` : `  ✗ ${label}`);
  if (!ok) allPassed = false;
}

if (!allPassed) {
  console.error('\n发布前检查未通过，请修复上述问题后重试。');
  process.exit(1);
}

console.log('\n发布前检查全部通过 ✓');
