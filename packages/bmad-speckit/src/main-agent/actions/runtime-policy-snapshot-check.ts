const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runtimePolicySnapshotCheckAction = createPackageRuntimeReportAction({
  action: 'runtime-policy-snapshot-check',
  checkSummary: 'runtime policy snapshot check command resolved through package runtime',
});

module.exports = {
  runtimePolicySnapshotCheckAction,
};
