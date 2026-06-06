const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runGovernanceExecutionResultIngestor = createPackageRuntimeReportAction({
  action: "governance-execution-result-ingestor",
  checkSummary: "Governance Execution Result Ingestor resolved through package runtime",
});

module.exports = {
  runGovernanceExecutionResultIngestor,
};
