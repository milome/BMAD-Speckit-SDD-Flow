const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runAssertImplementationEntry = createPackageRuntimeReportAction({
  action: "assert-implementation-entry",
  checkSummary: "Assert Implementation Entry resolved through package runtime",
});

module.exports = {
  runAssertImplementationEntry,
};
