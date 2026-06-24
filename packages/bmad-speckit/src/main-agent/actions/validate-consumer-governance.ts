const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runValidateConsumerGovernance = createPackageRuntimeReportAction({
  action: "validate-consumer-governance",
  checkSummary: "Validate Consumer Governance resolved through package runtime",
});

module.exports = {
  runValidateConsumerGovernance,
};
