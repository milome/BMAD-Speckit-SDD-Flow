const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const bmadArtifactHardcutAction = createPackageRuntimeReportAction({
  action: 'bmad-artifact-hardcut',
  checkSummary: 'bmad artifact hardcut command resolved through package runtime',
});

module.exports = {
  bmadArtifactHardcutAction,
};
