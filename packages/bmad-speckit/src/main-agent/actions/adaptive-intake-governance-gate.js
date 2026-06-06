const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const adaptiveIntakeGovernanceGateAction = createPackageRuntimeReportAction({
  action: 'adaptive-intake-governance-gate',
  checkSummary: 'adaptive intake governance gate command resolved through package runtime',
});

module.exports = {
  adaptiveIntakeGovernanceGateAction,
};
