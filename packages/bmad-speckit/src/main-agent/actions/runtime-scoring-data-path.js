const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runtimeScoringDataPathAction = createPackageRuntimeReportAction({
  action: 'runtime-scoring-data-path',
  checkSummary: 'runtime scoring data path command resolved through package runtime',
});

module.exports = {
  runtimeScoringDataPathAction,
};
