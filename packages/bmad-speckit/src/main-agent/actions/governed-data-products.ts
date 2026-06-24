const { createPackageRuntimeReportAction } = require('./package-runtime-report');

const governedDataProductsAction = createPackageRuntimeReportAction({
  action: 'governed-data-products',
  checkSummary: 'governed data products command resolved through package runtime',
});

module.exports = {
  governedDataProductsAction,
};
