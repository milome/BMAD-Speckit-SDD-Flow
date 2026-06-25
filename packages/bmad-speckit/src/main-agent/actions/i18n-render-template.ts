const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const runRenderTemplate = createPackageRuntimeReportAction({
  action: "i18n-render-template",
  checkSummary: "I18n Render Template resolved through package runtime",
});

module.exports = {
  runRenderTemplate,
};
