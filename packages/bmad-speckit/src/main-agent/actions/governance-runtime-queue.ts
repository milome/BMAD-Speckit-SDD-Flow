const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runGovernanceRuntimeQueue = createPackageRuntimeReportAction({
  action: "governance-runtime-queue",
  checkSummary: "Governance Runtime Queue resolved through package runtime",
});

module.exports = {
  runGovernanceRuntimeQueue,
};
