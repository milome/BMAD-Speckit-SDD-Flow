const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const requirementRecordControlStoreAction = createPackageRuntimeReportAction({
  action: 'requirement-record-control-store',
  checkSummary: 'requirement record control store command resolved through package runtime',
});

module.exports = {
  requirementRecordControlStoreAction,
};
