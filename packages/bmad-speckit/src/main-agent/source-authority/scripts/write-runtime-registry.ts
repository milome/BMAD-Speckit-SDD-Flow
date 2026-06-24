#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

function runtimeContextRegistryPath(root) {
  return path.join(root, '_bmad-output', 'runtime', 'registry.json');
}

function sanitizeBranchRef(value) {
  const normalized = String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'dev';
}

function resolveGitHeadPath(root) {
  const gitEntry = path.join(root, '.git');
  if (!fs.existsSync(gitEntry)) {
    return null;
  }
  try {
    const stat = fs.lstatSync(gitEntry);
    if (stat.isDirectory()) {
      return path.join(gitEntry, 'HEAD');
    }
    if (stat.isFile()) {
      const raw = fs.readFileSync(gitEntry, 'utf8').trim();
      const match = /^gitdir:\s*(.+)$/iu.exec(raw);
      if (!match) {
        return null;
      }
      const gitDir = path.isAbsolute(match[1]) ? match[1] : path.resolve(root, match[1]);
      return path.join(gitDir, 'HEAD');
    }
  } catch {
    return null;
  }
  return null;
}

function resolvePlanningArtifactsBranch(root) {
  const headPath = resolveGitHeadPath(root);
  if (!headPath || !fs.existsSync(headPath)) {
    return 'dev';
  }
  try {
    const raw = fs.readFileSync(headPath, 'utf8').trim();
    const branchMatch = /^ref:\s+refs\/heads\/(.+)$/iu.exec(raw);
    if (branchMatch) {
      return sanitizeBranchRef(branchMatch[1]);
    }
    if (/^[0-9a-f]{7,40}$/iu.test(raw)) {
      return `detached-${raw.slice(0, 7)}`;
    }
  } catch {
    return 'dev';
  }
  return 'dev';
}

function defaultEpicsPath(root) {
  return `_bmad-output/planning-artifacts/${resolvePlanningArtifactsBranch(root)}/epics.md`;
}

function defaultRuntimeContextRegistry(root) {
  return {
    version: 1,
    projectRoot: root,
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sources: {
      sprintStatusPath: '_bmad-output/implementation-artifacts/sprint-status.yaml',
      epicsPath: defaultEpicsPath(root),
      storyArtifactsRoot: '_bmad-output/implementation-artifacts',
      specsRoot: 'specs',
    },
    project: {
      activeEpicIds: [],
      activeStoryIds: [],
    },
    projectContextPath: path.join('_bmad-output', 'runtime', 'context', 'project.json'),
    epicContexts: {},
    storyContexts: {},
    runContexts: {},
    activeScope: {
      scopeType: 'project',
      resolvedContextPath: path.join('_bmad-output', 'runtime', 'context', 'project.json'),
      reason: 'init bootstrap project scope',
    },
  };
}

function writeRuntimeContextRegistry(root, registry) {
  const file = runtimeContextRegistryPath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(registry, null, 2) + '\n', 'utf8');
}

const targetDir = process.argv[2];
if (!targetDir) {
  process.stderr.write('write-runtime-registry: targetDir required\n');
  process.exit(1);
}

const root = path.resolve(targetDir);
const registry = defaultRuntimeContextRegistry(root);
writeRuntimeContextRegistry(root, registry);
process.exit(0);
