const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-validate-template-manifest",
  purpose: "I18n Validate Template Manifest package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-validate-template-manifest.js"],
});

module.exports = {
  moduleExports,
};
