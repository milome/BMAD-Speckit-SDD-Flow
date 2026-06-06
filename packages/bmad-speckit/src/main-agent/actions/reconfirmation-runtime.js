const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const reconfirmationRuntimeAction = createPackageRuntimeReportAction({
  action: 'reconfirmation-runtime',
  checkSummary: 'reconfirmation runtime command resolved through package runtime',
});

module.exports = {
  reconfirmationRuntimeAction,
};
