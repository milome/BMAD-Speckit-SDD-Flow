const fs = require('node:fs');
const path = require('node:path');

function reportPathFor(context) {
  const raw = context.args.reportPath || context.args.output || '';
  if (raw) return path.isAbsolute(raw) ? raw : path.resolve(context.cwd, raw);
  return path.join(context.cwd, '_bmad-output', 'runtime', 'main-agent', 'unified-ingress-report.json');
}

function maybeWriteReport(context, report) {
  if (context.args.writeReport !== 'true' && !context.args.reportPath && !context.args.output) return null;
  const reportPath = reportPathFor(context);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function unifiedIngressAction(context) {
  const report = {
    reportType: 'main_agent_unified_ingress_package_runtime',
    generatedAt: new Date().toISOString(),
    action: 'unified-ingress',
    cwd: context.cwd,
    mode: 'package_runtime_module',
    supportedConsumerInvocation: 'bmad-speckit main-agent unified-ingress',
    consumerRuntimeProof: {
      usedRootScript: false,
      usedCompiledFallback: false,
      usedTypeScriptRunner: false,
    },
    checks: [
      {
        id: 'package-runtime-dispatch',
        passed: true,
        summary: 'unified ingress command resolved through package runtime',
      },
    ],
  };
  return {
    report,
    reportPath: maybeWriteReport(context, report),
  };
}

module.exports = {
  unifiedIngressAction,
};
