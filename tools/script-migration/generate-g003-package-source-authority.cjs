#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const ENTRY_SOURCE = 'scripts/main-agent-orchestration.ts';
const TARGET_ROOT = 'packages/bmad-speckit/src/main-agent/source-authority';
const DIST_ROOT = 'packages/bmad-speckit/dist/main-agent/source-authority';
const MANIFEST_PATH =
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/source-authority/G003.main-agent-orchestration.package-source-manifest.json';

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(relativePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(repoPath(relativePath))).digest('hex')}`;
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--json') args.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function targetPathForSource(sourceRelativePath) {
  return `${DIST_ROOT}/${normalizePath(sourceRelativePath).replace(/\.(?:ts|tsx)$/u, '.js')}`;
}

function sourceAuthorityPathForSource(sourceRelativePath) {
  return `${TARGET_ROOT}/${normalizePath(sourceRelativePath)}`;
}

function sourcePathForImport(importerRelativePath, specifier) {
  if (!specifier.startsWith('.')) return null;
  const importerDir = path.dirname(importerRelativePath);
  const candidateBase = normalizePath(path.normalize(path.join(importerDir, specifier)));
  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    `${candidateBase}.js`,
    `${candidateBase}.cjs`,
    `${candidateBase}/index.ts`,
    `${candidateBase}/index.tsx`,
    `${candidateBase}/index.js`,
    `${candidateBase}/index.cjs`,
  ];
  return candidates.find((candidate) => fs.existsSync(repoPath(candidate)) && fs.statSync(repoPath(candidate)).isFile()) || null;
}

function importSpecifiers(sourceText) {
  const out = [];
  const importRe = /\bimport\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/gu;
  const exportRe = /\bexport\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/gu;
  const requireRe = /\b(?:require|requireCommonJs)\s*\(\s*['"]([^'"]+)['"]\s*\)/gu;
  let match;
  while ((match = importRe.exec(sourceText)) !== null) out.push(match[1]);
  while ((match = exportRe.exec(sourceText)) !== null) out.push(match[1]);
  while ((match = requireRe.exec(sourceText)) !== null) out.push(match[1]);
  return out;
}

function collectSourceGraph(entrySource) {
  const seen = new Set();
  const queue = [entrySource];
  const edges = [];
  while (queue.length > 0) {
    const current = normalizePath(queue.shift());
    if (seen.has(current)) continue;
    seen.add(current);
    const text = fs.readFileSync(repoPath(current), 'utf8');
    for (const specifier of importSpecifiers(text)) {
      const resolved = sourcePathForImport(current, specifier);
      if (!resolved) continue;
      edges.push({ from: current, specifier, to: resolved });
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  return {
    sources: [...seen].sort(),
    edges: edges.sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`)),
  };
}

function writeFile(relativePath, text, dryRun) {
  if (!dryRun) {
    const absolute = repoPath(relativePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, text, 'utf8');
  }
  return {
    path: relativePath,
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: sha256Text(text),
  };
}

function generate(dryRun = false) {
  const graph = collectSourceGraph(ENTRY_SOURCE);
  const generatedFiles = [];
  const copiedSourceFiles = [];
  const expectedDistFiles = [];
  const diagnostics = [];
  for (const source of graph.sources) {
    const target = targetPathForSource(source);
    expectedDistFiles.push({
      source,
      sourceSha256: sha256File(source),
      target,
    });
    const sourceAuthorityTarget = sourceAuthorityPathForSource(source);
    const sourceText =
      source === ENTRY_SOURCE || !fs.existsSync(repoPath(sourceAuthorityTarget))
        ? fs.readFileSync(repoPath(source), 'utf8')
        : fs.readFileSync(repoPath(sourceAuthorityTarget), 'utf8');
    copiedSourceFiles.push({
      source,
      sourceSha256: sha256File(source),
      target: sourceAuthorityTarget,
      ...writeFile(sourceAuthorityTarget, sourceText, dryRun),
    });
  }
  const manifest = {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-g003-package-source-authority/v1',
    generatedAt: new Date().toISOString(),
    entrySource: ENTRY_SOURCE,
    entryTarget: targetPathForSource(ENTRY_SOURCE),
    entrySourceAuthorityTarget: sourceAuthorityPathForSource(ENTRY_SOURCE),
    targetRoot: TARGET_ROOT,
    distRoot: DIST_ROOT,
    sourceCount: graph.sources.length,
    edgeCount: graph.edges.length,
    diagnostics,
    generatedFiles,
    copiedSourceFiles,
    expectedDistFiles,
    edges: graph.edges,
    fallbackPolicy: {
      usesRootScriptsRuntime: false,
      usesTsxRuntime: false,
      usesTsNodeRuntime: false,
      usesCompiledMainAgentFallback: false,
    },
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestInfo = writeFile(MANIFEST_PATH, manifestText, dryRun);
  return {
    ok: diagnostics.length === 0,
    dryRun,
    manifestPath: MANIFEST_PATH,
    manifestSha256: manifestInfo.sha256,
    sourceCount: graph.sources.length,
    edgeCount: graph.edges.length,
    generatedFileCount: generatedFiles.length,
    copiedSourceFileCount: copiedSourceFiles.length,
    expectedDistFileCount: expectedDistFiles.length,
    diagnostics,
    entryTarget: targetPathForSource(ENTRY_SOURCE),
    entrySourceAuthorityTarget: sourceAuthorityPathForSource(ENTRY_SOURCE),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = generate(args.dryRun);
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${result.generatedFileCount} files\n`);
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ENTRY_SOURCE,
  MANIFEST_PATH,
  TARGET_ROOT,
  collectSourceGraph,
  generate,
  sourceAuthorityPathForSource,
  targetPathForSource,
};
