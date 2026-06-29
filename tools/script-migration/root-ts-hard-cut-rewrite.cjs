#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCAN_DIRS = ['_bmad', '.codex', '.claude', '.cursor', 'tests', 'packages'];
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', '.runtime-mcp']);
const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function repoRelative(absolutePath) {
  return toPosix(path.relative(REPO_ROOT, absolutePath));
}

function walk(dir, out = []) {
  const absoluteDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(absoluteDir)) return out;
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const absolute = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) walk(repoRelative(absolute), out);
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) out.push(absolute);
  }
  return out;
}

function rootTsPaths() {
  return walk('scripts').filter((file) => file.endsWith('.ts')).map(repoRelative).sort();
}

function packageSourcePath(rootScriptPath) {
  return `packages/bmad-speckit/src/main-agent/source-authority/${rootScriptPath}`;
}

const commandReplacements = [
  [/npx\s+ts-node\s+--project\s+tsconfig\.node\.json\s+--transpile-only\s+scripts\/run-auditor-host\.ts/gu, 'npx --no-install bmad-speckit run-auditor-host'],
  [/npx\s+ts-node\s+scripts\/run-auditor-host\.ts/gu, 'npx --no-install bmad-speckit run-auditor-host'],
  [/npx\s+ts-node\s+--transpile-only\s+scripts\/governance-remediation-runner\.ts/gu, 'npx --no-install bmad-speckit main-agent governance-remediation-runner'],
  [/npx\s+ts-node\s+scripts\/governance-remediation-runner\.ts/gu, 'npx --no-install bmad-speckit main-agent governance-remediation-runner'],
  [/node\s+scripts\/assert-implementation-entry\.ts/gu, 'npx --no-install bmad-speckit assert-implementation-entry'],
  [/npx\s+ts-node\s+scripts\/eval-questions-cli\.ts/gu, 'npx bmad-speckit eval-questions'],
  [/npx\s+ts-node\s+scripts\/coach-diagnose\.ts/gu, 'npx bmad-speckit coach'],
  [/npx\s+ts-node\s+scripts\/sft-extract\.ts/gu, 'npx bmad-speckit sft-extract'],
];

function replacementFor(rootScriptPath) {
  if (rootScriptPath === 'scripts/run-auditor-host.ts') return 'bmad-speckit run-auditor-host';
  if (rootScriptPath === 'scripts/parse-and-write-score.ts') return 'bmad-speckit score';
  if (rootScriptPath === 'scripts/coach-diagnose.ts') return 'bmad-speckit coach';
  if (rootScriptPath === 'scripts/sft-extract.ts') return 'bmad-speckit sft-extract';
  if (rootScriptPath === 'scripts/assert-implementation-entry.ts')
    return 'bmad-speckit assert-implementation-entry';
  if (rootScriptPath === 'scripts/eval-questions-cli.ts') return 'bmad-speckit eval-questions';
  if (rootScriptPath === 'scripts/emit-runtime-policy.ts') return 'bmad-speckit emit-runtime-policy';
  if (rootScriptPath === 'scripts/resolve-active-requirement.ts')
    return 'bmad-speckit main-agent resolve-active-requirement';
  if (rootScriptPath === 'scripts/party-mode-gate-check.ts')
    return 'installed party-mode runtime checker';
  return packageSourcePath(rootScriptPath);
}

function rewriteText(text, rootScripts) {
  let next = text;
  for (const [pattern, replacement] of commandReplacements) {
    next = next.replace(pattern, replacement);
  }
  for (const rootScriptPath of rootScripts) {
    next = next.split(rootScriptPath).join(replacementFor(rootScriptPath));
  }
  next = next
    .replace(/scripts\/\*\*\/\*\.ts/gu, 'packages/bmad-speckit/src/**/*.ts')
    .replace(/scripts\/\*\.ts/gu, 'packages/bmad-speckit/src/**/*.ts');
  const duplicatedPackagePrefix =
    'packages/bmad-speckit/src/main-agent/source-authority/scripts/';
  next = next
    .split(duplicatedPackagePrefix)
    .join('packages/bmad-speckit/src/main-agent/source-authority/scripts/');
  return next;
}

function rewriteFiles() {
  const rootScripts = rootTsPaths();
  const files = SCAN_DIRS.flatMap((dir) => walk(dir));
  const changed = [];
  for (const absolute of files) {
    const rel = repoRelative(absolute);
    if (rel.startsWith('packages/bmad-speckit/dist/')) continue;
    const before = fs.readFileSync(absolute, 'utf8');
    const after = rewriteText(before, rootScripts);
    if (after !== before) {
      fs.writeFileSync(absolute, after, 'utf8');
      changed.push(rel);
    }
  }
  return changed;
}

function summarizeRefs() {
  const rootScripts = rootTsPaths();
  const counts = new Map();
  for (const absolute of SCAN_DIRS.flatMap((dir) => walk(dir))) {
    const text = fs.readFileSync(absolute, 'utf8');
    for (const rootScriptPath of rootScripts) {
      const count = text.split(rootScriptPath).length - 1;
      if (count > 0) counts.set(rootScriptPath, (counts.get(rootScriptPath) || 0) + count);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function main(argv) {
  const apply = argv.includes('--apply');
  const summary = summarizeRefs();
  const changed = apply ? rewriteFiles() : [];
  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'pass',
        mode: apply ? 'apply' : 'dry-run',
        rootTsRefKinds: summary.length,
        topRefs: summary.slice(0, 80).map(([pathName, count]) => ({ path: pathName, count })),
        changedFiles: changed,
        changedFileCount: changed.length,
      },
      null,
      2
    )}\n`
  );
}

main(process.argv.slice(2));
