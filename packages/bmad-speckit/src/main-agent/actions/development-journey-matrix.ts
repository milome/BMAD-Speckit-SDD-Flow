const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const developmentJourneyMatrixAction = createPackageRuntimeReportAction({
  action: 'development-journey-matrix',
  checkSummary: 'development journey matrix command resolved through package runtime',
});

module.exports = {
  developmentJourneyMatrixAction,
};
