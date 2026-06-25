const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const recordMainAgentInspectReadinessClosureAction = createPackageRuntimeReportAction({
  action: 'record-main-agent-inspect-readiness-closure',
  checkSummary: 'record main agent inspect readiness closure command resolved through package runtime',
});

module.exports = {
  recordMainAgentInspectReadinessClosureAction,
};
