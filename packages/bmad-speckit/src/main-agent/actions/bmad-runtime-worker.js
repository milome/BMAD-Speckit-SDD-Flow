const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const bmadRuntimeWorkerAction = createPackageRuntimeReportAction({
  action: 'bmad-runtime-worker',
  checkSummary: 'bmad runtime worker command resolved through package runtime',
});

module.exports = {
  bmadRuntimeWorkerAction,
};
