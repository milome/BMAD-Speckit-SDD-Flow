const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const sixModelRuntimeDecisionAction = createPackageRuntimeReportAction({
  action: 'six-model-runtime-decision',
  checkSummary: 'six model runtime decision command resolved through package runtime',
});

module.exports = {
  sixModelRuntimeDecisionAction,
};
