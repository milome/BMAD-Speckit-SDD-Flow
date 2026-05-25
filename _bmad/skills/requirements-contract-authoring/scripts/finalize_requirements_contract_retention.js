#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { normalizePathForReport } = require('./pre_render_definition_drilldown_lib');

const CONFIRMED_STRATEGIES = new Set([
  'confirmed-local-only',
  'confirmed-local-file-only',
  'remove-from-index-keep-local',
]);

function usage(exitCode = 0) {
  console.log(`Usage:
  node finalize_requirements_contract_retention.js --source <source-document.md> --strategy confirmed-local-only --mode dry-run|apply [--receipt <receipt.json>] [--json]

Removes a confirmed source document from Git index only, preserving the local file.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    source: '',
    strategy: '',
    mode: 'dry-run',
    receipt: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--source' || arg === '--strategy' || arg === '--mode' || arg === '--receipt') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return { error: `missing value for ${arg}` };
      args[arg.slice(2)] = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) return { error: `unknown option ${arg}` };
    if (args.source) return { error: `unexpected positional argument ${arg}` };
    args.source = arg;
  }
  if (!args.source) return { error: 'missing source document path' };
  if (!args.strategy) return { error: 'missing confirmed retention strategy' };
  if (!CONFIRMED_STRATEGIES.has(args.strategy)) return { error: `unsupported or unconfirmed retention strategy ${args.strategy}` };
  if (!['dry-run', 'apply'].includes(args.mode)) return { error: `unsupported mode ${args.mode}` };
  return args;
}

function git(args, options = {}) {
  return spawnSync('git', args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf8',
  });
}

function repoRoot() {
  const result = git(['rev-parse', '--show-toplevel']);
  if (result.status !== 0) throw new Error(result.stderr || 'git rev-parse failed');
  return result.stdout.trim();
}

function repoRelativePath(filePath) {
  return path.relative(repoRoot(), path.resolve(filePath)).replace(/\\/g, '/');
}

function sha256File(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function defaultReceiptPath(sourcePath) {
  const safeName = path.basename(sourcePath).replace(/[^A-Za-z0-9_.-]+/g, '-');
  return path.join(
    process.cwd(),
    '_bmad-output',
    'runtime',
    'requirement-records',
    'retention-cleanup',
    `${safeName}.receipt.json`
  );
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildReceipt({ sourcePath, strategy, mode, status, command, sourceExistsBefore, sourceExistsAfter, sourceHashBefore, sourceHashAfter, gitResult = null, issue = null }) {
  return {
    schemaVersion: 'requirements-contract-retention-cleanup-receipt/v1',
    status,
    mode,
    strategy,
    source: normalizePathForReport(sourcePath),
    command,
    localFilePreserved: sourceExistsBefore && sourceExistsAfter && sourceHashBefore === sourceHashAfter,
    sourceExistsBefore,
    sourceExistsAfter,
    sourceHashBefore,
    sourceHashAfter,
    git: gitResult
      ? {
          status: gitResult.status,
          stdout: gitResult.stdout,
          stderr: gitResult.stderr,
        }
      : null,
    issue,
    generatedAt: new Date().toISOString(),
  };
}

function runCleanup({ source, strategy, mode, receipt }) {
  const sourcePath = path.resolve(source);
  const sourceExistsBefore = fs.existsSync(sourcePath);
  if (!sourceExistsBefore) {
    return buildReceipt({
      sourcePath,
      strategy,
      mode,
      status: 'FAIL',
      command: null,
      sourceExistsBefore,
      sourceExistsAfter: false,
      sourceHashBefore: null,
      sourceHashAfter: null,
      issue: 'source document file not found',
    });
  }

  const rel = repoRelativePath(sourcePath);
  const command = ['git', 'rm', '--cached', '--', rel];
  const sourceHashBefore = sha256File(sourcePath);
  let gitResult = null;
  if (mode === 'apply') {
    gitResult = git(['rm', '--cached', '--', rel]);
  }
  const sourceExistsAfter = fs.existsSync(sourcePath);
  const sourceHashAfter = sourceExistsAfter ? sha256File(sourcePath) : null;
  const failed =
    (mode === 'apply' && gitResult.status !== 0) ||
    !sourceExistsAfter ||
    sourceHashBefore !== sourceHashAfter;
  const receiptValue = buildReceipt({
    sourcePath,
    strategy,
    mode,
    status: failed ? 'FAIL' : 'PASS',
    command,
    sourceExistsBefore,
    sourceExistsAfter,
    sourceHashBefore,
    sourceHashAfter,
    gitResult,
    issue: failed ? 'retention cleanup failed or local file was not preserved' : null,
  });
  const receiptPath = path.resolve(receipt || defaultReceiptPath(sourcePath));
  writeJsonFile(receiptPath, receiptValue);
  return { ...receiptValue, receiptPath: normalizePathForReport(receiptPath) };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.error) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: args.error }, null, 2));
    return 2;
  }
  try {
    const receipt = runCleanup(args);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    return receipt.status === 'PASS' ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ verdict: 'FAIL', message: error instanceof Error ? error.message : String(error) }, null, 2));
    return 1;
  }
}

module.exports = { parseArgs, runCleanup };

if (require.main === module) process.exit(main(process.argv.slice(2)));
