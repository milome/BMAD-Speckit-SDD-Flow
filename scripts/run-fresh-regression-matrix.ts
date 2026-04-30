/**
 * Fresh consumer worktree regression matrix (Story E14-S1).
 * SSOT: docs/plans/FRESH_INSTALL_REGRESSION_STORY_E14_S1.md section 3,
 * docs/plans/PRODUCTION_INTEGRATION_SDDA_T1_T10_2026-03-20.md section 0 rows 2-3.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

/** Vitest files aligned with FRESH section 3 row 7 and PRODUCTION section 0 row 3 */
export const GOVERNANCE_VITEST_FILES = [
  'tests/acceptance/bmad-config.test.ts',
  'tests/acceptance/runtime-governance-matrix.test.ts',
  'tests/acceptance/runtime-governance.test.ts',
  'tests/acceptance/runtime-governance-policy.test.ts',
  'tests/acceptance/runtime-governance-scoring-chain.test.ts',
  'tests/acceptance/runtime-governance-mandatory-granularity.test.ts',
] as const;

const RUNTIME_LAYER4_FILES = [
  'tests/acceptance/accept-runtime.test.ts',
  'tests/acceptance/accept-layer4-e2e.test.ts',
] as const;

function walkForAuditMd(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) {
    return;
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkForAuditMd(p, out);
    } else if (/^AUDIT.*\.md$/i.test(ent.name)) {
      out.push(p);
    }
  }
}

function hasScoringDataFiles(freshRoot: string): boolean {
  const dirs = [
    path.join(freshRoot, 'packages', 'scoring', 'data'),
    path.join(freshRoot, '_bmad-output', 'scoring'),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      continue;
    }
    let files: string[];
    try {
      files = fs.readdirSync(d);
    } catch {
      continue;
    }
    for (const f of files) {
      if (f.endsWith('.json') || f === 'scores.jsonl') {
        return true;
      }
    }
  }
  return false;
}

/**
 * True when real `sft-extract` should run (AUDIT reports under _bmad-output or scoring storage files).
 * @param {string} freshRoot - Consumer worktree root
 * @returns {boolean} Whether to invoke real sft-extract
 */
export function shouldRunRealSftExtract(freshRoot: string): boolean {
  const auditFiles: string[] = [];
  walkForAuditMd(path.join(freshRoot, '_bmad-output'), auditFiles);
  if (auditFiles.length > 0) {
    return true;
  }
  return hasScoringDataFiles(freshRoot);
}

export function resolveFreshRegressionRoot(repoRoot: string): string {
  const env = process.env.FRESH_REGRESSION_ROOT;
  if (env != null && env.trim() !== '') {
    return path.resolve(env.trim());
  }
  const resolvedRepoRoot = path.resolve(repoRoot);
  const parentDirName = path.basename(path.dirname(resolvedRepoRoot));
  const projectRoot =
    parentDirName === '.worktrees' || parentDirName === 'worktrees'
      ? path.dirname(path.dirname(resolvedRepoRoot))
      : resolvedRepoRoot;
  return path.join(projectRoot, '..', 'BMAD-Speckit-SDD-Flow-01-fresh-regression');
}

export function validateFreshRoot(freshRoot: string): { ok: true } | { ok: false; reason: string } {
  if (!fs.existsSync(freshRoot)) {
    return { ok: false, reason: 'fresh root does not exist' };
  }
  const pkgPath = path.join(freshRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { ok: false, reason: 'package.json missing' };
  }
  try {
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { name?: string };
    if (typeof pkg?.name !== 'string' || pkg.name.length === 0) {
      return { ok: false, reason: 'package.json missing valid name' };
    }
  } catch {
    return { ok: false, reason: 'package.json not readable JSON' };
  }
  return { ok: true };
}

function readPackageScripts(freshRoot: string): Record<string, string> {
  const pkgPath = path.join(freshRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
  return pkg.scripts ?? {};
}

function runCmd(cwd: string, command: string, args: string[], log: string[]): number {
  log.push(`$ ${command} ${args.join(' ')}`);
  const r = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true, env: process.env });
  const code = r.status === null ? 1 : r.status;
  log.push(code === 0 ? 'OK' : `FAIL exit=${code}`);
  return code;
}

function runNpmScript(cwd: string, script: string, log: string[]): number {
  return runCmd(cwd, 'npm', ['run', script], log);
}

export function runOptionalNpmScript(
  cwd: string,
  scripts: Record<string, string>,
  script: string,
  log: string[]
): number {
  if (!scripts[script]) {
    log.push(`SKIP: ${script} missing; treat as OK`);
    return 0;
  }
  return runNpmScript(cwd, script, log);
}

function appendSummary(repoRoot: string, lines: string[]): void {
  const outDir = path.join(
    repoRoot,
    '_bmad-output',
    'implementation-artifacts',
    'epic-14-runtimegovanceValidator',
    'story-14-1-runtimegovanceValidator'
  );
  fs.mkdirSync(outDir, { recursive: true });
  const p = path.join(outDir, 'fresh-regression-last-run.txt');
  fs.appendFileSync(p, `${lines.join('\n')}\n`, 'utf8');
}

export function resolveHostMatrixGateMode(
  scripts: Record<string, string>
): 'host_matrix_script' | 'claude_cursor_script' | 'dual_script' | 'legacy_split' | 'invalid' {
  if (scripts['test:ci:host-matrix']) {
    return 'host_matrix_script';
  }
  if (scripts['test:ci:claude-cursor']) {
    return 'claude_cursor_script';
  }
  if (scripts['test:ci:dual']) {
    return 'dual_script';
  }
  if (scripts['test:ci']) {
    return 'legacy_split';
  }
  return 'invalid';
}

export function resolveDualHostGateMode(
  scripts: Record<string, string>
): 'claude_cursor_script' | 'dual_script' | 'legacy_split' | 'invalid' {
  if (scripts['test:ci:claude-cursor']) {
    return 'claude_cursor_script';
  }
  if (scripts['test:ci:dual']) {
    return 'dual_script';
  }
  if (scripts['test:ci']) {
    return 'legacy_split';
  }
  return 'invalid';
}

function runHostMatrixGate(cwd: string, scripts: Record<string, string>, log: string[]): number {
  const mode = resolveHostMatrixGateMode(scripts);

  if (mode === 'host_matrix_script') {
    return runNpmScript(cwd, 'test:ci:host-matrix', log);
  }

  if (mode === 'claude_cursor_script') {
    return runNpmScript(cwd, 'test:ci:claude-cursor', log);
  }

  if (mode === 'dual_script') {
    return runNpmScript(cwd, 'test:ci:dual', log);
  }

  if (mode === 'invalid') {
    log.push('FAIL: test:ci missing while test:ci:host-matrix absent');
    return 1;
  }

  if (scripts['init:cursor']) {
    const c = runNpmScript(cwd, 'test:ci', log);
    if (c !== 0) {
      return c;
    }
    return runNpmScript(cwd, 'init:cursor', log);
  }

  if (scripts['init:claude']) {
    const initClaude = runNpmScript(cwd, 'init:claude', log);
    if (initClaude !== 0) {
      return initClaude;
    }
  }

  const vitest = runCmd(cwd, 'npx', ['vitest', 'run'], log);
  if (vitest !== 0) {
    return vitest;
  }

  const nodeTests = runCmd(
    path.join(cwd, 'packages', 'bmad-speckit'),
    'node',
    ['--test', '--test-concurrency=1', 'tests/'],
    log
  );
  if (nodeTests !== 0) {
    return nodeTests;
  }

  log.push('SKIP: init:cursor missing; legacy split gate treated as single-host compatible');
  return 0;
}

function runCoachSmoke(cwd: string, scripts: Record<string, string>, log: string[]): number {
  const coach = runCmd(cwd, 'npx', ['bmad-speckit', 'coach'], log);
  if (coach === 0) {
    return 0;
  }
  if (!scripts['coach:diagnose']) {
    log.push('FAIL: coach non-zero and coach:diagnose script missing');
    return 1;
  }
  return runNpmScript(cwd, 'coach:diagnose', log);
}

/**
 * Executes the full matrix in the fresh worktree.
 * @returns {number} Process exit code (0 success)
 */
export function runFreshRegressionMatrixMain(): number {
  const repoRoot = path.resolve(__dirname, '..');
  const freshRoot = resolveFreshRegressionRoot(repoRoot);
  const logLines: string[] = [];
  const stamp = new Date().toISOString();
  logLines.push(`=== fresh-regression-matrix ${stamp} ===`);
  logLines.push(`freshRoot=${freshRoot}`);

  const v = validateFreshRoot(freshRoot);
  if (!v.ok) {
    logLines.push(`ABORT: ${v.reason}`);
    appendSummary(repoRoot, logLines);
    console.error(`[fresh-regression] ${v.reason}: ${freshRoot}`);
    return 1;
  }

  const scripts = readPackageScripts(freshRoot);

  const steps: Array<{ label: string; fn: () => number }> = [
    { label: 'build:scoring', fn: () => runNpmScript(freshRoot, 'build:scoring', logLines) },
    {
      label: 'build:runtime-emit',
      fn: () => runOptionalNpmScript(freshRoot, scripts, 'build:runtime-emit', logLines),
    },
    { label: 'host-matrix', fn: () => runHostMatrixGate(freshRoot, scripts, logLines) },
    { label: 'lint', fn: () => runNpmScript(freshRoot, 'lint', logLines) },
    { label: 'test:bmad', fn: () => runNpmScript(freshRoot, 'test:bmad', logLines) },
    { label: 'test:scoring', fn: () => runNpmScript(freshRoot, 'test:scoring', logLines) },
    {
      label: 'vitest i18n',
      fn: () => runCmd(freshRoot, 'npx', ['vitest', 'run', 'tests/i18n'], logLines),
    },
    {
      label: 'vitest runtime+layer4',
      fn: () => runCmd(freshRoot, 'npx', ['vitest', 'run', ...RUNTIME_LAYER4_FILES], logLines),
    },
    {
      label: 'vitest governance bundle',
      fn: () => runCmd(freshRoot, 'npx', ['vitest', 'run', ...GOVERNANCE_VITEST_FILES], logLines),
    },
    {
      label: 'bmad-speckit check',
      fn: () => runCmd(freshRoot, 'npx', ['bmad-speckit', 'check'], logLines),
    },
    {
      label: 'bmad-speckit scores',
      fn: () => runCmd(freshRoot, 'npx', ['bmad-speckit', 'scores'], logLines),
    },
    {
      label: 'bmad-speckit score --help',
      fn: () => runCmd(freshRoot, 'npx', ['bmad-speckit', 'score', '--help'], logLines),
    },
    {
      label: 'bmad-speckit sft-extract --help',
      fn: () => runCmd(freshRoot, 'npx', ['bmad-speckit', 'sft-extract', '--help'], logLines),
    },
    {
      label: 'bmad-speckit runtime-mcp --help',
      fn: () => runCmd(freshRoot, 'npx', ['bmad-speckit', 'runtime-mcp', '--help'], logLines),
    },
    {
      label: 'bmad-speckit dashboard-live --help',
      fn: () => runCmd(freshRoot, 'npx', ['bmad-speckit', 'dashboard-live', '--help'], logLines),
    },
    {
      label: 'bmad-speckit sft-preview --help',
      fn: () => runCmd(freshRoot, 'npx', ['bmad-speckit', 'sft-preview', '--help'], logLines),
    },
    {
      label: 'bmad-speckit sft-bundle --help',
      fn: () => runCmd(freshRoot, 'npx', ['bmad-speckit', 'sft-bundle', '--help'], logLines),
    },
    { label: 'coach smoke', fn: () => runCoachSmoke(freshRoot, scripts, logLines) },
  ];

  let exitCode = 0;
  for (const s of steps) {
    logLines.push(`--- ${s.label} ---`);
    const c = s.fn();
    if (c !== 0) {
      exitCode = c;
      break;
    }
  }

  if (exitCode === 0) {
    logLines.push('--- sft-extract (conditional) ---');
    if (shouldRunRealSftExtract(freshRoot)) {
      const c = runCmd(freshRoot, 'npx', ['bmad-speckit', 'sft-extract'], logLines);
      if (c !== 0) {
        exitCode = c;
      }
    } else {
      logLines.push('SKIP: no AUDIT*.md under _bmad-output and no scoring data files; treat as OK');
    }
  }

  logLines.push(`FINAL_EXIT=${exitCode}`);
  appendSummary(repoRoot, logLines);
  return exitCode;
}

if (require.main === module) {
  process.exitCode = runFreshRegressionMatrixMain();
}

