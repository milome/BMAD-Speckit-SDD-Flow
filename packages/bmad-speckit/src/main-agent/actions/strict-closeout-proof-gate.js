const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const strictCloseoutProofGateAction = createPackageRuntimeReportAction({
  action: 'strict-closeout-proof-gate',
  checkSummary: 'strict closeout proof gate command resolved through package runtime',
});

module.exports = {
  strictCloseoutProofGateAction,
};
