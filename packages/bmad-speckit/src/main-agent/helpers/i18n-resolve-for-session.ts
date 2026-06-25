const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-resolve-for-session",
  purpose: "I18n Resolve For Session package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-resolve-for-session.ts"],
});

module.exports = {
  moduleExports,
};
