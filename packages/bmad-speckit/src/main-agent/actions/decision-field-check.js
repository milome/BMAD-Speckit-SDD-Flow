const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const decisionFieldCheckAction = createPackageRuntimeReportAction({
  action: 'decision-field-check',
  checkSummary: 'decision field check command resolved through package runtime',
});

module.exports = {
  decisionFieldCheckAction,
};
