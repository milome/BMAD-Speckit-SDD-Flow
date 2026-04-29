#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '..');

const dependencyNodeModules = [
  path.join(root, 'node_modules', 'bmad-speckit', 'node_modules'),
  path.join(root, 'packages', 'bmad-speckit', 'node_modules'),
].filter((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());

if (dependencyNodeModules.length > 0) {
  const current = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
    : [];
  process.env.NODE_PATH = [...new Set([...dependencyNodeModules, ...current])].join(
    path.delimiter
  );
  Module._initPaths();
}

const candidates = [
  path.join(root, 'node_modules', 'bmad-speckit', 'bin', 'bmad-speckit.js'),
  path.join(root, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js'),
];

const cliEntry = candidates.find((candidate) => fs.existsSync(candidate));
if (!cliEntry) {
  process.stderr.write('bmad-speckit CLI entry not found. Run npm install first.\n');
  process.exit(1);
}

require(cliEntry);
