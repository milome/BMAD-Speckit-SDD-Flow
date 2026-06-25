const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const entryflowTraceabilityCheckAction = createPackageRuntimeReportAction({
  action: 'entryflow-traceability-check',
  checkSummary: 'entryflow traceability check command resolved through package runtime',
});

module.exports = {
  entryflowTraceabilityCheckAction,
};
