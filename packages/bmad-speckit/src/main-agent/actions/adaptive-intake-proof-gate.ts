const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const adaptiveIntakeProofGateAction = createPackageRuntimeReportAction({
  action: 'adaptive-intake-proof-gate',
  checkSummary: 'adaptive intake proof gate command resolved through package runtime',
});

module.exports = {
  adaptiveIntakeProofGateAction,
};
