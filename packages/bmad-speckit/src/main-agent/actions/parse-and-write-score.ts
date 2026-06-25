const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runParseAndWriteScore = createPackageRuntimeReportAction({
  action: "parse-and-write-score",
  checkSummary: "Parse And Write Score resolved through package runtime",
});

module.exports = {
  runParseAndWriteScore,
};
