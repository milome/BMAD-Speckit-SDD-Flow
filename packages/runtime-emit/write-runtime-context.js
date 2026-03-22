#!/usr/bin/env node
/**
 * Write `.bmad/runtime-context.json` (bootstrap / speckit phase updates).
 * Usage: node write-runtime-context.js [root] [flow] [stage] [templateId?]
 * Default: cwd, flow=story, stage=specify
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const flow = (process.argv[3] || 'story').trim();
const stage = (process.argv[4] || 'specify').trim();
const templateIdArg = process.argv[5];

const bmad = path.join(root, '.bmad');
fs.mkdirSync(bmad, { recursive: true });

const payload = {
  version: 1,
  flow,
  stage,
  updatedAt: new Date().toISOString(),
};
if (templateIdArg && String(templateIdArg).trim() !== '') {
  payload.templateId = String(templateIdArg).trim();
}

const file = path.join(bmad, 'runtime-context.json');
const tmp = `${file}.${process.pid}.tmp`;
fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
let fd = fs.openSync(tmp, 'r+');
try {
  fs.fsyncSync(fd);
} finally {
  fs.closeSync(fd);
}
fs.renameSync(tmp, file);
fd = fs.openSync(file, 'r+');
try {
  fs.fsyncSync(fd);
} finally {
  fs.closeSync(fd);
}

console.log('Wrote', file);
