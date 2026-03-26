#!/usr/bin/env node

const path = require('node:path');
const { verifySpecifyMirror } = require(path.join(
  __dirname,
  '..',
  '_bmad',
  'speckit',
  'scripts',
  'node',
  'speckit-mirror.js'
));

const projectRoot = path.resolve(__dirname, '..');
const bmadRoot = path.join(projectRoot, '_bmad');
const result = verifySpecifyMirror({ bmadRoot, projectRoot });

if (!result.ok) {
  console.error('Speckit .specify mirror drift detected.');
  for (const issue of result.issues) {
    if (issue.type === 'extra') {
      console.error(`- extra: ${issue.targetRelative}`);
      continue;
    }
    console.error(`- ${issue.type}: ${issue.targetRelative} <= ${issue.sourceRelative}`);
  }
  process.exit(1);
}

console.log(`Speckit .specify mirror is in sync (${result.plan.entries.length} files checked)`);
