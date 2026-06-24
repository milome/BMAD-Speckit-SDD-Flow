const fs = require('node:fs');
const path = require('node:path');

function resolveOutputPath(context) {
  const raw = context.args.reportPath || context.args.output || '';
  if (!raw) {
    return path.join(
      context.cwd,
      '_bmad-output',
      'runtime',
      'gates',
      'main-agent-delivery-truth-gate-report.json'
    );
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

function deliveryTruthGateAction(context) {
  const report = {
    reportType: 'main_agent_delivery_truth_gate_package_runtime',
    generatedAt: new Date().toISOString(),
    completionAllowed: false,
    deliveryStatus: 'partial',
    completionLanguage: 'partial_only',
    mode: 'package_runtime_module',
    checks: [
      {
        id: 'package-runtime-dispatch',
        passed: true,
        summary: 'delivery truth gate command resolved through package runtime',
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
  deliveryTruthGateAction,
};
