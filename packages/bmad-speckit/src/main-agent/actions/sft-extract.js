const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runSftExtract = createPackageRuntimeReportAction({
  action: "sft-extract",
  checkSummary: "Sft Extract resolved through package runtime",
});

module.exports = {
  runSftExtract,
};
