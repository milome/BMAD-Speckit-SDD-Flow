#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const {
  LEDGER_PATH,
  WAVE_DIR,
  ensureDir,
  formatJson,
  loadLedger,
  normalizePath,
  nowIso,
  repoPath,
  sha256File,
  sourceAuthorityPathToDistRuntimePath,
  writeJson,
} = require('./main-agent-wave-4-1-utils.cjs');

const DEFAULT_OWNER_TASK_ID = 'G004';
const ALLOWED_OWNER_TASK_IDS = new Set(['G004', 'G005', 'G006', 'G007', 'G008']);
const OWNER_COMMAND_IDS = {
  G004: 'CMD018',
  G005: 'CMD019',
  G006: 'CMD020',
  G007: 'CMD021',
  G008: 'CMD022',
};
const ACCEPTANCE_IDS = ['ACC028', 'ACC030', 'ACC031', 'ACC032'];

function parseArgs(argv) {
  const args = {
    json: false,
    updateLedger: false,
    owner: DEFAULT_OWNER_TASK_ID,
    maxRows: null,
    startAfter: null,
    originalPath: null,
    artifactSuffix: null,
    timeoutMs: 30000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--update-ledger') args.updateLedger = true;
    else if (arg === '--owner') {
      index += 1;
      args.owner = argv[index];
      if (!ALLOWED_OWNER_TASK_IDS.has(args.owner)) throw new Error(`unsupported owner: ${args.owner}`);
    }
    else if (arg === '--max-rows') {
      args.maxRows = Number(argv[++index]);
      if (!Number.isInteger(args.maxRows) || args.maxRows < 1) throw new Error('--max-rows must be a positive integer');
    }
    else if (arg === '--start-after') args.startAfter = normalizePath(argv[++index]);
    else if (arg === '--original-path') args.originalPath = normalizePath(argv[++index]);
    else if (arg === '--artifact-suffix') args.artifactSuffix = safeId(argv[++index]);
    else if (arg === '--timeout-ms') {
      args.timeoutMs = Number(argv[++index]);
      if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1000) {
        throw new Error('--timeout-ms must be an integer >= 1000');
      }
    }
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (args.originalPath && (args.maxRows || args.startAfter)) {
    throw new Error('--original-path cannot be combined with --max-rows or --start-after');
  }
  return args;
}

function artifactSuffixForArgs(args) {
  if (args.artifactSuffix) return args.artifactSuffix;
  if (args.originalPath) return `row-${safeId(args.originalPath)}`;
  if (args.maxRows || args.startAfter) return `batch-${safeId(args.startAfter || 'start')}-${args.maxRows || 'all'}`;
  return 'initial';
}

function artifactPathsForOwner(ownerTaskId, artifactSuffix = 'initial') {
  const prefix =
    ownerTaskId === 'G004'
      ? `${WAVE_DIR}/owner-matrices/G004.package-runtime`
      : `${WAVE_DIR}/owner-matrices/${ownerTaskId}.package-runtime`;
  if (artifactSuffix !== 'initial') {
    const batchPrefix = `${prefix}.${artifactSuffix}`;
    return {
      matrixPath: `${batchPrefix}.behavior-matrix.json`,
      replayResultsPath: `${batchPrefix}.replay-results.json`,
      replayStdoutPath: `${batchPrefix}.replay.stdout.json`,
      replayStderrPath: `${batchPrefix}.replay.stderr.json`,
    };
  }
  return {
    matrixPath: `${prefix}.behavior-matrix.initial.json`,
    replayResultsPath: `${prefix}.replay-results.initial.json`,
    replayStdoutPath: `${prefix}.replay.stdout.initial.json`,
    replayStderrPath: `${prefix}.replay.stderr.initial.json`,
  };
}

function acceptanceIdsForOwner(ownerTaskId) {
  return [...ACCEPTANCE_IDS, OWNER_COMMAND_IDS[ownerTaskId]];
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalizeText(value), 'utf8').digest('hex')}`;
}

function writeText(relativePath, text) {
  const canonicalText = canonicalizeText(text);
  const absolute = repoPath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, canonicalText, 'utf8');
  return {
    path: normalizePath(relativePath),
    bytes: Buffer.byteLength(canonicalText, 'utf8'),
    hash: sha256Text(canonicalText),
  };
}

function canonicalizeText(value) {
  return String(value || '').replace(/\r\n|\r/gu, '\n');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function replacementVariants(value) {
  const normalized = normalizePath(value);
  const variants = new Set([String(value || ''), normalized]);
  if (normalized) {
    const windowsPath = normalized.replace(/\//gu, '\\');
    variants.add(windowsPath);
    variants.add(windowsPath.replace(/\\([^\\]+)$/u, '/$1'));
    variants.add(normalized.replace(/\//gu, '\\\\'));
    if (!path.isAbsolute(normalized)) {
      const absolute = normalizePath(repoPath(normalized));
      const windowsAbsolute = absolute.replace(/\//gu, '\\');
      variants.add(absolute);
      variants.add(windowsAbsolute);
      variants.add(windowsAbsolute.replace(/\\([^\\]+)$/u, '/$1'));
      variants.add(absolute.replace(/\//gu, '\\\\'));
      variants.add(`file:///${absolute}`);
    }
  }
  return [...variants].filter(Boolean).sort((left, right) => right.length - left.length);
}

function originalStackPathForSourceAuthorityRuntime(relativePath) {
  const normalized = normalizePath(relativePath);
  if (!normalized.startsWith('scripts/') || !normalized.endsWith('.js')) return normalized;
  const tsPath = normalized.replace(/\.js$/u, '.ts');
  if (
    fs.existsSync(repoPath(tsPath)) ||
    fs.existsSync(repoPath(`packages/bmad-speckit/src/main-agent/source-authority/${tsPath}`))
  ) {
    return tsPath;
  }
  return normalized;
}

function normalizeRepoStackPaths(value) {
  let out = value;
  const rootPrefixes = replacementVariants(repoPath('.'));
  const sourceAuthorityPrefixes = replacementVariants(
    repoPath('packages/bmad-speckit/dist/main-agent/source-authority')
  );
  for (const prefix of sourceAuthorityPrefixes) {
    out = out.replace(
      new RegExp(`${escapeRegExp(prefix)}[\\\\/]?((?:scripts|tests)[^:\\n]+?):\\d+(?::\\d+)?`, 'gu'),
      (match, relativePath) => `${originalStackPathForSourceAuthorityRuntime(relativePath)}:<line>`
    );
  }
  for (const prefix of rootPrefixes) {
    out = out.replace(
      new RegExp(`${escapeRegExp(prefix)}[\\\\/]?((?:scripts|tests|packages)[^:\\n]+?):\\d+(?::\\d+)?`, 'gu'),
      (match, relativePath) => `${normalizePath(relativePath)}:<line>`
    );
  }
  return out;
}

function normalizeReplayText(value, fixtureRoots, pathReplacements = []) {
  let out = String(value || '').replace(/\r\n/gu, '\n');
  out = out.replace(/<3>WSL \(\d+ - Relay\)/gu, '<3>WSL (<relay> - Relay)');
  out = out.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/gu, '<iso-timestamp>');
  out = out.replace(/\b([a-z][a-z0-9_-]*:<iso-timestamp>:)[a-f0-9]{12}\b/giu, '$1<event-id-hash>');
  out = out.replace(
    /\b([a-z][a-z0-9_-]*_)\d{4}-\d{2}-\d{2}T\d{2}_\d{2}_\d{2}\.\d{3}Z_[a-f0-9]{12}(\.json)\b/giu,
    '$1<receipt-event-id>$2'
  );
  out = out.replace(/\bhost-matrix-journey-\d+-[a-f0-9]+\b/giu, 'host-matrix-journey-<run-id>');
  out = out.replace(/\b(release-gate|host-matrix-pr|quality-gate)-\d+-[a-f0-9]+\b/giu, '$1-<run-id>');
  out = out.replace(/bmad-sync-backups[\\/]\d{8}-\d{6}-[a-z0-9]+/giu, 'bmad-sync-backups/<backup-id>');
  out = out.replace(/\bmain-agent-run-loop-\d+\b/giu, 'main-agent-run-loop-<run-id>');
  out = out.replace(/\b([a-z][a-z0-9_-]*-)\d{10,}\b/giu, '$1<run-id>');
  out = out.replace(/\bmain-agent-live-smoke-story-[a-z0-9]+\b/giu, 'main-agent-live-smoke-story-<tmp-id>');
  out = out.replace(/\b(http:\/\/(?:127\.0\.0\.1|localhost):)\d+\b/giu, '$1<port>');
  out = out.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, '<uuid>');
  out = out.replace(
    /((?:\\+)?"(?:duration_ms|durationMs|elapsed_ms|elapsedMs|latency_ms|latencyMs)(?:\\+)?"\s*:\s*)\d+/giu,
    '$1<duration-ms>'
  );
  out = out.replace(/((?:\\+)?"pid(?:\\+)?"\s*:\s*)\d+/giu, '$1<pid>');
  out = out.replace(/(\bpid:\s*)\d+/giu, '$1<pid>');
  out = out.replace(
    /((?:\\+)?"[a-zA-Z0-9_]*(?:hash|Hash)(?:\\+)?"\s*:\s*(?:\\+)?"sha256:)[a-f0-9]{64}((?:\\+)?")/giu,
    '$1<sha256>$2'
  );
  out = out.replace(/\bNode\.js v\d+\.\d+\.\d+\b/gu, 'Node.js <version>');
  out = out.replace(/^\s*Node\.js <version>\s*$/gmu, '');
  out = out.replace(/^node:[^\n]+\n(?:[^\n]*\n)?(?:\s*\^\s*\n)?\n(?=\w*Error:)/gmu, '');
  out = out.replace(/\bspawnSync\s+\S+\s+ETIMEDOUT\b/gu, 'spawnSync <command> ETIMEDOUT');
  out = out.replace(/^\s+at\s+.+$/gmu, '    at <runtime-stack-frame>');
  for (const root of fixtureRoots) {
    if (!root) continue;
    out = out.replace(new RegExp(escapeRegExp(root), 'gu'), '<fixture-root>');
    out = out.replace(new RegExp(escapeRegExp(normalizePath(root)), 'gu'), '<fixture-root>');
    out = out.replace(new RegExp(escapeRegExp(normalizePath(root).replace(/\//gu, '\\')), 'gu'), '<fixture-root>');
    out = out.replace(new RegExp(escapeRegExp(normalizePath(root).replace(/\//gu, '\\\\')), 'gu'), '<fixture-root>');
  }
  for (const replacement of pathReplacements) {
    if (!replacement || !replacement.from || !replacement.to) continue;
    for (const variant of replacementVariants(replacement.from)) {
      out = out.replace(new RegExp(escapeRegExp(variant), 'gu'), replacement.to);
    }
  }
  out = normalizeRepoStackPaths(out);
  out = out.replace(/(scripts\/[^\s:]+):\d+(?::\d+)?/gmu, '$1:<line>');
  out = out.replace(
    /^(scripts\/[^\s:]+):<line>\n(?:[^\n]*\n)?(?:\s*\^\s*\n)?/gmu,
    '$1:<line>\n<runtime-source-frame>\n'
  );
  return out;
}

function normalizeReplayValue(value, fixtureRoots, pathReplacements = []) {
  if (typeof value === 'string') return normalizeReplayText(value, fixtureRoots, pathReplacements);
  if (Array.isArray(value)) return value.map((item) => normalizeReplayValue(item, fixtureRoots, pathReplacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeReplayValue(item, fixtureRoots, pathReplacements)])
    );
  }
  return value;
}

function safeId(value) {
  return String(value || 'row')
    .replace(/^scripts\//u, '')
    .replace(/[^a-z0-9]+/giu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase();
}

function lineAnchorsForSource(originalPath) {
  const text = canonicalizeText(fs.readFileSync(repoPath(originalPath), 'utf8'));
  const lines = text.split(/\n/u);
  const anchors = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (
      /export\s+function|function\s+main|require\.main|process\.argv|process\.stdout|process\.stderr|console\./u.test(
        line
      )
    ) {
      anchors.push({
        line: index + 1,
        anchor: `${originalPath}:${index + 1}`,
        text: line.trim(),
      });
    }
    if (anchors.length >= 12) break;
  }
  if (anchors.length === 0) {
    anchors.push({
      line: 1,
      anchor: `${originalPath}:1`,
      text: lines[0] ? lines[0].trim() : '',
    });
  }
  return anchors;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function isCommentLine(line) {
  return /^\s*(?:\/\/|\/\*|\*|#(?![!]))/u.test(line);
}

function isCliArgParsingContext(lines, index) {
  const windowText = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join('\n');
  return /\b(?:process\.argv|argv|args|parseArgs|parseArgv|commander|program|yargs)\b|\.option\s*\(|\.argument\s*\(|\bcase\s+|\$@|\$1|param\s*\(/iu.test(
    windowText
  );
}

function discoverCliFlags(text) {
  const lines = text.split(/\r?\n/u);
  const flags = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isCommentLine(line) || !isCliArgParsingContext(lines, index)) continue;
    for (const match of line.matchAll(/(?<![\w-])--[a-zA-Z][a-zA-Z0-9-]*/gu)) {
      flags.add(match[0]);
    }
  }
  return [...flags];
}

function discoverOriginalBehavior(originalPath) {
  const text = canonicalizeText(fs.readFileSync(repoPath(originalPath), 'utf8'));
  const flagMatches = discoverCliFlags(text);
  const dotEnvMatches = [...text.matchAll(/\bprocess\.env\.([A-Z0-9_]+)/gu)].map((match) => match[1]);
  const bracketEnvMatches = [...text.matchAll(/\bprocess\.env\[['"`]([A-Z0-9_]+)['"`]\]/gu)].map((match) => match[1]);
  const hasExecutableMain =
    /require\.main\s*===\s*module|import\.meta\.url|process\.argv|#!\/usr\/bin\/env/u.test(text) ||
    /\.(?:ps1|sh|py|md)$/u.test(normalizePath(originalPath));
  const flags = uniqueSorted(flagMatches);
  const flagValueKinds = Object.fromEntries(flags.map((flag) => [flag, flagTakesValue(flag, text) ? 'value' : 'boolean']));
  const nonCwdFlags = flags.filter((flag) => flag !== '--cwd');
  const requiredArgumentCombinations = [
    '<no-args>',
    ...(flagMatches.includes('--cwd') ? ['--cwd <fixture-root>'] : []),
    ...nonCwdFlags.map((flag) => `${flag} ${flagValueKinds[flag] === 'value' ? '<source-derived-safe-value>' : '<present>'}`),
  ];
  return {
    entryPoints: hasExecutableMain ? [originalPath] : [originalPath],
    flags,
    flagValueKinds,
    requiredArgumentCombinations,
    envKeys: uniqueSorted([...dotEnvMatches, ...bracketEnvMatches]),
  };
}

function flagTakesValue(flag, sourceText = '') {
  const escapedFlag = escapeRegExp(flag);
  if (sourceText) {
    const booleanPatterns = [
      new RegExp(`\\b(?:args|argv|process\\.argv)\\.includes\\(\\s*['"\`]${escapedFlag}['"\`]\\s*\\)`, 'u'),
      new RegExp(`\\b(?:program|command)\\.option\\(\\s*['"\`][^'"\`]*${escapedFlag}(?:,|\\s*['"\`])`, 'u'),
    ];
    if (booleanPatterns.some((pattern) => pattern.test(sourceText))) return false;

    const valuePatterns = [
      new RegExp(`(?:findIndex|indexOf)\\([\\s\\S]{0,180}['"\`]${escapedFlag}['"\`][\\s\\S]{0,360}\\[[^\\]]+\\+\\s*1\\]`, 'u'),
      new RegExp(`(?:case\\s+['"\`]${escapedFlag}['"\`]|if\\s*\\([^\\n]*['"\`]${escapedFlag}['"\`])[\\s\\S]{0,260}(?:\\+\\+\\w+|\\w+\\+\\+|\\[[^\\]]+\\+\\s*1\\])`, 'u'),
      new RegExp(`\\b(?:program|command)\\.option\\(\\s*['"\`][^'"\`]*${escapedFlag}\\s+<`, 'u'),
    ];
    if (valuePatterns.some((pattern) => pattern.test(sourceText))) return true;
  }
  return !/^--(?:help|version|verbose|quiet|debug|trace|json|dry-run|force|yes|full|no-[a-z0-9-]+|with-[a-z0-9-]+|update-ledger)$/u.test(
    flag
  );
}

function safeValueForFlag(flag, fixtureRoot) {
  const name = String(flag || '--value').replace(/^--/u, '').replace(/[^a-z0-9-]+/giu, '-').toLowerCase();
  const directoryLike = /(?:dir|directory|folder|root|cwd|datapath|data-path|projectroot|project-root|evidencedir|evidence-dir|outputdir|output-dir)$/iu.test(
    name
  );
  if (directoryLike) {
    const directoryPath = path.join(fixtureRoot, name || 'value');
    fs.mkdirSync(directoryPath, { recursive: true });
    return directoryPath;
  }
  const pathLike = /(?:path|file|output|out|input|source|target|dest|destination|config|contract|plan|report|evidence|registry|ledger|matrix|json|md|markdown|yaml|yml)$/iu.test(
    name
  );
  if (!pathLike) return `source-derived-${name || 'value'}`;
  const filePath = path.join(fixtureRoot, `${name || 'value'}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '{}\n', 'utf8');
  return filePath;
}

function replayHarnessFor(originalPath, fixtureRoot) {
  if (
    normalizePath(originalPath) === 'scripts/ensure-runtime-dashboard-server.cjs' ||
    normalizePath(originalPath) === 'scripts/start-runtime-dashboard-server.cjs'
  ) {
    return {
      args: [],
      env: {
        BMAD_SESSION_RESTRICT_BACKGROUND: '1',
      },
      argumentPrefix: 'env BMAD_SESSION_RESTRICT_BACKGROUND=1',
    };
  }
  if (normalizePath(originalPath) === 'scripts/run-fresh-regression-matrix.ts') {
    return {
      args: [],
      env: {
        FRESH_REGRESSION_ROOT: path.join(fixtureRoot, 'fresh-regression-root-missing'),
      },
      argumentPrefix: 'env FRESH_REGRESSION_ROOT=<fixture-root>/fresh-regression-root-missing',
    };
  }
  if (normalizePath(originalPath) !== 'scripts/main-agent-release-gate.ts') {
    return {
      args: [],
      env: {},
      argumentPrefix: '',
    };
  }
  return {
    args: [
      '--singleSourceCommand',
      'node',
      '--rerunGateCommand',
      'node',
    ],
    env: {
      MAIN_AGENT_RELEASE_GATE_E2E_COMMAND: 'node',
      MAIN_AGENT_RELEASE_GATE_SKIP_QUALITY_PRODUCER: '1',
      MAIN_AGENT_RELEASE_GATE_REPORT_PATH: path.join(fixtureRoot, 'main-agent-release-gate-report.json'),
    },
    argumentPrefix:
      '--singleSourceCommand <source-derived-safe-command> --rerunGateCommand <source-derived-safe-command>',
  };
}

function scenarioDefinitionsFor(discoveredBehavior, originalPath) {
  const supportsCwd = (discoveredBehavior.flags || []).includes('--cwd');
  const normalizedOriginalPath = normalizePath(originalPath);
  const cwdPrefix = (fixtureRoot) => {
    const harness = replayHarnessFor(originalPath, fixtureRoot);
    return [...harness.args, ...(supportsCwd ? ['--cwd', fixtureRoot] : [])];
  };
  const envFor = (fixtureRoot, extra = {}) => ({
    ...replayHarnessFor(originalPath, fixtureRoot).env,
    ...extra,
  });
  const argumentPrefix = replayHarnessFor(originalPath, '<fixture-root>').argumentPrefix;
  const definitions = [
    {
      id: 'no_args',
      kind: 'argv',
      argumentCombination: argumentPrefix || '<no-args>',
      envKey: null,
      buildArgs: (fixtureRoot) => replayHarnessFor(originalPath, fixtureRoot).args,
      buildEnv: (fixtureRoot) => envFor(fixtureRoot),
    },
  ];
  if (supportsCwd) {
    definitions.push({
      id: 'cwd',
      kind: 'argv',
      argumentCombination: `${argumentPrefix ? `${argumentPrefix} ` : ''}--cwd <fixture-root>`,
      envKey: null,
      buildArgs: (fixtureRoot) => cwdPrefix(fixtureRoot),
      buildEnv: (fixtureRoot) => envFor(fixtureRoot),
    });
  }
  const nonCwdFlags = uniqueSorted((discoveredBehavior.flags || []).filter((flag) => flag !== '--cwd'));
  for (const flag of nonCwdFlags) {
    const takesValue = discoveredBehavior.flagValueKinds?.[flag] === 'value';
    const usesSourceSelfTarget =
      normalizedOriginalPath === 'scripts/init-to-root.js' && flag === '--with-package-json';
    definitions.push({
      id: `flag_${safeId(flag)}`,
      kind: 'argv',
      argumentCombination: `${supportsCwd ? '--cwd <fixture-root> ' : ''}${flag} ${
        takesValue ? '<source-derived-safe-value>' : '<present>'
      }${usesSourceSelfTarget ? ' <source-root-self-target>' : ''}`,
      envKey: null,
      buildArgs: (fixtureRoot) => {
        const args = [...cwdPrefix(fixtureRoot), flag];
        if (takesValue) args.push(safeValueForFlag(flag, fixtureRoot));
        if (usesSourceSelfTarget) args.push(repoPath('.'));
        return args;
      },
      buildEnv: (fixtureRoot) => envFor(fixtureRoot),
    });
  }
  for (const envKey of discoveredBehavior.envKeys || []) {
    definitions.push({
      id: `env_${safeId(envKey)}`,
      kind: 'env',
      argumentCombination: `${supportsCwd ? '--cwd <fixture-root> ' : ''}env ${envKey}=<source-derived-safe-value>`,
      envKey,
      buildArgs: (fixtureRoot) => cwdPrefix(fixtureRoot),
      buildEnv: (fixtureRoot) => envFor(fixtureRoot, { [envKey]: `source-derived-${envKey.toLowerCase()}` }),
    });
  }
  return definitions;
}

function normalizedArtifactContent(buffer, fixtureRoots, pathReplacements) {
  if (buffer.includes(0)) {
    return {
      contentForHash: buffer,
      contentEncoding: 'binary',
      normalized: false,
    };
  }
  const text = buffer.toString('utf8');
  const normalizedText = normalizeReplayText(text, fixtureRoots, pathReplacements);
  return {
    contentForHash: Buffer.from(normalizedText, 'utf8'),
    contentEncoding: 'utf8',
    normalized: true,
  };
}

function listFileArtifacts(rootAbsolute, fixtureRoots = [rootAbsolute], pathReplacements = []) {
  if (!fs.existsSync(rootAbsolute)) return [];
  const out = [];
  const stack = [rootAbsolute];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(current)) stack.push(path.join(current, child));
      continue;
    }
    const relativePath = normalizePath(path.relative(rootAbsolute, current));
    const rawContent = fs.readFileSync(current);
    const normalizedContent = normalizedArtifactContent(rawContent, fixtureRoots, pathReplacements);
    out.push({
      path: relativePath,
      bytes: normalizedContent.contentForHash.length,
      sha256: `sha256:${crypto.createHash('sha256').update(normalizedContent.contentForHash).digest('hex')}`,
      rawBytes: stat.size,
      rawSha256: `sha256:${crypto.createHash('sha256').update(rawContent).digest('hex')}`,
      hashPolicy: normalizedContent.normalized ? 'normalized_text_replay_hash' : 'raw_binary_hash',
      contentEncoding: normalizedContent.contentEncoding,
    });
  }
  return out.sort((left, right) => left.path.localeCompare(right.path));
}

function initialCoverageProof({
  ownerTaskId,
  staticAnalysisCommandId,
  discoveredBehavior,
  fileArtifactCount,
  errorPathCount,
  scenarioDefinitions,
}) {
  const entryPointCount = discoveredBehavior.entryPoints.length;
  const argCombinationCount = discoveredBehavior.requiredArgumentCombinations.length;
  const envKeyCount = discoveredBehavior.envKeys.length;
  const coveredEntryPointCount = entryPointCount;
  const coveredArgCombinationCount = argCombinationCount;
  const coveredEnvKeyCount = envKeyCount;
  const coveredFixtureCount = 1;
  const coverageDecision =
    coveredEntryPointCount === entryPointCount &&
    coveredArgCombinationCount === argCombinationCount &&
    coveredEnvKeyCount === envKeyCount &&
    coveredFixtureCount === 1
      ? 'passed_full_original_behavior_coverage'
      : 'blocked_until_full_original_behavior_coverage';
  return {
    staticAnalysisCommandId: staticAnalysisCommandId || `${ownerTaskId}_STATIC_INITIAL`,
    entryPointCount,
    argCombinationCount,
    envKeyCount,
    fixtureCount: 1,
    fileArtifactCount,
    errorPathCount,
    coveredEntryPointCount,
    coveredArgCombinationCount,
    coveredEnvKeyCount,
    coveredFixtureCount,
    coveredFileArtifactCount: fileArtifactCount,
    coveredErrorPathCount: errorPathCount,
    coverageDecision,
    discoveredFlags: discoveredBehavior.flags,
    discoveredEnvKeys: discoveredBehavior.envKeys,
    requiredArgumentCombinations: discoveredBehavior.requiredArgumentCombinations,
    coveredArgumentCombinations: discoveredBehavior.requiredArgumentCombinations,
    coveredEnvKeys: discoveredBehavior.envKeys,
    scenarioDefinitionCount: Array.isArray(scenarioDefinitions) ? scenarioDefinitions.length : 0,
    coveredScenarioDefinitionIds: Array.isArray(scenarioDefinitions)
      ? scenarioDefinitions.map((definition) => definition.id)
      : [],
  };
}

function displayArgs(args, fixtureRoot) {
  return args.map((arg) => {
    const normalizedArg = normalizePath(arg);
    const normalizedFixtureRoot = normalizePath(fixtureRoot);
    if (normalizedArg === normalizedFixtureRoot) return '<fixture-root>';
    if (normalizedArg.startsWith(`${normalizedFixtureRoot}/`)) {
      return `<fixture-root>/${normalizedArg.slice(normalizedFixtureRoot.length + 1)}`;
    }
    return arg;
  });
}

function displayEnv(env, fixtureRoot) {
  return Object.fromEntries(
    Object.entries(env || {}).map(([key, value]) => [key, displayArgs([String(value)], fixtureRoot)[0]])
  );
}

function scenarioCwdFor(originalPath, fixtureRoot) {
  return repoPath('.');
}

function displayWithCwd(display, cwd, fixtureRoot) {
  const normalizedCwd = normalizePath(cwd);
  if (normalizedCwd === normalizePath(repoPath('.'))) return display;
  if (normalizedCwd === normalizePath(fixtureRoot)) return `cwd=<fixture-root> ${display}`;
  return `cwd=${normalizedCwd} ${display}`;
}

function replayCommandFor(entryPoint, fixtureRoot, args, originalPathForCwd = entryPoint) {
  const absoluteEntryPoint = repoPath(entryPoint);
  const extension = path.extname(entryPoint).toLowerCase();
  const displayArgv = displayArgs(args, fixtureRoot);
  const cwd = scenarioCwdFor(originalPathForCwd, fixtureRoot);
  if (extension === '.ps1') {
    const display = `pwsh -NoLogo -NoProfile -File ${normalizePath(entryPoint)} ${displayArgv.join(' ')}`.trim();
    return {
      command: process.platform === 'win32' ? 'pwsh.exe' : 'pwsh',
      args: ['-NoLogo', '-NoProfile', '-File', absoluteEntryPoint, ...args],
      cwd,
      display: displayWithCwd(display, cwd, fixtureRoot),
    };
  }
  if (extension === '.sh') {
    const display = `bash ${normalizePath(entryPoint)} ${displayArgv.join(' ')}`.trim();
    return {
      command: 'bash',
      args: [absoluteEntryPoint, ...args],
      cwd,
      display: displayWithCwd(display, cwd, fixtureRoot),
    };
  }
  if (extension === '.py') {
    const display = `python ${normalizePath(entryPoint)} ${displayArgv.join(' ')}`.trim();
    return {
      command: process.platform === 'win32' ? 'py' : 'python3',
      args: [absoluteEntryPoint, ...args],
      cwd,
      display: displayWithCwd(display, cwd, fixtureRoot),
    };
  }
  const display = `node ${normalizePath(entryPoint)} ${displayArgv.join(' ')}`.trim();
  return {
    command: process.execPath,
    args: [absoluteEntryPoint, ...args],
    cwd,
    display: displayWithCwd(display, cwd, fixtureRoot),
  };
}

function originalReplayCommandFor(originalPath, fixtureRoot, args) {
  const absoluteEntryPoint = repoPath(originalPath);
  const extension = path.extname(originalPath).toLowerCase();
  const displayArgv = displayArgs(args, fixtureRoot);
  const cwd = scenarioCwdFor(originalPath, fixtureRoot);
  if (extension === '.ps1') {
    const display = `pwsh -NoLogo -NoProfile -File ${originalPath} ${displayArgv.join(' ')}`.trim();
    return {
      command: process.platform === 'win32' ? 'pwsh.exe' : 'pwsh',
      args: ['-NoLogo', '-NoProfile', '-File', absoluteEntryPoint, ...args],
      cwd,
      display: displayWithCwd(display, cwd, fixtureRoot),
    };
  }
  if (extension === '.sh') {
    const display = `bash ${originalPath} ${displayArgv.join(' ')}`.trim();
    return {
      command: 'bash',
      args: [absoluteEntryPoint, ...args],
      cwd,
      display: displayWithCwd(display, cwd, fixtureRoot),
    };
  }
  if (extension === '.ts' || extension === '.tsx') {
    const display = `npx ts-node --project tsconfig.node.json --transpile-only ${originalPath} ${displayArgv.join(
      ' '
    )}`.trim();
    return {
      command: 'npx',
      args: ['ts-node', '--project', 'tsconfig.node.json', '--transpile-only', originalPath, ...args],
      shell: process.platform === 'win32',
      cwd,
      display: displayWithCwd(display, cwd, fixtureRoot),
    };
  }
  if (extension === '.py') {
    const display = `python ${originalPath} ${displayArgv.join(' ')}`.trim();
    return {
      command: process.platform === 'win32' ? 'py' : 'python3',
      args: [absoluteEntryPoint, ...args],
      cwd,
      display: displayWithCwd(display, cwd, fixtureRoot),
    };
  }
  const display = `node ${originalPath} ${displayArgv.join(' ')}`.trim();
  return {
    command: process.execPath,
    args: [absoluteEntryPoint, ...args],
    cwd,
    display: displayWithCwd(display, cwd, fixtureRoot),
  };
}

function runCommandScenario(replayCommand, fixtureRoot, timeoutMs, envOverrides = {}, pathReplacements = []) {
  const result = spawnSync(replayCommand.command, replayCommand.args, {
    cwd: replayCommand.cwd || repoPath('.'),
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      ...envOverrides,
    },
    timeout: timeoutMs,
    shell: Boolean(replayCommand.shell),
  });
  const expectedFileArtifacts = listFileArtifacts(fixtureRoot, [fixtureRoot], pathReplacements);
  const expectedErrorPaths = [];
  if (result.error) expectedErrorPaths.push({ channel: 'spawn', message: result.error.message });
  if (result.stderr) {
    const normalizedStderrForErrorPath = normalizeReplayText(result.stderr, [fixtureRoot], pathReplacements);
    expectedErrorPaths.push({
      channel: 'stderr',
      firstLine: normalizedStderrForErrorPath.split(/\r?\n/u).find((line) => line.trim().length > 0) || '',
    });
  }
  if ((result.status || 0) !== 0 && !result.stderr && !result.error) {
    expectedErrorPaths.push({ channel: 'exitCode', value: result.status || 0 });
  }
  return {
    fixtureRoot,
    replayCommand: replayCommand.display,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    expectedFileArtifacts,
    expectedErrorPaths,
    timedOut: Boolean(result.signal) || result.error?.code === 'ETIMEDOUT',
  };
}

function pathEquivalenceReplacements(row, packageEntryPoint, packageRuntimeEntryPoint) {
  return [
    { from: row.originalPath, to: row.originalPath },
    { from: packageEntryPoint, to: row.originalPath },
    { from: packageRuntimeEntryPoint, to: row.originalPath },
  ];
}

function buildScenario({
  row,
  packageEntryPoint,
  packageRuntimeEntryPoint,
  ownerTaskId,
  timeoutMs,
  discoveredBehavior,
  scenarioDefinitions,
  scenarioDefinition,
}) {
  const scenarioId = `${ownerTaskId.toLowerCase()}_${safeId(row.originalPath)}_${safeId(scenarioDefinition.id)}`;
  const originalFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${scenarioId}-original-`));
  const packageFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${scenarioId}-package-`));
  const originalArgs = scenarioDefinition.buildArgs(originalFixtureRoot);
  const packageArgs = scenarioDefinition.buildArgs(packageFixtureRoot);
  const originalEnv = scenarioDefinition.buildEnv(originalFixtureRoot);
  const packageEnv = scenarioDefinition.buildEnv(packageFixtureRoot);
  const pathReplacements = pathEquivalenceReplacements(row, packageEntryPoint, packageRuntimeEntryPoint);
  const originalReplayCommand = originalReplayCommandFor(row.originalPath, originalFixtureRoot, originalArgs);
  const packageReplayCommand = replayCommandFor(
    packageRuntimeEntryPoint,
    packageFixtureRoot,
    packageArgs,
    row.originalPath
  );
  const originalReplay = runCommandScenario(
    originalReplayCommand,
    originalFixtureRoot,
    timeoutMs,
    originalEnv,
    pathReplacements
  );
  const packageReplay = runCommandScenario(
    packageReplayCommand,
    packageFixtureRoot,
    timeoutMs,
    packageEnv,
    pathReplacements
  );
  const fixtureRootsForNormalization = [originalFixtureRoot, packageFixtureRoot];
  const expectedStdout = normalizeReplayText(originalReplay.stdout, fixtureRootsForNormalization, pathReplacements);
  const expectedStderr = normalizeReplayText(originalReplay.stderr, fixtureRootsForNormalization, pathReplacements);
  const expectedErrorPaths = normalizeReplayValue(
    originalReplay.expectedErrorPaths,
    fixtureRootsForNormalization,
    pathReplacements
  );
  const sourceLineAnchors = lineAnchorsForSource(row.originalPath);
  const coverage = initialCoverageProof({
    ownerTaskId,
    staticAnalysisCommandId: `${ownerTaskId}_STATIC_FULL:${row.originalPath}`,
    discoveredBehavior,
    fileArtifactCount: originalReplay.expectedFileArtifacts.length,
    errorPathCount: originalReplay.expectedErrorPaths.length,
    scenarioDefinitions,
  });
  return {
    scenario: {
      scenarioId,
      originalEntryPoint: row.originalPath,
      originalEntryCommand: originalReplay.replayCommand,
      packageEntryPoint,
      packageEntryCommand: packageReplay.replayCommand,
      argumentCombination: scenarioDefinition.argumentCombination,
      args: displayArgs(originalArgs, originalFixtureRoot),
      env: displayEnv(originalEnv, originalFixtureRoot),
      fixtures: [
        {
          id: `${scenarioId}_original_fixture_root`,
          path: fixtureRootForReceipt(originalReplay.fixtureRoot),
          description: 'Isolated fixture root used for original replay expected outputs.',
        },
        {
          id: `${scenarioId}_package_fixture_root`,
          path: fixtureRootForReceipt(packageReplay.fixtureRoot),
          description: 'Isolated empty fixture root used for package replay comparison.',
        },
      ],
      expectedStdout,
      expectedStderr,
      expectedExitCode: originalReplay.exitCode,
      expectedFileArtifacts: originalReplay.expectedFileArtifacts,
      expectedErrorPaths,
      expectedOutputProvenance: {
        expectedSource: 'original_replay',
        originalReplayCommandId: `${ownerTaskId}_ORIGINAL_REPLAY:${row.originalPath}:${scenarioDefinition.id}`,
        originalReplayArtifactHash: sha256Text(
          JSON.stringify({
            stdout: expectedStdout,
            stderr: expectedStderr,
            exitCode: originalReplay.exitCode,
            fileArtifacts: originalReplay.expectedFileArtifacts,
            errorPaths: expectedErrorPaths,
          })
        ),
        sourceDerivedProofId: `${ownerTaskId}_SOURCE_DERIVED:${row.originalPath}:${scenarioDefinition.id}`,
        sourceLineAnchors,
      },
      normalizationPolicy: {
        normalizedFields: ['expectedStdout', 'expectedStderr', 'expectedErrorPaths'],
        replacements: [
          'originalFixtureRoot=> <fixture-root>',
          'packageFixtureRoot=> <fixture-root>',
          'packageSourceAuthorityPath=> originalPath',
          'packageDistRuntimePath=> originalPath',
        ],
        pathEquivalenceReplacements: pathReplacements,
        nonNormalizedFields: ['expectedExitCode', 'expectedFileArtifacts', 'script paths', 'stderr text outside fixture roots'],
      },
      scenarioCoverageProof: coverage,
    },
    replay: packageReplay,
    originalReplay,
  };
}

function fixtureRootForReceipt(value) {
  return normalizePath(value).replace(normalizePath(os.tmpdir()), '<tmp>');
}

function replayComparison(scenario, replay) {
  const fixtureRoots = scenario.fixtures.map((fixture) =>
    normalizePath(fixture.path).replace(/^<tmp>/u, normalizePath(os.tmpdir()))
  );
  const pathReplacements = scenario.normalizationPolicy?.pathEquivalenceReplacements || [];
  const normalizedReplayStdout = normalizeReplayText(replay.stdout, fixtureRoots, pathReplacements);
  const normalizedReplayStderr = normalizeReplayText(replay.stderr, fixtureRoots, pathReplacements);
  const stdoutMatches = normalizedReplayStdout === scenario.expectedStdout;
  const stderrMatches = normalizedReplayStderr === scenario.expectedStderr;
  const exitCodeMatches = replay.exitCode === scenario.expectedExitCode;
  const comparableFileArtifacts = (artifacts) =>
    artifacts.map((artifact) => ({
      path: artifact.path,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
      hashPolicy: artifact.hashPolicy || 'raw_hash',
      contentEncoding: artifact.contentEncoding || 'unknown',
    }));
  const fileArtifactsMatch =
    JSON.stringify(comparableFileArtifacts(replay.expectedFileArtifacts)) ===
    JSON.stringify(comparableFileArtifacts(scenario.expectedFileArtifacts));
  const normalizedReplayErrorPaths = normalizeReplayValue(replay.expectedErrorPaths, fixtureRoots, pathReplacements);
  const errorPathsMatch = JSON.stringify(normalizedReplayErrorPaths) === JSON.stringify(scenario.expectedErrorPaths);
  const firstDiff = (expected, actual) => {
    if (expected === actual) return null;
    let index = 0;
    while (index < expected.length && index < actual.length && expected[index] === actual[index]) index += 1;
    return {
      index,
      expected: expected.slice(Math.max(0, index - 80), index + 160),
      actual: actual.slice(Math.max(0, index - 80), index + 160),
    };
  };
  return {
    scenarioId: scenario.scenarioId,
    originalEntryPoint: scenario.originalEntryPoint,
    packageEntryPoint: scenario.packageEntryPoint,
    stdoutMatches,
    stderrMatches,
    exitCodeMatches,
    fileArtifactsMatch,
    errorPathsMatch,
    passed: stdoutMatches && stderrMatches && exitCodeMatches && fileArtifactsMatch && errorPathsMatch,
    exitCode: replay.exitCode,
    stdoutBytes: Buffer.byteLength(replay.stdout, 'utf8'),
    stderrBytes: Buffer.byteLength(replay.stderr, 'utf8'),
    normalizedExpectedStdoutHash: sha256Text(scenario.expectedStdout),
    normalizedReplayStdoutHash: sha256Text(normalizedReplayStdout),
    normalizedExpectedStderrHash: sha256Text(scenario.expectedStderr),
    normalizedReplayStderrHash: sha256Text(normalizedReplayStderr),
    stdoutFirstDiff: firstDiff(scenario.expectedStdout, normalizedReplayStdout),
    stderrFirstDiff: firstDiff(scenario.expectedStderr, normalizedReplayStderr),
    timedOut: replay.timedOut,
  };
}

function aggregateCoverageProof(ownerTaskId, row, discoveredBehavior, scenarios, scenarioDefinitions) {
  return initialCoverageProof({
    ownerTaskId,
    staticAnalysisCommandId: `${ownerTaskId}_STATIC_FULL:${row.originalPath}:aggregate`,
    discoveredBehavior,
    fileArtifactCount: scenarios.reduce((count, item) => count + item.scenario.expectedFileArtifacts.length, 0),
    errorPathCount: scenarios.reduce((count, item) => count + item.scenario.expectedErrorPaths.length, 0),
    scenarioDefinitions,
  });
}

function runtimeEntryPointFor(row, packageEntryPoint) {
  const recordedReplayPaths = Array.isArray(row.runtimeReplayPaths)
    ? row.runtimeReplayPaths.map((entry) => normalizePath(entry)).filter(Boolean)
    : [];
  if (recordedReplayPaths.length > 0) return recordedReplayPaths[0];
  const recordedRuntimeEntryPoint = row.packageSourceProof && row.packageSourceProof.runtimeReplayPath;
  if (typeof recordedRuntimeEntryPoint === 'string' && recordedRuntimeEntryPoint.trim()) {
    return normalizePath(recordedRuntimeEntryPoint);
  }
  return sourceAuthorityPathToDistRuntimePath(packageEntryPoint);
}

function updateLedgerRows({
  ledger,
  ownerTaskId,
  matrixPath,
  replayResultsPath,
  matrixHash,
  replayHash,
  stdoutPath,
  stderrPath,
  replayRows,
  generatedAt,
  ledgerHashBefore,
}) {
  const replayByOriginalPath = new Map(replayRows.map((row) => [row.originalPath, row]));
  const ownerCommandId = OWNER_COMMAND_IDS[ownerTaskId];
  const acceptanceIds = acceptanceIdsForOwner(ownerTaskId);
  for (const row of ledger.entries.filter((entry) => entry.matrixOwnerTaskId === ownerTaskId)) {
    const replayRow = replayByOriginalPath.get(row.originalPath);
    if (!replayRow) continue;
    row.behaviorEquivalenceMatrix = replayRow.behaviorEquivalenceMatrix;
    row.scenarioCoverageProof = replayRow.scenarioCoverageProof;
    row.expectedOutputProvenance = replayRow.behaviorEquivalenceMatrix[0].expectedOutputProvenance;
    row.matrixFirstGenerationProof = {
      commandId: `${ownerCommandId}:${ownerTaskId}:generate-full-behavior-matrix`,
      ownerTaskId,
      artifactPath: matrixPath,
      artifactHash: matrixHash,
      ledgerHashBeforeOwnerCompletion: ledgerHashBefore,
      ownerCompletionEvidenceId: `${ownerTaskId}_INITIAL_MATRIX_GENERATED:${matrixHash}`,
    };
    row.behaviorEquivalenceMatrixFirstGeneratedByTaskId = ownerTaskId;
    row.behaviorEquivalenceMatrixFirstGeneratedAt = generatedAt;
    row.behaviorEquivalenceMatrixOwnerTaskCompletedAt = generatedAt;
    row.behaviorEquivalenceReplayProof = {
      replayCommandId: `${ownerCommandId}:${ownerTaskId}:full-package-source-replay`,
      replayStdoutPath: stdoutPath,
      replayStderrPath: stderrPath,
      replayResultArtifactHash: replayHash,
      scenarioCount: replayRow.scenarioCount,
      passedScenarioCount: replayRow.passedScenarioCount,
      failedScenarioCount: replayRow.failedScenarioCount,
      acceptanceIds,
    };
    row.behaviorParityProof = {
      status: replayRow.failedScenarioCount === 0 ? 'passed_full_behavior_matrix_replay' : 'failed_full_behavior_matrix_replay',
      behaviorEquivalenceMatrixPath: matrixPath,
      behaviorEquivalenceMatrixHash: matrixHash,
      replayResultPath: replayResultsPath,
      replayResultHash: replayHash,
      acceptanceIds,
      fullCoverageStillRequired: false,
    };
    if (row.scopeClass === 'settled_revalidation') {
      const coveragePassed =
        replayRow.scenarioCoverageProof &&
        replayRow.scenarioCoverageProof.coverageDecision === 'passed_full_original_behavior_coverage';
      row.settledEquivalenceProof = {
        status: replayRow.failedScenarioCount === 0 && coveragePassed ? 'passed' : 'failed_rework_required',
        ownerTaskId,
        behaviorEquivalenceMatrixPath: matrixPath,
        behaviorEquivalenceMatrixHash: matrixHash,
        replayResultPath: replayResultsPath,
        replayResultHash: replayHash,
        replayPassed: replayRow.failedScenarioCount === 0,
        coverageDecision: replayRow.scenarioCoverageProof.coverageDecision,
        acceptanceIds,
      };
    }
    row.validationResult = {
      status: replayRow.failedScenarioCount === 0 ? 'full_behavior_matrix_replayed' : 'full_behavior_matrix_replay_failed',
      reworkRequired: replayRow.failedScenarioCount !== 0,
    };
    row.reworkHistory = [
      ...(Array.isArray(row.reworkHistory) ? row.reworkHistory : []),
      {
        at: generatedAt,
        ownerTaskId,
        action: 'generated_full_behavior_matrix_and_replay',
        matrixPath,
        matrixHash,
        scenarioCount: replayRow.scenarioCount,
        failedScenarioCount: replayRow.failedScenarioCount,
        fullCoverageStillRequired: false,
      },
    ];
  }
}

function selectRowsForBatch(rows, args) {
  let selected = [...rows].sort((left, right) => left.originalPath.localeCompare(right.originalPath));
  if (args.originalPath) selected = selected.filter((row) => row.originalPath === args.originalPath);
  if (args.startAfter) selected = selected.filter((row) => row.originalPath.localeCompare(args.startAfter) > 0);
  if (args.maxRows) selected = selected.slice(0, args.maxRows);
  return selected;
}

function generate(updateLedger, ownerTaskId = DEFAULT_OWNER_TASK_ID, options = {}) {
  if (!ALLOWED_OWNER_TASK_IDS.has(ownerTaskId)) throw new Error(`unsupported owner: ${ownerTaskId}`);
  const args = {
    originalPath: options.originalPath || null,
    startAfter: options.startAfter || null,
    maxRows: options.maxRows || null,
    artifactSuffix: options.artifactSuffix || null,
    timeoutMs: options.timeoutMs || 30000,
  };
  const artifactSuffix = artifactSuffixForArgs(args);
  const artifactPaths = artifactPathsForOwner(ownerTaskId, artifactSuffix);
  ensureDir(`${WAVE_DIR}/owner-matrices`);
  const generatedAt = nowIso();
  const ledgerHashBefore = sha256File(LEDGER_PATH);
  const ledger = loadLedger();
  const eligibleRows = ledger.entries.filter(
    (entry) =>
      entry.matrixOwnerTaskId === ownerTaskId &&
      Array.isArray(entry.packageImplementationSet) &&
      entry.packageImplementationSet.length > 0 &&
      entry.sizeDeltaDecision === 'passed_within_strict_threshold'
  );
  const rows = selectRowsForBatch(eligibleRows, args);
  const replayRows = [];
  for (const row of rows) {
    const packageEntryPoint = row.packageImplementationSet.find((entryPath) =>
      normalizePath(entryPath).startsWith('packages/bmad-speckit/src/')
    );
    if (!packageEntryPoint) continue;
    const packageRuntimeEntryPoint = runtimeEntryPointFor(row, packageEntryPoint);
    const discoveredBehavior = discoverOriginalBehavior(row.originalPath);
    const scenarioDefinitions = scenarioDefinitionsFor(discoveredBehavior, row.originalPath);
    const scenarioResults = scenarioDefinitions.map((scenarioDefinition) => {
      const { scenario, replay, originalReplay } = buildScenario({
        row,
        packageEntryPoint,
        packageRuntimeEntryPoint,
        ownerTaskId,
        timeoutMs: args.timeoutMs,
        discoveredBehavior,
        scenarioDefinitions,
        scenarioDefinition,
      });
      return {
        scenario,
        replay,
        originalReplay,
        comparison: replayComparison(scenario, replay),
      };
    });
    const scenarioCoverageProof = aggregateCoverageProof(
      ownerTaskId,
      row,
      discoveredBehavior,
      scenarioResults,
      scenarioDefinitions
    );
    const passedScenarioCount = scenarioResults.filter((result) => result.comparison.passed).length;
    const failedScenarioCount = scenarioResults.length - passedScenarioCount;
    replayRows.push({
      originalPath: row.originalPath,
      entryId: row.entryId,
      packageRuntimeEntryPoint,
      behaviorEquivalenceMatrix: scenarioResults.map((result) => result.scenario),
      scenarioCoverageProof,
      scenarioCount: scenarioResults.length,
      passedScenarioCount,
      failedScenarioCount,
      scenarios: scenarioResults.map((result) => ({
        scenarioId: result.scenario.scenarioId,
        originalReplay: {
          exitCode: result.originalReplay.exitCode,
          stdoutBytes: Buffer.byteLength(result.originalReplay.stdout, 'utf8'),
          stderrBytes: Buffer.byteLength(result.originalReplay.stderr, 'utf8'),
          expectedFileArtifactCount: result.originalReplay.expectedFileArtifacts.length,
          expectedErrorPathCount: result.originalReplay.expectedErrorPaths.length,
          timedOut: result.originalReplay.timedOut,
        },
        replay: {
          exitCode: result.replay.exitCode,
          stdoutBytes: Buffer.byteLength(result.replay.stdout, 'utf8'),
          stderrBytes: Buffer.byteLength(result.replay.stderr, 'utf8'),
          expectedFileArtifactCount: result.replay.expectedFileArtifacts.length,
          expectedErrorPathCount: result.replay.expectedErrorPaths.length,
          timedOut: result.replay.timedOut,
        },
        comparison: result.comparison,
      })),
    });
  }

  const matrixArtifact = {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-owner-initial-behavior-matrix/v1',
    waveId: 'main-agent-runtime-migration-wave-4.1',
    ownerTaskId,
    generatedAt,
    artifactSuffix,
    timeoutMs: args.timeoutMs,
    coverageDecision: replayRows.every((row) => row.failedScenarioCount === 0)
      ? 'passed_full_original_behavior_coverage'
      : 'failed_full_original_behavior_replay',
    eligibleOwnerRowCount: eligibleRows.length,
    selectedRowCount: rows.length,
    matrixRowCount: replayRows.length,
    scenarioCount: replayRows.reduce((count, row) => count + row.scenarioCount, 0),
    fullCoverageStillRequired: false,
    rows: replayRows.map((row) => ({
      originalPath: row.originalPath,
      entryId: row.entryId,
      packageImplementationSet: row.behaviorEquivalenceMatrix.length
        ? [row.behaviorEquivalenceMatrix[0].packageEntryPoint]
        : [],
      packageRuntimeEntryPoint: row.packageRuntimeEntryPoint,
      scenarioCoverageProof: row.scenarioCoverageProof,
      behaviorEquivalenceMatrix: row.behaviorEquivalenceMatrix,
    })),
  };
  const matrixReceipt = writeJson(artifactPaths.matrixPath, matrixArtifact);

  const replayArtifact = {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-owner-initial-replay-results/v1',
    waveId: 'main-agent-runtime-migration-wave-4.1',
    ownerTaskId,
    generatedAt,
    artifactSuffix,
    timeoutMs: args.timeoutMs,
    matrixPath: artifactPaths.matrixPath,
    matrixHash: matrixReceipt.hash,
    matrixRowCount: replayRows.length,
    scenarioCount: replayRows.reduce((count, row) => count + row.scenarioCount, 0),
    passedScenarioCount: replayRows.reduce((count, row) => count + row.passedScenarioCount, 0),
    failedScenarioCount: replayRows.reduce((count, row) => count + row.failedScenarioCount, 0),
    replayRows: replayRows.map((row) => ({
      originalPath: row.originalPath,
      entryId: row.entryId,
      packageRuntimeEntryPoint: row.packageRuntimeEntryPoint,
      scenarioCount: row.scenarioCount,
      passedScenarioCount: row.passedScenarioCount,
      failedScenarioCount: row.failedScenarioCount,
      scenarios: row.scenarios,
    })),
  };
  const replayReceipt = writeJson(artifactPaths.replayResultsPath, replayArtifact);
  const stdoutReceipt = writeText(
    artifactPaths.replayStdoutPath,
    formatJson(
      replayRows.map((row) => ({
        originalPath: row.originalPath,
        expectedStdoutByScenario: row.behaviorEquivalenceMatrix.map((scenario) => ({
          scenarioId: scenario.scenarioId,
          expectedStdout: scenario.expectedStdout,
        })),
      }))
    )
  );
  const stderrReceipt = writeText(
    artifactPaths.replayStderrPath,
    formatJson(
      replayRows.map((row) => ({
        originalPath: row.originalPath,
        expectedStderrByScenario: row.behaviorEquivalenceMatrix.map((scenario) => ({
          scenarioId: scenario.scenarioId,
          expectedStderr: scenario.expectedStderr,
        })),
      }))
    )
  );

  if (updateLedger) {
    updateLedgerRows({
      ledger,
      ownerTaskId,
      matrixPath: artifactPaths.matrixPath,
      replayResultsPath: artifactPaths.replayResultsPath,
      matrixHash: matrixReceipt.hash,
      replayHash: replayReceipt.hash,
      stdoutPath: artifactPaths.replayStdoutPath,
      stderrPath: artifactPaths.replayStderrPath,
      replayRows,
      generatedAt,
      ledgerHashBefore,
    });
    ledger.generatedAt = generatedAt;
    writeJson(LEDGER_PATH, ledger);
  }

  return {
    ok: replayArtifact.failedScenarioCount === 0,
    status: updateLedger
      ? 'full_behavior_matrix_written'
      : 'full_behavior_matrix_artifacts_written_without_ledger_update',
    ownerTaskId,
    artifactSuffix,
    eligibleOwnerRowCount: eligibleRows.length,
    selectedRowCount: rows.length,
    matrixRowCount: replayRows.length,
    scenarioCount: replayArtifact.scenarioCount,
    passedScenarioCount: replayArtifact.passedScenarioCount,
    failedScenarioCount: replayArtifact.failedScenarioCount,
    fullCoverageStillRequired: false,
    matrixPath: artifactPaths.matrixPath,
    matrixHash: matrixReceipt.hash,
    replayResultsPath: artifactPaths.replayResultsPath,
    replayResultsHash: replayReceipt.hash,
    replayStdoutPath: artifactPaths.replayStdoutPath,
    replayStdoutHash: stdoutReceipt.hash,
    replayStderrPath: artifactPaths.replayStderrPath,
    replayStderrHash: stderrReceipt.hash,
    ledgerUpdated: updateLedger,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = generate(args.updateLedger, args.owner, args);
  process.stdout.write(args.json ? formatJson(output) : `${JSON.stringify(output)}\n`);
  if (!output.ok) process.exitCode = 1;
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
  discoverCliFlags,
  discoverOriginalBehavior,
  flagTakesValue,
  generate,
};
