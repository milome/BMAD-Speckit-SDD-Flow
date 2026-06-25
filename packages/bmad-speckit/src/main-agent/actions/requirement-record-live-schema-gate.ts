const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const requirementRecordLiveSchemaGateAction = createPackageRuntimeReportAction({
  action: 'requirement-record-live-schema-gate',
  checkSummary: 'requirement record live schema gate command resolved through package runtime',
});

module.exports = {
  requirementRecordLiveSchemaGateAction,
};
