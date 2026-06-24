const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const renderAuditBlockCliAction = createPackageRuntimeReportAction({
  action: 'render-audit-block-cli',
  checkSummary: 'render audit block cli command resolved through package runtime',
});

module.exports = {
  renderAuditBlockCliAction,
};
