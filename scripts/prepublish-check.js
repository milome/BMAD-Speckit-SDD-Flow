#!/usr/bin/env node
/**
 * 发布前检查：将 workspace 包同步到 packages/bmad-speckit/node_modules/@bmad-speckit/*，
 * 配合 package.json bundleDependencies，使 npm pack 后的 tarball 在干净目录可安装运行。
 */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS script for prepublish */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SPECKIT_DIR = path.join(ROOT, 'packages', 'bmad-speckit');

const BUNDLED = [
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
    distCheck: (dir) => {
      const emit = path.join(dir, 'dist', 'emit-runtime-policy.cjs');
      const resolveSession = path.join(dir, 'dist', 'resolve-for-session.cjs');
      const renderAudit = path.join(dir, 'dist', 'render-audit-block.cjs');
      return (
        fs.existsSync(emit) &&
        fs.existsSync(resolveSession) &&
        fs.existsSync(renderAudit)
      );
    },
  },
];

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

function syncWorkspacePackageToBundled(relDir, scopedId) {
  const pkgDir = path.join(ROOT, relDir);
  const parts = scopedId.split('/');
  const dest = path.join(SPECKIT_DIR, 'node_modules', ...parts);
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const publishFiles = (pkg.files || []).filter((f) => !String(f).includes('*'));

  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(path.join(pkgDir, 'package.json'), path.join(dest, 'package.json'));
  const readmeSrc = path.join(pkgDir, 'README.md');
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.join(dest, 'README.md'));
  }
  for (const dir of publishFiles) {
    const src = path.join(pkgDir, dir);
    const out = path.join(dest, dir);
    if (fs.existsSync(src)) {
      copyDir(src, out);
    }
  }
}

for (const b of BUNDLED) {
  console.log(`同步 ${b.id} → bmad-speckit/node_modules ...`);
  syncWorkspacePackageToBundled(b.relDir, b.id);
}
console.log('同步完成。\n');

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
  console.log(ok ? `  ✓ ${label}` : `  ✗ ${label}`);
  if (!ok) allPassed = false;
}

if (!allPassed) {
  console.error('\n发布前检查未通过，请修复上述问题后重试。');
  process.exit(1);
}

console.log('\n发布前检查全部通过 ✓');
