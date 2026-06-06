const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const orchestrationStateAction = createPackageRuntimeReportAction({
  action: 'orchestration-state',
  checkSummary: 'orchestration state command resolved through package runtime',
});

module.exports = {
  orchestrationStateAction,
};
