const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-resolve-localized-markdown-path",
  purpose: "I18n Resolve Localized Markdown Path package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-resolve-localized-markdown-path.ts"],
});

module.exports = {
  moduleExports,
};
