const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const e2eDualHostJourneyRunnerAction = createPackageRuntimeReportAction({
  action: 'e2e-dual-host-journey-runner',
  checkSummary: 'e2e dual host journey runner command resolved through package runtime',
});

module.exports = {
  e2eDualHostJourneyRunnerAction,
};
