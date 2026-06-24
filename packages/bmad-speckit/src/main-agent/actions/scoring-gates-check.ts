const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const scoringGatesCheckAction = createPackageRuntimeReportAction({
  action: 'scoring-gates-check',
  checkSummary: 'scoring gates check command resolved through package runtime',
});

module.exports = {
  scoringGatesCheckAction,
};
