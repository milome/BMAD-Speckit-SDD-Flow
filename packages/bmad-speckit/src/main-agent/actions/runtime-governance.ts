const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runRuntimeGovernance = createPackageRuntimeReportAction({
  action: "runtime-governance",
  checkSummary: "Runtime Governance resolved through package runtime",
});

module.exports = {
  runRuntimeGovernance,
};
