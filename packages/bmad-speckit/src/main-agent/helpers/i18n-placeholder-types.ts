const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-placeholder-types",
  purpose: "I18n Placeholder Types package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-placeholder-types.ts"],
});

module.exports = {
  moduleExports,
};
