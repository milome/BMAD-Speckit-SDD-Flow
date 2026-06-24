const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const liveSmokeMainAgentRuntimeAction = createPackageRuntimeReportAction({
  action: 'live-smoke-main-agent-runtime',
  checkSummary: 'live smoke main agent runtime command resolved through package runtime',
});

module.exports = {
  liveSmokeMainAgentRuntimeAction,
};
