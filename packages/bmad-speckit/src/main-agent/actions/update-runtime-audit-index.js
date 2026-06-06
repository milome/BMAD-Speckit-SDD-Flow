const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const updateRuntimeAuditIndexAction = createPackageRuntimeReportAction({
  action: 'update-runtime-audit-index',
  checkSummary: 'update runtime audit index command resolved through package runtime',
});

module.exports = {
  updateRuntimeAuditIndexAction,
};
