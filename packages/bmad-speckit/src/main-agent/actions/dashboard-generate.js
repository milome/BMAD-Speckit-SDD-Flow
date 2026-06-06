const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runDashboardGenerate = createPackageRuntimeReportAction({
  action: "dashboard-generate",
  checkSummary: "Dashboard Generate resolved through package runtime",
});

module.exports = {
  runDashboardGenerate,
};
