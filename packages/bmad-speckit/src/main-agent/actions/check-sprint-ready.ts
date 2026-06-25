const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runCheckSprintReady = createPackageRuntimeReportAction({
  action: "check-sprint-ready",
  checkSummary: "Check Sprint Ready resolved through package runtime",
});

module.exports = {
  runCheckSprintReady,
};
