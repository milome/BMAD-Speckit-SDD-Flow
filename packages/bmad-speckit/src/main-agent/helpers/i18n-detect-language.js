const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-detect-language",
  purpose: "I18n Detect Language package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-detect-language.js"],
});

module.exports = {
  moduleExports,
};
