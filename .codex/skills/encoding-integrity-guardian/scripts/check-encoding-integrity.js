#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_PATHS = [
  '_bmad',
  '.codex',
  '.cursor',
  '.claude',
  'docs',
  'README.md',
  'README.zh-CN.md',
  'AGENTS.md',
  'package.json',
  'packages',
  'scripts',
  'tests',
];

const MOJIBAKE_PATTERNS = [
  // Build known mojibake sentinels from code points so this gate does not
  // contain literal corrupted text and then flag itself.
  String.fromCodePoint(0x9983),
  String.fromCodePoint(0x9225),
  String.fromCodePoint(0x922b),
  String.fromCodePoint(0x95b3),
  String.fromCodePoint(0x95ba),
  String.fromCodePoint(0x95bf),
  String.fromCodePoint(0x93c2),
  String.fromCodePoint(0x68e3),
  String.fromCodePoint(0xe0a3),
  String.fromCodePoint(0xe178),
  String.fromCodePoint(0xfffd),
];

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.csv',
  '.js',
  '.json',
  '.md',
  '.mdx',
  '.mjs',
  '.ps1',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

function listGitFiles() {
  const result = spawnSync('git', ['ls-files'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'git ls-files failed');
  }
  return result.stdout.split(/\r?\n/u).filter(Boolean);
}

function parseArgs(argv) {
  const options = { json: false, paths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--paths') options.paths.push(...String(argv[++index] || '').split(',').filter(Boolean));
    else if (arg.startsWith('--paths=')) options.paths.push(...arg.slice('--paths='.length).split(',').filter(Boolean));
    else options.paths.push(arg);
  }
  if (options.paths.length === 0) options.paths = DEFAULT_PATHS;
  return options;
}

function isInScope(file, scopes) {
  return scopes.some((scope) => file === scope || file.startsWith(`${scope.replace(/\\/gu, '/')}/`));
}

function isTextFile(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function scanFile(file) {
  const bytes = fs.readFileSync(file);
  const hits = [];
  if (bytes.includes(0)) {
    hits.push({ line: 1, pattern: 'NUL-byte/possible-UTF-16-or-binary', sample: '<binary-or-utf16-like-content>' });
    return hits;
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    hits.push({ line: 1, pattern: 'UTF-8-BOM', sample: '<utf8-bom>' });
  }
  const text = bytes.toString('utf8');
  const lines = text.split(/\r?\n/u);
  for (const pattern of MOJIBAKE_PATTERNS) {
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].includes(pattern)) {
        hits.push({ line: index + 1, pattern, sample: lines[index].trim().slice(0, 220) });
      }
    }
  }
  return hits;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = listGitFiles()
    .filter((file) => isInScope(file, options.paths))
    .filter(isTextFile)
    .filter((file) => fs.existsSync(file));
  const findings = [];
  for (const file of files) {
    const hits = scanFile(file);
    if (hits.length > 0) findings.push({ file, hits });
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ checkedFiles: files.length, findings }, null, 2)}\n`);
  } else {
    for (const finding of findings) {
      for (const hit of finding.hits.slice(0, 5)) {
        process.stdout.write(`${finding.file}:${hit.line}: ${hit.pattern}: ${hit.sample}\n`);
      }
      if (finding.hits.length > 5) {
        process.stdout.write(`${finding.file}: ... ${finding.hits.length - 5} more hits\n`);
      }
    }
    process.stdout.write(`checkedFiles=${files.length} findings=${findings.length}\n`);
  }
  return findings.length === 0 ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
