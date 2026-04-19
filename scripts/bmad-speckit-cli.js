#!/usr/bin/env node
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS wrapper for published root bin */

const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');

function resolveCliEntry() {
  const root = path.resolve(__dirname, '..');
  const candidates = [
    path.join(root, 'node_modules', 'bmad-speckit', 'bin', 'bmad-speckit.js'),
    path.join(root, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    return require.resolve('bmad-speckit/bin/bmad-speckit.js', {
      paths: [root, process.cwd()],
    });
  } catch {
    return null;
  }
}

function installBundledDependencyNodePaths(root) {
  const candidates = [
    path.join(root, 'node_modules', 'bmad-speckit', 'node_modules'),
    path.join(root, 'packages', 'bmad-speckit', 'node_modules'),
  ].filter((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());

  if (candidates.length === 0) {
    return;
  }

  const current = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
    : [];
  const merged = [...new Set([...candidates, ...current])];
  process.env.NODE_PATH = merged.join(path.delimiter);
  Module._initPaths();
}

const root = path.resolve(__dirname, '..');
installBundledDependencyNodePaths(root);
const cliEntry = resolveCliEntry();
if (!cliEntry) {
  process.stderr.write(
    'bmad-speckit wrapper: cannot resolve packages/bmad-speckit CLI entry. Reinstall dependencies or install the packaged CLI.\n'
  );
  process.exit(1);
}

require(cliEntry);
