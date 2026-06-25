const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runBmadConfig = createPackageRuntimeReportAction({
  action: "bmad-config",
  checkSummary: "Bmad Config resolved through package runtime",
});

module.exports = {
  runBmadConfig,
};
