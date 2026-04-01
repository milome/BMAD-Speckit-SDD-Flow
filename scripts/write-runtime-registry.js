#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

function runtimeContextRegistryPath(root) {
  return path.join(root, '_bmad-output', 'runtime', 'registry.json');
}

function defaultRuntimeContextRegistry(root) {
  return {
    version: 1,
    projectRoot: root,
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sources: {
      sprintStatusPath: '_bmad-output/implementation-artifacts/sprint-status.yaml',
      epicsPath: 'epics.md',
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
