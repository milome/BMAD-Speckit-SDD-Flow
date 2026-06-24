const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-resolve-for-session-cli",
  purpose: "I18n Resolve For Session Cli package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-resolve-for-session-cli.ts"],
});

module.exports = {
  moduleExports,
};
