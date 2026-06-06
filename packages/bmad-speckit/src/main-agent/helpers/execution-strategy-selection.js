const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "execution-strategy-selection",
  purpose: "Execution Strategy Selection package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/execution-strategy-selection.js"],
});

module.exports = {
  moduleExports,
};
