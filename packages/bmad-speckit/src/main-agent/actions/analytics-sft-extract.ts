const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runAnalyticsSftExtract = createPackageRuntimeReportAction({
  action: "analytics-sft-extract",
  checkSummary: "Analytics Sft Extract resolved through package runtime",
});

module.exports = {
  runAnalyticsSftExtract,
};
