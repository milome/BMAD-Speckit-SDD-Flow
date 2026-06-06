const fs = require('node:fs');
const path = require('node:path');

function reportPathFor(context) {
  const raw = context.args.reportPath || context.args.output || '';
  if (raw) return path.isAbsolute(raw) ? raw : path.resolve(context.cwd, raw);
  return path.join(
    context.cwd,
    '_bmad-output',
    'runtime',
    'main-agent',
    'implementation-readiness-gate-report.json'
  );
}

function maybeWriteReport(context, report) {
  if (context.args.writeReport !== 'true' && !context.args.reportPath && !context.args.output) return null;
  const reportPath = reportPathFor(context);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function implementationReadinessGateAction(context) {
  const report = {
    reportType: 'main_agent_implementation_readiness_gate_package_runtime',
    generatedAt: new Date().toISOString(),
    action: 'implementation-readiness-gate',
    cwd: context.cwd,
    mode: 'package_runtime_module',
    supportedConsumerInvocation: 'bmad-speckit main-agent implementation-readiness-gate',
    consumerRuntimeProof: {
      usedRootScript: false,
      usedCompiledFallback: false,
      usedTypeScriptRunner: false,
    },
    checks: [
      {
        id: 'package-runtime-dispatch',
        passed: true,
        summary: 'implementation readiness gate command resolved through package runtime',
      },
    ],
  };
  return {
    report,
    reportPath: maybeWriteReport(context, report),
  };
}

module.exports = {
  implementationReadinessGateAction,
};
