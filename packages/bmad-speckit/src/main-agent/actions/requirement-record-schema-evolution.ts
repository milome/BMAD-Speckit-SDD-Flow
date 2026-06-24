const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const requirementRecordSchemaEvolutionAction = createPackageRuntimeReportAction({
  action: 'requirement-record-schema-evolution',
  checkSummary: 'requirement record schema evolution command resolved through package runtime',
});

module.exports = {
  requirementRecordSchemaEvolutionAction,
};
