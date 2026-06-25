const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runInstallConsumerMcp = createPackageRuntimeReportAction({
  action: "mcp-consumer-install-consumer-mcp",
  checkSummary: "Mcp Consumer Install Consumer Mcp resolved through package runtime",
});

module.exports = {
  runInstallConsumerMcp,
};
