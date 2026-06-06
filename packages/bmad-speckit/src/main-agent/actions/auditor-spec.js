const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const auditorSpecAction = createPackageRuntimeReportAction({
  action: 'auditor-spec',
  checkSummary: 'auditor spec command resolved through package runtime',
});

module.exports = {
  auditorSpecAction,
};
