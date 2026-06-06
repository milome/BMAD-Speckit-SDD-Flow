const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "facilitator-registry",
  purpose: "Facilitator Registry package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/facilitator-registry.js"],
});

module.exports = {
  moduleExports,
};
