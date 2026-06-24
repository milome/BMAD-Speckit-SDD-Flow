const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const resolveActiveRequirementAction = createPackageRuntimeReportAction({
  action: 'resolve-active-requirement',
  checkSummary: 'resolve active requirement command resolved through package runtime',
});

module.exports = {
  resolveActiveRequirementAction,
};
