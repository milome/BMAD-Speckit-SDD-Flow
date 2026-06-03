#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(packageRoot, 'src', 'main-agent');
const distRoot = path.join(packageRoot, 'dist', 'main-agent');
const files = [
  'index.js',
  'runtime.js',
  'actions/inspect.js',
  'actions/confirm-scope.js',
  'actions/dispatch-plan.js',
  'actions/run-loop.js',
  'actions/release-gate.js',
  'actions/quality-gate.js',
  'actions/delivery-truth-gate.js',
  'auditor-host/run-auditor-host.cjs',
  'helpers/write-runtime-context.cjs',
];

function copyRuntimeFile(relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(distRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`main-agent source file missing: ${relativePath}`);
  }
  const text = fs.readFileSync(source, 'utf8');
  if (/scripts[\\/]main-agent-orchestration\.ts/.test(text)) {
    throw new Error(`main-agent dist source references root orchestration script: ${relativePath}`);
  }
  if (/compiled[\\/]main-agent-orchestration\.cjs/.test(text)) {
    throw new Error(`covered main-agent source references compiled fallback: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

for (const file of files) copyRuntimeFile(file);
process.stdout.write(`built dist/main-agent files=${files.length}\n`);
