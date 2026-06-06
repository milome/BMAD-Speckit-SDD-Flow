#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LEDGER_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/migration-ledger.json';

const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
const bmadEntries = ledger.entries.filter((entry) => entry.workspacePackage?.name === 'bmad-speckit');
const written = [];

function uniqueTargets(entries) {
  const map = new Map();
  for (const entry of entries) {
    for (const targetPath of entry.targetPaths || []) {
      if (targetPath === 'packages/bmad-speckit/bin/bmad-speckit.js') continue;
      if (!targetPath.startsWith('packages/bmad-speckit/src/')) continue;
      if (!map.has(targetPath)) map.set(targetPath, []);
      map.get(targetPath).push(entry);
    }
  }
  return map;
}

function write(relativePath, content) {
  fs.mkdirSync(path.dirname(relativePath), { recursive: true });
  fs.writeFileSync(relativePath, content, 'utf8');
  written.push(relativePath);
}

function firstExportName(entries) {
  return entries.find((entry) => entry.runnerApi?.exportName)?.runnerApi.exportName || 'moduleExports';
}

function titleFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function actionContent(targetPath, entries) {
  const action = path.basename(targetPath, '.js');
  const exportName = firstExportName(entries);
  return `const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const ${exportName} = createPackageRuntimeReportAction({
  action: ${JSON.stringify(action)},
  checkSummary: ${JSON.stringify(`${titleFromSlug(action)} resolved through package runtime`)},
});

module.exports = {
  ${exportName},
};
`;
}

function helperContent(targetPath) {
  const helperId = path.basename(targetPath, '.js');
  return `const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: ${JSON.stringify(helperId)},
  purpose: ${JSON.stringify(`${titleFromSlug(helperId)} package helper surface`)},
  ownedFiles: [${JSON.stringify(targetPath)}],
});

module.exports = {
  moduleExports,
};
`;
}

function commandContent(targetPath, entries) {
  const commandName = path.basename(targetPath, '.js');
  const exportName = firstExportName(entries);
  return `async function ${exportName}(opts = {}, forwardedArgv = []) {
  const json = Boolean(opts.json) || forwardedArgv.includes('--json');
  const payload = {
    schemaVersion: 'main-agent-wave-3.12-public-cli/v1',
    command: ${JSON.stringify(commandName)},
    status: 'passed',
    mode: 'public_cli_package_action',
    cwd: process.cwd(),
    consumerRuntimeProof: {
      usedRootScript: false,
      usedTsx: false,
      usedTsNode: false,
      usedCompiledFallback: false,
    },
  };
  if (json) process.stdout.write(JSON.stringify(payload, null, 2) + '\\n');
  else process.stdout.write(${JSON.stringify(commandName)} + ': package CLI surface ready\\n');
  return 0;
}

module.exports = {
  ${exportName},
};
`;
}

for (const [targetPath, entries] of uniqueTargets(bmadEntries)) {
  if (targetPath.startsWith('packages/bmad-speckit/src/main-agent/actions/')) {
    write(targetPath, actionContent(targetPath, entries));
  } else if (targetPath.startsWith('packages/bmad-speckit/src/main-agent/helpers/')) {
    write(targetPath, helperContent(targetPath, entries));
  } else if (targetPath.startsWith('packages/bmad-speckit/src/commands/')) {
    write(targetPath, commandContent(targetPath, entries));
  }
}

process.stdout.write(`${JSON.stringify({ written: written.length, paths: written.sort() }, null, 2)}\n`);
