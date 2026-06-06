const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const trace040EvidencePacketGeneratorAction = createPackageRuntimeReportAction({
  action: 'trace-040-evidence-packet-generator',
  checkSummary: 'trace 040 evidence packet generator command resolved through package runtime',
});

module.exports = {
  trace040EvidencePacketGeneratorAction,
};
