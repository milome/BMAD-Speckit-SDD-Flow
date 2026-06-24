const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const auditStageRoutingAction = createPackageRuntimeReportAction({
  action: 'audit-stage-routing',
  checkSummary: 'audit stage routing command resolved through package runtime',
});

module.exports = {
  auditStageRoutingAction,
};
