const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runVerifyHooksNoTsNode = createPackageRuntimeReportAction({
  action: "verify-hooks-no-ts-node",
  checkSummary: "Verify Hooks No Ts Node resolved through package runtime",
});

module.exports = {
  runVerifyHooksNoTsNode,
};
