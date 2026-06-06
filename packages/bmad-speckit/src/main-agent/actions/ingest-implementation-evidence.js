const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const ingestImplementationEvidenceAction = createPackageRuntimeReportAction({
  action: 'ingest-implementation-evidence',
  checkSummary: 'ingest implementation evidence command resolved through package runtime',
});

module.exports = {
  ingestImplementationEvidenceAction,
};
