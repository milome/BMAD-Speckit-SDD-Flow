const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const targetArtifactRealizationGateAction = createPackageRuntimeReportAction({
  action: 'target-artifact-realization-gate',
  checkSummary: 'target artifact realization gate command resolved through package runtime',
});

module.exports = {
  targetArtifactRealizationGateAction,
};
