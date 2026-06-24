const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const perMustClosureEvidenceIndexAction = createPackageRuntimeReportAction({
  action: 'per-must-closure-evidence-index',
  checkSummary: 'per must closure evidence index command resolved through package runtime',
});

module.exports = {
  perMustClosureEvidenceIndexAction,
};
