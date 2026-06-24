const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-protected-token-check",
  purpose: "I18n Protected Token Check package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-protected-token-check.ts"],
});

module.exports = {
  moduleExports,
};
