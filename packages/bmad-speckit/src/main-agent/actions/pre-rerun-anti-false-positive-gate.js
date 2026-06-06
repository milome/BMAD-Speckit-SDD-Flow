const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const preRerunAntiFalsePositiveGateAction = createPackageRuntimeReportAction({
  action: 'pre-rerun-anti-false-positive-gate',
  checkSummary: 'pre rerun anti false positive gate command resolved through package runtime',
});

module.exports = {
  preRerunAntiFalsePositiveGateAction,
};
