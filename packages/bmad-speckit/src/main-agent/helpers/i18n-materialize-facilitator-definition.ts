const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "i18n-materialize-facilitator-definition",
  purpose: "I18n Materialize Facilitator Definition package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/i18n-materialize-facilitator-definition.ts"],
});

module.exports = {
  moduleExports,
};
