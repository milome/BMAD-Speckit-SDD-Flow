const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runGovernanceStageEventEmitter = createPackageRuntimeReportAction({
  action: "governance-stage-event-emitter",
  checkSummary: "Governance Stage Event Emitter resolved through package runtime",
});

module.exports = {
  runGovernanceStageEventEmitter,
};
