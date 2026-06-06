const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const datasetReleaseGateAction = createPackageRuntimeReportAction({
  action: 'dataset-release-gate',
  checkSummary: 'dataset release gate command resolved through package runtime',
});

module.exports = {
  datasetReleaseGateAction,
};
