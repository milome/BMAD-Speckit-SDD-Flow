const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const auditReviewGateAction = createPackageRuntimeReportAction({
  action: 'audit-review-gate',
  checkSummary: 'audit review gate command resolved through package runtime',
});

module.exports = {
  auditReviewGateAction,
};
