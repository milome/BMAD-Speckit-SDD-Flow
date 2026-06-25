const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const orchestrationDispatchContractAction = createPackageRuntimeReportAction({
  action: 'orchestration-dispatch-contract',
  checkSummary: 'orchestration dispatch contract command resolved through package runtime',
});

module.exports = {
  orchestrationDispatchContractAction,
};
