#!/usr/bin/env node
/**
 * Write an explicit runtime context file (bootstrap / speckit phase updates).
 * Usage: node scripts/write-runtime-context.cjs <targetFile> [flow] [stage] [templateId?] [epicId] [storyId] [storySlug] [runId] [artifactRoot] [contextScope]
 * Default flow/stage: story / specify
 */
/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const targetFileArg = process.argv[2];
if (!targetFileArg || String(targetFileArg).trim() === '') {
  console.error(
    'Usage: node write-runtime-context.cjs <targetFile> [flow] [stage] [templateId?] [epicId] [storyId] [storySlug] [runId] [artifactRoot] [contextScope]'
  );
  process.exit(1);
}

const targetFile = path.resolve(targetFileArg);
const flow = (process.argv[3] || 'story').trim();
const stage = (process.argv[4] || 'specify').trim();
const templateIdArg = process.argv[5];
const epicIdArg = process.argv[6];
const storyIdArg = process.argv[7];
const storySlugArg = process.argv[8];
const runIdArg = process.argv[9];
const artifactRootArg = process.argv[10];
const contextScopeArg = process.argv[11];

fs.mkdirSync(path.dirname(targetFile), { recursive: true });

const payload = {
  version: 1,
  flow,
  stage,
  updatedAt: new Date().toISOString(),
};
if (templateIdArg && String(templateIdArg).trim() !== '') {
  payload.templateId = String(templateIdArg).trim();
}
if (epicIdArg && String(epicIdArg).trim() !== '') {
  payload.epicId = String(epicIdArg).trim();
}
if (storyIdArg && String(storyIdArg).trim() !== '') {
  payload.storyId = String(storyIdArg).trim();
}
if (storySlugArg && String(storySlugArg).trim() !== '') {
  payload.storySlug = String(storySlugArg).trim();
}
if (runIdArg && String(runIdArg).trim() !== '') {
  payload.runId = String(runIdArg).trim();
}
if (artifactRootArg && String(artifactRootArg).trim() !== '') {
  payload.artifactRoot = String(artifactRootArg).trim();
}
if (contextScopeArg && ['project', 'story'].includes(String(contextScopeArg).trim())) {
  payload.contextScope = String(contextScopeArg).trim();
}

const tmp = `${targetFile}.${process.pid}.tmp`;
fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
let fd = fs.openSync(tmp, 'r+');
try {
  fs.fsyncSync(fd);
} finally {
  fs.closeSync(fd);
}
fs.renameSync(tmp, targetFile);
fd = fs.openSync(targetFile, 'r+');
try {
  fs.fsyncSync(fd);
} finally {
  fs.closeSync(fd);
}

console.log('Wrote', targetFile);
