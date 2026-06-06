const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-agent-manifest",
  purpose: "I18n Agent Manifest package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-agent-manifest.js"],
});

module.exports = {
  moduleExports,
};
