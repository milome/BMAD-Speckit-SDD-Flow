const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const aiTddContractGateAction = createPackageRuntimeReportAction({
  action: 'ai-tdd-contract-gate',
  checkSummary: 'ai tdd contract gate command resolved through package runtime',
});

module.exports = {
  aiTddContractGateAction,
};
