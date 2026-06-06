const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const orchestrationGovernanceContractAction = createPackageRuntimeReportAction({
  action: 'orchestration-governance-contract',
  checkSummary: 'orchestration governance contract command resolved through package runtime',
});

module.exports = {
  orchestrationGovernanceContractAction,
};
