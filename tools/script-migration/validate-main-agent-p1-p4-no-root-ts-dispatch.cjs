#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const INSTALL_MATRIX_DIR = 'repo-governance/script-migrations/main-agent-p1-p4-runtime-migration/install-matrix';
const WAVE_IDS = [
  'main-agent-runtime-migration-wave-3.6',
  'main-agent-runtime-migration-wave-3.7',
  'main-agent-runtime-migration-wave-3.8',
  'main-agent-runtime-migration-wave-3.9',
];

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function readRegistry(errors) {
  try {
    return yaml.load(fs.readFileSync(repoPath(REGISTRY_PATH), 'utf8'));
  } catch (error) {
    errors.push(`failed to read registry: ${error.message}`);
    return null;
  }
}

function p1p4Entries(registry, errors) {
  const entries = [];
  for (const waveId of WAVE_IDS) {
    const wave = registry?.waves?.find((candidate) => candidate.waveId === waveId);
    if (!wave) {
      errors.push(`missing wave: ${waveId}`);
      continue;
    }
    for (const entry of wave.entries || []) entries.push({ waveId, ...entry });
  }
  return entries;
}

function actionSlug(entry) {
  const source = (entry.targetSourcePaths || entry.targetPaths || []).find((target) =>
    slash(target).startsWith('packages/bmad-speckit/src/main-agent/actions/')
  );
  if (source) return path.basename(source, '.js');
  const slug = path.basename(entry.originalPath || '').replace(/\.(?:ts|js|cjs)$/u, '');
  return slug.startsWith('main-agent-') ? slug.slice('main-agent-'.length) : slug;
}

function coveredRootScriptRegex(entries) {
  const alternatives = entries
    .map((entry) => slash(entry.originalPath))
    .filter((originalPath) => originalPath.startsWith('scripts/'))
    .map((originalPath) => escapeRegExp(originalPath).replace(/\//gu, '[\\\\/]'));
  return new RegExp(`(^|[\\\\/])(?:${alternatives.join('|')})(?:$|[^A-Za-z0-9_.-])`, 'iu');
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(slash))].sort();
}

function targetFiles(entries) {
  const packageRuntimeEntries = entries.filter((entry) => entry.migrationStrategy === 'package_runtime_module');
  const helperEntries = entries.filter((entry) => entry.migrationStrategy === 'durable_helper_copy');
  return unique([
    'packages/bmad-speckit/bin/bmad-speckit.js',
    'packages/bmad-speckit/src/main-agent/index.js',
    'packages/bmad-speckit/src/main-agent/runtime.js',
    'packages/bmad-speckit/dist/main-agent/index.js',
    'packages/bmad-speckit/dist/main-agent/runtime.js',
    'packages/bmad-speckit/src/main-agent/actions/package-runtime-report.js',
    'packages/bmad-speckit/dist/main-agent/actions/package-runtime-report.js',
    'packages/bmad-speckit/src/main-agent/helpers/durable-helper-report.js',
    'packages/bmad-speckit/dist/main-agent/helpers/durable-helper-report.js',
    ...packageRuntimeEntries.flatMap((entry) => [...(entry.targetSourcePaths || []), ...(entry.targetDistPaths || [])]),
    ...helperEntries.flatMap((entry) => [...(entry.targetSourcePaths || []), ...(entry.targetDistPaths || [])]),
  ]);
}

function scanFiles(entries, errors) {
  const rootScriptPattern = coveredRootScriptRegex(entries);
  const forbidden = [
    { id: 'covered-root-script-path', pattern: rootScriptPattern },
    { id: 'runRepoScript', pattern: /runRepoScript\s*\(/u },
    { id: 'tsx', pattern: /(^|[^A-Za-z0-9_-])tsx(?:\.cmd)?($|[^A-Za-z0-9_-])/iu },
    { id: 'ts-node', pattern: /(^|[^A-Za-z0-9_-])ts-node(?:\.cmd)?($|[^A-Za-z0-9_-])/iu },
    { id: 'compiled-fallback', pattern: /compiled[\\/]main-agent-orchestration\.cjs/iu },
  ];
  const scanned = [];
  for (const relativePath of targetFiles(entries)) {
    if (relativePath.startsWith('repo-governance/') || relativePath.startsWith('tools/script-migration/')) continue;
    const fullPath = repoPath(relativePath);
    if (!fs.existsSync(fullPath)) {
      errors.push(`missing covered package runtime file: ${relativePath}`);
      continue;
    }
    const text = fs.readFileSync(fullPath, 'utf8');
    scanned.push(relativePath);
    for (const { id, pattern } of forbidden) {
      if (pattern.test(text)) errors.push(`${relativePath} contains forbidden ${id}`);
    }
  }
  return scanned;
}

function validateRuntimeDispatch(entries, errors) {
  const runtimeText = fs.existsSync(repoPath('packages/bmad-speckit/src/main-agent/runtime.js'))
    ? fs.readFileSync(repoPath('packages/bmad-speckit/src/main-agent/runtime.js'), 'utf8')
    : '';
  for (const entry of entries.filter((candidate) => candidate.migrationStrategy === 'package_runtime_module')) {
    const action = actionSlug(entry);
    if (!runtimeText.includes(`'${action}'`)) {
      errors.push(`runtime.js missing package runtime action dispatch for ${entry.entryId}: ${action}`);
    }
    const target = `packages/bmad-speckit/src/main-agent/actions/${action}.js`;
    if (!fs.existsSync(repoPath(target))) errors.push(`missing action source for ${entry.entryId}: ${target}`);
  }
}

function validateInstallReceipts(errors) {
  const dir = repoPath(INSTALL_MATRIX_DIR);
  if (!fs.existsSync(dir)) {
    errors.push(`missing install matrix directory: ${INSTALL_MATRIX_DIR}`);
    return [];
  }
  const receiptFiles = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(dir, name))
    .sort();
  if (receiptFiles.length < 4) errors.push(`expected at least four install matrix receipts, got ${receiptFiles.length}`);
  const receipts = [];
  for (const filePath of receiptFiles) {
    const relativePath = slash(path.relative(ROOT, filePath));
    const receipt = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    receipts.push(relativePath);
    for (const field of ['usedRootScript', 'usedTsx', 'usedTsNode', 'usedCompiledFallback']) {
      if (receipt[field] !== false) errors.push(`${relativePath} ${field} must be false`);
    }
    if (receipt.generatedSurfaceScan && receipt.generatedSurfaceScan.findings?.length) {
      errors.push(`${relativePath} generatedSurfaceScan has findings`);
    }
    for (const command of receipt.commands || []) {
      for (const field of ['usedRootScript', 'usedTsx', 'usedTsNode', 'usedCompiledFallback']) {
        if (command[field] !== false) errors.push(`${relativePath} command ${command.commandId || command.action} ${field} must be false`);
      }
    }
  }
  return receipts;
}

function main() {
  const errors = [];
  const registry = readRegistry(errors);
  const entries = registry ? p1p4Entries(registry, errors) : [];
  const scannedFiles = scanFiles(entries, errors);
  validateRuntimeDispatch(entries, errors);
  const installMatrixReceipts = validateInstallReceipts(errors);
  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    registryPath: REGISTRY_PATH,
    checkedEntries: entries.length,
    scannedFiles,
    installMatrixReceipts,
    usedRootScript: false,
    usedTsx: false,
    usedTsNode: false,
    usedCompiledFallback: false,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (errors.length > 0) process.exit(1);
}

main();
