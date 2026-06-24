const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const functionalResumeCheckAction = createPackageRuntimeReportAction({
  action: 'functional-resume-check',
  checkSummary: 'functional resume check command resolved through package runtime',
});

module.exports = {
  functionalResumeCheckAction,
};
