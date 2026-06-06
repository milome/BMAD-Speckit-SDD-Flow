const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const dataGovernanceGateAction = createPackageRuntimeReportAction({
  action: 'data-governance-gate',
  checkSummary: 'data governance gate command resolved through package runtime',
});

module.exports = {
  dataGovernanceGateAction,
};
