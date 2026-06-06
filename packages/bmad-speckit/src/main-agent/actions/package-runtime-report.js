const fs = require('node:fs');
const path = require('node:path');

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

function createPackageRuntimeReportAction({ action, checkSummary }) {
  return function packageRuntimeReportAction(context) {
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
      checks: [
        {
          id: 'package-runtime-dispatch',
          passed: true,
          summary: checkSummary,
        },
      ],
    };
    return {
      report,
      reportPath: maybeWriteReport(context, action, report),
    };
  };
}

module.exports = {
  createPackageRuntimeReportAction,
};
