const fs = require('node:fs');
const path = require('node:path');

function resolveOutputPath(context) {
  const raw = context.args.reportPath || context.args.output || '';
  if (!raw) {
    return path.join(context.cwd, '_bmad-output', 'runtime', 'gates', 'main-agent-release-gate-report.json');
  }
  return path.isAbsolute(raw) ? raw : path.resolve(context.cwd, raw);
}

function maybeWriteReport(context, report) {
  if (context.args.writeReport !== 'true' && !context.args.reportPath && !context.args.output) {
    return null;
  }
  const reportPath = resolveOutputPath(context);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function releaseGateAction(context) {
  const report = {
    reportType: 'main_agent_release_gate_package_runtime',
    generatedAt: new Date().toISOString(),
    gate: 'main-agent-release-gate',
    completionAllowed: false,
    criticalFailures: 0,
    mode: 'package_runtime_module',
    checks: [
      {
        id: 'package-runtime-dispatch',
        passed: true,
        summary: 'release gate command resolved through package runtime',
      },
    ],
  };
  const reportPath = maybeWriteReport(context, report);
  return {
    report,
    reportPath,
  };
}

module.exports = {
  releaseGateAction,
};
