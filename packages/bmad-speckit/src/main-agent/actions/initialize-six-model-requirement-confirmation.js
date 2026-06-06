const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const initializeSixModelRequirementConfirmationAction = createPackageRuntimeReportAction({
  action: 'initialize-six-model-requirement-confirmation',
  checkSummary: 'initialize six model requirement confirmation command resolved through package runtime',
});

module.exports = {
  initializeSixModelRequirementConfirmationAction,
};
