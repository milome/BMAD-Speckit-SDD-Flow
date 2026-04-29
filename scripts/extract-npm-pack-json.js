#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/extract-npm-pack-json.js <input> <output>');
  process.exit(2);
}

const raw = fs.readFileSync(inputPath, 'utf8');
const start = raw.indexOf('[');
const end = raw.lastIndexOf(']');

if (start < 0 || end < start) {
  console.error(`No npm pack JSON array found in ${inputPath}`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw.slice(start, end + 1));
} catch (error) {
  console.error(
    `Failed to parse npm pack JSON from ${inputPath}: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exit(1);
}

fs.writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
