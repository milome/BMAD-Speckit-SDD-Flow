const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-field-meta-types",
  purpose: "I18n Field Meta Types package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-field-meta-types.ts"],
});

module.exports = {
  moduleExports,
};
