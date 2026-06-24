const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const verifyCursorAuditGranularityAction = createPackageRuntimeReportAction({
  action: 'verify-cursor-audit-granularity',
  checkSummary: 'verify cursor audit granularity command resolved through package runtime',
});

module.exports = {
  verifyCursorAuditGranularityAction,
};
