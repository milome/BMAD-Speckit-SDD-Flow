const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const traceStatusPolicyCheckAction = createPackageRuntimeReportAction({
  action: 'trace-status-policy-check',
  checkSummary: 'trace status policy check command resolved through package runtime',
});

module.exports = {
  traceStatusPolicyCheckAction,
};
