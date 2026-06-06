const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runModelGovernanceHintResolver = createPackageRuntimeReportAction({
  action: "model-governance-hint-resolver",
  checkSummary: "Model Governance Hint Resolver resolved through package runtime",
});

module.exports = {
  runModelGovernanceHintResolver,
};
