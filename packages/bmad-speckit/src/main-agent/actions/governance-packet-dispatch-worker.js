const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const governancePacketDispatchWorkerAction = createPackageRuntimeReportAction({
  action: 'governance-packet-dispatch-worker',
  checkSummary: 'governance packet dispatch worker command resolved through package runtime',
});

module.exports = {
  governancePacketDispatchWorkerAction,
};
