const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "execution-intent-schema",
  purpose: "Execution Intent Schema package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/execution-intent-schema.js"],
});

module.exports = {
  moduleExports,
};
