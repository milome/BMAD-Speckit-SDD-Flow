const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const aiTddCloseoutRemediationAdapterAction = createPackageRuntimeReportAction({
  action: 'ai-tdd-closeout-remediation-adapter',
  checkSummary: 'ai tdd closeout remediation adapter command resolved through package runtime',
});

module.exports = {
  aiTddCloseoutRemediationAdapterAction,
};
