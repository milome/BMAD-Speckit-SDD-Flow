const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-language-policy",
  purpose: "I18n Language Policy package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-language-policy.ts"],
});

module.exports = {
  moduleExports,
};
