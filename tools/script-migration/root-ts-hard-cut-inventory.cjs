#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ROOT_SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');
const PACKAGE_SOURCE_DIR = path.join(
  REPO_ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'source-authority',
  'scripts'
);
const CONTRACT_PATH = 'docs/plans/2026-06-27-root-scripts-ts-hard-cut-goal-execution-plan.md';
const COVERAGE_OUT = 'repo-governance/script-migrations/root-ts-hard-cut/coverage-map.json';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--')) {
      args[arg.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function repoRelative(absolutePath) {
  return toPosix(path.relative(REPO_ROOT, absolutePath));
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolute, predicate, out);
    } else if (predicate(absolute)) {
      out.push(absolute);
    }
  }
  return out;
}

function gitLines(args) {
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sha256File(absolutePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex')}`;
}

function sourceEquivalentFor(scriptPath) {
  const relative = scriptPath.slice('scripts/'.length);
  const candidate = path.join(PACKAGE_SOURCE_DIR, relative);
  return fs.existsSync(candidate) ? repoRelative(candidate) : null;
}

function classify(scriptPath, tracked) {
  if (scriptPath === 'scripts/bmads-auto-cli.ts') {
    return {
      disposition: 'deprecated_public_cli_de_surface',
      deletionRequired: true,
      deletionAllowedAfterGates: true,
      packageSourceEquivalent: null,
      notes: ['Untracked deprecated compatibility CLI; delete during G010.'],
    };
  }

  const packageSourceEquivalent = sourceEquivalentFor(scriptPath);
  if (packageSourceEquivalent) {
    return {
      disposition: tracked ? 'tracked_package_source_equivalent' : 'untracked_package_source_equivalent',
      deletionRequired: true,
      deletionAllowedAfterGates: true,
      packageSourceEquivalent,
      notes: ['Package source equivalent exists; active callers must switch before deletion.'],
    };
  }

  return {
    disposition: tracked ? 'tracked_requires_disposition' : 'untracked_requires_disposition',
    deletionRequired: true,
    deletionAllowedAfterGates: false,
    packageSourceEquivalent: null,
    notes: ['No package source equivalent detected by path; G008/G009 must record disposition before deletion.'],
  };
}

function buildCoverageMap() {
  return {
    schemaVersion: 'root-ts-hard-cut-coverage-map/v1',
    contractPath: CONTRACT_PATH,
    sourcePlanHash: 'sha256:315858757a5ac41926710b2382908f64e64adec86dcfc90807bd861d31ceff45',
    generatedAt: new Date().toISOString(),
    obligations: [
      ['SRC-001', ['G001', 'G010', 'G012'], ['ACC001', 'ACC002', 'ACC018'], ['CMD001', 'CMD003', 'CMD010', 'CMD019']],
      ['SRC-002', ['G002', 'G011'], ['ACC003', 'ACC004', 'ACC014'], ['CMD004', 'CMD011', 'CMD019']],
      ['SRC-003', ['G003', 'G011', 'G012'], ['ACC005', 'ACC006'], ['CMD004', 'CMD005', 'CMD019']],
      ['SRC-004', ['G005', 'G011', 'G012'], ['ACC009', 'ACC010', 'ACC020'], ['CMD007', 'CMD014', 'CMD019']],
      ['SRC-005', ['G004', 'G012'], ['ACC007', 'ACC008', 'ACC020'], ['CMD006', 'CMD018', 'CMD019']],
      ['SRC-006', ['G006', 'G009', 'G012'], ['ACC011', 'ACC012', 'ACC013'], ['CMD008', 'CMD012', 'CMD013', 'CMD019']],
      ['SRC-007', ['G007', 'G010', 'G012'], ['ACC015', 'ACC016', 'ACC018'], ['CMD003', 'CMD009', 'CMD019']],
      ['SRC-008', ['G008', 'G009', 'G012'], ['ACC017', 'ACC021'], ['CMD010', 'CMD019']],
      ['SRC-009', ['G001', 'G008', 'G012'], ['ACC002', 'ACC017'], ['CMD001', 'CMD010', 'CMD019']],
      ['SRC-010', ['G002', 'G003', 'G004', 'G005', 'G006', 'G007', 'G008', 'G009', 'G010'], ['ACC003', 'ACC005', 'ACC007', 'ACC009', 'ACC011', 'ACC015', 'ACC017'], ['CMD003', 'CMD004', 'CMD005', 'CMD006', 'CMD007', 'CMD008', 'CMD009', 'CMD010', 'CMD019']],
      ['SRC-011', ['G006', 'G009', 'G012'], ['ACC012', 'ACC013', 'ACC021', 'ACC022'], ['CMD010', 'CMD012', 'CMD013', 'CMD019']],
      ['SRC-012', ['G010', 'G011', 'G012'], ['ACC018', 'ACC019', 'ACC023'], ['CMD003', 'CMD004', 'CMD005', 'CMD006', 'CMD007', 'CMD008', 'CMD009', 'CMD010', 'CMD011', 'CMD014', 'CMD015', 'CMD016', 'CMD019']],
      ['SRC-013', ['G012'], ['ACC024'], ['CMD017', 'CMD020']],
    ].map(([sourceId, taskIds, acceptanceIds, commandIds]) => ({
      sourceId,
      taskIds,
      acceptanceIds,
      commandIds,
    })),
  };
}

function buildManifest() {
  const filesystemPaths = walkFiles(ROOT_SCRIPTS_DIR, (absolute) => absolute.endsWith('.ts'))
    .map(repoRelative)
    .sort();
  const trackedSet = new Set(gitLines(['ls-files', 'scripts/**/*.ts']));
  const rows = filesystemPaths.map((scriptPath) => {
    const absolutePath = path.join(REPO_ROOT, scriptPath);
    const tracked = trackedSet.has(scriptPath);
    const classification = classify(scriptPath, tracked);
    return {
      scriptPath,
      tracked,
      existsAtInventory: true,
      sha256: sha256File(absolutePath),
      sizeBytes: fs.statSync(absolutePath).size,
      ...classification,
    };
  });

  return {
    schemaVersion: 'root-ts-hard-cut-deletion-manifest/v1',
    generatedAt: new Date().toISOString(),
    contractPath: CONTRACT_PATH,
    initialFilesystemCount: filesystemPaths.length,
    initialTrackedCount: [...trackedSet].length,
    expectedOriginalFilesystemCount: 197,
    expectedOriginalTrackedCount: 196,
    currentInventoryDiffersFromOriginalAudit: [...trackedSet].length !== 196 || filesystemPaths.length !== 197,
    untrackedDeprecatedPath: filesystemPaths.includes('scripts/bmads-auto-cli.ts')
      ? 'scripts/bmads-auto-cli.ts'
      : null,
    trackedPathsMissingFromFilesystem: [...trackedSet].filter((scriptPath) => !filesystemPaths.includes(scriptPath)),
    rows,
  };
}

function writeJson(filePath, value) {
  const absolute = path.join(REPO_ROOT, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = buildManifest();
  if (args.out) {
    writeJson(args.out, manifest);
    writeJson(COVERAGE_OUT, buildCoverageMap());
  }
  const output = {
    status: 'pass',
    initialFilesystemCount: manifest.initialFilesystemCount,
    initialTrackedCount: manifest.initialTrackedCount,
    rows: manifest.rows.length,
    manifestPath: args.out || null,
    coverageMapPath: args.out ? COVERAGE_OUT : null,
    currentInventoryDiffersFromOriginalAudit: manifest.currentInventoryDiffersFromOriginalAudit,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
