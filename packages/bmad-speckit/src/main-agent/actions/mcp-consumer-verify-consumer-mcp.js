const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runVerifyConsumerMcp = createPackageRuntimeReportAction({
  action: "mcp-consumer-verify-consumer-mcp",
  checkSummary: "Mcp Consumer Verify Consumer Mcp resolved through package runtime",
});

module.exports = {
  runVerifyConsumerMcp,
};
