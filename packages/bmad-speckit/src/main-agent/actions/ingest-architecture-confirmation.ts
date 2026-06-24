const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runIngestArchitectureConfirmation = createPackageRuntimeReportAction({
  action: "ingest-architecture-confirmation",
  checkSummary: "Ingest Architecture Confirmation resolved through package runtime",
});

module.exports = {
  runIngestArchitectureConfirmation,
};
