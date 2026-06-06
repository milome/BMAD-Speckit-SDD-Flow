const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const executionClosureGateAction = createPackageRuntimeReportAction({
  action: 'execution-closure-gate',
  checkSummary: 'execution closure gate command resolved through package runtime',
});

module.exports = {
  executionClosureGateAction,
};
