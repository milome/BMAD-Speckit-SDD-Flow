const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const skillOrchestrationAuditAction = createPackageRuntimeReportAction({
  action: 'skill-orchestration-audit',
  checkSummary: 'skill orchestration audit command resolved through package runtime',
});

module.exports = {
  skillOrchestrationAuditAction,
};
