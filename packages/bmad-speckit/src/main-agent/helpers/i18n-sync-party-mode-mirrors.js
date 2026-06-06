const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-sync-party-mode-mirrors",
  purpose: "I18n Sync Party Mode Mirrors package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-sync-party-mode-mirrors.js"],
});

module.exports = {
  moduleExports,
};
