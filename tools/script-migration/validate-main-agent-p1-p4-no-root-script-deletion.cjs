#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
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

function readRegistry(errors) {
  const filePath = repoPath(REGISTRY_PATH);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing registry: ${REGISTRY_PATH}`);
    return null;
  }
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`invalid registry YAML: ${error.message}`);
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

function gitStatusLines() {
  const result = spawnSync('git', ['status', '--porcelain=v1'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 20 * 1024 * 1024,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`git status failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return String(result.stdout || '').split(/\r?\n/u).filter(Boolean);
}

function statusMentionsOriginalPath(line, originalPath) {
  const normalized = slash(line);
  return normalized.endsWith(` ${originalPath}`) || normalized.includes(` ${originalPath} -> `);
}

function validate(entries, errors) {
  const seen = new Set();
  const status = gitStatusLines();
  for (const entry of entries) {
    const key = `${entry.waveId}:${entry.originalPath}`;
    if (seen.has(key)) errors.push(`duplicate row in P1-P4 wave set: ${key}`);
    seen.add(key);

    if (!entry.originalPath || !entry.originalPath.startsWith('scripts/')) {
      errors.push(`${entry.waveId}/${entry.entryId} originalPath is not a root script: ${entry.originalPath}`);
      continue;
    }
    if (!fs.existsSync(repoPath(entry.originalPath))) {
      errors.push(`original root script missing: ${entry.originalPath}`);
    }
    if (entry.originalPathStatus !== 'retained') {
      errors.push(`${entry.entryId} originalPathStatus must remain retained`);
    }
    if (entry.deletionAllowed !== false) {
      errors.push(`${entry.entryId} deletionAllowed must be false`);
    }
    if (entry.deletionApprovalRef !== null) {
      errors.push(`${entry.entryId} deletionApprovalRef must be null`);
    }
    if (/deletion[-_ ]?ready|delete[-_ ]?ready/iu.test(String(entry.oldPathDisposition || ''))) {
      errors.push(`${entry.entryId} oldPathDisposition must not mark deletion-ready`);
    }

    for (const line of status) {
      if (!statusMentionsOriginalPath(line, entry.originalPath)) continue;
      const code = line.slice(0, 2);
      if (code.includes('D') || code.includes('R')) {
        errors.push(`git status reports deletion/move/rename for ${entry.originalPath}: ${line}`);
      }
    }
  }
}

function main() {
  const errors = [];
  const registry = readRegistry(errors);
  const entries = registry ? p1p4Entries(registry, errors) : [];
  if (entries.length !== 82) errors.push(`P1-P4 entry count expected 82 but got ${entries.length}`);
  validate(entries, errors);
  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    registryPath: REGISTRY_PATH,
    waveIds: WAVE_IDS,
    checkedEntries: entries.length,
    rootScriptsDeleted: false,
    rootScriptDeletionApproved: false,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (errors.length > 0) process.exit(1);
}

main();
