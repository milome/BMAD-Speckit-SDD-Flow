#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT_PATH = 'docs/plans/2026-06-27-root-scripts-ts-hard-cut-goal-execution-plan.md';
const COVERAGE_RECEIPT_PATH = 'docs/plans/2026-06-27-root-scripts-ts-hard-cut-coverage-receipt.json';
const GENERATION_RECEIPT_PATH = 'docs/plans/2026-06-27-root-scripts-ts-hard-cut-generation-receipt.json';
const ROOT_TS_REF = /(?:^|['"`\s(:,[{])scripts[\\/][^'"`\s),\]}]+\.ts\b/g;
const EXEC_TOKENS = /\b(ts-node|tsx|node\s+--loader|node\s+--import|npm\s+exec|npx\s+ts-node|npx\s+tsx)\b/;
const IGNORED_SCAN_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', '.runtime-mcp']);
let rootTsRefSetCache = null;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--')) {
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
  const absoluteDir = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(absoluteDir)) return out;
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (IGNORED_SCAN_DIRS.has(entry.name)) continue;
    const absolute = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) walkFiles(repoRelative(absolute), predicate, out);
    else if (predicate(absolute)) out.push(absolute);
  }
  return out;
}

function readText(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function maybeReadJson(relativePath) {
  const absolute = path.join(REPO_ROOT, relativePath);
  return fs.existsSync(absolute) ? JSON.parse(fs.readFileSync(absolute, 'utf8')) : null;
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
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    exitCode: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function rootTsFilesystemPaths() {
  return walkFiles('scripts', (absolute) => absolute.endsWith('.ts')).map(repoRelative).sort();
}

function rootTsTrackedPaths() {
  return gitLines(['ls-files', 'scripts/**/*.ts']).sort();
}

function currentRootTsRefSet() {
  if (!rootTsRefSetCache) {
    rootTsRefSetCache = new Set([...rootTsFilesystemPaths(), ...rootTsTrackedPaths()]);
  }
  return rootTsRefSetCache;
}

function lineFindings(relativePath, matcher) {
  if (!fs.existsSync(path.join(REPO_ROOT, relativePath))) return [];
  return readText(relativePath)
    .split(/\r?\n/)
    .flatMap((line, index) => (matcher(line) ? [{ path: relativePath, line: index + 1, text: line.trim() }] : []));
}

function rootScriptRefsInText(line) {
  ROOT_TS_REF.lastIndex = 0;
  const currentRootRefs = currentRootTsRefSet();
  return [...line.matchAll(ROOT_TS_REF)]
    .map((match) => match[0].replace(/^['"`\s(:,[{]+/, '').replace(/\\/g, '/'))
    .filter((ref) => ref.includes('*') || currentRootRefs.has(ref));
}

function textFilesUnder(dirs) {
  const extensions = new Set([
    '.cjs',
    '.js',
    '.json',
    '.md',
    '.mjs',
    '.ps1',
    '.sh',
    '.ts',
    '.tsx',
    '.txt',
    '.yaml',
    '.yml',
  ]);
  return dirs.flatMap((dir) =>
    walkFiles(dir, (absolute) => {
      const rel = repoRelative(absolute);
      if (rel.includes('/node_modules/') || rel.includes('/dist/')) return false;
      return extensions.has(path.extname(absolute));
    }).map(repoRelative)
  );
}

function scanFiles(files, options = {}) {
  const findings = [];
  const allowHistorical = options.allowHistorical === true;
  for (const file of files) {
    const absolute = path.join(REPO_ROOT, file);
    if (!fs.existsSync(absolute)) continue;
    const text = fs.readFileSync(absolute, 'utf8');
    text.split(/\r?\n/).forEach((line, index) => {
      const refs = rootScriptRefsInText(line);
      const relativeRefs = importTargets(line, file);
      if (refs.length === 0 && relativeRefs.length === 0) return;
      if (allowHistorical && isHistoricalEvidencePath(file)) return;
      findings.push({
        path: file,
        line: index + 1,
        refs: [...new Set([...refs, ...relativeRefs])],
        relativeRefs,
        hasExecutionToken: EXEC_TOKENS.test(line),
        text: line.trim().slice(0, 500),
      });
    });
  }
  return findings;
}

function isHistoricalEvidencePath(file) {
  const normalized = file.replace(/\\/g, '/');
  return (
    normalized.startsWith('repo-governance/script-migrations/') ||
    normalized.includes('/trace-execution/') ||
    normalized.includes('/fixtures/requirements/')
  );
}

function failIfFindings(payload, countKey, findings) {
  return {
    ...payload,
    [countKey]: findings.length,
    findings,
    status: findings.length === 0 ? 'pass' : 'fail',
  };
}

function checkValidatorSelf() {
  const files = [
    'tools/script-migration/root-ts-hard-cut-inventory.cjs',
    'tools/script-migration/root-ts-hard-cut-guard.cjs',
  ];
  const findings = [];
  const executableRootScriptRef =
    /\b(?:require|import|spawnSync|execFileSync|execSync)\s*\([^)]*['"]scripts[\\/][^'"]+\.ts['"]/;
  const commandRootScriptRef =
    /\b(?:node|tsx|ts-node|npm\s+exec|npx)\b[^`'"\r\n]*scripts[\\/][^\s`'"]+\.ts\b/;
  for (const file of files) {
    const text = readText(file);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (executableRootScriptRef.test(line) || commandRootScriptRef.test(line)) {
        findings.push({ path: file, line: index + 1, text: line.trim() });
      }
    });
  }
  return failIfFindings(
    {
      check: 'validator-self-check',
      validatorFiles: files,
      proves: 'validators do not import, require, dynamically import, transpile, or execute root scripts/**/*.ts',
    },
    'validatorSelfFindingCount',
    findings
  );
}

function checkRootInventoryZero() {
  const filesystem = rootTsFilesystemPaths();
  const tracked = rootTsTrackedPaths();
  return {
    check: 'root-inventory-zero',
    status: filesystem.length === 0 && tracked.length === 0 ? 'pass' : 'fail',
    filesystemCount: filesystem.length,
    trackedCount: tracked.length,
    filesystem,
    tracked,
  };
}

function checkPackageJsonNoRootTs() {
  const pkg = readJson('package.json');
  const findings = [];
  for (const [name, command] of Object.entries(pkg.scripts || {})) {
    const refs = rootScriptRefsInText(command);
    const hasRootScriptGlob = /scripts[\\/]\*\*?[\\/]\*\.ts|scripts[\\/]\*\*?[\\/]\*\.tsx/.test(command);
    const hasExecution = EXEC_TOKENS.test(command) || refs.length > 0;
    const executesRootScript = refs.length > 0 && hasExecution;
    if (refs.length > 0 || hasRootScriptGlob || executesRootScript) {
      findings.push({ script: name, command, refs, hasRootScriptGlob, hasExecution });
    }
  }
  return {
    check: 'package-json-no-root-ts',
    status: findings.length === 0 ? 'pass' : 'fail',
    packageJsonRootTsCommandCount: findings.filter((finding) => finding.refs.length > 0 || finding.hasExecution).length,
    packageJsonRootTsGlobCount: findings.filter((finding) => finding.hasRootScriptGlob).length,
    findings,
  };
}

function checkWorkflowsNoRootTs() {
  const files = textFilesUnder(['.github/workflows']);
  const findings = scanFiles(files);
  return failIfFindings({ check: 'workflows-no-root-ts' }, 'workflowRootTsFindingCount', findings);
}

function checkSurfacesNoRootTsAuthority() {
  const files = textFilesUnder(['_bmad', '.codex', '.claude', '.cursor']);
  const findings = scanFiles(files).filter((finding) => {
    if (finding.path.includes('/skills/') && finding.path.includes('/scripts/')) return false;
    if (finding.refs.length === 0) return false;
    return true;
  });
  return failIfFindings({ check: 'surfaces-no-root-ts-authority' }, 'surfaceRootTsAuthorityCount', findings);
}

function checkTestsNoRootTsAuthority() {
  const files = textFilesUnder(['tests', 'packages']);
  const findings = scanFiles(files, { allowHistorical: true }).filter((finding) => {
    if (!finding.path.includes('/tests/') && !finding.path.startsWith('tests/')) return false;
    if (finding.path.includes('/fixtures/requirements/')) return false;
    return finding.refs.length > 0 || finding.hasExecutionToken;
  });
  return failIfFindings({ check: 'tests-no-root-ts-authority' }, 'testRootTsAuthorityCount', findings);
}

function checkPackagesNoRootTsBridge() {
  const files = textFilesUnder([
    'packages/bmad-speckit/src',
    'packages/bmad-speckit/bin',
    'packages/bmad-speckit/scripts',
    'packages/runtime-emit',
    'packages/runtime-context',
    'packages/scoring',
    'packages/ralph-method',
    'packages/schema',
  ]).filter((file) => {
    if (file.includes('/tests/') || file.includes('/__tests__/')) return false;
    if (file.includes('/dist/') || file.includes('/docs/')) return false;
    if (/\bREADME\.md$/i.test(file)) return false;
    return true;
  });
  const findings = scanFiles(files).filter((finding) => {
    const text = finding.text.trim();
    if (text.startsWith('*') || text.startsWith('//') || text.startsWith('/*')) return false;
    if (/Ported from /u.test(text)) return false;
    if (/^(console\.(error|log|warn)\(|throw new Error\(|return `?Usage:|['"`]Usage:|['"`]示例：)/u.test(text)) {
      return false;
    }
    if (/\b(does not require|must not require|not require)\b.*scripts[\\/][^'"`\s),\]}]+\.ts\b/iu.test(text)) {
      return false;
    }
    if (/^const originalSource = /u.test(text)) return false;
    return finding.refs.length > 0;
  });
  return failIfFindings({ check: 'packages-no-root-ts-bridge' }, 'packageRootTsBridgeCount', findings);
}

function importTargets(line, importer) {
  const targets = [];
  const importRe = /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  for (const match of line.matchAll(importRe)) {
    const spec = match[1] || match[2] || match[3];
    if (!spec || !spec.startsWith('.')) continue;
    const base = path.dirname(path.join(REPO_ROOT, importer));
    const resolvedBase = path.resolve(base, spec);
    const resolvedRel = repoRelative(resolvedBase);
    if (resolvedRel.startsWith('scripts/')) {
      const ext = path.extname(resolvedRel);
      if (ext === '.ts') {
        targets.push(resolvedRel);
        continue;
      }
      if (ext === '') {
        targets.push(`${resolvedRel}.ts`);
        continue;
      }
    }
    const candidates = [resolvedBase, `${resolvedBase}.ts`, path.join(resolvedBase, 'index.ts')];
    const target = candidates.find((candidate) => fs.existsSync(candidate));
    if (target && repoRelative(target).startsWith('scripts/') && target.endsWith('.ts')) {
      targets.push(repoRelative(target));
    }
  }
  return targets;
}

function checkRootInternalGraphZero() {
  const activeExternal = new Set();
  for (const result of [
    checkPackageJsonNoRootTs(),
    checkWorkflowsNoRootTs(),
    checkSurfacesNoRootTsAuthority(),
    checkTestsNoRootTsAuthority(),
    checkPackagesNoRootTsBridge(),
  ]) {
    for (const finding of result.findings || []) {
      for (const ref of finding.refs || []) activeExternal.add(ref);
    }
  }

  if (activeExternal.size === 0) {
    return {
      check: 'root-internal-graph-zero',
      status: 'pass',
      rootInternalEdgeCount: 0,
      activeExternalRootTsRefCount: 0,
      edges: [],
    };
  }

  const rootFiles = rootTsFilesystemPaths();
  const edges = [];
  for (const file of rootFiles) {
    if (!activeExternal.has(file)) continue;
    const text = readText(file);
    text.split(/\r?\n/).forEach((line, index) => {
      for (const target of importTargets(line, file)) {
        edges.push({ importer: file, target, line: index + 1 });
      }
    });
  }
  return {
    check: 'root-internal-graph-zero',
    status: edges.length === 0 ? 'pass' : 'fail',
    rootInternalEdgeCount: edges.length,
    activeExternalRootTsRefCount: activeExternal.size,
    edges,
  };
}

function checkRegistryDisposition(args) {
  const manifest = args.manifest ? maybeReadJson(args.manifest) : null;
  const rows = manifest?.rows || [];
  const findings = [];
  for (const row of rows) {
    if (row.deletionAllowedAfterGates) continue;
    if (row.disposition && /docs_only|governance_only|deprecated/.test(row.disposition)) continue;
    findings.push({
      scriptPath: row.scriptPath,
      disposition: row.disposition || null,
      reason: 'manifest row lacks package source equivalent or terminal disposition',
    });
  }
  return {
    check: 'registry-disposition',
    status: findings.length === 0 ? 'pass' : 'fail',
    registryDispositionStatus: findings.length === 0 ? 'pass' : 'fail',
    findingCount: findings.length,
    findings,
  };
}

function checkParityAndInstallMatrix(args) {
  const manifest = args.manifest ? maybeReadJson(args.manifest) : null;
  const parityPath = 'repo-governance/script-migrations/root-ts-hard-cut/package-source-parity-evidence.json';
  const installPath = 'repo-governance/script-migrations/root-ts-hard-cut/install-matrix.json';
  const distPath = 'repo-governance/script-migrations/root-ts-hard-cut/dist-runtime-evidence.json';
  const parity = maybeReadJson(parityPath);
  const install = maybeReadJson(installPath);
  const dist = maybeReadJson(distPath);
  const findings = [];
  if (!manifest) findings.push({ path: args.manifest || null, reason: 'manifest missing' });
  if (!parity || parity.parityStatus !== 'pass') findings.push({ path: parityPath, reason: 'parityStatus is not pass' });
  if (!install || install.installMatrixStatus !== 'pass') findings.push({ path: installPath, reason: 'installMatrixStatus is not pass' });
  if (!install || install.installMatrixRequiredCommandsStatus !== 'pass') findings.push({ path: installPath, reason: 'installMatrixRequiredCommandsStatus is not pass' });
  if (!install || install.historicalEvidenceExclusionStatus !== 'pass') findings.push({ path: installPath, reason: 'historicalEvidenceExclusionStatus is not pass' });
  if (!dist || dist.distRuntimeStatus !== 'pass') findings.push({ path: distPath, reason: 'distRuntimeStatus is not pass' });
  return {
    check: 'parity-and-install-matrix',
    status: findings.length === 0 ? 'pass' : 'fail',
    parityStatus: parity?.parityStatus || 'missing',
    installMatrixStatus: install?.installMatrixStatus || 'missing',
    installMatrixRequiredCommandsStatus: install?.installMatrixRequiredCommandsStatus || 'missing',
    historicalEvidenceExclusionStatus: install?.historicalEvidenceExclusionStatus || 'missing',
    distRuntimeStatus: dist?.distRuntimeStatus || 'missing',
    findings,
  };
}

function checkCompletionEvidence(args) {
  const evidencePath = args.evidence || 'repo-governance/script-migrations/root-ts-hard-cut/completion-evidence.json';
  const evidence = maybeReadJson(evidencePath);
  const findings = [];
  if (!evidence) {
    return {
      check: 'completion-evidence',
      status: 'fail',
      findings: [{ path: evidencePath, reason: 'completion evidence missing' }],
    };
  }

  const requiredZero = [
    'rootScriptsTsFinalCount',
    'trackedRootScriptsTsFinalCount',
    'packageJsonRootTsCommandCount',
    'workflowRootTsFindingCount',
    'surfaceRootTsAuthorityCount',
    'testRootTsAuthorityCount',
    'packageRootTsBridgeCount',
    'rootInternalEdgeCount',
  ];
  for (const key of requiredZero) {
    if (evidence[key] !== 0) findings.push({ field: key, actual: evidence[key], expected: 0 });
  }
  const requiredPass = [
    'registryDispositionStatus',
    'parityStatus',
    'installMatrixStatus',
    'installMatrixRequiredCommandsStatus',
    'historicalEvidenceExclusionStatus',
  ];
  for (const key of requiredPass) {
    if (evidence[key] !== 'pass') findings.push({ field: key, actual: evidence[key], expected: 'pass' });
  }
  if (evidence.goalContractHash !== sha256Rel(CONTRACT_PATH)) {
    findings.push({ field: 'goalContractHash', actual: evidence.goalContractHash, expected: sha256Rel(CONTRACT_PATH) });
  }
  if (evidence.generationReceiptGoalContractHash !== evidence.goalContractHash) {
    findings.push({
      field: 'generationReceiptGoalContractHash',
      actual: evidence.generationReceiptGoalContractHash,
      expected: evidence.goalContractHash,
    });
  }
  if (!Array.isArray(evidence.commandResults) || !hasCommandRange(evidence.commandResults, 0, 19)) {
    findings.push({ field: 'commandResults', reason: 'must contain CMD000 through CMD019' });
  }
  if (evidence.evidencePhase === 'pre_commit_local_validation') {
    if (evidence.localPreCommitStatus !== 'pass') findings.push({ field: 'localPreCommitStatus', expected: 'pass' });
  } else if (evidence.evidencePhase === 'post_implementation_commit_pre_ci') {
    if (evidence.localPendingCiStatus !== 'pass') findings.push({ field: 'localPendingCiStatus', expected: 'pass' });
    if (evidence.ciRunPending !== true) findings.push({ field: 'ciRunPending', expected: true });
  } else if (evidence.evidencePhase === 'post_ci_final') {
    if (evidence.completionEvidenceStatus !== 'pass') findings.push({ field: 'completionEvidenceStatus', expected: 'pass' });
    if (evidence.ciRunPending !== false) findings.push({ field: 'ciRunPending', expected: false });
    if (!evidence.ciRun || evidence.ciRun.workflowName !== 'CI' || evidence.ciRun.conclusion !== 'success') {
      findings.push({ field: 'ciRun', reason: 'CI run must be bound and successful' });
    }
  } else {
    findings.push({ field: 'evidencePhase', actual: evidence.evidencePhase });
  }

  return {
    check: 'completion-evidence',
    status: findings.length === 0 ? 'pass' : 'fail',
    localPreCommitStatus: evidence.evidencePhase === 'pre_commit_local_validation' && findings.length === 0 ? 'pass' : undefined,
    localPendingCiStatus:
      evidence.evidencePhase === 'post_implementation_commit_pre_ci' && findings.length === 0 ? 'pass' : undefined,
    completionEvidenceStatus: evidence.evidencePhase === 'post_ci_final' && findings.length === 0 ? 'pass' : undefined,
    evidencePhase: evidence.evidencePhase,
    implementationCommitSha: evidence.implementationCommitSha || null,
    ciRunPending: evidence.ciRunPending,
    findings,
  };
}

function hasCommandRange(commandResults, start, end) {
  const ids = new Set(commandResults.map((row) => row.id || row.commandId));
  for (let index = start; index <= end; index += 1) {
    if (!ids.has(`CMD${String(index).padStart(3, '0')}`)) return false;
  }
  return true;
}

function sha256Rel(relativePath) {
  const crypto = require('crypto');
  return `sha256:${crypto.createHash('sha256').update(readText(relativePath)).digest('hex')}`;
}

function checkContractReceipts() {
  const generation = readJson(GENERATION_RECEIPT_PATH);
  const coverage = readJson(COVERAGE_RECEIPT_PATH);
  const goalContractHash = sha256Rel(CONTRACT_PATH);
  const findings = [];
  if (generation.goalContractHash !== goalContractHash) {
    findings.push({
      path: GENERATION_RECEIPT_PATH,
      field: 'goalContractHash',
      actual: generation.goalContractHash,
      expected: goalContractHash,
    });
  }
  if (coverage.unmappedSourceObligations !== 0) {
    findings.push({
      path: COVERAGE_RECEIPT_PATH,
      field: 'unmappedSourceObligations',
      actual: coverage.unmappedSourceObligations,
      expected: 0,
    });
  }
  return {
    check: 'contract-receipts',
    status: findings.length === 0 ? 'pass' : 'fail',
    goalContractHash,
    generationReceiptGoalContractHash: generation.goalContractHash,
    coverageUnmappedSourceObligations: coverage.unmappedSourceObligations,
    findings,
  };
}

function checkEncodingGate() {
  const result = commandOutput('node', ['_bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js']);
  const findingsMatch = result.stdout.match(/findings=(\d+)/);
  const findings = findingsMatch ? Number(findingsMatch[1]) : null;
  return {
    check: 'encoding-gate',
    status: result.exitCode === 0 && findings === 0 ? 'pass' : 'fail',
    exitCode: result.exitCode,
    findings,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function runCheck(args) {
  switch (args.check) {
    case 'validator-self-check':
      return checkValidatorSelf(args);
    case 'root-inventory-zero':
      return checkRootInventoryZero(args);
    case 'package-json-no-root-ts':
      return checkPackageJsonNoRootTs(args);
    case 'workflows-no-root-ts':
      return checkWorkflowsNoRootTs(args);
    case 'surfaces-no-root-ts-authority':
      return checkSurfacesNoRootTsAuthority(args);
    case 'tests-no-root-ts-authority':
      return checkTestsNoRootTsAuthority(args);
    case 'packages-no-root-ts-bridge':
      return checkPackagesNoRootTsBridge(args);
    case 'root-internal-graph-zero':
      return checkRootInternalGraphZero(args);
    case 'registry-disposition':
      return checkRegistryDisposition(args);
    case 'parity-and-install-matrix':
      return checkParityAndInstallMatrix(args);
    case 'completion-evidence':
      return checkCompletionEvidence(args);
    case 'contract-receipts':
      return checkContractReceipts(args);
    case 'encoding-gate':
      return checkEncodingGate(args);
    case 'all-local-gates':
      return {
        check: 'all-local-gates',
        results: [
          checkRootInventoryZero(args),
          checkPackageJsonNoRootTs(args),
          checkWorkflowsNoRootTs(args),
          checkSurfacesNoRootTsAuthority(args),
          checkTestsNoRootTsAuthority(args),
          checkPackagesNoRootTsBridge(args),
          checkRootInternalGraphZero(args),
          checkRegistryDisposition(args),
          checkParityAndInstallMatrix(args),
          checkEncodingGate(args),
        ],
      };
    default:
      return {
        check: args.check || null,
        status: 'fail',
        findings: [{ reason: `Unknown check: ${args.check || '<missing>'}` }],
      };
  }
}

function deriveStatus(payload) {
  if (payload.status) return payload.status;
  if (Array.isArray(payload.results)) {
    return payload.results.every((result) => result.status === 'pass') ? 'pass' : 'fail';
  }
  return 'fail';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = runCheck(args);
  const status = deriveStatus(payload);
  const output = { status, ...payload };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (status !== 'pass') process.exitCode = 1;
}

main();
