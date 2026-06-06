const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runGovernanceProviderAdapter = createPackageRuntimeReportAction({
  action: "governance-provider-adapter",
  checkSummary: "Governance Provider Adapter resolved through package runtime",
});

module.exports = {
  runGovernanceProviderAdapter,
};
