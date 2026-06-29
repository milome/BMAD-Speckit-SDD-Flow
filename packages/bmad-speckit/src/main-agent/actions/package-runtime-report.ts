const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sourceAuthorityScriptCache = new Map();

function reportTypeFor(action) {
  return `main_agent_${action.replace(/-/g, '_')}_package_runtime`;
}

function reportPathFor(context, action) {
  const raw = context.args.reportPath || context.args.output || '';
  if (raw) return path.isAbsolute(raw) ? raw : path.resolve(context.cwd, raw);
  return path.join(context.cwd, '_bmad-output', 'runtime', 'main-agent', `${action}-report.json`);
}

function maybeWriteReport(context, action, report) {
  if (context.args.writeReport !== 'true' && !context.args.reportPath && !context.args.output) return null;
  const reportPath = reportPathFor(context, action);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function packageRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function sourceAuthorityRoots() {
  const root = packageRoot();
  return [
    path.join(root, 'dist', 'main-agent', 'source-authority', 'scripts'),
    path.join(root, 'src', 'main-agent', 'source-authority', 'scripts'),
  ];
}

function collectFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.js')) out.push(fullPath);
    }
  }
  return out.sort();
}

function actionSourceAuthorityCandidates(action) {
  const normalized = String(action || '').trim();
  return [`${normalized}.js`, `main-agent-${normalized}.js`];
}

function findSourceAuthorityScript(action) {
  const cacheKey = String(action || '');
  if (sourceAuthorityScriptCache.has(cacheKey)) return sourceAuthorityScriptCache.get(cacheKey);
  const candidates = new Set(actionSourceAuthorityCandidates(cacheKey));
  for (const root of sourceAuthorityRoots()) {
    for (const file of collectFiles(root)) {
      if (candidates.has(path.basename(file))) {
        sourceAuthorityScriptCache.set(cacheKey, file);
        return file;
      }
    }
  }
  sourceAuthorityScriptCache.set(cacheKey, null);
  return null;
}

function contextArgsForSourceAuthority(context, action) {
  const rawArgv = Array.isArray(context.rawArgv) ? context.rawArgv.map(String) : [];
  const positionalAction = rawArgv[0] === action ? rawArgv.slice(1) : rawArgv;
  const withoutRuntimeOnlyArgs = [];
  for (let index = 0; index < positionalAction.length; index += 1) {
    const value = positionalAction[index];
    if (value === '--action') {
      index += 1;
      continue;
    }
    if (value.startsWith('--action=')) continue;
    withoutRuntimeOnlyArgs.push(value);
  }
  const hasCwd = withoutRuntimeOnlyArgs.some((value) => value === '--cwd' || value.startsWith('--cwd='));
  return hasCwd ? withoutRuntimeOnlyArgs : [...withoutRuntimeOnlyArgs, '--cwd', context.cwd];
}

function replaySourceAuthorityRuntime(context, action) {
  const runtimePath = findSourceAuthorityScript(action);
  if (!runtimePath) {
    return {
      status: 'missing_source_authority_runtime',
      runtimePath: null,
      exitCode: null,
      stdout: '',
      stderr: `missing package dist source-authority runtime for ${action}`,
      usedRootScript: false,
      usedCompiledFallback: false,
      usedTypeScriptRunner: false,
    };
  }
  const result = spawnSync(process.execPath, [runtimePath, ...contextArgsForSourceAuthority(context, action)], {
    cwd: context.cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    status: result.error ? 'source_authority_runtime_error' : 'source_authority_runtime_replayed',
    runtimePath: path.relative(packageRoot(), runtimePath).replace(/\\/g, '/'),
    exitCode: typeof result.status === 'number' ? result.status : null,
    stdout: result.stdout || '',
    stderr: result.error ? result.error.message : result.stderr || '',
    usedRootScript: false,
    usedCompiledFallback: false,
    usedTypeScriptRunner: false,
  };
}

function createPackageRuntimeReportAction({ action, checkSummary }) {
  return function packageRuntimeReportAction(context) {
    const sourceAuthorityRuntimeProof = replaySourceAuthorityRuntime(context, action);
    const replayPassed =
      sourceAuthorityRuntimeProof.status === 'source_authority_runtime_replayed' &&
      sourceAuthorityRuntimeProof.exitCode === 0;
    const report = {
      reportType: reportTypeFor(action),
      generatedAt: new Date().toISOString(),
      action,
      cwd: context.cwd,
      mode: 'package_runtime_module',
      supportedConsumerInvocation: `bmad-speckit main-agent ${action}`,
      consumerRuntimeProof: {
        usedRootScript: false,
        usedCompiledFallback: false,
        usedTypeScriptRunner: false,
      },
      sourceAuthorityRuntimeProof,
      checks: [
        {
          id: 'package-source-authority-runtime-replay',
          passed: replayPassed,
          summary: checkSummary,
        },
      ],
    };
    return {
      report,
      reportPath: maybeWriteReport(context, action, report),
      status: replayPassed ? 'package_runtime_ready' : 'source_authority_runtime_failed',
      exitCode: replayPassed ? 0 : sourceAuthorityRuntimeProof.exitCode || 1,
      errors: replayPassed
        ? []
        : [
            {
              code: 'source_authority_runtime_failed',
              message:
                sourceAuthorityRuntimeProof.stderr ||
                sourceAuthorityRuntimeProof.stdout ||
                `source-authority runtime failed for ${action}`,
            },
          ],
    };
  };
}

module.exports = {
  createPackageRuntimeReportAction,
};
