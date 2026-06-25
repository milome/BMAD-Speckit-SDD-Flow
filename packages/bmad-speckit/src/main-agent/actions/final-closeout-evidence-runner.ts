const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const finalCloseoutEvidenceRunnerAction = createPackageRuntimeReportAction({
  action: 'final-closeout-evidence-runner',
  checkSummary: 'final closeout evidence runner command resolved through package runtime',
});

module.exports = {
  finalCloseoutEvidenceRunnerAction,
};
