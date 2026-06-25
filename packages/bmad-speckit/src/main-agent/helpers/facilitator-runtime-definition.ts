const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "facilitator-runtime-definition",
  purpose: "Facilitator Runtime Definition package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/facilitator-runtime-definition.ts"],
});

module.exports = {
  moduleExports,
};
