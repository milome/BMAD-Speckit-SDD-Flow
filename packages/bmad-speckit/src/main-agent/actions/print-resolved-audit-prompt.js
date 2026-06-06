const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const printResolvedAuditPromptAction = createPackageRuntimeReportAction({
  action: 'print-resolved-audit-prompt',
  checkSummary: 'print resolved audit prompt command resolved through package runtime',
});

module.exports = {
  printResolvedAuditPromptAction,
};
