#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const PACKAGE_ROOT = path.join(ROOT, 'packages', 'bmad-speckit');
const CONTRACT_PATH = 'docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md';
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const EVIDENCE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', 'main-agent-p1-p4-runtime-migration');
const INSTALL_MATRIX_DIR = path.join(EVIDENCE_DIR, 'install-matrix');
const WAVE_IDS = [
  'main-agent-runtime-migration-wave-3.6',
  'main-agent-runtime-migration-wave-3.7',
  'main-agent-runtime-migration-wave-3.8',
  'main-agent-runtime-migration-wave-3.9',
];
const INSTALL_MODES = ['save-dev', 'npx-package', 'no-save', 'init-sync-consumer'];
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npmCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-p1-p4-npm-cache-'));

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function repoRelative(filePath) {
  return slash(path.relative(ROOT, filePath));
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(String(value || ''), 'utf8').digest('hex')}`;
}

function quoteArg(arg) {
  return /\s/u.test(String(arg)) ? JSON.stringify(String(arg)) : String(arg);
}

function safeRm(targetPath, allowedRoots) {
  const resolved = path.resolve(targetPath);
  const allowed = allowedRoots.map((root) => path.resolve(root));
  if (!allowed.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error(`refusing to remove path outside allowed roots: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function runProcess(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      npm_config_loglevel: 'error',
      npm_config_cache: npmCacheDir,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
      ...extraEnv,
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    command: [command, ...args.map(quoteArg)].join(' '),
    exitCode: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || result.error?.message || ''),
  };
}

function expectSuccess(result) {
  if (result.exitCode !== 0) {
    throw new Error(`${result.command}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return result;
}

function commandRow(commandId, result, extra = {}) {
  return {
    commandId,
    command: result.command,
    exitCode: result.exitCode,
    stdoutHash: sha256(result.stdout),
    stderrHash: sha256(result.stderr),
    stdoutPreview: result.stdout.slice(0, 600),
    stderrPreview: result.stderr.slice(0, 600),
    ...extra,
  };
}

function readRegistry() {
  return yaml.load(fs.readFileSync(path.join(ROOT, REGISTRY_PATH), 'utf8'));
}

function entriesForWaves() {
  const registry = readRegistry();
  const entries = [];
  for (const waveId of WAVE_IDS) {
    const wave = registry.waves.find((candidate) => candidate.waveId === waveId);
    if (!wave) throw new Error(`missing registry wave: ${waveId}`);
    for (const entry of wave.entries) entries.push({ waveId, ...entry });
  }
  return entries;
}

function actionSlug(entry) {
  const source = (entry.targetSourcePaths || entry.targetPaths || []).find((target) =>
    slash(target).startsWith('packages/bmad-speckit/src/main-agent/actions/')
  );
  if (source) return path.basename(source, '.js');
  const slug = path.basename(entry.originalPath || '').replace(/\.(?:ts|js|cjs)$/u, '');
  return slug.startsWith('main-agent-') ? slug.slice('main-agent-'.length) : slug;
}

function helperRelPath(entry) {
  const dist = (entry.targetDistPaths || entry.targetPaths || []).find((target) =>
    slash(target).startsWith('packages/bmad-speckit/dist/main-agent/helpers/')
  );
  if (!dist) throw new Error(`missing dist helper path for ${entry.entryId}`);
  return slash(dist).replace('packages/bmad-speckit/', '');
}

function helperIdFor(entry) {
  return entry.helperId || path.basename(helperRelPath(entry), '.js');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function coveredRootScriptPattern(entries) {
  const alternatives = entries
    .map((entry) => slash(entry.originalPath))
    .filter((originalPath) => originalPath.startsWith('scripts/'))
    .map((originalPath) => escapeRegExp(originalPath).replace(/\//gu, '[\\\\/]'));
  return new RegExp(`(^|[\\\\/])(?:${alternatives.join('|')})(?:$|[^A-Za-z0-9_.-])`, 'iu');
}

function parsePackOutput(stdout) {
  const start = stdout.indexOf('[');
  if (start < 0) throw new Error('npm pack output missing JSON array');
  return JSON.parse(stdout.slice(start));
}

function latestTarball() {
  if (!fs.existsSync(EVIDENCE_DIR)) return null;
  return fs
    .readdirSync(EVIDENCE_DIR)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => path.join(EVIDENCE_DIR, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
}

function prepareTarball(commandRows) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const build = expectSuccess(
    runProcess(npmCmd, ['run', 'build:main-agent-dist', '--prefix', 'packages/bmad-speckit'], ROOT)
  );
  commandRows.push(commandRow('prepare-build-main-agent-dist', build));
  const preparePackSurface = expectSuccess(
    runProcess(process.execPath, ['scripts/prepublish-check.js'], ROOT, {
      BMAD_PREPUBLISH_SILENT: '1',
      BMAD_PACK_SESSION: '1',
    })
  );
  commandRows.push(commandRow('prepare-package-install-surface', preparePackSurface));
  try {
    const pack = expectSuccess(
      runProcess(npmCmd, ['pack', '--pack-destination', EVIDENCE_DIR, '--json', '--ignore-scripts'], PACKAGE_ROOT)
    );
    commandRows.push(commandRow('npm-pack', pack));
    const parsed = parsePackOutput(pack.stdout);
    const filename = parsed[0]?.filename;
    const tarball = filename ? path.join(EVIDENCE_DIR, filename) : latestTarball();
    if (!tarball || !fs.existsSync(tarball)) throw new Error('npm pack did not produce a package tarball');
    return {
      tarball,
      packageName: parsed[0]?.name || 'bmad-speckit',
      packageVersion: parsed[0]?.version || null,
      packFiles: (parsed[0]?.files || []).map((file) => slash(file.path)).sort(),
    };
  } finally {
    const cleanup = runProcess(process.execPath, ['scripts/cleanup-packed-bmad.js'], ROOT);
    commandRows.push(commandRow('cleanup-package-install-surface', cleanup));
  }
}

function writeConsumerPackageJson(target, name) {
  fs.writeFileSync(
    path.join(target, 'package.json'),
    `${JSON.stringify({ name, version: '1.0.0', private: true }, null, 2)}\n`,
    'utf8'
  );
}

function resolveInstalledPackageRuntime(target) {
  const candidates = [
    path.join(target, 'node_modules', 'bmad-speckit'),
    path.join(target, 'node_modules', 'bmad-speckit-sdd-flow', 'node_modules', 'bmad-speckit'),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'dist', 'main-agent', 'index.js'))) ?? null;
}

function ensureRuntimeProbe(target, entries) {
  const probePath = path.join(target, 'main-agent-p1-p4-runtime-probe.cjs');
  const logPath = path.join(target, 'main-agent-p1-p4-runtime-probe.ndjson');
  const rootScriptReSource = coveredRootScriptPattern(entries).source;
  fs.writeFileSync(
    probePath,
    [
      "const fs = require('node:fs');",
      "const childProcess = require('node:child_process');",
      "const Module = require('node:module');",
      "const logPath = process.env.BMAD_P1_P4_RUNTIME_PROBE_LOG;",
      `const ROOT_SCRIPT_RE = new RegExp(${JSON.stringify(rootScriptReSource)}, 'iu');`,
      "const TSX_RE = /(^|[\\\\/])tsx(?:\\.cmd)?$|\\btsx\\b/i;",
      "const TS_NODE_RE = /(^|[\\\\/])ts-node(?:\\.cmd)?$|\\bts-node\\b/i;",
      "const COMPILED_FALLBACK_RE = /compiled[\\\\/]main-agent-orchestration\\.cjs/i;",
      'function stringify(value) { try { return JSON.stringify(value); } catch { return String(value); } }',
      'function flags(args) {',
      '  const text = Array.isArray(args) ? args.map(stringify).join(" ") : stringify(args);',
      '  return {',
      '    usedRootScript: ROOT_SCRIPT_RE.test(text),',
      '    usedTsx: TSX_RE.test(text),',
      '    usedTsNode: TS_NODE_RE.test(text),',
      '    usedCompiledFallback: COMPILED_FALLBACK_RE.test(text),',
      '    text,',
      '  };',
      '}',
      'function record(kind, args) {',
      '  if (!logPath) return;',
      '  const result = flags(args);',
      '  if (!result.usedRootScript && !result.usedTsx && !result.usedTsNode && !result.usedCompiledFallback) return;',
      '  fs.appendFileSync(logPath, JSON.stringify({ kind, cwd: process.cwd(), ...result }) + "\\n", "utf8");',
      '}',
      'record("process.argv", process.argv);',
      'for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync"]) {',
      '  const original = childProcess[name];',
      '  if (typeof original !== "function") continue;',
      '  childProcess[name] = function patchedChildProcess(...args) {',
      '    record(`child_process.${name}`, args);',
      '    return original.apply(this, args);',
      '  };',
      '}',
      'const originalLoad = Module._load;',
      'Module._load = function patchedModuleLoad(request, parent, isMain) {',
      '  record("module.load", [request, parent && parent.filename]);',
      '  return originalLoad.call(this, request, parent, isMain);',
      '};',
      '',
    ].join('\n'),
    'utf8'
  );
  fs.rmSync(logPath, { force: true });
  return { probePath, logPath };
}

function readProbeFlags(logPath) {
  if (!fs.existsSync(logPath)) {
    return {
      usedRootScript: false,
      usedTsx: false,
      usedTsNode: false,
      usedCompiledFallback: false,
      probeHits: [],
    };
  }
  const probeHits = fs
    .readFileSync(logPath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return {
    usedRootScript: probeHits.some((hit) => hit.usedRootScript),
    usedTsx: probeHits.some((hit) => hit.usedTsx),
    usedTsNode: probeHits.some((hit) => hit.usedTsNode),
    usedCompiledFallback: probeHits.some((hit) => hit.usedCompiledFallback),
    probeHits,
  };
}

function parseJsonFromStdout(stdout) {
  const text = String(stdout || '').trim();
  for (let index = text.indexOf('{'); index >= 0; index = text.indexOf('{', index + 1)) {
    try {
      return JSON.parse(text.slice(index));
    } catch {
      // npm/npx can prepend non-JSON lines.
    }
  }
  throw new Error(`stdout did not contain JSON:\n${stdout}`);
}

function commandArgsForMode(mode, tarball, action) {
  const args = ['main-agent', action, '--json'];
  if (mode === 'npx-package') return [npxCmd, ['--yes', '--package', tarball, 'bmad-speckit', ...args]];
  return [npxCmd, ['--no-install', 'bmad-speckit', ...args]];
}

function validateActionResponse(entry, action, result, flags) {
  if (result.exitCode !== 0) {
    throw new Error(`${result.command}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (flags.usedRootScript || flags.usedTsx || flags.usedTsNode || flags.usedCompiledFallback) {
    throw new Error(`forbidden runtime probe hit for ${action}: ${JSON.stringify(flags.probeHits, null, 2)}`);
  }
  const parsed = parseJsonFromStdout(result.stdout);
  if (parsed.schemaVersion !== 'main-agent-package-runtime/v1') {
    throw new Error(`${entry.entryId} schemaVersion mismatch`);
  }
  if (parsed.action !== action) throw new Error(`${entry.entryId} action mismatch: ${parsed.action}`);
  if (parsed.status !== 'package_runtime_ready') throw new Error(`${entry.entryId} status mismatch: ${parsed.status}`);
  const proof = parsed.data?.report?.consumerRuntimeProof;
  if (proof?.usedRootScript !== false) throw new Error(`${entry.entryId} did not report usedRootScript=false`);
  if (proof?.usedCompiledFallback !== false) throw new Error(`${entry.entryId} did not report usedCompiledFallback=false`);
  if (proof?.usedTypeScriptRunner !== false) throw new Error(`${entry.entryId} did not report usedTypeScriptRunner=false`);
  return parsed;
}

function runObservedAction(mode, tarball, entry, consumerRoot, allEntries) {
  const action = actionSlug(entry);
  const { probePath, logPath } = ensureRuntimeProbe(consumerRoot, allEntries);
  const [runner, args] = commandArgsForMode(mode, tarball, action);
  const result = runProcess(runner, args, consumerRoot, {
    BMAD_P1_P4_RUNTIME_PROBE_LOG: logPath,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''}--require=${probePath}`,
  });
  const flags = readProbeFlags(logPath);
  const parsed = validateActionResponse(entry, action, result, flags);
  return commandRow(action, result, {
    entryId: entry.entryId,
    waveId: entry.waveId,
    originalPath: entry.originalPath,
    action,
    usedRootScript: flags.usedRootScript,
    usedTsx: flags.usedTsx,
    usedTsNode: flags.usedTsNode,
    usedCompiledFallback: flags.usedCompiledFallback,
    parsedStatus: parsed.status,
    probeHits: flags.probeHits,
  });
}

function ensureHelperProbe(target) {
  const helperProbePath = path.join(target, 'main-agent-p1-p4-helper-probe.cjs');
  fs.writeFileSync(
    helperProbePath,
    [
      "'use strict';",
      'const modulePath = process.argv[2];',
      'const expectedHelperId = process.argv[3];',
      'const helperModule = require(modulePath);',
      'const candidates = Object.entries(helperModule).filter(([, value]) => typeof value === "function");',
      'let selected = null;',
      'for (const [exportName, helper] of candidates) {',
      '  const result = helper({ cwd: process.cwd() });',
      '  if (result && result.helperId === expectedHelperId) {',
      '    selected = { exportName, result };',
      '    break;',
      '  }',
      '}',
      'if (!selected) throw new Error(`helper export missing for ${expectedHelperId}`);',
      'const { result } = selected;',
      'if (result.schemaVersion !== "main-agent-durable-helper/v1") throw new Error("schemaVersion mismatch");',
      'if (result.publicCliAction !== false) throw new Error("publicCliAction must be false");',
      'if (result.consumerRuntimeProof.usedRootScript !== false) throw new Error("usedRootScript must be false");',
      'if (result.consumerRuntimeProof.usedCompiledFallback !== false) throw new Error("usedCompiledFallback must be false");',
      'if (result.consumerRuntimeProof.usedTypeScriptRunner !== false) throw new Error("usedTypeScriptRunner must be false");',
      'process.stdout.write(JSON.stringify(selected));',
      '',
    ].join('\n'),
    'utf8'
  );
  return helperProbePath;
}

function runObservedHelper(mode, entry, packagePath, consumerRoot, allEntries) {
  const { probePath, logPath } = ensureRuntimeProbe(consumerRoot, allEntries);
  const helperProbePath = ensureHelperProbe(consumerRoot);
  const helperId = helperIdFor(entry);
  const requirePath = path.join(packagePath, helperRelPath(entry));
  const result = runProcess(process.execPath, [helperProbePath, requirePath, helperId], consumerRoot, {
    BMAD_P1_P4_RUNTIME_PROBE_LOG: logPath,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''}--require=${probePath}`,
  });
  const flags = readProbeFlags(logPath);
  if (result.exitCode !== 0) {
    throw new Error(`${result.command}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (flags.usedRootScript || flags.usedTsx || flags.usedTsNode || flags.usedCompiledFallback) {
    throw new Error(`forbidden helper probe hit for ${helperId}: ${JSON.stringify(flags.probeHits, null, 2)}`);
  }
  const parsed = JSON.parse(result.stdout);
  return commandRow(`helper:${helperId}`, result, {
    entryId: entry.entryId,
    waveId: entry.waveId,
    originalPath: entry.originalPath,
    helperId,
    exportName: parsed.exportName,
    usedRootScript: flags.usedRootScript,
    usedTsx: flags.usedTsx,
    usedTsNode: flags.usedTsNode,
    usedCompiledFallback: flags.usedCompiledFallback,
    probeHits: flags.probeHits,
  });
}

function aggregateFlags(commands) {
  return {
    usedRootScript: commands.some((row) => row.usedRootScript),
    usedTsx: commands.some((row) => row.usedTsx),
    usedTsNode: commands.some((row) => row.usedTsNode),
    usedCompiledFallback: commands.some((row) => row.usedCompiledFallback),
  };
}

function installTarball(mode, tarball, consumerRoot) {
  if (mode === 'save-dev' || mode === 'init-sync-consumer') {
    expectSuccess(
      runProcess(npmCmd, ['install', '--save-dev', tarball, '--ignore-scripts', '--no-audit', '--no-fund'], consumerRoot)
    );
  }
  if (mode === 'no-save') {
    expectSuccess(
      runProcess(npmCmd, ['install', '--no-save', tarball, '--ignore-scripts', '--no-audit', '--no-fund'], consumerRoot)
    );
  }
}

function allFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) return allFiles(fullPath);
    if (!entry.isFile()) return [];
    return [fullPath];
  });
}

function isGeneratedSurfaceFile(consumerRoot, filePath) {
  const relativePath = slash(path.relative(consumerRoot, filePath));
  if (relativePath.includes('/assets/')) return false;
  if (/\.min\.(?:js|css)$/iu.test(relativePath)) return false;
  if (relativePath.includes('/node_modules/')) return false;
  return /\.(?:md|mdx|txt|json|jsonc|ya?ml|toml|js|cjs|mjs|ts|sh|ps1)$/iu.test(relativePath);
}

function scanGeneratedSurfaces(consumerRoot, allEntries) {
  const rootScriptPattern = coveredRootScriptPattern(allEntries);
  const callLikeTypeScriptRunner = /(?:^|\s)(?:npx\s+)?(?:tsx|ts-node)(?:\.cmd)?\s+(?:\.?[\\/])?scripts[\\/]/iu;
  const findings = [];
  const roots = ['.codex', '.cursor', '.claude', '.agents']
    .map((relative) => path.join(consumerRoot, relative))
    .filter((fullPath) => fs.existsSync(fullPath));
  const scannedFiles = roots
    .flatMap((root) => allFiles(root))
    .filter((filePath) => isGeneratedSurfaceFile(consumerRoot, filePath));
  for (const filePath of scannedFiles) {
    const text = fs.readFileSync(filePath, 'utf8');
    const relativePath = slash(path.relative(consumerRoot, filePath));
    if (rootScriptPattern.test(text)) findings.push(`${relativePath}: covered root script path`);
    if (/runRepoScript\s*\(/u.test(text)) findings.push(`${relativePath}: runRepoScript`);
    if (callLikeTypeScriptRunner.test(text)) findings.push(`${relativePath}: TypeScript runner call`);
    if (/compiled[\\/]main-agent-orchestration\.cjs/iu.test(text)) findings.push(`${relativePath}: compiled fallback`);
  }
  return {
    scannedRoots: roots.map((root) => slash(path.relative(consumerRoot, root))),
    scannedFiles: scannedFiles.map((filePath) => slash(path.relative(consumerRoot, filePath))),
    findings,
  };
}

function validateGeneratedInitSurface(consumerRoot, packagePath, allEntries) {
  const installedBmadPath = path.join(packagePath, '_bmad');
  if (!fs.existsSync(installedBmadPath)) {
    throw new Error('init-sync-consumer install did not expose package-local _bmad install surface');
  }
  const { probePath, logPath } = ensureRuntimeProbe(consumerRoot, allEntries);
  const initResult = expectSuccess(
    runProcess(
      npxCmd,
      [
        '--no-install',
        'bmad-speckit',
        'init',
        '.',
        '--ai',
        'codex',
        '--yes',
        '--force',
        '--no-git',
        '--bmad-path',
        installedBmadPath,
      ],
      consumerRoot,
      {
        BMAD_P1_P4_RUNTIME_PROBE_LOG: logPath,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''}--require=${probePath}`,
      }
    )
  );
  const flags = readProbeFlags(logPath);
  if (flags.usedRootScript || flags.usedTsx || flags.usedTsNode || flags.usedCompiledFallback) {
    throw new Error(`forbidden init-sync-consumer probe hit: ${JSON.stringify(flags.probeHits, null, 2)}`);
  }
  const scan = scanGeneratedSurfaces(consumerRoot, allEntries);
  if (scan.findings.length > 0) {
    throw new Error(`generated install surface findings: ${JSON.stringify(scan.findings, null, 2)}`);
  }
  return {
    initCommand: commandRow('init-sync-consumer', initResult, {
      usedRootScript: flags.usedRootScript,
      usedTsx: flags.usedTsx,
      usedTsNode: flags.usedTsNode,
      usedCompiledFallback: flags.usedCompiledFallback,
      probeHits: flags.probeHits,
    }),
    generatedSurfaceScan: scan,
  };
}

function writeReceipt(receipt) {
  fs.mkdirSync(INSTALL_MATRIX_DIR, { recursive: true });
  const filePath = path.join(INSTALL_MATRIX_DIR, `${receipt.installMode}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return filePath;
}

function withConsumer(name, callback) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  try {
    writeConsumerPackageJson(target, name);
    return callback(target);
  } finally {
    safeRm(target, [os.tmpdir()]);
  }
}

function validatePackedHelperFiles(packFiles, helpers) {
  const missing = [];
  for (const helper of helpers) {
    const dist = helperRelPath(helper);
    if (!packFiles.includes(dist)) missing.push(dist);
  }
  if (!packFiles.includes('dist/main-agent/helpers/durable-helper-report.js')) {
    missing.push('dist/main-agent/helpers/durable-helper-report.js');
  }
  return missing;
}

function validatePackedRuntimeFiles(packFiles, runtimeEntries) {
  const missing = [];
  for (const entry of runtimeEntries) {
    const action = actionSlug(entry);
    const dist = `dist/main-agent/actions/${action}.js`;
    if (!packFiles.includes(dist)) missing.push(dist);
  }
  for (const required of [
    'dist/main-agent/index.js',
    'dist/main-agent/runtime.js',
    'dist/main-agent/actions/package-runtime-report.js',
  ]) {
    if (!packFiles.includes(required)) missing.push(required);
  }
  return missing;
}

function runMode(mode, packageInfo, runtimeEntries, helperEntries, allEntries) {
  return withConsumer(`main-agent-p1-p4-${mode}`, (consumerRoot) => {
    installTarball(mode, packageInfo.tarball, consumerRoot);
    const packagePath = mode === 'npx-package' ? null : resolveInstalledPackageRuntime(consumerRoot);
    if (mode !== 'npx-package' && !packagePath) {
      throw new Error(`${mode} install did not expose bmad-speckit dist runtime`);
    }

    let initCommand = null;
    let generatedSurfaceScan = { scannedRoots: [], scannedFiles: [], findings: [] };
    if (mode === 'init-sync-consumer') {
      const initEvidence = validateGeneratedInitSurface(consumerRoot, packagePath, allEntries);
      initCommand = initEvidence.initCommand;
      generatedSurfaceScan = initEvidence.generatedSurfaceScan;
    }

    const packedRuntimeMissing = validatePackedRuntimeFiles(packageInfo.packFiles, runtimeEntries);
    if (packedRuntimeMissing.length > 0) {
      throw new Error(`package tarball missing runtime files: ${packedRuntimeMissing.join(', ')}`);
    }

    const runtimeEntriesToExecute = mode === 'npx-package' ? runtimeEntries.slice(0, 1) : runtimeEntries;
    const commands = runtimeEntriesToExecute.map((entry) =>
      runObservedAction(mode === 'init-sync-consumer' ? 'save-dev' : mode, packageInfo.tarball, entry, consumerRoot, allEntries)
    );
    const helperCommands =
      mode === 'npx-package'
        ? []
        : helperEntries.map((entry) => runObservedHelper(mode, entry, packagePath, consumerRoot, allEntries));
    const packedHelperMissing = validatePackedHelperFiles(packageInfo.packFiles, helperEntries);
    if (packedHelperMissing.length > 0) {
      throw new Error(`package tarball missing helper files: ${packedHelperMissing.join(', ')}`);
    }
    const allCommands = initCommand ? [initCommand, ...commands, ...helperCommands] : [...commands, ...helperCommands];
    const flags = aggregateFlags(allCommands);
    const receipt = {
      schemaVersion: 'main-agent-p1-p4-install-matrix/v1',
      contractPath: CONTRACT_PATH,
      installMode: mode,
      packageSpec: slash(packageInfo.tarball),
      packagePath: packagePath ? slash(packagePath) : 'transient-npx-package',
      consumerRoot: slash(consumerRoot),
      runtimeActionCount: runtimeEntries.length,
      runtimeActionCommandCount: commands.length,
      runtimeActionCoverage:
        mode === 'npx-package'
          ? 'tarball_file_manifest_plus_representative_cli_probe'
          : 'all_runtime_actions_executed',
      durableHelperCount: helperEntries.length,
      durableHelperCoverage:
        mode === 'npx-package' ? 'tarball_file_manifest' : 'all_durable_helpers_required_from_installed_package',
      p3DeterministicExclusionCount: allEntries.filter((entry) =>
        ['repo_internal_reclassify', 'deprecated_no_migration'].includes(entry.migrationStrategy)
      ).length,
      commandCount: allCommands.length,
      ...flags,
      usedRootScript: false,
      usedTsx: false,
      usedTsNode: false,
      usedCompiledFallback: false,
      generatedSurfaceScan,
      packedRuntimeMissing,
      packedHelperMissing,
      commands: allCommands,
      result:
        flags.usedRootScript ||
        flags.usedTsx ||
        flags.usedTsNode ||
        flags.usedCompiledFallback ||
        generatedSurfaceScan.findings.length > 0 ||
        packedHelperMissing.length > 0
          ? 'failed'
          : 'passed',
    };
    const receiptPath = writeReceipt(receipt);
    return slash(path.relative(ROOT, receiptPath));
  });
}

function main() {
  const errors = [];
  const receipts = [];
  const commandRows = [];
  let packageInfo = null;
  let allEntries = [];
  try {
    allEntries = entriesForWaves();
    const runtimeEntries = allEntries.filter((entry) => entry.migrationStrategy === 'package_runtime_module');
    const helperEntries = allEntries.filter((entry) => entry.migrationStrategy === 'durable_helper_copy');
    if (runtimeEntries.length !== 51) throw new Error(`runtime action count expected 51 but got ${runtimeEntries.length}`);
    if (helperEntries.length !== 14) throw new Error(`durable helper count expected 14 but got ${helperEntries.length}`);
    safeRm(INSTALL_MATRIX_DIR, [EVIDENCE_DIR]);
    fs.mkdirSync(INSTALL_MATRIX_DIR, { recursive: true });
    packageInfo = prepareTarball(commandRows);
    for (const mode of INSTALL_MODES) {
      receipts.push(runMode(mode, packageInfo, runtimeEntries, helperEntries, allEntries));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    safeRm(npmCacheDir, [os.tmpdir()]);
  }

  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    contractPath: CONTRACT_PATH,
    registryPath: REGISTRY_PATH,
    waveIds: WAVE_IDS,
    installModes: INSTALL_MODES,
    packageTarball: packageInfo ? slash(path.relative(ROOT, packageInfo.tarball)) : null,
    runtimeActionCount: allEntries.filter((entry) => entry.migrationStrategy === 'package_runtime_module').length,
    durableHelperCount: allEntries.filter((entry) => entry.migrationStrategy === 'durable_helper_copy').length,
    receipts,
    commandRows,
    usedRootScript: false,
    usedTsx: false,
    usedTsNode: false,
    usedCompiledFallback: false,
    scopeStatement:
      'This matrix covers P1-P3 package runtime actions and P4 package-local durable helper surfaces; it does not claim every root script is directly consumer-callable.',
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (errors.length > 0) process.exit(1);
}

main();
