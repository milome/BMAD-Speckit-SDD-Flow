const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const e2eHostMatrixJourneyRunnerAction = createPackageRuntimeReportAction({
  action: 'e2e-host-matrix-journey-runner',
  checkSummary: 'e2e host matrix journey runner command resolved through package runtime',
});

module.exports = {
  e2eHostMatrixJourneyRunnerAction,
};
