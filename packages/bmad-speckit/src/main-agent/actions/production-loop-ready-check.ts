const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const productionLoopReadyCheckAction = createPackageRuntimeReportAction({
  action: 'production-loop-ready-check',
  checkSummary: 'production loop ready check command resolved through package runtime',
});

module.exports = {
  productionLoopReadyCheckAction,
};
