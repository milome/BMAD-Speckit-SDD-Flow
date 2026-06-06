const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runGovernanceHookTypes = createPackageRuntimeReportAction({
  action: "governance-hook-types",
  checkSummary: "Governance Hook Types resolved through package runtime",
});

module.exports = {
  runGovernanceHookTypes,
};
