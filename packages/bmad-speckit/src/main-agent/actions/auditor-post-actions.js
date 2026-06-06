const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const auditorPostActionsAction = createPackageRuntimeReportAction({
  action: 'auditor-post-actions',
  checkSummary: 'auditor post actions command resolved through package runtime',
});

module.exports = {
  auditorPostActionsAction,
};
