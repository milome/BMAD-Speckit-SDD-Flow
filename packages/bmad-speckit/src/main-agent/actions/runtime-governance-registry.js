const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runRuntimeGovernanceRegistry = createPackageRuntimeReportAction({
  action: "runtime-governance-registry",
  checkSummary: "Runtime Governance Registry resolved through package runtime",
});

module.exports = {
  runRuntimeGovernanceRegistry,
};
