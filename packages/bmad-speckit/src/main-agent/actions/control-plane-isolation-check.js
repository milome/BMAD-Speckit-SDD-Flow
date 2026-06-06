const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const controlPlaneIsolationCheckAction = createPackageRuntimeReportAction({
  action: 'control-plane-isolation-check',
  checkSummary: 'control plane isolation check command resolved through package runtime',
});

module.exports = {
  controlPlaneIsolationCheckAction,
};
