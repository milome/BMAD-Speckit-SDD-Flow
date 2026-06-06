const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-render-field-view",
  purpose: "I18n Render Field View package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-render-field-view.js"],
});

module.exports = {
  moduleExports,
};
