const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runWriteRuntimePolicySnapshotAndRecoveryContext = createPackageRuntimeReportAction({
  action: "write-runtime-policy-snapshot-and-recovery-context",
  checkSummary: "Write Runtime Policy Snapshot And Recovery Context resolved through package runtime",
});

module.exports = {
  runWriteRuntimePolicySnapshotAndRecoveryContext,
};
