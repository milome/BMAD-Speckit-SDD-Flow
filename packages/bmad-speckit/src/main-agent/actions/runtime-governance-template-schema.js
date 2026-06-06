const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runRuntimeGovernanceTemplateSchema = createPackageRuntimeReportAction({
  action: "runtime-governance-template-schema",
  checkSummary: "Runtime Governance Template Schema resolved through package runtime",
});

module.exports = {
  runRuntimeGovernanceTemplateSchema,
};
