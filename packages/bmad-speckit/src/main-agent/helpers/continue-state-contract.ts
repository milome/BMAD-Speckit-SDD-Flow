const { createDurableHelperDescriptor } = require('./durable-helper-report');

const moduleExports = createDurableHelperDescriptor({
  helperId: "continue-state-contract",
  purpose: "Continue State Contract package helper surface",
  ownedFiles: ["packages/bmad-speckit/src/main-agent/helpers/continue-state-contract.ts"],
});

module.exports = {
  moduleExports,
};
